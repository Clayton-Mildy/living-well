/// <reference types="node" />
// Static check of the activity and calendar areas: every translation key used in their screens and actions exists in English and Indonesian,
// plural pairs are complete, and Indonesian is not left in English. (t() takes plain strings, so tsc cannot catch a typo.)
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { en, id } from '../i18n';

const dir = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));
const sources = [
  ...['activity', 'calendar'].flatMap((f) => {
    const d = dir(`../../../../apps/web/src/features/${f}/`);
    return readdirSync(d).filter((x) => /\.tsx?$/.test(x)).map((x) => ({ file: `${f}/${x}`, src: readFileSync(d + x, 'utf8') }));
  }),
  ...['care.ts', 'photos.ts', 'schedule.ts'].map((x) => ({ file: `actions/${x}`, src: readFileSync(dir(`../actions/${x}`), 'utf8') })),
];
const E = en as Record<string, string>;
const ACTION_NAMES = new Set(['activity.upsert']); // action names that look like keys
const I = id as Record<string, string>;

/** Key literals ('activity.x', "cal.y", `common.z`) and prefixes of dynamic keys ('cal.icon_' + i, `activity.opt.${k}`). */
function keysIn(src: string) {
  const exact = new Set<string>();
  const prefixes = new Set<string>();
  for (const m of src.matchAll(/(['"`])((?:activity|cal|common|nav)\.[A-Za-z0-9_.]*)\1/g)) if (!ACTION_NAMES.has(m[2])) (/[_.]$/.test(m[2]) ? prefixes : exact).add(m[2]);
  for (const m of src.matchAll(/`((?:activity|cal|common|nav)\.[A-Za-z0-9_.]*)\$\{/g)) prefixes.add(m[1]);
  return { exact, prefixes };
}

describe('activity and calendar translations', () => {
  it('every key the screens and actions use exists in EN and ID', () => {
    const missing: string[] = [];
    for (const { file, src } of sources) {
      const { exact, prefixes } = keysIn(src);
      for (const k of exact) {
        const ok = (d: Record<string, string>) => k in d || (k + '_one' in d && k + '_other' in d); // plural base used with plural()
        if (!ok(E)) missing.push(`${file}: ${k} (en)`);
        if (!ok(I)) missing.push(`${file}: ${k} (id)`);
      }
      for (const p of prefixes) {
        if (!Object.keys(E).some((k) => k.startsWith(p))) missing.push(`${file}: ${p}* (en)`);
        if (!Object.keys(I).some((k) => k.startsWith(p))) missing.push(`${file}: ${p}* (id)`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('the dynamic keys the code builds all exist', () => {
    const need: string[] = [];
    for (const k of ['calm', 'cheerful', 'quiet', 'agitated']) need.push('activity.opt.mood.' + k);
    for (const k of ['all', 'most', 'half', 'little', 'none']) need.push('activity.opt.lunch.' + k, 'activity.lunchShort.' + k);
    for (const k of ['joined', 'satOut']) need.push('activity.opt.session.' + k);
    for (const k of ['lunch', 'session', 'mood']) need.push('activity.round.' + k, 'activity.restWhat.' + k, 'activity.notif.act.' + k);
    for (const k of ['markLunch', 'markSession', 'markMood']) need.push('activity.feed.' + k);
    for (const k of ['yes', 'satOut']) need.push('activity.opt.joined.' + k);
    for (const k of ['normal', 'withdrawn']) need.push('activity.opt.communicative.' + k);
    for (const k of ['normal', 'low']) need.push('activity.opt.content.' + k);
    for (const k of ['mood', 'lunch', 'joined', 'communicative', 'content']) need.push('activity.row.' + k);
    for (const k of ['blurry', 'wrongPerson', 'privacy', 'notFlattering', 'duplicate', 'other']) need.push('activity.reason.' + k);
    for (const k of ['closed', 'holiday', 'outing']) need.push('cal.t_' + k, 'cal.notif.added_' + k, 'cal.notif.changed_' + k, 'cal.notif.removed_' + k, 'cal.feed.added_' + k, 'cal.feed.changed_' + k, 'cal.feed.removed_' + k);
    for (const k of ['music_note', 'palette', 'self_improvement', 'yard', 'extension', 'style', 'skillet', 'menu_book', 'interests', 'sports_esports', 'theater_comedy', 'brush', 'local_florist', 'fitness_center', 'celebration', 'directions_walk']) need.push('cal.icon_' + k);
    for (const k of ['activity.nowAt', 'activity.nextAt', 'activity.lastAt', 'activity.lunch', 'activity.tea', 'cal.errTitle']) need.push(k);
    for (const base of ['activity.nInClub', 'activity.sentGroupPhoto', 'activity.sentGroupVideo', 'activity.sendTo', 'activity.photosToday', 'activity.photosCount', 'activity.hiddenCount', 'activity.bulkSaved', 'activity.restMarked', 'activity.markRestTitle', 'activity.pendingCount', 'activity.picCount', 'cal.changesPending'])
      need.push(base + '_one', base + '_other');
    // kinds, feed keys and error codes the actions emit
    for (const k of ['logSaved', 'logUpdated', 'newPhoto', 'newVideo', 'newPhotos', 'newMedia', 'photoRejected', 'photosRejected', 'activityPhotoRejected', 'activityPhotosRejected']) need.push('activity.notif.' + k);
    for (const k of ['log', 'logEdited', 'photo', 'video', 'groupPhoto', 'groupVideo', 'photoHidden', 'photoRestored', 'photoRemoved', 'activityPhoto']) need.push('activity.feed.' + k);
    for (const k of ['noSession', 'dateRange', 'notAttended', 'nothingToLog', 'soloOne', 'alreadyHidden', 'notHidden', 'photoPending', 'notPending', 'picDate', 'picSession']) need.push('activity.err.' + k);
    need.push('cal.notif.schedulePublished');
    need.push('cal.feed.schedulePublished');
    for (const k of ['badActivity', 'badRoom', 'badTeacher', 'inactiveActivity', 'inactiveTeacher', 'noTeacher', 'futureOnly', 'noDraft', 'pastDate', 'endBeforeStart', 'rangeTooLong', 'timeBoth', 'timeOrder', 'pastEvent', 'dupName']) need.push('cal.err.' + k);
    expect(need.filter((k) => !(k in E) || !(k in I))).toEqual([]);
  });

  it('Indonesian is translated, not copied (short shared words are fine)', () => {
    const words = (x: string) => x.replace(/\{\w+\}/g, '').split(/[^\p{L}]+/u).filter(Boolean).length;
    const copied = Object.keys(E).filter((k) => /^(activity|cal)\./.test(k) && E[k] === I[k] && words(E[k]) >= 3);
    expect(copied).toEqual([]);
  });

  it('placeholders match between languages', () => {
    const vars = (s: string) => (s.match(/\{\w+\}/g) || []).sort().join(',');
    const bad = Object.keys(E).filter((k) => /^(activity|cal)\./.test(k) && vars(E[k]) !== vars(I[k]));
    expect(bad).toEqual([]);
  });
});
