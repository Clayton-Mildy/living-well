// KC round 6: Approvals per person. Everything waiting about one member sits together; group photos and menu / stock have their own sections.
import { describe, expect, it } from 'vitest';
import { buildSeed } from '@cp/shared';
import { APPROVAL_TYPES, pendingItems, type ApprovalItem, type ApprovalType } from '@cp/shared/rules/approvals';
import { groupByPerson } from './approvalView';

const itemsOf = (s: ReturnType<typeof buildSeed>['citra']) => Object.fromEntries(APPROVAL_TYPES.map((k) => [k, pendingItems(s, k)])) as Record<ApprovalType, ApprovalItem[]>;

describe('groupByPerson', () => {
  it('puts every waiting entry in exactly one place: a person, group photos or other', () => {
    const s = buildSeed().citra;
    const items = itemsOf(s);
    const g = groupByPerson(s, items);
    const placed = [...g.people.flatMap((p) => p.items), ...g.groupPhotos, ...g.other].map((x) => x.id).sort();
    expect(placed).toEqual(APPROVAL_TYPES.flatMap((k) => items[k]).map((x) => x.id).sort());
    expect(g.people.length).toBeGreaterThan(0);
  });

  it('a person holds only entries about that member; solo photos go to their member, other photos to group photos', () => {
    const s = buildSeed().citra;
    const g = groupByPerson(s, itemsOf(s));
    for (const p of g.people) {
      for (const it of p.items) {
        if (it.type === 'photos') expect(s.photos[it.id]).toMatchObject({ kind: 'solo', memberIds: [p.memberId] });
        else if (it.type === 'profile') expect(it.memberId ?? s.changeRequests[it.id]?.target.memberId).toBe(p.memberId);
        else expect(it.memberId).toBe(p.memberId);
      }
    }
    for (const it of g.groupPhotos) expect(s.photos[it.id].kind === 'solo' && s.photos[it.id].memberIds.length === 1).toBe(false);
    for (const it of g.other) expect(['menu', 'stock']).toContain(it.type);
  });

  it('KC round 7: a waiting activity picture (a session, no members) goes to the "Group & activity photos" section', () => {
    const s = buildSeed().citra;
    s.photos['pa1'] = { id: 'pa1', clubId: s.clubId, createdAt: '2026-10-21T10:50', createdBy: 'staff:s5', date: '2026-10-21', time: '10:50', kind: 'activity', media: 'photo', activity: 'Keroncong sing-along', memberIds: [], tone: 0, takenBy: 's5', visibility: 'pending' };
    const g = groupByPerson(s, itemsOf(s));
    expect(g.groupPhotos.map((x) => x.id)).toContain('pa1');
    expect(g.people.flatMap((p) => p.items).map((x) => x.id)).not.toContain('pa1');
  });

  it('lists people A to Z by first name', () => {
    const s = buildSeed().citra;
    const names = groupByPerson(s, itemsOf(s)).people.map((p) => s.members[p.memberId].firstName); // by first name, not by Bapak / Ibu / Oma
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });
});
