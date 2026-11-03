// Terms and conditions: publish (Ega, Benjamin), agree (family), and the server-side rule that a family user's other actions wait for the current version.
import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { allActions, buildSeed, execute, getUser, live, type ClubState, type FamilyLink, type User } from '../index';
import { needsTerms } from '../rules/terms';

const clock = { today: '2026-10-21', nowMin: 600 };
let n = 0;
const T1 = { version: 1, en: '# Terms\n- Notice {noticeDays} days', id: '', publishedAt: '2026-10-01T09:00', publishedBy: 's9' };

/** A club with terms v1; every contact with a username has agreed except Sinta Halim (f_sinta, daughter of Opa Hendra), who has a login and no agreement. */
function world() {
  let s: ClubState = produce(buildSeed().citra, (d) => {
    d.club.settings.terms = [T1];
    for (const c of Object.values(d.familyContacts)) if (c.username) c.termsAgreed = { version: 1, at: '2026-10-02T10:00' };
    d.familyContacts.f_sinta = { id: 'f_sinta', clubId: d.clubId, createdAt: '2026-10-01T09:00', createdBy: 'system', username: 'sinta', name: 'Sinta Halim', firstName: 'Sinta', phone: '+6281200000099', lang: 'en', activatedAt: '2026-10-01T09:00' };
    d.familyLinks['f_sinta:m2'] = { id: 'f_sinta:m2', clubId: d.clubId, createdAt: '2026-10-01T09:00', createdBy: 'system', familyId: 'f_sinta', memberId: 'm2', relation: 'daughter', primary: false, appAccess: true, healthAlerts: true } satisfies FamilyLink;
  });
  const user = (id: string): User => getUser({ [s.clubId]: s }, id)!;
  return {
    get s() { return s; },
    user,
    run(name: string, input: unknown, uid: string) {
      const r = execute(s, name, input, user(uid), clock, `t${++n}`);
      s = r.state;
      return r;
    },
    fail(name: string, input: unknown, uid: string, code: string) {
      expect(() => execute(s, name, input, user(uid), clock, `t${++n}`)).toThrow(code);
    },
  };
}

describe('terms.publish', () => {
  it('Ega publishes version 2: the text, who and when, and every family login is notified', () => {
    const w = world();
    w.run('terms.publish', { en: '# New terms\n- One', id: 'Syarat baru' }, 's9');
    const t = w.s.club.settings.terms!;
    expect(t.map((x) => x.version)).toEqual([1, 2]);
    expect(t[1]).toMatchObject({ version: 2, en: '# New terms\n- One', id: 'Syarat baru', publishedBy: 's9', publishedAt: '2026-10-21T10:00' });
    const told = live(w.s.notifications).filter((x) => x.kind === 'terms.notif.updated');
    const logins = live(w.s.familyContacts).filter((c) => c.username).map((c) => c.id).sort();
    expect(told.flatMap((x) => x.toUsers ?? []).sort()).toEqual(logins);
    expect(told[0]).toMatchObject({ link: '/me?terms=1' });
  });
  it('the first publish is version 1; the owner can publish too; EN is required, 20,000 characters at most', () => {
    const s0 = produce(world().s, (d) => { delete d.club.settings.terms; });
    const first = execute(s0, 'terms.publish', { en: 'First', id: '' }, getUser({ [s0.clubId]: s0 }, 's9')!, clock, 'tp1');
    expect(first.state.club.settings.terms).toHaveLength(1);
    expect(first.state.club.settings.terms![0].version).toBe(1);
    const w = world();
    w.run('terms.publish', { en: 'By the owner', id: '' }, 's11');
    expect(w.s.club.settings.terms!.at(-1)).toMatchObject({ version: 2, publishedBy: 's11' });
    w.fail('terms.publish', { en: '   ', id: '' }, 's9', 'err.invalid');
    w.fail('terms.publish', { en: 'x'.repeat(20001), id: '' }, 's9', 'err.invalid');
    w.run('terms.publish', { en: 'x'.repeat(20000), id: 'y'.repeat(20000) }, 's9');
  });
  it('only management and the owner, never other staff or family', () => {
    const w = world();
    w.fail('terms.publish', { en: 'x', id: '' }, 's1', 'err.forbidden');
    w.fail('terms.publish', { en: 'x', id: '' }, 's10', 'err.forbidden');
    w.fail('terms.publish', { en: 'x', id: '' }, 'f1', 'err.forbidden');
  });
});

describe('the family gate', () => {
  it('after version 2 Maria is "updated": planChange.request is refused, notifications still work, agreeing lets it through', () => {
    const w = world();
    expect(needsTerms(w.s, w.s.familyContacts.f1)).toBeNull();
    const asked = w.run('planChange.request', { memberId: 'm1', to: 'gold' }, 'f1'); // v1 agreed: allowed
    w.run('planChange.withdraw', { requestId: asked.result.requestId }, 'f1');
    w.run('terms.publish', { en: 'Version two', id: '' }, 's9');
    expect(needsTerms(w.s, w.s.familyContacts.f1)).toBe('updated');
    w.fail('planChange.request', { memberId: 'm1', to: 'gold' }, 'f1', 'err.termsFirst');
    w.run('notifications.readAll', {}, 'f1');
    w.run('terms.agree', { version: 2 }, 'f1');
    expect(w.s.familyContacts.f1.termsAgreed).toEqual({ version: 2, at: '2026-10-21T10:00' });
    expect(needsTerms(w.s, w.s.familyContacts.f1)).toBeNull();
    w.run('planChange.request', { memberId: 'm1', to: 'gold' }, 'f1');
  });
  it('a fresh contact is "first": refused until agreeing (Review Focus 1)', () => {
    const w = world();
    expect(needsTerms(w.s, w.s.familyContacts.f_sinta)).toBe('first');
    w.fail('family.setHealthAlerts', { memberId: 'm2', on: false }, 'f_sinta', 'err.termsFirst');
    w.fail('planChange.request', { memberId: 'm2', to: 'gold' }, 'f_sinta', 'err.termsFirst');
    w.run('terms.agree', { version: 1 }, 'f_sinta');
    expect(w.s.familyContacts.f_sinta.termsAgreed).toEqual({ version: 1, at: '2026-10-21T10:00' });
    w.fail('planChange.request', { memberId: 'm2', to: 'gold' }, 'f_sinta', 'err.forbidden'); // now past the gate (Sinta is not the payer)
  });
  it('the gate reads the live contact, not the signed-in snapshot', () => {
    const w = world();
    const stale = w.user('f_sinta'); // taken before she agrees: its contact has no termsAgreed
    w.run('terms.agree', { version: 1 }, 'f_sinta');
    expect(() => execute(w.s, 'planChange.request', { memberId: 'm2', to: 'gold' }, stale, clock, 'stale1')).toThrow('err.forbidden');
  });
  it('only terms.agree, notifications.read, notifications.readAll and account.updateFamily pass the gate', () => {
    const w = world();
    w.run('notifications.read', { ids: [] }, 'f_sinta');
    w.run('notifications.readAll', {}, 'f_sinta');
    w.run('account.updateFamily', { familyId: 'f_sinta', lang: 'id' }, 'f_sinta'); // she can switch language to read the terms
    expect(w.s.familyContacts.f_sinta.lang).toBe('id');
    // every other registered action is refused before it reads its input
    const open = ['terms.agree', 'notifications.read', 'notifications.readAll', 'account.updateFamily'];
    const rest = allActions().map((a) => a.name).filter((x) => !open.includes(x));
    expect(rest.length).toBeGreaterThan(100);
    for (const name of rest) w.fail(name, {}, 'f_sinta', 'err.termsFirst');
  });
  it('no terms at all: no gate. Staff actions are never gated', () => {
    const w = world();
    const s0 = produce(w.s, (d) => { delete d.club.settings.terms; });
    expect(needsTerms(s0, s0.familyContacts.f_sinta)).toBeNull();
    expect(() => execute(s0, 'planChange.request', { memberId: 'm2', to: 'gold' }, getUser({ [s0.clubId]: s0 }, 'f_sinta')!, clock, 'ng1')).toThrow('err.forbidden'); // past the gate (Sinta is not the payer)
    // staff are never gated: Ega acts while every family contact waits
    const w2 = world();
    w2.run('terms.publish', { en: 'Version two', id: '' }, 's9');
    w2.run('terms.publish', { en: 'Version three', id: '' }, 's9');
  });
});

describe('terms.agree', () => {
  it('the version must be the current one', () => {
    const w = world();
    w.run('terms.publish', { en: 'Version two', id: '' }, 's9');
    w.fail('terms.agree', { version: 1 }, 'f1', 'err.invalid');
    w.fail('terms.agree', { version: 3 }, 'f1', 'err.invalid');
    w.fail('terms.agree', { version: 'two' }, 'f1', 'err.invalid');
    w.run('terms.agree', { version: 2 }, 'f1');
  });
  it('is for family only, and needs published terms', () => {
    const w = world();
    w.fail('terms.agree', { version: 1 }, 's9', 'err.forbidden');
    const s0 = produce(w.s, (d) => { delete d.club.settings.terms; });
    expect(() => execute(s0, 'terms.agree', { version: 1 }, getUser({ [s0.clubId]: s0 }, 'f1')!, clock, 'na1')).toThrow('err.invalid');
  });
});
