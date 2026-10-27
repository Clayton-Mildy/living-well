// Round 14 (D): the signing rules, the timeline, who may sign and the masked phone.
import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { buildSeed, type Signing } from '../index';
import { SIGN_STATUSES, canSign, formDoc, maskPhone, signTrail, signerOf, signingOf } from './signing';

// the seed sends Oma Lina's form for signing (round 14 D seed); these tests start from a form nobody has sent
const base = produce(buildSeed().citra, (d) => { delete formDoc(d.members.m1)!.signing; });
const step = (status: Signing['status'], at: string, by: Signing['steps'][number]['by'] = 'staff:s1') => ({ status, at, by });

describe('signTrail', () => {
  it('an e-Meterai form lists all five statuses; the reached ones carry when and who, the rest nothing', () => {
    const sig: Signing = { status: 'sent', meterai: 'e', steps: [step('draft', '2026-10-27T09:00'), step('sent', '2026-10-27T09:00')] };
    const t = signTrail(sig);
    expect(t.map((x) => x.status)).toEqual(SIGN_STATUSES);
    expect(t[0]).toEqual({ status: 'draft', at: '2026-10-27T09:00', by: 'staff:s1' });
    expect(t[1]).toEqual({ status: 'sent', at: '2026-10-27T09:00', by: 'staff:s1' });
    for (const x of t.slice(2)) expect(x.at).toBeUndefined();
    for (const x of t.slice(2)) expect(x.by).toBeUndefined();
  });
  it('a resend shows the latest sent step', () => {
    const sig: Signing = { status: 'sent', meterai: 'e', steps: [step('draft', '2026-10-27T09:00'), step('sent', '2026-10-27T09:00'), step('sent', '2026-10-28T10:30', 'staff:s9')] };
    expect(signTrail(sig)[1]).toEqual({ status: 'sent', at: '2026-10-28T10:30', by: 'staff:s9' });
  });
  it('a physical form lists only the steps recorded', () => {
    const sig: Signing = { status: 'stamped', meterai: 'physical', steps: [step('stamped', '2026-10-27T11:00', 'staff:s9')] };
    expect(signTrail(sig)).toEqual([{ status: 'stamped', at: '2026-10-27T11:00', by: 'staff:s9' }]);
  });
});

describe('maskPhone', () => {
  it('keeps the country code and the last four digits', () => {
    expect(maskPhone('+6281210904471')).toBe('+62 ••• 4471');
  });
});

describe('signer', () => {
  it('only the primary (billing) contact may sign; another family contact of the same member may not', () => {
    expect(signerOf(base, 'm1')?.id).toBe('f1');
    expect(canSign(base, 'm1', 'f1')).toBe(true);
    expect(canSign(base, 'm1', 'f2')).toBe(false); // Daniel: linked to m1, not the billing contact
    expect(canSign(base, 'm1', 'nobody')).toBe(false);
  });
  it('formDoc and signingOf read the membership form document', () => {
    expect(formDoc(base.members.m1)?.id).toBe('m1-doc-form');
    expect(signingOf(base.members.m1)).toBeUndefined();
    const s = produce(base, (d) => { d.members.m1.documents.find((x) => x.type === 'membershipForm')!.signing = { status: 'sent', meterai: 'e', steps: [] }; });
    expect(signingOf(s.members.m1)?.status).toBe('sent');
  });
});
