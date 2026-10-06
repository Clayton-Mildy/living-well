import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { buildSeed, type ClubState, type Message } from '../index';
import {
  AUTO_ACK_MINUTES, FAMILY_TOPICS, autoAckKey, canStaffUseTopic, familyChoices, familyRows, minutesBetween, needsAutoAck, resolveMemberSel, resolveRow, senderKind, staffRows, starterTopics, teamStaff, topicsOf,
} from './chat';

const T = '2026-10-21';
const base: ClubState = buildSeed().citra;
const msg = (from: string, at: string, kind: Message['kind'] = 'text') => ({ from: from as Message['from'], at, kind });

describe('topics by role', () => {
  it('each role covers its own topics; management all; family and others none', () => {
    expect(topicsOf('lobby')).toEqual(['lobby']);
    expect(topicsOf('finance')).toEqual(['billing']);
    expect(topicsOf('mgmt')).toEqual(['lobby', 'nurse', 'care', 'kitchen', 'billing']);
    expect(topicsOf('family')).toEqual([]);
    expect(topicsOf('driver')).toEqual([]);
    expect(topicsOf(null)).toEqual([]);
    expect(canStaffUseTopic('nurse', 'nurse')).toBe(true);
    expect(canStaffUseTopic('nurse', 'lobby')).toBe(false);
    expect(FAMILY_TOPICS).not.toContain('kitchen');
  });
  it('teams resolve to staff by role, never by a fixed id', () => {
    expect(teamStaff(base, 'lobby')?.id).toBe('s1');
    expect(teamStaff(base, 'nurse')?.id).toBe('s8');
    expect(teamStaff(base, 'billing')?.id).toBe('s10');
    const swapped = produce(base, (d) => { d.staff.s1.active = false; d.staff.s7.role = 'lobby'; });
    expect(teamStaff(swapped, 'lobby')?.id).toBe('s7');
  });
});

describe('auto-acknowledgement window', () => {
  it('minutes between works across days and months', () => {
    expect(minutesBetween('2026-10-21T10:00', '2026-10-21T10:45')).toBe(45);
    expect(minutesBetween('2026-10-31T23:30', '2026-11-01T00:10')).toBe(40);
    expect(minutesBetween('2026-12-31T23:59', '2027-01-01T00:01')).toBe(2);
    expect(AUTO_ACK_MINUTES).toBe(60);
  });
  it('needs one when no staff message or earlier acknowledgement is within the hour', () => {
    const now = `${T}T10:00`;
    expect(needsAutoAck([], now)).toBe(true);
    expect(needsAutoAck([msg('family:f1', `${T}T09:59`)], now)).toBe(true); // the family's own messages never count
    expect(needsAutoAck([msg('staff:s1', `${T}T09:30`)], now)).toBe(false);
    expect(needsAutoAck([msg('staff:s1', `${T}T09:00`)], now)).toBe(true); // exactly 60 minutes ago is outside the window
    expect(needsAutoAck([msg('staff:s8', `${T}T09:20`, 'healthAlert')], now)).toBe(false);
    expect(needsAutoAck([msg('system', `${T}T09:40`, 'autoAck')], now)).toBe(false);
    expect(needsAutoAck([msg('system', `${T}T09:40`, 'system')], now)).toBe(true); // other system lines do not count
    expect(autoAckKey('lobby')).toBe('chat.autoAck.lobby');
    expect(senderKind({ from: 'family:f1' })).toBe('family');
    expect(senderKind({ from: 'staff:s1' })).toBe('staff');
    expect(senderKind({ from: 'system' })).toBe('system');
  });
});

describe('thread rows', () => {
  it('staff rows: newest first, filtered by topic, per-side unread, member and contact resolved', () => {
    const lobby = staffRows(base, 'lobby');
    expect(lobby.map((r) => [r.key, r.unread, r.member.id, r.family.id])).toEqual([['t2', 1, 'm10', 'fm10_0'], ['t1', 1, 'm1', 'f1']]);
    expect(staffRows(base, 'nurse').map((r) => r.key)).toEqual(['t3', 't4']);
    const all = staffRows(base, 'mgmt');
    expect(all).toHaveLength(7); // t1-t4 and the three meal-feedback threads
    expect(staffRows(base, 'mgmt', 'kitchen').map((r) => r.key).sort()).toEqual(['tk-c1', 'tk-c2', 'tk-c3']);
    expect(staffRows(base, 'mgmt', 'kitchen').find((r) => r.key === 'tk-c2')?.feedback?.dish).toBe('Gado-gado');
    expect(staffRows(base, 'finance')).toEqual([]);
    expect(staffRows(base, 'family')).toEqual([]);
  });
  it('family rows: real threads first (health alert and kitchen reply included), then starters for lobby and nurse (billing for the primary contact)', () => {
    const rows = familyRows(base, 'f1', null, T);
    expect(rows.filter((r) => r.thread).map((r) => r.key)).toEqual(['t1']);
    expect(rows.filter((r) => r.thread).every((r) => r.unread === 0)).toBe(true);
    const starters = rows.filter((r) => !r.thread).map((r) => r.key);
    expect(starters).toEqual(['v:m1:nurse', 'v:m1:billing', 'v:m46:lobby', 'v:m46:nurse', 'v:m46:billing']);
    const daniel = familyRows(base, 'f2', null, T).filter((r) => !r.thread).map((r) => r.key);
    expect(daniel).toEqual(['v:m1:lobby', 'v:m1:nurse', 'v:m46:lobby', 'v:m46:nurse']); // not the primary contact: no billing starter
    const cynthia = familyRows(base, 'fm2_0', null, T);
    expect(cynthia.filter((r) => r.thread).map((r) => r.topic).sort()).toEqual(['kitchen', 'nurse']);
    expect(cynthia.find((r) => r.topic === 'nurse')?.last?.from).toBe('family:fm2_0');
    expect(starterTopics(base, 'f1', 'm1')).toEqual(['lobby', 'nurse', 'billing']);
  });
  it('the member switcher limits rows to one member; ended members get no starters', () => {
    const lina = familyRows(base, 'f1', ['m1'], T);
    expect(lina.every((r) => r.member.id === 'm1')).toBe(true);
    const ended = produce(base, (d) => { d.members.m46.memberships[0].lastDay = '2026-10-20'; });
    expect(familyRows(ended, 'f1', null, T).some((r) => r.member.id === 'm46')).toBe(false);
  });
  it('a starter row resolves to the real thread once it exists', () => {
    const rows = familyRows(base, 'f1', null, T);
    expect(resolveRow(rows, 'v:m1:lobby')?.key).toBe('t1'); // t1 is the lobby thread for Oma Lina; no starter was listed, so the real thread is found
    expect(resolveRow(rows, 'v:m1:nurse')?.thread).toBeUndefined();
    expect(resolveRow(rows, 't1')?.key).toBe('t1');
    expect(resolveRow(rows, null)).toBeUndefined();
    expect(resolveRow(rows, 'v:m1:care')).toBeUndefined();
  });
});

describe('member switcher', () => {
  it("offers the family's members whose membership has not ended; 'both' only for two or more", () => {
    const f1 = familyChoices(base, 'f1', T);
    expect(f1.all.sort()).toEqual(['m1', 'm46']);
    expect(f1.choices.sort()).toEqual(['m1', 'm46']);
    expect(familyChoices(base, 'fm10_0', T).choices).toEqual(['m10']);
    const ended = produce(base, (d) => { d.members.m46.memberships[0].lastDay = '2026-10-20'; });
    expect(familyChoices(ended, 'f1', T).choices).toEqual(['m1']);
    expect(familyChoices(ended, 'f1', T).all.sort()).toEqual(['m1', 'm46']);
    const allEnded = produce(ended, (d) => { d.members.m1.memberships[0].lastDay = '2026-10-19'; });
    expect(familyChoices(allEnded, 'f1', T).choices.sort()).toEqual(['m1', 'm46']); // nothing active: still lists them
    expect(familyChoices(base, 'nobody', T)).toEqual({ all: [], choices: [] });
  });
  it('resolves the stored choice', () => {
    expect(resolveMemberSel('m1', ['m1', 'm46'])).toBe('m1');
    expect(resolveMemberSel('both', ['m1', 'm46'])).toBe('both');
    expect(resolveMemberSel('gone', ['m1', 'm46'])).toBe('both');
    expect(resolveMemberSel(undefined, ['m1', 'm46'])).toBe('both');
    expect(resolveMemberSel('both', ['m1'])).toBe('m1');
    expect(resolveMemberSel('m1', [])).toBe('');
  });
});
