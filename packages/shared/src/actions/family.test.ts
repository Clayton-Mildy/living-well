// Family contact actions: gating, afterApprove (login), per-member primary, app access, linking, removing, and the family's document upload.
import { describe, it, expect } from 'vitest';
import { buildSeed, execute, getUser, findByPhone, contactsOfMember, primaryContact, isPrimaryFor, live, type ClubState, type User } from '../index';

const T = '2026-10-21';
const clock = { today: T, nowMin: 600 };
const seed = () => buildSeed();
const who = (c: ReturnType<typeof buildSeed>, id: string): User => getUser(c, id)!;
let seq = 0;
const run = (s: ClubState, name: string, input: unknown, user: User) => execute(s, name, input, user, clock, `f${++seq}`);
const add = (over: Record<string, unknown> = {}) => ({ memberId: 'm10', name: 'Dewi Purnomo', phone: '0813 4000 1122', relation: 'daughter', ...over });

describe('family.addContact', () => {
  it('lobby: gated. the contact is pending and cannot sign in; approval activates the login', () => {
    const c = seed();
    const r = run(c.citra, 'family.addContact', add(), who(c, 's1'));
    expect(r.reviewed).toBe('gate');
    const fid = r.result.familyId as string;
    expect(fid).toBe('fm10_1');
    expect(r.state.familyContacts[fid].review?.status).toBe('pending');
    expect(r.state.familyContacts[fid].activatedAt).toBeUndefined();
    expect(findByPhone({ citra: r.state }, '+62 813-4000-1122')).toEqual({ ok: false, reason: 'pending' });
    expect(contactsOfMember(r.state, 'm10').map((x) => x.contact.id)).toContain(fid); // listed, flagged pending
    const a = run(r.state, 'review.approve', { crId: r.result.changeRequestId }, who(c, 's9'));
    expect(a.state.familyContacts[fid].activatedAt).toBeTruthy();
    expect(findByPhone({ citra: a.state }, '0813 4000 1122').ok).toBe(true);
    expect(Object.values(a.state.notifications).some((n) => n.kind === 'members.notif.contactAdded' && n.toUsers.includes(fid))).toBe(true);
    expect(Object.values(a.state.activity).some((x) => x.memberId === 'm10' && x.key === 'members.feed.contactAdded')).toBe(true);
  });

  it('the Primary toggle applies once approved (the billing contact does not change while pending)', () => {
    const c = seed();
    const r = run(c.citra, 'family.addContact', add({ primary: true }), who(c, 's1'));
    expect(primaryContact(r.state, 'm10')?.id).toBe('fm10_0'); // still Laras
    const a = run(r.state, 'review.approve', { crId: r.result.changeRequestId }, who(c, 's9'));
    expect(primaryContact(a.state, 'm10')?.id).toBe('fm10_1');
    expect(isPrimaryFor(a.state, 'fm10_0', 'm10')).toBe(false);
    const notPrimary = run(c.citra, 'family.addContact', add({ primary: false }), who(c, 's9'));
    expect(primaryContact(notPrimary.state, 'm10')?.id).toBe('fm10_0');
  });

  it('management adds a contact that works at once', () => {
    const c = seed();
    const r = run(c.citra, 'family.addContact', add(), who(c, 's9'));
    expect(r.reviewed).toBeUndefined();
    expect(findByPhone({ citra: r.state }, '0813 4000 1122').ok).toBe(true);
  });

  it('validation: name, mobile, a mobile already in use (contacts and staff), roles', () => {
    const c = seed();
    const go = (over: Record<string, unknown>, u = 's1') => () => run(c.citra, 'family.addContact', add(over), who(c, u));
    expect(go({ name: '' })).toThrow('members.err.contactRequired');
    expect(go({ phone: '' })).toThrow('members.err.phoneRequired');
    expect(go({ phone: '123' })).toThrow('members.err.phoneInvalid');
    expect(go({ phone: '+62 812-1090-4471' })).toThrow('members.err.phoneInUse'); // Maria
    expect(go({ phone: '+62 811-2201-3345' })).toThrow('members.err.phoneInUse'); // Caca (staff)
    expect(go({}, 's8')).toThrow('err.forbidden');
    expect(go({}, 'f1')).toThrow('err.forbidden');
    expect(go({ memberId: 'm404' })).toThrow('err.notFound');
  });
});

describe('family.linkContact', () => {
  it('links an existing contact to another member; approval makes the link live', () => {
    const c = seed();
    const r = run(c.citra, 'family.linkContact', { memberId: 'm10', familyId: 'f1', relation: 'other' }, who(c, 's1'));
    expect(r.reviewed).toBe('gate');
    const lid = Object.values(r.state.familyLinks).find((l) => l.familyId === 'f1' && l.memberId === 'm10')!;
    expect(lid.review?.status).toBe('pending');
    expect(getUser({ citra: r.state }, 'f1')?.kind === 'family' && (getUser({ citra: r.state }, 'f1') as { memberIds: string[] }).memberIds).not.toContain('m10');
    const a = run(r.state, 'review.approve', { crId: r.result.changeRequestId }, who(c, 's9'));
    expect((getUser({ citra: a.state }, 'f1') as { memberIds: string[] }).memberIds).toContain('m10');
    expect(() => run(a.state, 'family.linkContact', { memberId: 'm10', familyId: 'f1', relation: 'other' }, who(c, 's9'))).toThrow('members.err.alreadyLinked');
    expect(() => run(c.citra, 'family.linkContact', { memberId: 'm10', familyId: 'nobody', relation: 'other' }, who(c, 's9'))).toThrow('members.err.contactNotFound');
  });

  it('unlinking and linking again works', () => {
    const c = seed();
    const l = run(c.citra, 'family.linkContact', { memberId: 'm10', familyId: 'f2', relation: 'son' }, who(c, 's9'));
    const u = run(l.state, 'family.unlinkContact', { memberId: 'm10', familyId: 'f2' }, who(c, 's9'));
    const again = run(u.state, 'family.linkContact', { memberId: 'm10', familyId: 'f2', relation: 'son' }, who(c, 's9'));
    expect(contactsOfMember(again.state, 'm10').map((x) => x.contact.id)).toContain('f2');
    expect(Object.keys(again.state.familyLinks).filter((k) => k.startsWith('f2:m10'))).toEqual(['f2:m10', 'f2:m10#2']);
  });
});

describe('family.updateContact', () => {
  it('name and mobile are gated on the contact; the relationship is gated on the link', () => {
    const c = seed();
    const r = run(c.citra, 'family.updateContact', { familyId: 'f2', memberId: 'm1', name: 'Daniel W.', phone: '0813 8820 9999' }, who(c, 's1'));
    expect(r.reviewed).toBe('gate');
    expect(r.state.familyContacts.f2.name).toBe('Daniel Wijaya');
    const cr = r.state.changeRequests[r.result.changeRequestId as string];
    expect(cr.target).toEqual({ type: 'familyContact', id: 'f2', memberId: 'm1' });
    expect(cr.changes.map((x) => x.field).sort()).toEqual(['name', 'phone']);
    const a = run(r.state, 'review.approve', { crId: cr.id }, who(c, 's9'));
    expect(a.state.familyContacts.f2).toMatchObject({ name: 'Daniel W.', firstName: 'Daniel', phone: '+6281388209999' });
    const rel = run(c.citra, 'family.updateContact', { familyId: 'f2', memberId: 'm1', relation: 'sibling' }, who(c, 's1'));
    const crr = rel.state.changeRequests[rel.result.changeRequestId as string];
    expect(crr.target).toMatchObject({ type: 'familyLink', id: 'f2:m1' });
    expect(run(rel.state, 'review.approve', { crId: crr.id }, who(c, 's9')).state.familyLinks['f2:m1'].relation).toBe('sibling');
    expect(() => run(c.citra, 'family.updateContact', { familyId: 'f2', memberId: 'm1', phone: '+62 812-1090-4471' }, who(c, 's9'))).toThrow('members.err.phoneInUse');
    expect(() => run(c.citra, 'family.updateContact', { familyId: 'f2' }, who(c, 's9'))).toThrow('err.noChanges');
  });
});

describe('family.setPrimary: the billing contact is per member', () => {
  it('making Daniel primary for Lina does not change Opa Budi', () => {
    const c = seed();
    const r = run(c.citra, 'family.setPrimary', { memberId: 'm1', familyId: 'f2' }, who(c, 's1'));
    expect(r.reviewed).toBe('gate');
    expect(primaryContact(r.state, 'm1')?.id).toBe('f1'); // unchanged until approved
    const a = run(r.state, 'review.approve', { crId: r.result.changeRequestId }, who(c, 's9'));
    expect(primaryContact(a.state, 'm1')?.id).toBe('f2');
    expect(primaryContact(a.state, 'm46')?.id).toBe('f1');
    expect(isPrimaryFor(a.state, 'f1', 'm1')).toBe(false);
    expect(isPrimaryFor(a.state, 'f1', 'm46')).toBe(true);
    expect(() => run(a.state, 'family.setPrimary', { memberId: 'm1', familyId: 'f2' }, who(c, 's9'))).toThrow('err.noChanges');
  });
});

describe('family.setAppAccess', () => {
  it('revoke blocks the login for that member; invite brings it back', () => {
    const c = seed();
    const r = run(c.citra, 'family.setAppAccess', { memberId: 'm10', familyId: 'fm10_0', appAccess: false }, who(c, 's9'));
    expect(findByPhone({ citra: r.state }, '+62 816-1436-6582')).toEqual({ ok: false, reason: 'noAccess' });
    const inv = run(r.state, 'family.setAppAccess', { memberId: 'm10', familyId: 'fm10_0', appAccess: true }, who(c, 's9'));
    expect(findByPhone({ citra: inv.state }, '+62 816-1436-6582').ok).toBe(true);
    expect(Object.values(inv.state.notifications).some((n) => n.kind === 'members.notif.appInvite' && n.toUsers.includes('fm10_0'))).toBe(true);
    const g = run(c.citra, 'family.setAppAccess', { memberId: 'm10', familyId: 'fm10_0', appAccess: false }, who(c, 's1'));
    expect(g.reviewed).toBe('gate');
    expect(findByPhone({ citra: g.state }, '+62 816-1436-6582').ok).toBe(true);
    expect(() => run(c.citra, 'family.setAppAccess', { memberId: 'm10', familyId: 'fm10_0', appAccess: true }, who(c, 's9'))).toThrow('err.noChanges');
    expect(() => run(c.citra, 'family.setAppAccess', { memberId: 'm10', familyId: 'fm10_0' }, who(c, 's9'))).toThrow('err.invalid');
  });
});

describe('family.unlinkContact', () => {
  it('a member keeps at least one contact; removing the primary promotes the next; an orphan contact is removed', () => {
    const c = seed();
    expect(() => run(c.citra, 'family.unlinkContact', { memberId: 'm10', familyId: 'fm10_0' }, who(c, 's9'))).toThrow('members.err.lastContact');
    const r = run(c.citra, 'family.unlinkContact', { memberId: 'm2', familyId: 'fm2_0' }, who(c, 's1'));
    expect(r.reviewed).toBe('gate');
    expect(contactsOfMember(r.state, 'm2')).toHaveLength(2); // still there until approved
    const a = run(r.state, 'review.approve', { crId: r.result.changeRequestId }, who(c, 's9'));
    expect(contactsOfMember(a.state, 'm2').map((x) => x.contact.id)).toEqual(['fm2_1']);
    expect(primaryContact(a.state, 'm2')?.id).toBe('fm2_1');
    expect(a.state.familyContacts.fm2_0.deletedAt).toBeTruthy();
    expect(findByPhone({ citra: a.state }, '+62 815-1294-4718').ok).toBe(false);
    // Maria is also Opa Budi's contact: removing her from Lina keeps her login
    const m = run(c.citra, 'family.unlinkContact', { memberId: 'm1', familyId: 'f1' }, who(c, 's9'));
    expect(m.state.familyContacts.f1.deletedAt).toBeUndefined();
    expect(primaryContact(m.state, 'm1')?.id).toBe('f2');
    expect(live(m.state.familyLinks).some((l) => l.id === 'f1:m46')).toBe(true);
  });
});

describe('document.upload (family)', () => {
  it('gated: the file waits for review; approval stores it as added by the family', () => {
    const c = seed();
    const r = run(c.citra, 'document.upload', { memberId: 'm46', type: 'healthInfo', fileName: 'ringkasan.pdf', mediaId: 'md_testfamilyupload001' }, who(c, 'f1'));
    expect(r.reviewed).toBe('gate');
    expect(r.state.members.m46.documents.find((d) => d.type === 'healthInfo')?.status).toBe('requested');
    const cr = r.state.changeRequests[r.result.changeRequestId as string];
    expect(cr).toMatchObject({ section: 'docsConsent', target: { type: 'document', id: 'm46', memberId: 'm46' }, submittedBy: 'family:f1' });
    expect(Object.values(r.state.notifications).some((n) => n.kind === 'notif.reviewSubmitted' && n.toRoles.includes('mgmt'))).toBe(true);
    const a = run(r.state, 'review.approve', { crId: cr.id }, who(c, 's9'));
    expect(a.state.members.m46.documents.find((d) => d.type === 'healthInfo')).toMatchObject({ status: 'onFile', fileName: 'ringkasan.pdf', mediaId: 'md_testfamilyupload001', via: 'family', by: 'family:f1' });
    expect(Object.values(a.state.notifications).some((n) => n.kind === 'notif.reviewApproved' && n.toUsers.includes('f1'))).toBe(true);
  });

  it('only a family member linked to the member can upload; the family can withdraw', () => {
    const c = seed();
    expect(() => run(c.citra, 'document.upload', { memberId: 'm10', type: 'ktp' }, who(c, 'f1'))).toThrow('err.forbidden');
    expect(() => run(c.citra, 'document.upload', { memberId: 'm46', type: 'ktp' }, who(c, 's1'))).toThrow('err.forbidden');
    const r = run(c.citra, 'document.upload', { memberId: 'm46', type: 'ktp' }, who(c, 'f1'));
    expect(run(r.state, 'review.withdraw', { crId: r.result.changeRequestId }, who(c, 'f1')).state.changeRequests[r.result.changeRequestId as string].status).toBe('withdrawn');
    expect(() => run(c.citra, 'document.upload', { memberId: 'm46', type: 'nannyKtp' }, who(c, 'f1'))).toThrow('members.err.noNanny');
    expect(() => run(c.citra, 'document.upload', { memberId: 'm46', type: 'passport' }, who(c, 'f1'))).toThrow('err.invalid');
  });
});
