// The paper Membership Application Form: cleaning and checking the answers, the data the form is printed from (a saved member and a member still
// being typed), and the page-1 mapping (what goes on each blank line, in Indonesian).
import { describe, it, expect } from 'vitest';
import { buildSeed, priceOn, rp, type ClubState } from '../index';
import {
  applicationDataFromInput, applicationDataOf, cleanRegistration, idDate, maritalWord, page1Values, signatureValues, splitAddress, validateRegistration,
} from './applicationForm';

const T = '2026-10-21';
const seed = (): ClubState => structuredClone(buildSeed().citra);

describe('the answers of the application form', () => {
  it('are cleaned: trimmed, phones in one format, empty and unticked ones left out, anything else dropped', () => {
    const r = cleanRegistration({ nickname: '  Oma Lina ', marital: 'married', city: '', mobile: '0812 1090 4471', phone: '021 7199 2210', commDifficulty: false, selfCare: undefined, ids: { guarantor: true, member: false }, junk: 1 });
    expect(r).toEqual({ nickname: 'Oma Lina', marital: 'married', phone: '+62 21 7199 2210', mobile: '+62 812-1090-4471', commDifficulty: false, ids: { guarantor: true } });
    expect(cleanRegistration({})).toBeUndefined();
    expect(cleanRegistration({ nickname: '  ', marital: 'engaged', ids: { member: false } })).toBeUndefined();
    expect(cleanRegistration('x')).toBeUndefined();
    expect(cleanRegistration(undefined)).toBeUndefined();
  });
  it('the seed answers survive cleaning unchanged (so editing a seed member never looks like a change)', () => {
    const s = seed();
    for (const id of ['m1', 'm46', 'm2', 'm20', 'm10']) {
      const reg = s.members[id].registration!;
      const cleaned = cleanRegistration(reg)!;
      expect({ ...cleaned, ids: cleaned.ids }, id).toEqual(JSON.parse(JSON.stringify({ ...reg, ids: Object.fromEntries(Object.entries(reg.ids || {}).filter(([, v]) => v)) })));
    }
  });
  it('are checked: email, postcode, RT/RW and phone numbers', () => {
    expect(validateRegistration(undefined)).toEqual([]);
    expect(validateRegistration(cleanRegistration({ email: 'a@b.co', postcode: '12730', rtRw: '004/002', mobile: '0812 1090 4471' }))).toEqual([]);
    const bad = validateRegistration(cleanRegistration({ email: 'nope', postcode: '127', rtRw: '004#002', mobile: '12', phone: 'abc' }));
    expect(bad.map((x) => x.field).sort()).toEqual(['email', 'postcode', 'regMobile', 'regPhone', 'rtRw']);
    expect(bad.find((x) => x.field === 'email')?.code).toBe('members.err.emailInvalid');
    expect(bad.find((x) => x.field === 'regPhone')?.code).toBe('members.err.regPhoneInvalid');
  });
});

describe('page 1 of the form for a saved member (Oma Lina, m1)', () => {
  const s = seed();
  const v = page1Values(applicationDataOf(s, 'm1', T));
  it('writes the person, the address and the contact numbers', () => {
    expect(v).toMatchObject({
      name: 'Lina Wijaya', nickname: 'Oma Lina', dobAge: '14 Mei 1945 (81 th)', marital: 'Menikah', address1: s.members.m1.address, address2: '',
      rtRw: '004/002', city: 'Jakarta Selatan', postcode: '12730', phone: '+62 21 7199 2210', mobile: '+62 812-1090-4471', email: 'maria.wijaya@example.com',
    });
  });
  it('writes the plan, its fees, the health problems and the dementia line', () => {
    expect(v.monthlyFee).toBe(rp(priceOn(s, T).flex));
    expect(v.registrationFee).toBe(priceOn(s, T).registration ? `Flex · ${rp(priceOn(s, T).registration!)}` : 'Flex');
    expect(v.conditions).toBe(s.members.m1.health.conditions.join('; ')); // a condition can hold a comma ("Hard of hearing, left ear"), so they are split with semicolons
    expect(v.dementia).toBe('Tidak ada'); // alert and oriented, no dementia note: nothing to report (KC round 6)
  });
  it('answers the questions in Indonesian: yes/no, the carer and her name, the allergies', () => {
    expect(v).toMatchObject({ q1: 'Tidak', q2: 'Ya', q3: 'Tidak', carer: 'Ya', carerName: 'Mbak Sari', allergy: 'Ya', allergyList: 'Kerang-kerangan' });
  });
  it('names the family contact, her relation in Indonesian, the home phone and her mobile', () => {
    expect(v).toMatchObject({ kin: 'Maria Wijaya', kinRelation: 'Putri', kinHome: '+62 21 7199 2210', kinPhone: '+62 812-1090-4471' });
  });
  it('ticks the identity documents that were received', () => {
    expect(v).toMatchObject({ idGuarantor: true, idMember: true, idCarer: true });
    const o = seed(); // Pak Bambang: the member's own ID is not in yet, and there is no carer
    expect(page1Values(applicationDataOf(o, 'm10', T))).toMatchObject({ idGuarantor: true, idMember: false, idCarer: false, carer: 'Tidak', carerName: '' });
  });
  it('signs as the billing contact, with the print date', () => {
    expect(v).toMatchObject({ signer: 'Maria Wijaya', date: '21 Oktober 2026' });
    expect(signatureValues(applicationDataOf(s, 'm1', T))).toEqual({ signer: 'Maria Wijaya', date: '21 Oktober 2026' });
  });
});

describe('the signer is the billing contact', () => {
  it('follows the primary contact when it changes, and falls back to the first contact when none is primary', () => {
    const s = seed();
    const links = Object.values(s.familyLinks).filter((l) => l.memberId === 'm1' && !l.deletedAt);
    expect(links.length).toBeGreaterThan(1); // Maria and Daniel Wijaya
    const other = links.find((l) => !l.primary)!;
    for (const l of links) l.primary = l.id === other.id;
    expect(applicationDataOf(s, 'm1', T).signer).toBe(s.familyContacts[other.familyId].name);
    for (const l of links) l.primary = false;
    expect(applicationDataOf(s, 'm1', T).signer).toBeTruthy(); // the first contact, not blank
  });
});

describe('the printed words', () => {
  it('shows the registration fee when the price list has one, and the plan alone when it does not', () => {
    const s = seed();
    const price = priceOn(s, T);
    price.registration = 2_500_000;
    expect(page1Values(applicationDataOf(s, 'm1', T)).registrationFee).toBe(`Flex · ${rp(2_500_000)}`);
    delete price.registration;
    expect(page1Values(applicationDataOf(s, 'm1', T)).registrationFee).toBe('Flex');
    expect(page1Values(applicationDataOf(s, 'm46', T))).toMatchObject({ registrationFee: 'Gold', monthlyFee: rp(price.gold) });
  });
  it('joins the cognitive summary and the dementia note; a widower is Duda; "yes" answers print as Ya', () => {
    const v = page1Values(applicationDataOf(seed(), 'm20', T));
    expect(v.dementia).toBe('Mild memory loss; may repeat questions'); // "alert and oriented" is not a dementia problem, so only the note
    expect(v).toMatchObject({ marital: 'Duda', q1: 'Ya', q3: 'Ya' });
    expect(maritalWord('widowed', 'f')).toBe('Janda');
    expect(maritalWord('single', null)).toBe('Belum menikah');
    expect(maritalWord(null, 'f')).toBe('');
  });
  it('leaves a question blank until it was answered', () => {
    const s = seed();
    delete s.members.m1.registration;
    expect(page1Values(applicationDataOf(s, 'm1', T))).toMatchObject({ q1: '', q2: '', q3: '', nickname: '', marital: '', idGuarantor: false, kinHome: '' });
  });
  it('writes dates in Indonesian and breaks a long address over the two lines at a space', () => {
    expect(idDate('2026-03-05')).toBe('5 Maret 2026');
    expect(splitAddress('Jl. Bangka Raya no. 18, Kemang')).toEqual(['Jl. Bangka Raya no. 18, Kemang', '']);
    const [a, b] = splitAddress('Jl. Kemang Selatan Raya no. 18 Blok C, Komplek Taman Kemang Indah, Kelurahan Bangka, Mampang Prapatan', 50);
    expect(a.length).toBeLessThanOrEqual(50);
    expect(`${a} ${b}`).toBe('Jl. Kemang Selatan Raya no. 18 Blok C, Komplek Taman Kemang Indah, Kelurahan Bangka, Mampang Prapatan');
  });
});

describe('a new member who is still being typed', () => {
  const s = seed();
  const input = {
    title: 'Oma', name: 'Siti Rahma', dob: '1946-03-12', address: 'Jl. Test 1', plan: 'gold' as const, nanny: { name: 'Mbak Wati' },
    contact: { name: 'Rudi Rahma', phone: '+6281340007777', relation: 'son' as const, primary: true },
    health: { conditions: ['Osteoporosis'], food: ['peanuts' as const], foodOther: 'Kiwi', drugs: ['other:Codeine' as never] },
    registration: cleanRegistration({ nickname: 'Oma Siti', marital: 'widowed', mobile: '0812 5550 1234', commDifficulty: true, ids: { guarantor: true, carer: true } }),
  };
  const d = applicationDataFromInput(s, input, T);
  it('has the same data a saved member has', () => {
    expect(page1Values(d)).toMatchObject({
      name: 'Siti Rahma', nickname: 'Oma Siti', dobAge: '12 Maret 1946 (80 th)', marital: 'Janda', address1: 'Jl. Test 1', mobile: '+62 812-5550-1234',
      registrationFee: priceOn(s, T).registration ? `Gold · ${rp(priceOn(s, T).registration!)}` : 'Gold', monthlyFee: rp(priceOn(s, T).gold),
      conditions: 'Osteoporosis', q1: 'Ya', q2: '', carer: 'Ya', carerName: 'Mbak Wati', allergy: 'Ya', allergyList: 'Kacang tanah, Kiwi, Codeine',
      kin: 'Rudi Rahma', kinRelation: 'Putra', kinPhone: '+62 813-4000-7777', idGuarantor: true, idMember: false, idCarer: true, signer: 'Rudi Rahma', date: '21 Oktober 2026',
    });
  });
  it('works with nothing typed yet (blank lines, no error)', () => {
    const empty = applicationDataFromInput(s, { name: '', dob: '', address: '', plan: 'flex', nanny: null, contact: { name: '', phone: '', relation: 'daughter', primary: true }, health: { conditions: [], food: [], foodOther: '', drugs: [] } }, T);
    expect(page1Values(empty)).toMatchObject({ name: '', dobAge: '', kin: '', signer: '', carer: 'Tidak', allergy: 'Tidak', registrationFee: expect.stringMatching(/^Flex/) });
  });
  it('uses an existing contact (chosen from the list) as the signer and the family contact', () => {
    const f = Object.values(s.familyContacts)[0];
    const e = applicationDataFromInput(s, { ...input, contact: { existingId: f.id, name: '', phone: '', relation: 'daughter', primary: true } }, T);
    expect(page1Values(e)).toMatchObject({ kin: f.name, signer: f.name, kinRelation: 'Putri' });
  });
});
