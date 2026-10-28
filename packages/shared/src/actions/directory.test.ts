// Directory actions: add, update, delete, toggle public. Finance, management and the lobby keep the list; families see public entries.
import { describe, it, expect } from 'vitest';
import { buildSeed, execute, getUser, live, projectForFamily, type ClubState } from '../index';

const clubs = buildSeed();
const T = '2026-10-21';
const clock = { today: T, nowMin: 600 };
let n = 0;
function world() {
  let s: ClubState = buildSeed().citra;
  const w = {
    get s() { return s; },
    run(name: string, input: unknown, uid: string) {
      const r = execute(s, name, input, getUser(clubs, uid)!, clock, `d${++n}`);
      s = r.state;
      return r;
    },
    fail(name: string, input: unknown, uid: string, code: string) {
      expect(() => execute(s, name, input, getUser(clubs, uid)!, clock, `d${++n}`)).toThrow(code);
    },
  };
  return w;
}
const entry = { kind: 'supplier', name: 'Toko Roti Manis', what: 'Bread and cakes', whatId: 'Roti dan kue', phone: '0812 3456 7890', public: false };

describe('directory', () => {
  it('seed: nine suppliers are internal, doctors and services are public', () => {
    const s = world().s;
    const d = live(s.directory);
    expect(d).toHaveLength(13); // round 14 p2: d10–d13, the shops of the seeded receipts; round 15: d14–d15, two AC vendors
    expect(d.filter((x) => x.public).map((x) => x.id).sort()).toEqual(['d1', 'd2', 'd3', 'd4']);
    expect(d.filter((x) => x.kind === 'supplier').map((x) => x.id).sort()).toEqual(['d10', 'd11', 'd12', 'd13', 'd14', 'd15', 'd6', 'd7', 'd9']);
  });

  it('finance, management and the lobby can add; the phone is stored as +62…', () => {
    for (const uid of ['s10', 's9', 's1']) {
      const w = world();
      const r = w.run('directory.add', entry, uid);
      expect(w.s.directory[r.result.id as string]).toMatchObject({ kind: 'supplier', name: 'Toko Roti Manis', what: 'Bread and cakes', whatId: 'Roti dan kue', phone: '+6281234567890', public: false, createdBy: `staff:${uid}` });
    }
    const w = world();
    const r = w.run('directory.add', { ...entry, kind: 'doctor', phone: '+65 9123 4567', public: true, whatId: undefined }, 's10');
    expect(w.s.directory[r.result.id as string]).toMatchObject({ kind: 'doctor', phone: '+6591234567', public: true });
    expect(w.s.directory[r.result.id as string].whatId).toBeUndefined();
  });

  it('nobody else can: nurse, activity, kitchen, family', () => {
    const w = world();
    for (const uid of ['s8', 's5', 's2', 's3', 'f1', 'fm20_0']) {
      w.fail('directory.add', entry, uid, 'err.forbidden');
      w.fail('directory.update', { id: 'd6', name: 'x' }, uid, 'err.forbidden');
      w.fail('directory.delete', { id: 'd6' }, uid, 'err.forbidden');
      w.fail('directory.togglePublic', { id: 'd6' }, uid, 'err.forbidden');
    }
  });

  it('validates the input', () => {
    const w = world();
    w.fail('directory.add', { ...entry, name: '  ' }, 's10', 'err.invalid');
    w.fail('directory.add', { ...entry, what: '' }, 's10', 'err.invalid');
    w.fail('directory.add', { ...entry, kind: 'vet' }, 's10', 'err.invalid');
    w.fail('directory.add', { ...entry, phone: 'call me' }, 's10', 'err.invalid');
    w.fail('directory.add', { ...entry, phone: '12' }, 's10', 'err.invalid');
    w.fail('directory.add', { ...entry, name: 'x'.repeat(121) }, 's10', 'err.invalid');
    w.fail('directory.add', 'nope', 's10', 'err.invalid');
    w.fail('directory.update', { id: 'd6', phone: 'abc' }, 's10', 'err.invalid');
    w.fail('directory.update', { id: 'd6', kind: 'vet' }, 's10', 'err.invalid');
  });

  it('updates only what is sent; null clears the Indonesian wording', () => {
    const w = world();
    w.run('directory.update', { id: 'd1', name: 'dr. Andreas Wirawan, Sp.PD (KGH)', phone: '0812 9001 2299' }, 's1');
    expect(w.s.directory.d1).toMatchObject({ name: 'dr. Andreas Wirawan, Sp.PD (KGH)', phone: '+6281290012299', what: 'Internal medicine · visits Tuesdays', public: true, kind: 'doctor' });
    w.run('directory.update', { id: 'd1', what: 'Internal medicine · Tuesdays and Thursdays', whatId: 'Penyakit dalam · Selasa dan Kamis' }, 's10');
    expect(w.s.directory.d1).toMatchObject({ what: 'Internal medicine · Tuesdays and Thursdays', whatId: 'Penyakit dalam · Selasa dan Kamis' });
    w.run('directory.update', { id: 'd1', whatId: null }, 's9');
    expect(w.s.directory.d1.whatId).toBeUndefined();
    w.run('directory.update', { id: 'd6', kind: 'service', public: true }, 's10');
    expect(w.s.directory.d6).toMatchObject({ kind: 'service', public: true });
    w.fail('directory.update', { id: 'nope', name: 'x' }, 's10', 'err.notFound');
  });

  it('a supplier can carry a spend category: stored on add and update, unknown ones refused, null clears it', () => {
    const w = world();
    const id = w.run('directory.add', { ...entry, category: 'groceries' }, 's10').result.id as string;
    expect(w.s.directory[id].category).toBe('groceries');
    const plain = w.run('directory.add', entry, 's10').result.id as string;
    expect('category' in w.s.directory[plain]).toBe(false);
    w.run('directory.update', { id, category: 'marketplace' }, 's10');
    expect(w.s.directory[id].category).toBe('marketplace');
    w.run('directory.update', { id, name: 'Toko Roti Baru' }, 's10');
    expect(w.s.directory[id]).toMatchObject({ category: 'marketplace', name: 'Toko Roti Baru' });
    w.run('directory.update', { id, category: null }, 's10');
    expect('category' in w.s.directory[id]).toBe(false);
    w.fail('directory.add', { ...entry, category: 'snacks' }, 's10', 'err.invalid');
    w.fail('directory.update', { id, category: 'snacks' }, 's10', 'err.invalid');
  });

  // round 15 (phase 2): contacts grouped by an editable category list; the supplier's spending category is separate
  it('setGroup adds "AC and electrical": the lobby, finance and management may; nurse, kitchen, activity, family may not', () => {
    for (const uid of ['s1', 's10', 's9']) {
      const w = world();
      const before = (w.s.club.settings.directoryGroups ?? []).length;
      const r = w.run('directory.setGroup', { name: 'Pest control', nameId: 'Pengendalian hama' }, uid);
      expect(w.s.club.settings.directoryGroups).toHaveLength(before + 1);
      expect(w.s.club.settings.directoryGroups!.find((g) => g.id === r.result.groupId)).toMatchObject({ name: 'Pest control', nameId: 'Pengendalian hama', active: true });
    }
    const w = world();
    for (const uid of ['s8', 's2', 's5', 'f1']) w.fail('directory.setGroup', { name: 'AC and electrical' }, uid, 'err.forbidden');
  });

  it('seed: the eight categories, the AC vendors in "AC and electrical", the others grouped', () => {
    const s = world().s;
    const gs = s.club.settings.directoryGroups!;
    expect(gs.map((g) => g.name)).toEqual(['AC and electrical', 'Plumbing', 'Transport', 'Medical', 'Groceries', 'Cleaning', 'Activity materials', 'Other']);
    expect(gs.every((g) => g.active && g.nameId)).toBe(true);
    const ac = gs[0].id;
    const inAc = live(s.directory).filter((d) => d.groupId === ac).map((d) => d.name).sort();
    expect(inAc).toEqual(['Dingin Jaya AC Service', 'Kemang Teknik AC']);
    for (const d of live(s.directory).filter((x) => inAc.includes(x.name))) expect(d.phone).toMatch(/^\+62\d{8,}$/);
    expect(live(s.directory).filter((d) => d.kind !== 'supplier' || ['groceries', 'cleaning'].includes(d.category ?? '')).every((d) => d.groupId)).toBe(true);
  });

  it('setGroup renames, keeps ids and retires; a no-op is refused; an unknown id is refused', () => {
    const w = world();
    const ac = w.s.club.settings.directoryGroups![0].id;
    w.run('directory.setGroup', { id: ac, name: 'AC, electrical and lights', nameId: 'AC dan listrik', active: true }, 's1');
    expect(w.s.club.settings.directoryGroups![0]).toMatchObject({ id: ac, name: 'AC, electrical and lights', active: true });
    w.fail('directory.setGroup', { id: ac, name: 'AC, electrical and lights', nameId: 'AC dan listrik', active: true }, 's1', 'err.noChanges');
    w.run('directory.setGroup', { id: ac, name: 'AC, electrical and lights', nameId: 'AC dan listrik', active: false }, 's9');
    expect(w.s.club.settings.directoryGroups![0].active).toBe(false);
    w.fail('directory.setGroup', { id: 'dgrp_99', name: 'x' }, 's1', 'err.notFound');
    w.fail('directory.setGroup', { id: 'bad', name: 'x' }, 's1', 'err.invalid');
    w.fail('directory.setGroup', { name: '  ' }, 's1', 'err.invalid');
    w.fail('directory.setGroup', { name: 'x'.repeat(61) }, 's1', 'err.invalid');
  });

  it('add and update take a groupId: null clears it; unknown and retired ids are refused', () => {
    const w = world();
    const [ac, plumbing] = w.s.club.settings.directoryGroups!;
    const id = w.run('directory.add', { ...entry, groupId: ac.id }, 's10').result.id as string;
    expect(w.s.directory[id].groupId).toBe(ac.id);
    w.run('directory.update', { id, groupId: plumbing.id }, 's1');
    expect(w.s.directory[id].groupId).toBe(plumbing.id);
    w.run('directory.update', { id, name: 'Toko Roti Baru' }, 's1');
    expect(w.s.directory[id].groupId).toBe(plumbing.id); // not sent = unchanged
    w.run('directory.update', { id, groupId: null }, 's1');
    expect('groupId' in w.s.directory[id]).toBe(false);
    w.fail('directory.add', { ...entry, groupId: 'dgrp_99' }, 's10', 'err.invalid');
    w.fail('directory.update', { id, groupId: 'dgrp_99' }, 's10', 'err.invalid');
    w.run('directory.setGroup', { id: plumbing.id, name: plumbing.name, nameId: plumbing.nameId, active: false }, 's1');
    w.fail('directory.update', { id, groupId: plumbing.id }, 's10', 'err.invalid');
    w.fail('directory.add', { ...entry, groupId: plumbing.id }, 's10', 'err.invalid');
    // a contact already in a retired group keeps it until someone changes it (nothing else is lost)
    const kept = w.run('directory.add', { ...entry, groupId: ac.id }, 's10').result.id as string;
    w.run('directory.setGroup', { id: ac.id, name: ac.name, nameId: ac.nameId, active: false }, 's1');
    w.run('directory.update', { id: kept, name: 'Renamed' }, 's10');
    expect(w.s.directory[kept].groupId).toBe(ac.id);
  });

  it('the spending category stays separate from the directory category', () => {
    const w = world();
    const gid = w.s.club.settings.directoryGroups![0].id;
    w.run('directory.update', { id: 'd6', groupId: gid }, 's10');
    expect(w.s.directory.d6).toMatchObject({ groupId: gid, category: 'groceries' });
  });

  it('toggles public and families see exactly the public entries', () => {
    const w = world();
    const fam = () => Object.values(projectForFamily(w.s, 'f1').directory).map((x) => x.id).sort();
    expect(fam()).toEqual(['d1', 'd2', 'd3', 'd4']);
    expect(w.run('directory.togglePublic', { id: 'd6' }, 's10').result.public).toBe(true);
    expect(fam()).toEqual(['d1', 'd2', 'd3', 'd4', 'd6']);
    expect(w.run('directory.togglePublic', { id: 'd1' }, 's1').result.public).toBe(false);
    expect(fam()).toEqual(['d2', 'd3', 'd4', 'd6']);
  });

  it('deletes (soft): gone from the lists and from families, and cannot be changed afterwards', () => {
    const w = world();
    w.run('directory.delete', { id: 'd2' }, 's1');
    expect(w.s.directory.d2.deletedAt).toBe(`${T}T10:00`);
    expect(live(w.s.directory).map((x) => x.id)).not.toContain('d2');
    expect(Object.keys(projectForFamily(w.s, 'f1').directory)).not.toContain('d2');
    w.fail('directory.delete', { id: 'd2' }, 's10', 'err.notFound');
    w.fail('directory.update', { id: 'd2', name: 'x' }, 's10', 'err.notFound');
    w.fail('directory.togglePublic', { id: 'd2' }, 's10', 'err.notFound');
    // receipts and vendor invoices that named the supplier keep its name
    w.run('directory.delete', { id: 'd6' }, 's10');
    expect(w.s.receipts.rc1.supplier).toBe('Sayur Segar Kemang');
    w.fail('receipt.add', { date: T, supplier: 'Sayur Segar Kemang', directoryId: 'd6', amount: 1000, sectionId: 'fnb' }, 's2', 'err.notFound');
  });

  it('other areas can name the id as contactId', () => {
    const w = world();
    w.run('directory.togglePublic', { contactId: 'd7' }, 's10');
    expect(w.s.directory.d7.public).toBe(true);
  });
});
