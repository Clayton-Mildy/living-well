// i18n completeness for the lobby and messages areas: every key the actions emit (errors, feed entries, notification kinds,
// stored automatic replies), every key the screens write literally, and every key the screens build at run time
// ('lobby.food.' + allergen, 'chat.topic.' + topic, …) exists in English and Indonesian, and the Indonesian text is not just the
// English text. The drop-in club has no "expected" members, escorts, absences or bookings: none of those words survive here.
import { readdirSync, readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { DICT, hasKey, translate } from '../index';
import { ALL_TOPICS } from '../rules/chat';

const src = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8');
/** Dotted i18n keys used as string literals after `ctx.fail(`, `new DomainError(`, `kind:` and `key:` in an actions file. */
const keysIn = (text: string) => {
  const out = new Set<string>();
  for (const m of text.matchAll(/(?:ctx\.fail\(|new DomainError\(|\bkind:\s*|\bkey:\s*)'([a-z]+\.[A-Za-z.]+)'/g)) out.add(m[1]);
  for (const m of text.matchAll(/key:\s*`([a-z]+\.[A-Za-z.]+)\.\$\{/g)) out.add(m[1] + '.*'); // template keys, checked below
  return [...out];
};
/** Every 'lobby.…' / 'chat.…' string literal in the screens of a feature folder (also inside ternaries and tables). */
const screenKeys = (dir: string) => {
  const out = new Set<string>();
  const root = new URL(dir, import.meta.url);
  for (const f of readdirSync(root).filter((x) => /\.(tsx?|ts)$/.test(x))) {
    for (const m of readFileSync(new URL(f, root), 'utf8').matchAll(/'((?:lobby|chat)\.[A-Za-z](?:[A-Za-z.]*[A-Za-z])?)'/g)) out.add(m[1]);
  }
  return [...out].sort();
};
const both = (key: string) => [DICT.en[key], DICT.id[key]] as const;

describe('keys emitted by the lobby and messages actions', () => {
  const emitted = [...keysIn(src('./attendance.ts')), ...keysIn(src('./messages.ts'))].filter((k) => !k.endsWith('.*'));
  it('finds the keys it should (guards against the regex silently matching nothing)', () => {
    expect(emitted).toEqual(expect.arrayContaining(['lobby.err.faceOptOut', 'lobby.feed.extraVisit', 'lobby.notif.extraVisit', 'chat.err.empty', 'chat.notif.reply', 'notif.checkedIn', 'err.closedDay']));
    expect(emitted.length).toBeGreaterThan(25);
  });
  it.each(emitted)('%s exists in English and Indonesian', (key) => {
    expect(hasKey(key), key).toBe(true);
    const [en, id] = both(key);
    expect(en, key).toBeTruthy();
    expect(id, key).toBeTruthy();
  });
  it('per-topic feed keys and stored automatic replies exist for every topic a family can write to', () => {
    for (const topic of ALL_TOPICS) {
      expect(hasKey(`chat.feed.family.${topic}`), topic).toBe(true);
      expect(hasKey(`chat.autoAck.${topic}`), topic).toBe(true);
      expect(hasKey(`chat.topic.${topic}`), topic).toBe(true);
      expect(hasKey(`chat.teamSub.${topic}`), topic).toBe(true);
    }
  });
});

describe('keys written literally in the screens', () => {
  const lobby = screenKeys('../../../../apps/web/src/features/lobby/');
  const chat = screenKeys('../../../../apps/web/src/features/chat/');
  it('finds the keys it should', () => {
    expect(lobby).toEqual(expect.arrayContaining(['lobby.arrivals', 'lobby.extraVisit', 'lobby.usually', 'lobby.checkInTitle']));
    expect(chat).toEqual(expect.arrayContaining(['chat.newMessage', 'chat.placeholder']));
  });
  it.each([...lobby, ...chat])('%s exists in English and Indonesian', (key) => {
    expect(hasKey(key), key).toBe(true);
    expect(DICT.id[key], key).toBeTruthy();
  });
});

describe('keys the screens build at run time', () => {
  const dynamic: [string, string[]][] = [
    ['lobby.food.', ['shellfish', 'seafood', 'fish', 'peanuts', 'eggs', 'dairy', 'gluten']],
    ['lobby.mobility.', ['walkingStick', 'walker', 'wheelchair']],
    ['lobby.diet.', ['softFood', 'lowSalt', 'vegetarian', 'sugarFree']],
    ['lobby.drug.', ['penicillin', 'sulfa', 'aspirin', 'ibuprofen']],
    ['lobby.rel.', ['daughter', 'son', 'daughterInLaw', 'sonInLaw', 'granddaughter', 'grandson', 'grandchild', 'spouse', 'sibling', 'other']],
    ['lobby.source.', ['referral', 'instagram', 'website', 'walkIn', 'other']],
    ['lobby.', ['inClub', 'goneHome']],
    ['chat.ref.', ['dailyLog', 'reading', 'photo', 'invoice', 'feedback']],
    ['chat.q.', ['staff1', 'staff2', 'staff3', 'famLobby1', 'famLobby2', 'famLobby3', 'famNurse1', 'famNurse2', 'famNurse3']],
    ['status.', ['normal', 'watch', 'alert', 'pending']],
  ];
  for (const [prefix, names] of dynamic) {
    it(`${prefix}* is complete in both languages`, () => {
      for (const n of names) {
        expect(hasKey(prefix + n), prefix + n).toBe(true);
        expect(DICT.id[prefix + n], prefix + n).toBeTruthy();
      }
    });
  }
});

describe('the drop-in club: no expected members, escorts, absences, bookings or leave', () => {
  const mine = (k: string) => (k.startsWith('lobby.') || k.startsWith('chat.')) && !k.startsWith('lobby.source.'); // "walk-in" is still a way an enquiry arrives
  it('the removed keys are gone from the lobby and chat namespaces', () => {
    const gone = /^(lobby|chat)\.(expected|toArrive|statusExpected|statusNotBooked|statusLeave|statusAbsent|statusLate|reason\.|escort|absent|late|leave|book|walkIn|walkInTag|walkInNote|lateSub|collected|broughtBy|brought|setEscort|tEscort|dayNotice|ref\.dayNotice|none[A-Z]\w*Expected|noneExpected|allArrived)/;
    expect(Object.keys(DICT.en).filter((k) => gone.test(k))).toEqual([]);
    expect(Object.keys(DICT.id).filter((k) => gone.test(k))).toEqual([]);
  });
  it('no lobby or chat text talks about who is expected, who brought or collected a member, or absences', () => {
    const en = /\b(expected|to arrive|brought by|collected by|collected|escort|walk-in|absent|absence|running late|on leave)\b/i; // guests are still "booked", so that word is fine
    const id = /\b(diharapkan|dijemput|diantar|pengantar|penjemput|terlambat|tidak hadir|cuti|pemesanan)\b/i;
    for (const k of Object.keys(DICT.en).filter(mine)) {
      expect(DICT.en[k], k).not.toMatch(en);
      expect(DICT.id[k], k).not.toMatch(id);
    }
  });
  it('the usual arrival reads "Usually arrives around …", never "Expected"', () => {
    expect(translate('en', 'lobby.usually', { t: '10:05' })).toBe('Usually arrives around 10:05');
    expect(translate('id', 'lobby.usually', { t: '10:05' })).toBe('Biasanya tiba sekitar 10:05');
  });
  it('the extra-day note names the visit, the quota and the price', () => {
    expect(translate('en', 'lobby.extraVisit', { n: 11, q: 10, p: 'Rp 650.000' })).toBe('Visit 11 of 10 this month: an extra day, Rp 650.000 on next month’s invoice.');
    expect(translate('id', 'lobby.notif.extraVisit', { name: 'Oma Lina', n: 11, price: 'Rp 650.000' })).toContain('Rp 650.000');
    expect(translate('en', 'lobby.visitOf', { n: 8, q: 10 })).toBe('Flex · visit 8 of 10 this month');
    expect(translate('en', 'lobby.goldU')).toBe('Gold · unlimited days');
  });
});

describe('Indonesian is translated, not copied', () => {
  const same = (prefix: string) =>
    Object.keys(DICT.en)
      .filter((k) => k.startsWith(prefix))
      .filter((k) => DICT.en[k] === DICT.id[k] && /[a-z]{4,}/i.test(DICT.en[k].replace(/\{\w+\}/g, '')) && !/^(Flex|Gold|Walker|Gluten|Instagram|Ibuprofen|Aspirin|Sulfa|Vegetarian|Diabetes|Lobby)$/.test(DICT.en[k]));
  it('lobby and chat texts differ between the languages (apart from names and loan words)', () => {
    // '{name} · {rel}' style templates carry no words of their own
    expect([...same('lobby.'), ...same('chat.')]).toEqual([]);
  });
  it('placeholders match between English and Indonesian', () => {
    // English picks "his" or "her" ({p}); Indonesian "-nya" is neutral, so those texts take no pronoun
    const neutral = new Set(['lobby.nannyNote']);
    const vars = (s: string, k: string) => (s.match(/\{\w+\}/g) || []).filter((v) => !(neutral.has(k) && v === '{p}')).sort().join(',');
    for (const k of Object.keys(DICT.en).filter((x) => x.startsWith('lobby.') || x.startsWith('chat.'))) expect(vars(DICT.id[k], k), k).toBe(vars(DICT.en[k], k));
  });
  it('translate() renders the stored automatic replies with the family’s name', () => {
    expect(translate('en', 'chat.autoAck.lobby', { name: 'Maria' })).toBe('Thanks Maria, noted. We’ll take care of it.');
    expect(translate('id', 'chat.autoAck.nurse', { name: 'Maria', member: 'Oma Lina' })).toBe('Terima kasih, Maria. Saya akan memeriksa Oma Lina dan membalas di sini.');
  });
});
