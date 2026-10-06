// Every i18n key the members area uses exists in English and Indonesian (static keys found in the source, plus the families of keys built
// from data such as relations, allergies or the photo kinds), the placeholders match, and the Indonesian is translated, not copied.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { getAction } from '../actions';
import { en, id } from '../i18n';
import { DIETS, DOC_TYPES, END_REASONS, FOODS, MED_TIMINGS, MOBILITIES, RELATIONS, DRUGS } from './members';

const root = resolve(__dirname, '../../../..');
const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = [
  ...walk(join(root, 'apps/web/src/features/members')),
  join(root, 'packages/shared/src/actions/members.ts'), join(root, 'packages/shared/src/actions/family.ts'), join(root, 'packages/shared/src/rules/members.ts'),
].filter((f) => /\.(ts|tsx)$/.test(f) && !f.endsWith('.test.ts'));

const dynamic = (prefix: string, values: readonly (string | number)[]) => values.map((v) => prefix + v);
const FAMILIES = [
  ...dynamic('members.f.', ['active', 'in', 'att', 'flex', 'gold', 'ended']),
  ...dynamic('profile.rel.', RELATIONS), ...dynamic('profile.food.', FOODS), ...dynamic('profile.drug.', DRUGS), ...dynamic('profile.mobility.', [...MOBILITIES, 'none']),
  ...dynamic('profile.diet.', DIETS), ...dynamic('profile.timing.', MED_TIMINGS), ...dynamic('profile.doc.', [...DOC_TYPES, 'other']), ...dynamic('profile.endReason.', END_REASONS),
  ...dynamic('profile.tab.', ['overview', 'health', 'care', 'photos', 'att', 'docs', 'plan', 'family', 'notes', 'history']),
  // the Photos section of Reviews: the approve and reject messages are built from the count and the notify switch
  ...['reviews.photosApprovedOne', 'reviews.photosApprovedN', 'reviews.photosApprovedToldOne', 'reviews.photosApprovedToldN', 'reviews.photosRejectedOne', 'reviews.photosRejectedN'],
  ...dynamic('reviews.photoKind.', ['solo', 'group', 'lunch', 'arrival']), ...dynamic('reviews.status.', ['pending', 'approved', 'rejected', 'withdrawn', 'superseded', 'acknowledged', 'reverted']),
  // shared keys the screens reuse from other namespaces
  'common.pendingApproval', 'common.clear', 'common.staffOnly', 'common.sharedFam', 'err.noteRequired', 'status.alert', 'status.watch',
];

describe('i18n coverage for the members area', () => {
  const used = new Set<string>(FAMILIES);
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/['"`]((?:members|profile|reviews)\.[A-Za-z0-9_.]*[A-Za-z0-9])['"`]/g)) if (!getAction(m[1])) used.add(m[1]); // action names (members.end…) are not text
  }
  const E = en as Record<string, string>, I = id as Record<string, string>;
  it('finds the keys', () => expect(used.size).toBeGreaterThan(150));
  it('every key exists in English', () => expect([...used].filter((k) => !(k in E))).toEqual([]));
  it('every key exists in Indonesian', () => expect([...used].filter((k) => !(k in I))).toEqual([]));
  it('the new keys (list rows, photos, usernames and reset, the Photos section) are all there in both languages', () => {
    const keys = [
      'members.lastVisit', 'members.neverVisited', 'members.pagerLabel', 'members.planGoldTip', 'members.planFlexTip',
      'profile.takePhoto', 'profile.photoSaved', 'profile.photoSavedPending', 'profile.photoPending', 'profile.photoUploadFailed', 'profile.photosPager',
      'profile.usernameValue', 'profile.noLogin', 'profile.resetPassword', 'profile.resetPasswordFor', 'profile.resetTitle', 'profile.resetSub', 'profile.resetDone', 'profile.resetFailed',
      'reviews.tabPhotos', 'reviews.selectAll', 'reviews.clearSelection', 'reviews.selectedN', 'reviews.approvePhotos', 'reviews.rejectPhotos', 'reviews.notifyFamilies', 'reviews.notifyFamiliesSub',
      'reviews.rejectPhotosTitleOne', 'reviews.rejectPhotosTitleN', 'reviews.rejectPhotosSub', 'reviews.rejectPhotosReason', 'reviews.nonePhotos', 'reviews.nonePhotosSub', 'reviews.photosPager',
    ];
    expect(keys.filter((k) => !(k in E) || !(k in I))).toEqual([]);
  });
  it('the placeholders match between the languages', () => {
    const ph = (x: string) => (x.match(/\{\w+\}/g) || []).sort().join(',');
    const bad = Object.keys(E).filter((k) => /^(members|profile|reviews)\./.test(k)).filter((k) => ph(E[k]) !== ph(I[k]));
    expect(bad).toEqual([]);
  });
  it('the Indonesian is translated, not copied, for the long sentences', () => {
    const same = Object.keys(E).filter((k) => /^(members|profile|reviews)\./.test(k)).filter((k) => E[k].length > 40 && E[k] === I[k]);
    expect(same).toEqual([]);
  });
  it('counted texts have a singular and a plural form in both languages', () => {
    for (const base of ['reviews.photosWaiting', 'reviews.rejectPhotosTitle']) {
      for (const lang of [E, I]) { expect(`${base}One` in lang, `${base}One`).toBe(true); expect(`${base}N` in lang, `${base}N`).toBe(true); }
    }
  });
});
