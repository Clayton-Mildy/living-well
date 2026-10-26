// The Lunch card on Today (round 14, "lunch belongs to F&B"), right after the timeline: the day's dishes, the kitchen's approved lunch pictures and how much
// each parent ate ("Ate most", from the F&B team's approved lunch round). It shows only on a day a parent came; a day nobody has approved anything for
// reads "Not logged yet" (today) or "Not logged" (an earlier day) for the amount, like the rest of Today.
import { displayName, type Member, type Photo } from '@cp/shared';
import type { DayStory } from '@cp/shared/rules/family';
import { F, FillCard, PhotoTiles, SectionHead } from './kit';
import { famPhotoAria } from './photoText';
import { useFamilyCtx } from './useFamily';

export function LunchCard({ members, stories, past, onOpenPhoto }: { members: Member[]; stories: DayStory[]; past: boolean; onOpenPhoto: (p: Photo, all: Photo[]) => void }) {
  const { s, t, fmt } = useFamilyCtx();
  const came = stories.map((st, i) => ({ m: members[i], lunch: st.lunch })).filter((x, i) => stories[i].visited && x.lunch);
  if (!came.length) return null;
  const multi = members.length > 1;
  // a parent with an allergy may be served something else, so the dishes are told per parent when they differ
  const groups = new Map<string, Member[]>();
  for (const x of came) { const k = x.lunch!.dishes.join(', '); groups.set(k, [...(groups.get(k) || []), x.m]); }
  const photos = came[0].lunch!.photos;
  const none = t(past ? 'ftoday.dlNonePast' : 'ftoday.dlNone');
  if (!photos.length && ![...groups.keys()].some(Boolean) && !came.some((x) => x.lunch!.amount)) return null; // nothing to say yet
  return (
    <section data-testid="lunch-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <SectionHead>{t('ftoday.dlLunch')}</SectionHead>
      <FillCard radius={22} pad={14} gap={10}>
        {[...groups].filter(([dishes]) => dishes).map(([dishes, ms]) => (
          <span key={dishes} data-testid="lunch-card-dishes" style={{ fontSize: 16, lineHeight: '22px', color: F.text, overflowWrap: 'anywhere' }}>{groups.size > 1 ? `${ms.map(displayName).join(` ${t('common.and')} `)}: ` : ''}{dishes}</span>
        ))}
        {photos.length ? <PhotoTiles photos={photos} edge={false} radius={12} gap={4} testId="lunch-card-photos" label={(p) => famPhotoAria(s, p, t, fmt.lang)} onOpen={(p) => onOpenPhoto(p, photos)} /> : null}
        {came.map((x) => (
          <span key={x.m.id} data-testid="lunch-card-amount" data-member={x.m.id} data-amount={x.lunch!.amount ?? ''} style={{ fontSize: 15, lineHeight: '21px', fontWeight: x.lunch!.amount ? 500 : 400, color: x.lunch!.amount ? F.sage : F.muted }}>
            {multi ? `${displayName(x.m)}: ` : ''}{x.lunch!.amount ? t('ftoday.dlAte_' + x.lunch!.amount) : none}
          </span>
        ))}
      </FillCard>
    </section>
  );
}
