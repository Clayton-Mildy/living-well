// The invoice run's lines for a member: the dementia care fee (round 14, A2) on top of the plan line.
import { describe, it, expect } from 'vitest';
import { buildSeed, priceOn, type ClubState } from '../index';
import { FEE_DEFAULTS, feeOf, runLinesFor } from './billing';

const T = '2026-10-21';
const PERIOD = '2026-11';
const seed = (): ClubState => structuredClone(buildSeed().citra);
const withDementia = (v: boolean | undefined) => {
  const s = seed();
  s.members.m1.registration = { ...s.members.m1.registration, dementia: v };
  return s;
};
const dementiaLine = (s: ClubState) => runLinesFor(s, s.members.m1, PERIOD, T).find((l) => l.kind === 'dementia');

describe('the dementia care fee on the invoice', () => {
  it('is Rp 750.000 by default and a line of its own after the plan line', () => {
    expect(FEE_DEFAULTS.dementia).toBe(750000);
    const s = withDementia(true);
    expect(dementiaLine(s)).toMatchObject({ id: `dementia-${PERIOD}`, kind: 'dementia', label: 'inv.line.dementia', qty: 1, unit: 750000, amount: 750000 });
    const kinds = runLinesFor(s, s.members.m1, PERIOD, T).map((l) => l.kind);
    expect(kinds.indexOf('dementia')).toBe(kinds.indexOf('plan') + 1);
  });
  it('follows the price list when it has a figure', () => {
    const s = withDementia(true);
    const price = priceOn(s, '2026-11-21');
    Object.values(s.prices).forEach((p) => { if (p.id === price.id) p.dementia = 900000; });
    expect(feeOf(priceOn(s, '2026-11-21'), 'dementia')).toBe(900000);
    expect(dementiaLine(s)).toMatchObject({ unit: 900000, amount: 900000 });
  });
  it('is not billed when the answer is no or missing', () => {
    expect(dementiaLine(withDementia(false))).toBeUndefined();
    expect(dementiaLine(withDementia(undefined))).toBeUndefined();
  });
  it('is not billed in a month of leave (the leave fee replaces the plan)', () => {
    const s = withDementia(true);
    const ms = s.members.m1.memberships.at(-1)!;
    ms.leaves = [{ month: PERIOD, at: `${T}T10:00`, by: 'staff:s1' }];
    const lines = runLinesFor(s, s.members.m1, PERIOD, T);
    expect(lines.some((l) => l.label === 'inv.line.leave')).toBe(true);
    expect(lines.some((l) => l.kind === 'dementia')).toBe(false);
  });
});
