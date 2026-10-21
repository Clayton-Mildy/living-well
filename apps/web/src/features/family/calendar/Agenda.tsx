// Family Calendar: one day's agenda. A banner for a closure, holiday or weekend; else rows of time | bar | title and sub. The bar is bronze for a guest-hosted,
// extra or outing row. On a day a parent came, a finished session says who joined in or sat out and shows the family's pictures of it (64px thumbnails).
import type { Photo } from '@cp/shared';
import { displayName } from '@cp/shared';
import { eventTitle } from '@cp/shared/rules/calendar';
import { activityLabel, roomLabel, staffFirst } from '@cp/shared/rules/family';
import type { FamDay, FamRow } from '@cp/shared/rules/famCalendar';
import { Icon, PhotoImg } from '../../../components/ui';
import { useFamilyCtx } from '../useFamily';
import { F, HAIR, useFamWide } from '../kit';
import { nameList } from './bits';

const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);

/** Up to three 64px rounded thumbnails (72px on a laptop); past three the last one says "+N". */
function Thumbs({ photos, label, onOpen, max = 3, size = 64 }: { photos: Photo[]; label: (i: number) => string; onOpen: (p: Photo) => void; max?: number; size?: number }) {
  const shown = photos.slice(0, max);
  const more = photos.length - shown.length;
  return (
    <span data-testid="cal-photos" style={{ display: 'flex', gap: 6 }}>
      {shown.map((p, i) => (
        <button key={p.id} type="button" onClick={() => onOpen(p)} aria-label={label(i)} data-photo-id={p.id} className="cp-press"
          style={{ position: 'relative', width: size, height: size, border: 'none', padding: 0, borderRadius: 12, background: F.fill, overflow: 'hidden', cursor: 'pointer', flex: 'none' }}>
          <PhotoImg photo={p} />
          {i === shown.length - 1 && more > 0 ? <span aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'rgba(28,22,16,.5)', color: '#FFFFFF', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+{more}</span> : null}
        </button>
      ))}
    </span>
  );
}

export function Agenda({ day, onOpen }: { day: FamDay; onOpen: (photos: Photo[], startId: string) => void }) {
  const { s, t, fmt, now } = useFamilyCtx();
  const wide = useFamWide();
  const lang = fmt.lang;
  // a laptop: the day's title as the prototype's 22px line ("Today · Tuesday 13 October"); a phone: the small caps line
  const when = wide ? fmt.fdl(day.date) : fmt.fd(day.date, { weekday: 'long' }) + ' ' + Number(day.date.slice(8));
  const head = `${day.date === now.today ? t('common.today') + ' · ' : ''}${when}`;
  const name = (id: string) => displayName(s.members[id]);

  const banner = day.banner;
  const bannerText = !banner ? '' : banner.kind === 'weekend' ? t('fcal.weekend') : banner.title ? t('fcal.closedFor', { title: cap(eventTitle({ title: banner.title, titleId: banner.titleId }, lang)) }) : t('fcal.closed');
  const shut = banner && banner.kind !== 'weekend';

  const span = (r: FamRow) => (r.to ? `${r.time}–${r.to}` : '');
  const text = (r: FamRow): { title: string; sub: string } => {
    switch (r.kind) {
      case 'session': {
        const lead = r.guest ? t('fcal.guestHost', { name: r.guest.name }) : staffFirst(s, r.staffId);
        return { title: activityLabel(s, r.activityId, lang), sub: [roomLabel(s, r.roomId, lang), lead].filter(Boolean).join(' · ') };
      }
      case 'lunch':
      case 'tea': {
        const sub = (r.dishes ?? []).map((d) => (d.memberIds ? `${nameList(lang, d.memberIds.map(name))}: ` : '') + d.names.join(', ')).join(' · ');
        return { title: t(r.kind === 'lunch' ? 'family.tLunch' : 'family.tTea'), sub };
      }
      case 'outing': return { title: cap(eventTitle({ title: r.title ?? '', titleId: r.titleId }, lang)), sub: [t('cal.k_outing'), span(r)].filter(Boolean).join(' · ') };
      case 'venue': return { title: t('cal.private'), sub: [roomLabel(s, r.roomId, lang), span(r)].filter(Boolean).join(' · ') };
    }
  };
  const took = (r: FamRow) => {
    const joined = r.took.filter((x) => x.took === 'joined').map((x) => name(x.memberId));
    const sat = r.took.filter((x) => x.took === 'satOut').map((x) => name(x.memberId));
    if (!joined.length && !sat.length) return null;
    return (
      <span data-testid="cal-took" style={{ display: 'flex', flexWrap: 'wrap', columnGap: 8, fontSize: 13, lineHeight: 1.35 }}>
        {joined.length ? <span style={{ color: F.sage, fontWeight: 500 }}>{t('fcal.joined', { n: nameList(lang, joined) })}</span> : null}
        {sat.length ? <span style={{ color: F.muted }}>{t('fcal.satOut', { n: nameList(lang, sat) })}</span> : null}
      </span>
    );
  };

  return (
    <div data-testid="cal-agenda" data-date={day.date} style={{ display: 'flex', flexDirection: 'column' }}>
      {wide
        ? <h2 style={{ margin: 0, fontSize: 22, lineHeight: 1.25, letterSpacing: '-0.3px', fontWeight: 500, color: F.ink, padding: '0 0 10px' }}>{head}</h2>
        : <h2 style={{ margin: 0, fontSize: 13, lineHeight: '18px', letterSpacing: '0.4px', textTransform: 'uppercase', fontWeight: 600, color: F.ink, padding: '0 4px 6px' }}>{head}</h2>}
      {banner ? (
        <div data-testid="cal-banner" data-kind={banner.kind} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', borderRadius: 16, background: shut ? F.ochreBg : F.fill, color: shut ? F.ochre : F.soft, fontSize: 14, lineHeight: '20px' }}>
          <Icon name="event_busy" size={20} fill={1} color={shut ? F.ochre : F.muted} style={{ flex: 'none', marginTop: 0 }} />
          <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{bannerText}</span>
        </div>
      ) : null}
      {!banner && !day.rows.length ? <p style={{ margin: 0, padding: '12px 4px', fontSize: 15, color: F.muted }}>{t('fcal.nothing')}</p> : null}
      {day.rows.map((r, i) => {
        const x = text(r);
        const mark = took(r);
        return (
          <div key={r.key} data-testid="cal-row" data-kind={r.kind} data-time={r.time} style={{ display: 'flex', gap: 14, padding: '12px 0', borderTop: i ? HAIR : 'none' }}>
            <span style={{ width: wide ? 46 : 44, flex: 'none', fontSize: 15, fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: F.text }}>{r.time}</span>
            <span aria-hidden="true" style={{ width: 3, borderRadius: 2, background: r.accent ? F.bronze : F.line, flex: 'none' }} />
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.35, color: F.text, overflowWrap: 'anywhere' }}>{x.title}</span>
                {x.sub ? <span style={{ fontSize: 13, lineHeight: 1.35, color: F.muted, overflowWrap: 'anywhere' }}>{x.sub}</span> : null}
                {mark}
              </span>
              {r.photos.length ? <Thumbs size={wide ? 72 : 64} photos={r.photos} label={(k) => t('fcal.photoAria', { i: k + 1, n: r.photos.length, a: x.title })} onOpen={(p) => onOpen(r.photos, p.id)} /> : null}
            </span>
          </div>
        );
      })}
      {day.others.length ? (
        <div data-testid="cal-others" style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 14, borderTop: day.rows.length ? HAIR : 'none', marginTop: day.rows.length ? 0 : 6 }}>
          <h3 style={{ margin: 0, padding: '0 4px', fontSize: 13, lineHeight: '18px', letterSpacing: '0.4px', textTransform: 'uppercase', fontWeight: 600, color: F.muted }}>{t('fcal.dayPhotos')}</h3>
          <Thumbs size={wide ? 72 : 64} photos={day.others} max={4} label={(k) => t('fcal.photoAria', { i: k + 1, n: day.others.length, a: t('fcal.dayPhotos') })} onOpen={(p) => onOpen(day.others, p.id)} />
        </div>
      ) : null}
    </div>
  );
}
