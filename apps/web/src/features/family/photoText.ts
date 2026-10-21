// Words for a family photo (round 8): its caption in the family's language, shared by the Photos tab and the viewer.
import type { ClubState, Lang, Photo } from '@cp/shared';
import { GENERAL_ACTIVITY } from '@cp/shared/rules/activity';
import { photoActivityLabel } from '@cp/shared/rules/family';
import type { TFn } from '../../lib/i18n';

/** "Batik painting", "Lunch", or "Club photo" for a picture that belongs to no activity. */
export function famCaption(s: ClubState, p: Pick<Photo, 'kind' | 'activity'>, t: TFn, lang: Lang): string {
  if (p.kind === 'lunch') return t('fphotos.lunchLabel');
  const a = photoActivityLabel(s, p.activity, lang);
  return !a || a === GENERAL_ACTIVITY ? t('family.clubPhoto') : a;
}

/** The tile's spoken label: "Batik painting, 10:42, group photo". */
export function famPhotoAria(s: ClubState, p: Photo, t: TFn, lang: Lang): string {
  const a = famCaption(s, p, t, lang);
  return t(p.media === 'video' ? 'family.photoAriaVideo' : p.kind === 'group' ? 'family.photoAriaGroup' : p.kind === 'activity' ? 'family.photoAriaAct' : 'family.photoAria', { a, t: p.time });
}
