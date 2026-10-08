// Attendance tab (design ScrProfile att): visit tiles and a month calendar for any month. The club is drop-in: a day is marked when the member
// checked in. Flex counts visits (the 11th and later in a month are extra days), Gold is unlimited. Nothing is booked, so there are no
// booking, leave or absence actions here.
import { useState, type CSSProperties } from 'react';
import { addMonths, currentMembership, daysInMonth, dayStatus, dow, flexMonth, issueDateOf, priceOn, rp, ym, attOf } from '@cp/shared';
import { Button, FONT_BODY, Group, Icon } from '../../../components/ui';
import { cardStyle, HAIR } from '../lib';
import type { P } from './types';

interface Cell { day: string; label: string; bg: string; bd: string; fg: string; vis: 'visible' | 'hidden'; extra?: boolean; full?: string }

export function AttendanceTab({ p }: { p: P }) {
  const { s, m, t, fmt, today } = p;
  const [month, setMonth] = useState(ym(today));
  const dim = daysInMonth(month);
  const lead = (dow(`${month}-01`) + 6) % 7;
  const cur = currentMembership(m);
  const fm = flexMonth(s, m, month, today);
  const gold = fm.quota === null;
  const quota = fm.quota ?? 0;
  const usedShown = Math.min(fm.used, quota); // visits beyond the quota are the extra days, counted separately
  const monthName = fmt.fmonth(month);
  const price = priceOn(s, issueDateOf(s, month)).extra;
  const extraSet = new Set(fm.extraDates);

  const cells: Cell[] = [];
  for (let i = 0; i < lead; i++) cells.push({ day: '', label: '', bg: 'transparent', bd: 'none', fg: '#24201C', vis: 'hidden' });
  for (let i = 1; i <= dim; i++) {
    const d = `${month}-${String(i).padStart(2, '0')}`;
    const w = dow(d);
    const ds = dayStatus(s, d);
    const a = attOf(s, d, m.id);
    const member = d >= cur.start && (!cur.lastDay || d <= cur.lastDay);
    let c: Cell = { day: String(i), label: '', bg: '#FFFFFF', bd: '1px solid #F0EAE1', fg: '#24201C', vis: 'visible' };
    if (a?.checkIn) {
      const extra = extraSet.has(d);
      c = extra
        ? { ...c, bg: '#24201C', bd: 'none', fg: '#FFFFFF', label: t('profile.cal.extra'), extra: true, full: `${t('profile.cal.in', { t: a.checkIn.at })} · ${t('profile.cal.extra')}` }
        : { ...c, bg: '#75624B', bd: 'none', fg: '#FFFFFF', label: t('profile.cal.in', { t: a.checkIn.at }), full: t('profile.cal.in', { t: a.checkIn.at }) };
    } else if (w === 0 || w === 6) c = { ...c, bg: '#F5F5F3', bd: 'none', fg: '#5E5852' };
    else if (!ds.open) c = { ...c, bg: '#F0EAE1', bd: 'none', fg: '#5E5852', label: ds.reason === 'holiday' ? t('profile.cal.holiday') : t('profile.cal.closed') };
    else if (!member) c = { ...c, bg: '#F5F5F3', bd: 'none', fg: '#5E5852', label: cur.lastDay && d > cur.lastDay ? t('profile.cal.ended') : '' };
    else if (d === today) c = { ...c, label: t('common.today') };
    if (d === today) c.bd = '2px solid #24201C';
    cells.push(c);
  }
  const usualTile = { label: t('profile.f.usual'), value: m.usualArrival || '—' };
  const tiles = gold
    ? [
        { label: t('profile.tile.visitsIn', { m: monthName }), value: String(fm.used), sub: t('profile.tile.goldNoLimit') },
        usualTile,
      ]
    : [
        { label: t('profile.tile.used', { m: monthName }), value: `${usedShown}/${quota}` },
        { label: t('profile.tile.left'), value: String(fm.left ?? 0), sub: t('profile.tile.extra', { p: rp(price) }) },
        { label: t('profile.tile.extraDays', { m: monthName }), value: String(fm.extra), sub: fm.extra ? t('profile.tile.extraBill', { p: rp(fm.extra * price) }) : t('profile.tile.extraNone') },
        usualTile,
      ];
  const legend = [
    { bg: '#75624B', bd: 'none', label: t('profile.legend.visited') },
    ...(gold ? [] : [{ bg: '#24201C', bd: 'none', label: t('profile.legend.extra') }]),
    { bg: '#F0EAE1', bd: 'none', label: t('profile.legend.closed') },
  ];
  const dows = Array.from({ length: 7 }, (_, i) => fmt.fd(`2024-01-0${i + 1}`, { weekday: 'short' }));
  const tilesEl = (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '18px 24px' }}>
      {tiles.map((x, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <span style={{ fontSize: 13, color: '#6B6259', lineHeight: 1.4 }}>{x.label}</span>
          <span style={{ fontSize: 'clamp(30px, 3.6vw, 40px)', lineHeight: 1.1, fontWeight: 300, fontVariantNumeric: 'tabular-nums', letterSpacing: '-1px', color: '#24201C' }}>{x.value}</span>
          {'sub' in x ? <span style={{ fontSize: 13, color: '#6B6259', lineHeight: 1.4 }}>{x.sub}</span> : null}
        </div>
      ))}
    </div>
  );
  const calEl = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <button type="button" onClick={() => setMonth(addMonths(month, -1))} aria-label={t('profile.prevMonth')} className="h-cream" style={{ width: 44, height: 44, borderRadius: 999, border: '1px solid #DCD3C8', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#24201C' }}><Icon name="chevron_left" size={22} /></button>
        <h2 style={{ margin: 0, fontSize: 22, lineHeight: '30px', fontWeight: 400, letterSpacing: '-0.5px', color: '#2B231C', textAlign: 'center' }}>{fmt.fmonth(month, true)}</h2>
        <button type="button" onClick={() => setMonth(addMonths(month, 1))} aria-label={t('profile.nextMonth')} className="h-cream" style={{ width: 44, height: 44, borderRadius: 999, border: '1px solid #DCD3C8', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#24201C' }}><Icon name="chevron_right" size={22} /></button>
      </div>
      {month !== ym(today) ? <div><Button variant="ghost" size={44} onClick={() => setMonth(ym(today))}>{t('profile.thisMonth')}</Button></div> : null}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,minmax(0,1fr))', gap: 6 }}>
        {dows.map((w, i) => <div key={i} style={{ fontSize: 12, fontWeight: 500, textAlign: 'center', padding: '4px 0', lineHeight: 1.4, color: '#6B6259', letterSpacing: '1px', textTransform: 'uppercase' }}>{w}</div>)}
        {cells.map((c, i) => {
          const st: CSSProperties = { minHeight: 60, borderRadius: 8, padding: '6px 8px', background: c.bg, border: c.bd, color: c.fg, display: 'flex', flexDirection: 'column', gap: 2, visibility: c.vis, minWidth: 0, overflow: 'hidden', textAlign: 'left', fontFamily: 'Inter' };
          return (
            <div key={i} style={st} title={c.full} data-visit={c.full ? (c.extra ? 'extra' : 'visit') : undefined}>
              <span style={{ fontSize: FONT_BODY, fontWeight: 500, lineHeight: 1.4, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                {c.day}
                {c.extra ? <Icon name="paid" size={14} fill={1} /> : null}
              </span>
              <span style={{ fontSize: 12, lineHeight: '16px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.label}</span>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 18px', fontSize: 13, lineHeight: 1.4, color: '#6B6259' }}>
        {legend.map((l) => <span key={l.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 4, background: l.bg, border: l.bd }} />{l.label}</span>)}
      </div>
    </>
  );
  const ph = p.isPhone; // round 6, phone (staff and family): the visit tiles and the calendar are two iOS grouped sections (the month header keeps its arrows)
  if (ph) return (
    <>
      <Group>{tilesEl}</Group>
      <Group gap={14}>{calEl}</Group>
    </>
  );
  return (
    <div style={{ ...cardStyle, gap: 22, maxWidth: 980 }}>
      {tilesEl}
      <div style={{ borderTop: HAIR, paddingTop: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {calEl}
      </div>
    </div>
  );
}
