// Every i18n key the management and enquiries areas use exists in English and Indonesian (static keys found in the source,
// plus the families of keys built from data such as stage, relation or allergy names).
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { en, id } from '../i18n';
import { ALL_RELATIONS, DIETS, DRUGS, ENQ_SOURCES, FOODS, LOST_REASONS, MOBILITIES, TIMINGS } from './enquiries';
import { AUDIENCES, CONTRACTS, HR_NOTE_KINDS, TIME_KINDS } from './mgmt';

const root = resolve(__dirname, '../../../..');
const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = [
  ...walk(join(root, 'apps/web/src/features/mgmt')), ...walk(join(root, 'apps/web/src/features/enquiries')),
  join(root, 'packages/shared/src/actions/enquiries.ts'), join(root, 'packages/shared/src/actions/club.ts'), join(root, 'packages/shared/src/actions/people.ts'),
  join(root, 'packages/shared/src/rules/mgmt.ts'), join(root, 'packages/shared/src/rules/enquiries.ts'),
].filter((f) => /\.(ts|tsx)$/.test(f) && !f.endsWith('.test.ts'));

const ACTIONS = new Set(['form.send', 'form.open', 'form.saveDraft', 'form.submit', 'form.approve', 'form.return', 'form.applyMember']);
const dynamic = (prefix: string, values: readonly (string | number)[]) => values.map((v) => prefix + v);
const FAMILIES = [
  ...dynamic('enq.stage.', ['new', 'visit', 'trial', 'joined', 'lost']), ...dynamic('enq.next.', ['none', 'callBack', 'sendPrices', 'visit', 'trial', 'followUp', 'starts', 'custom']),
  ...dynamic('enq.lost.', LOST_REASONS), ...dynamic('enq.src_', ENQ_SOURCES), ...dynamic('enq.rel_', ALL_RELATIONS),
  ...dynamic('enq.form_', ['sent', 'opened', 'draft', 'ready', 'returned', 'approved']), ...dynamic('enq.feed.moved_', ['new', 'visit', 'trial']),
  ...dynamic('form.food_', FOODS), ...dynamic('form.drug_', DRUGS), ...dynamic('form.mob_', [...MOBILITIES, 'none']), ...dynamic('form.diet_', DIETS), ...dynamic('form.timing_', TIMINGS),
  ...dynamic('form.err.', ['name', 'dob', 'contactName', 'phone', 'nanny', 'nannyName', 'mobility', 'consent', 'signature', 'locked']),
  ...dynamic('mgmt.aud_', AUDIENCES), ...dynamic('mgmt.ph_', ['update', 'closure', 'event', 'custom']), ...dynamic('mgmt.plan_', ['flex', 'gold']), ...dynamic('mgmt.st_', ['sent', 'scheduled', 'cancelled']),
  ...dynamic('mgmt.svq_', ['overall', 'team', 'recommend', 'comment']), ...dynamic('mgmt.tplText_', ['update', 'closure', 'event']), ...dynamic('mgmt.tplTitle_', ['update', 'closure', 'event', 'custom']),
  ...dynamic('mgmt.notif.bc_', ['update', 'closure', 'event', 'custom']),
  ...dynamic('people.contract_', CONTRACTS), ...dynamic('people.nk_', HR_NOTE_KINDS), ...dynamic('people.tab_', ['profile', 'contract', 'pay', 'notes', 'att']), ...dynamic('people.tk_', TIME_KINDS),
  // shared keys the screens reuse from other namespaces
  'common.pendingApproval',
];

describe('i18n coverage for management and enquiries', () => {
  const used = new Set<string>(FAMILIES);
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/['"`]((?:mgmt|people|enq|form)\.[A-Za-z0-9_.]*[A-Za-z0-9])['"`]/g)) if (!ACTIONS.has(m[1])) used.add(m[1]);
  }
  it('finds the keys', () => expect(used.size).toBeGreaterThan(200));
  it('every key exists in English', () => {
    const missing = [...used].filter((k) => !(k in en));
    expect(missing).toEqual([]);
  });
  it('every key exists in Indonesian', () => {
    const missing = [...used].filter((k) => !(k in id));
    expect(missing).toEqual([]);
  });
  it('Indonesian is translated, not copied, for the long sentences', () => {
    const same = Object.keys(en).filter((k) => /^(mgmt|people|enq|form)\./.test(k)).filter((k) => (en as Record<string, string>)[k].length > 40 && (en as Record<string, string>)[k] === (id as Record<string, string>)[k]);
    expect(same).toEqual([]);
  });
  it('every counted text has a singular form ("1 answer", not "1 answers") in both languages', () => {
    const E = en as Record<string, string>, I = id as Record<string, string>;
    const ph = (x: string) => (x.match(/\{\w+\}/g) || []).sort().join(',');
    const counted = new Set<string>();
    for (const f of files) for (const m of readFileSync(f, 'utf8').matchAll(/\btn\(t, '((?:mgmt|people|enq|form)\.[A-Za-z0-9_]+)'/g)) counted.add(m[1]);
    expect(counted.size).toBeGreaterThan(15);
    for (const k of counted) {
      expect(`${k}One` in E, `${k}One (en)`).toBe(true);
      expect(`${k}One` in I, `${k}One (id)`).toBe(true);
      expect(ph(E[`${k}One`]), k).toBe(ph(E[k]));
      expect(ph(I[`${k}One`]), k).toBe(ph(I[k]));
    }
  });
  it('placeholders match between languages', () => {
    const ph = (s: string) => (s.match(/\{\w+\}/g) || []).sort().join(',');
    const bad = Object.keys(en).filter((k) => /^(mgmt|people|enq|form)\./.test(k)).filter((k) => ph((en as Record<string, string>)[k]) !== ph((id as Record<string, string>)[k]) && !/^form\.(s[0-9]|pron|consent|nannyQ|healthTake)/.test(k));
    expect(bad).toEqual([]);
  });
});
