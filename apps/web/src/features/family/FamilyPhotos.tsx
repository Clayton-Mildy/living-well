// Round 8 family Photos (the prototype's Photos tab): a big title, the monthly Memories carousel (one card per parent, then earlier months), filter chips,
// and the days with their pictures edge to edge. A card opens the memories story; a tile opens the viewer.
// Round 11 (KC: the two-parent navigation): the shared parent switch on the title row — Both, or one parent's pictures and memory cards alone; the chosen
// parent's name sits under the title. The choice is the family's stored one, shared with Today, Calendar and Health.
// Round 8c, laptop (the prototype's desktop, up to 1180px wide): the title and the filter chips on one line (chips on the right), the memory cards as a grid,
// and each day as a grid of six rounded tiles with small gaps. A phone or tablet keeps the centred column with the edge-to-edge grid.
// KC round 9: the days are a FEED (like Instagram) — each day's pictures as posts (a session, the lunch table, a parent's own pictures), big and swiped
// sideways, captioned underneath; nothing has to be opened to see them. On a laptop the feed is a centred column. A tap still opens the viewer.
// A floating round button (like the Demo button) switches between this feed and the gallery of tiles from before; the choice is remembered.
// KC round 10 ("the user will probably come here to see the past images, maybe a month ago; now it's hard to navigate"): a date filter beside the chips — a calendar
// button that opens the app's own date picker, limited to the days that have pictures, with quick picks under the calendar (Last week, This month, Last month,
// the month before by name). A chosen day or span shows those days alone, as a chip with a × to clear.
// KC round 10 ("press long to select, multi-select to save in bulk"): a long press on any picture starts selecting; taps add more; a bar at the foot saves them
// to the gallery (the share sheet on a phone, downloads elsewhere) or clears the selection. The viewer has its own Save button for one picture.
import { useCallback, useMemo, useState, type CSSProperties } from 'react';
import { addDays, addMonths, daysInMonth, memberName, weekStart, ym, type ISODate, type Photo, type YM } from '@cp/shared';
import { famPhotoDays, famPhotoPosts, filterPhotoDays, groupsPresent, memoryCards, type PhotoFilter } from '@cp/shared/rules/famPhotos';
import { DateField, Icon } from '../../components/ui';
import { savePhotos } from '../../lib/saveMedia';
import { say } from '../../store/ui';
import type { PhotoSelect } from './select';
import { PhotoViewer } from '../activity/PhotoViewer';
import { Chips, F, FamPage, LargeTitle, PhotoTiles, useFamWide } from './kit';
import { ParentSwitch } from './ParentSwitch';
import { MemoriesStory } from './MemoriesStory';
import { MemoryCards } from './MemoryCards';
import { PostCard } from './PhotoFeed';
import { PhotoGrid } from './PhotoGrid';
import { famPhotoAria } from './photoText';
import { useDevice } from '../../hooks/useDevice';
import { useFamilyCtx, useFamilySel } from './useFamily';

const PAGE_DAYS = 10; // ten days at a time, "Show more days" for the rest
const VIEW_KEY = 'cp.fam.photoView';
type View = 'feed' | 'grid';
const readView = (): View => { try { return localStorage.getItem(VIEW_KEY) === 'grid' ? 'grid' : 'feed'; } catch { return 'feed'; } };

export function FamilyPhotos() {
  const { s, t, fmt, now, user } = useFamilyCtx();
  const wide = useFamWide();
  const { choices, sel, who, setSel, multi } = useFamilySel();
  const [filter, setFilter] = useState<PhotoFilter>('all');
  const [span, setSpan] = useState<Span | null>(null);
  const [limit, setLimit] = useState(PAGE_DAYS);
  const [viewer, setViewer] = useState<{ startId: string } | null>(null);
  const [view, setView] = useState<View>(readView);
  const { isPhone } = useDevice();
  const toggleView = () => { const v: View = view === 'feed' ? 'grid' : 'feed'; setView(v); try { localStorage.setItem(VIEW_KEY, v); } catch { /* private window */ } };
  const [story, setStory] = useState<{ memberId: string; month: YM; cover: Photo | null } | null>(null);
  // selecting: null = not selecting; else the ids picked so far (an empty set stays in selecting mode until Cancel)
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const [saving, setSaving] = useState(false);
  const closeViewer = useCallback(() => setViewer(null), []);
  const closeStory = useCallback(() => setStory(null), []);
  const whoKey = who.join(',');
  const parents = useMemo(() => who.map((id) => s.members[id]).filter(Boolean), [whoKey, s.members]); // eslint-disable-line react-hooks/exhaustive-deps
  const allDays = useMemo(() => famPhotoDays(s, who), [s, whoKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const cards = useMemo(() => memoryCards(s, parents, now.today), [s, parents, now.today]);
  if (!user || !choices.length) return null;
  // round 11: the switch (Both and each face) on the title row; one parent chosen = their name under the title
  const switcher = multi ? <ParentSwitch tone="page" members={choices.map((id) => s.members[id]).filter(Boolean)} sel={sel} onPick={(id) => { setSel(id); setLimit(PAGE_DAYS); }} /> : null;
  const whoName = multi && sel !== 'both' && s.members[sel] ? memberName(s.members[sel]) : undefined;

  const groups = groupsPresent(allDays);
  const f: PhotoFilter = filter !== 'all' && !groups.includes(filter) ? 'all' : filter;
  const found = filterPhotoDays(allDays, f);
  // the date filter: a day (only days that have pictures of the chosen kind can be picked) or a quick span; one the kind filter emptied falls back to all days
  const pickable = new Set(found.map((d) => d.date));
  const within = (sp: Span) => found.filter((d) => d.date >= sp.from && d.date <= sp.to);
  const onSpan = span && within(span).length ? span : null;
  const inSpan = onSpan ? within(onSpan) : found;
  const days = inSpan.slice(0, limit).map((d) => ({ ...d, posts: famPhotoPosts(d.photos) }));
  const all = view === 'feed' ? days.flatMap((d) => d.posts.flatMap((x) => x.photos)) : days.flatMap((d) => d.photos); // the viewer goes through them in the order shown
  const select: PhotoSelect = {
    on: !!picked,
    has: (id) => !!picked?.has(id),
    toggle: (p) => setPicked((cur) => { const next = new Set(cur ?? []); if (next.has(p.id)) next.delete(p.id); else next.add(p.id); return next; }),
    start: (p) => setPicked((cur) => (cur ? new Set([...cur, p.id]) : new Set([p.id]))),
  };
  const pickedList = picked ? all.filter((p) => picked.has(p.id) && p.mediaId) : [];
  // KC round 10 ("bulk select per day"): a whole day in one tap — the day's count starts selecting with that day picked; while selecting, the day's check toggles it
  const dayAll = (ps: Photo[]) => ps.length > 0 && ps.every((p) => picked?.has(p.id));
  const pickDay = (ps: Photo[]) => setPicked((cur) => { const next = new Set(cur ?? []); const on = ps.every((p) => next.has(p.id)); for (const p of ps) { if (on) next.delete(p.id); else next.add(p.id); } return next; });
  const saveAll = async () => {
    if (!pickedList.length || saving) return;
    setSaving(true);
    try {
      const r = await savePhotos(pickedList);
      if (!r.cancelled) { setPicked(null); if (r.how === 'download') say(r.n === 1 ? t('fphotos.savedOne') : t('fphotos.savedN', { n: r.n }), { icon: 'download_done' }); }
    } catch { say(t('fphotos.saveFailed'), { tone: 'error', icon: 'error' }); }
    setSaving(false);
  };
  const chipLabel: Record<PhotoFilter, string> = { all: t('fphotos.chipAll'), portraits: t('fphotos.chipPortraits'), group: t('fphotos.chipGroup'), activities: t('fphotos.chipActivities'), lunch: t('fphotos.chipLunch') };
  const dayTitle = (d: string) => (d === now.today ? t('common.today') : fmt.fd(d, { weekday: 'long', day: 'numeric', month: 'short' }).replace(/,/g, ''));
  const count = (n: number) => (n === 1 ? t('family.phCountOne') : t('family.phCountN', { n }));

  const onFilter = (v: PhotoFilter) => { setFilter(v); setLimit(PAGE_DAYS); };
  const pickSpan = (v: Span | null) => { setSpan(v); setLimit(PAGE_DAYS); };
  const chipItems = (['all', ...groups] as PhotoFilter[]).map((v) => ({ value: v, label: chipLabel[v] }));
  // the quick picks: last week, this month, last month and the month before it (by name); only spans that have pictures
  const quick = useMemo(() => {
    const today = now.today, ws = weekStart(today), m0 = ym(today), m1 = addMonths(m0, -1), m2 = addMonths(m0, -2);
    const month = (m: YM, label: string): Span => ({ from: `${m}-01`, to: `${m}-${daysInMonth(m)}`, label });
    const all: Span[] = [{ from: addDays(ws, -7), to: addDays(ws, -1), label: t('fphotos.qLastWeek') }, month(m0, t('fphotos.qThisMonth')), month(m1, t('fphotos.qLastMonth')), month(m2, fmt.fmonth(m2))];
    return all.filter((sp) => found.some((d) => d.date >= sp.from && d.date <= sp.to));
  }, [now.today, found, t, fmt]);
  const dateFilter = pickable.size > 1 ? <DateJump value={onSpan} days={pickable} today={now.today} quick={quick} onPick={pickSpan} lg={wide} /> : null;
  return (
    <FamPage testId="family-photos" gap={wide ? 22 : 16} wide>
      <LargeTitle sub={whoName} right={wide ? (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {switcher}
          {groups.length > 1 ? <Chips<PhotoFilter> lg label={t('fphotos.filterAria')} testId="photo-filter" value={f} onChange={onFilter} bleed={0} items={chipItems} /> : null}
          {dateFilter}
        </span>
      ) : switcher ?? undefined}>{t('nav.photos')}</LargeTitle>

      {cards.length ? <MemoryCards cards={cards} onOpen={(c) => setStory({ memberId: c.memberId, month: c.month, cover: c.cover })} /> : null}

      {/* phone and tablet: the chips row (it scrolls sideways inside the page) with the date filter at its end; the laptop has them on the title's line */}
      {!wide && (groups.length > 1 || dateFilter) ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 -16px', padding: '0 16px' }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex' }}>{groups.length > 1 ? <Chips<PhotoFilter> label={t('fphotos.filterAria')} testId="photo-filter" value={f} onChange={onFilter} bleed={0} items={chipItems} /> : null}</div>
          {dateFilter}
        </div>
      ) : null}

      <div data-testid="photo-feed" data-view={view} data-from={onSpan?.from} data-to={onSpan?.to} style={{ display: 'flex', flexDirection: 'column', gap: view === 'feed' ? (wide ? 30 : 26) : (wide ? 22 : 16), width: '100%', maxWidth: wide && view === 'feed' ? 560 : undefined, alignSelf: 'center' }}>
        {days.map((d) => (
          <section key={d.date} data-testid="photo-day" data-date={d.date} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: wide ? 0 : '0 4px', minHeight: 32 }}>
              <h2 style={{ margin: 0, fontSize: wide ? 18 : 17, lineHeight: 1.3, fontWeight: 600, color: F.ink }}>{dayTitle(d.date)}</h2>
              {picked ? (
                <button type="button" onClick={() => pickDay(d.photos)} aria-pressed={dayAll(d.photos)} aria-label={t(dayAll(d.photos) ? 'fphotos.selDayOff' : 'fphotos.selDay')} data-testid="select-day" data-date={d.date} className="cp-press"
                  style={{ height: 32, padding: '0 4px 0 10px', borderRadius: 999, border: 'none', background: dayAll(d.photos) ? F.ink : F.fill, color: dayAll(d.photos) ? '#FFFFFF' : F.text, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                  {count(d.photos.length)}
                  <span aria-hidden="true" style={{ width: 22, height: 22, borderRadius: 999, background: dayAll(d.photos) ? '#FFFFFF' : 'transparent', boxShadow: dayAll(d.photos) ? 'none' : `inset 0 0 0 2px ${F.chev}`, color: F.ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{dayAll(d.photos) ? <Icon name="check" size={16} color={F.ink} /> : null}</span>
                </button>
              ) : (
                <button type="button" onClick={() => setPicked(new Set(d.photos.map((p) => p.id)))} aria-label={t('fphotos.selDay')} title={t('fphotos.selDay')} data-testid="select-day-start" data-date={d.date} className="cp-press"
                  style={{ height: 32, padding: '0 4px 0 8px', borderRadius: 999, border: 'none', background: 'transparent', color: F.muted, fontSize: 13, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                  {count(d.photos.length)}<Icon name="check_circle" size={20} color={F.chev} />
                </button>
              )}
            </div>
            {view === 'feed'
              ? d.posts.map((post) => <PostCard key={post.key} post={post} wide={wide} select={select} onOpen={(p) => setViewer({ startId: p.id })} />)
              : wide
                ? <PhotoGrid photos={d.photos} gap={6} select={select} label={(p) => famPhotoAria(s, p, t, fmt.lang)} onOpen={(p) => setViewer({ startId: p.id })} />
                : <PhotoTiles photos={d.photos} select={select} label={(p) => famPhotoAria(s, p, t, fmt.lang)} onOpen={(p) => setViewer({ startId: p.id })} />}
          </section>
        ))}
      </div>

      {inSpan.length > limit ? (
        <button type="button" onClick={() => setLimit((n) => n + PAGE_DAYS)} data-testid="photos-more" className="cp-fam-press"
          style={{ height: 48, border: 'none', borderRadius: 14, background: F.fill, color: F.ink, fontSize: 15, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', ...(wide ? { alignSelf: 'center', padding: '0 36px' } : {}) }}>{t('family.phMore')}</button>
      ) : null}

      {!days.length ? (
        <div data-testid="photos-empty" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '48px 20px', textAlign: 'center' }}>
          <Icon name="photo_library" size={34} weight={300} color={F.chev} />
          <span style={{ fontSize: 17, fontWeight: 500, color: F.text }}>{t('family.phEmpty')}</span>
          <span style={{ fontSize: 14, color: F.muted, lineHeight: 1.4 }}>{t('family.phEmptySub')}</span>
        </div>
      ) : null}

      {/* selecting: the bar at the foot — how many, select everything shown, save them, or stop */}
      {picked ? (
        <div role="toolbar" aria-label={t('fphotos.selToolbar')} data-testid="select-bar" data-count={picked.size}
          style={{ position: 'fixed', zIndex: 46, left: '50%', transform: 'translateX(-50%)', bottom: isPhone ? 'calc(96px + env(safe-area-inset-bottom, 0px))' : 78, width: isPhone ? 'calc(100% - 24px)' : 'min(480px, calc(100% - 48px))', height: 56, padding: '0 6px 0 16px', boxSizing: 'border-box', borderRadius: 999, background: '#24201C', color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 8px 24px rgba(20,16,12,.35)', animation: 'cpUp .18s ease-out' }}>
          <span data-testid="select-count" style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontVariantNumeric: 'tabular-nums' }}>{picked.size ? t('fphotos.selN', { n: picked.size }) : t('fphotos.selNone')}</span>
          <button type="button" onClick={() => setPicked(new Set(all.filter((p) => p.mediaId).map((p) => p.id)))} data-testid="select-all" className="cp-press" style={{ height: 40, padding: '0 12px', borderRadius: 999, border: 'none', background: 'transparent', color: '#FFFFFF', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>{t('fphotos.selAll')}</button>
          <button type="button" onClick={() => void saveAll()} disabled={!pickedList.length || saving} data-testid="select-save" className="cp-press" style={{ height: 44, padding: '0 16px 0 12px', borderRadius: 999, border: 'none', background: '#FFFFFF', color: '#24201C', fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, cursor: pickedList.length && !saving ? 'pointer' : 'default', opacity: pickedList.length && !saving ? 1 : 0.5, fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
            <Icon name={saving ? 'progress_activity' : 'download'} size={20} style={saving ? { animation: 'cpSpin 0.9s linear infinite' } : undefined} />{t('fphotos.selSave')}
          </button>
          <button type="button" onClick={() => setPicked(null)} aria-label={t('fphotos.selCancel')} data-testid="select-cancel" className="cp-press" style={{ width: 44, height: 44, borderRadius: 999, border: 'none', background: 'transparent', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}><Icon name="close" size={22} /></button>
        </div>
      ) : null}

      {days.length && !picked ? (
        <button type="button" onClick={toggleView} data-testid="photo-view-toggle" data-view={view} aria-label={t(view === 'feed' ? 'fphotos.viewGallery' : 'fphotos.viewFeed')} title={t(view === 'feed' ? 'fphotos.viewGallery' : 'fphotos.viewFeed')} className="cp-press"
          style={{ position: 'fixed', zIndex: 45, ...(isPhone ? { right: 12, bottom: 102, width: 40, height: 40, background: 'rgba(36,32,28,0.9)' } : { right: 24, bottom: 78, width: 42, height: 42, background: '#24201C' }), padding: 0, borderRadius: 999, border: 'none', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 14px rgba(20,16,12,.25)' } as CSSProperties}>
          <Icon name={view === 'feed' ? 'grid_view' : 'view_agenda'} size={20} color="#FFFFFF" />
        </button>
      ) : null}
      {viewer ? <PhotoViewer photos={all} startId={viewer.startId} onClose={closeViewer} audience="family" /> : null}
      {story ? <MemoriesStory memberId={story.memberId} month={story.month} cover={story.cover} onClose={closeStory} /> : null}
    </FamPage>
  );
}

/** The days shown: one day, or a quick span (last week, a month); `label` is what the chip says. */
interface Span { from: ISODate; to: ISODate; label: string }

/**
 * KC round 10: the date filter. A round calendar button (an invisible DateField over it, so the picker, its keyboard handling and its phone sheet are the app's own),
 * limited to the days that have pictures, with the quick picks in its footer. With a day or span chosen it is a dark chip with the name and a × that clears it;
 * the chip itself opens the picker again.
 */
function DateJump({ value, days, today, quick, onPick, lg }: { value: Span | null; days: Set<ISODate>; today: ISODate; quick: Span[]; onPick: (v: Span | null) => void; lg?: boolean }) {
  const { t, fmt } = useFamilyCtx();
  const [focus, setFocus] = useState(false);
  const sorted = Array.from(days).sort();
  const h = lg ? 36 : 34;
  const ring = focus ? `0 0 0 2px #FFFFFF, 0 0 0 4px ${F.ink}` : 'none';
  const oneDay = value && value.from === value.to ? value.from : '';
  const label = value ? value.label : '';
  const dayLabel = (d: ISODate) => (d === today ? t('common.today') : fmt.fd(d, { weekday: 'short', day: 'numeric', month: 'short' }).replace(/,/g, ''));
  return (
    <div data-testid="photo-date" data-value={value ? `${value.from}..${value.to}` : undefined} style={{ display: 'flex', alignItems: 'center', flex: 'none', height: h, borderRadius: 999, background: value ? F.ink : F.fill, color: value ? '#FFFFFF' : F.text, boxShadow: ring }} onFocusCapture={() => setFocus(true)} onBlurCapture={() => setFocus(false)}>
      <div style={{ position: 'relative', height: h, display: 'flex', alignItems: 'center', gap: 6, padding: value ? '0 4px 0 12px' : 0, width: value ? undefined : h, justifyContent: 'center' }}>
        <span aria-hidden="true" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', pointerEvents: 'none' }}>
          <Icon name="calendar_month" size={20} color="currentColor" />{label}
        </span>
        <div style={{ position: 'absolute', inset: 0, opacity: 0, overflow: 'hidden', borderRadius: 999 }}>
          <DateField ariaLabel={t('fphotos.dateAria')} value={oneDay} onChange={(v) => { if (v) onPick({ from: v, to: v, label: dayLabel(v) }); }} min={sorted[0]} max={sorted[sorted.length - 1]} disabledDate={(d) => !days.has(d)}
            quick={quick.map((q) => ({ key: q.label, label: q.label, run: () => onPick(q) }))} />
        </div>
      </div>
      {value ? (
        <button type="button" onClick={() => onPick(null)} aria-label={t('fphotos.dateClear')} data-testid="photo-date-clear" className="cp-press"
          style={{ width: h, height: h, borderRadius: 999, border: 'none', background: 'transparent', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, flex: 'none' }}>
          <Icon name="close" size={18} color="#FFFFFF" />
        </button>
      ) : null}
    </div>
  );
}
