// Health station (design ScrHealth, lines 795–929; logic 2441–2548), reworked for the drop-in club: no queue, nothing "due".
// The list shows every active member (and the guests in the club), the ones in the club today first, with a search box and pages;
// each row carries the last reading. Tapping someone opens their detail: today's readings and one form with every measurement.
// Opening someone starts waiting for the LEPU PC-303 (simulated: its values arrive after a moment); tapping a box to type stops the
// wait. One complete measurement is enough to save. Tablet and laptop: the list (330px) beside the detail, fields beside a 222px
// keypad. Phone: the list alone; a row opens the detail as a full-screen sheet with native inputs. "Limits" sets when a reading
// counts as Watch or Alert.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { dayStatus, lastBefore, limitsOf, nextOpenDay, type Health, type QueueKind } from '@cp/shared';
import { alertRecipients, filterRows, headlineValue, inClubCount, rowName, stationRows, suggestKind, type StationRow } from '@cp/shared/rules/healthStation';
import { Button, Eyebrow, Icon, IconButton, PageHead, Pager, usePaged, FONT_BODY } from '../../components/ui';
import { padFor, useDevice } from '../../hooks/useDevice';
import { useAct } from '../../lib/act';
import { useNow } from '../../lib/clock';
import { useFmt, useT, type TFn } from '../../lib/i18n';
import { useClub } from '../../store/replica';
import { DEVICE_MS, GUEST_SIM, simulate, type DeviceKind, type Sim } from './device';
import { EditReadingDialog, VoidReadingDialog } from './dialogs';
import { DetailHead } from './DetailHead';
import { applyDevice, canSave, evalDraft, hasValues, kindFor, newDraft, toInput, type Draft } from './form';
import { LimitsSheet } from './LimitsSheet';
import { Av, Badge, FullSheet, SearchBox } from './parts';
import { ReadingCard, joinNames } from './ReadingCard';
import { ReadingForm } from './ReadingForm';
import { smallCaps, useWidth } from './lib';
import { whoOfRow } from './who';

const PAGE = 10;
const SIDE_BY_SIDE = 330 + 20 + 590; // list + gap + a detail wide enough for the fields (300) beside the 222px keypad: below this the detail wraps under the list
const EMPTY = newDraft();
type Dlg = { t: 'edit'; id: string } | { t: 'void'; id: string };
const AUTO: DeviceKind[] = ['bp', 'vit']; // what the station waits for when someone is opened
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function HealthStation() {
  const t = useT();
  const { fdl, fds } = useFmt();
  const { device, isPhone } = useDevice();
  const s = useClub();
  const { today, nowMin, now } = useNow();
  const act = useAct();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const rows = useMemo(() => stationRows(s, today, nowMin), [s, today, nowMin]);
  const [q, setQ] = useState('');
  const list = useMemo(() => filterRows(rows, q), [rows, q]);
  const paged = usePaged(list, PAGE, q);
  const day = dayStatus(s, today);
  const closed = !day.open;
  const closedReason = day.open ? null : day.reason;

  const [selKey, setSelKey] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [busy, setBusy] = useState(false);
  const [dlg, setDlg] = useState<Dlg | null>(null);
  const [pick, setPick] = useState(0);
  const [limits, setLimits] = useState(false);
  const [jump, setJump] = useState<string | null>(null); // a row to bring onto the visible page
  const [bodyRef, bodyW] = useWidth<HTMLDivElement>();
  const detailRef = useRef<HTMLDivElement>(null);
  const stacked = isPhone || (bodyW > 0 && bodyW < SIDE_BY_SIDE);

  const cur = useMemo(() => rows.find((r) => r.key === selKey) ?? null, [rows, selKey]);
  const who = cur ? whoOfRow(cur) : null;
  const sheetOpen = isPhone && sheet && !!cur;

  // ----- the check it is saved as: worked out from today's readings and what was measured (the form does not ask) -----
  const draft = (cur && drafts[cur.key]) || EMPTY;
  const suggested: QueueKind = cur ? suggestKind(cur, nowMin, s.club.settings) : 'arrival';
  const sim: Sim = who?.member?.sim ?? GUEST_SIM;
  const recipients = who?.kind === 'member' ? alertRecipients(s, who.id).map((x) => x.contact.firstName) : [];
  const next = cur ? rows.find((r) => r.personId !== cur.personId && r.dueNow.length > 0) : undefined;

  // ----- drafts -----
  const patch = useCallback((key: string, fn: (d: Draft) => Draft) => setDrafts((m) => ({ ...m, [key]: fn(m[key] ?? newDraft()) })), []);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  // ----- the PC-303 (one device): waiting for it, and stopping when the nurse types -----
  const dev = useRef<{ token: number; key: string | null }>({ token: 0, key: null });
  const stopDevice = useCallback(() => {
    const prev = dev.current.key;
    dev.current = { token: dev.current.token + 1, key: null };
    if (prev) patch(prev, (d) => (d.meas ? { ...d, meas: null } : d));
  }, [patch]);
  /** Wait for the simulated device: after a moment its values fill in, one measurement after another. */
  const measure = useCallback(async (key: string, kinds: DeviceKind[], sm: Sim, o: { type: QueueKind; demoHigh?: boolean; exact?: boolean }) => {
    stopDevice();
    const token = dev.current.token + 1;
    dev.current = { token, key };
    for (const k of kinds) {
      patch(key, (d) => ({ ...d, meas: k }));
      await sleep(DEVICE_MS[k]);
      if (!alive.current || dev.current.token !== token) return;
      const vals = simulate(k, sm, o);
      patch(key, (d) => applyDevice(d, vals));
    }
    patch(key, (d) => ({ ...d, meas: null }));
    dev.current = { token, key: null };
  }, [patch, stopDevice]);
  const latest = useRef({ rows, drafts, nowMin });
  latest.current = { rows, drafts, nowMin };

  /** Open someone. Unless they already have numbers on the form, the station starts waiting for the PC-303. */
  const choose = useCallback((key: string, bring = false, auto = true) => {
    if (dev.current.key && dev.current.key !== key) stopDevice();
    setSelKey(key); setPick((p) => p + 1); if (isPhone) setSheet(true); if (bring) setJump(key);
    const d = latest.current.drafts[key];
    const row = latest.current.rows.find((r) => r.key === key);
    if (auto && row && !(d && (d.meas || hasValues(d)))) {
      void measure(key, AUTO, row.person.type === 'member' ? row.person.m.sim : GUEST_SIM, { type: suggestKind(row, latest.current.nowMin, s.club.settings) });
    }
  }, [isPhone, measure, stopDevice, s.club.settings]);

  // bring a row onto the visible page (after "Save and next" or a deep link); a search that hides it is cleared first
  useEffect(() => {
    if (!jump) return;
    const i = list.findIndex((r) => r.key === jump);
    if (i >= 0) { paged.setPage(Math.floor(i / PAGE) + 1); setJump(null); } else if (q) setQ('');
    else setJump(null);
  }, [jump, list]); // eslint-disable-line react-hooks/exhaustive-deps

  // ----- deep link (guided demo, other screens): ?member=m1 opens that member; &demo=high also runs "Read PC-303" once -----
  // The query is removed once it has been applied, so a reload does not repeat it, and the same link can be used again later.
  const wantMember = params.get('member');
  const wantDemo = params.get('demo');
  const applied = useRef<string | null>(null);
  useEffect(() => {
    if (!wantMember) { applied.current = null; return; }
    const key = `${wantMember}|${wantDemo ?? ''}`;
    if (applied.current === key) return;
    const finish = () => { applied.current = key; navigate(pathname, { replace: true }); };
    const hit = rows.find((x) => x.personId === wantMember);
    if (hit) {
      const demo = wantDemo === 'high' && hit.person.type === 'member';
      choose(hit.key, true, !demo);
      if (demo && hit.person.type === 'member') void measure(hit.key, AUTO, hit.person.m.sim, { type: suggestKind(hit, nowMin, s.club.settings), demoHigh: true, exact: true });
      finish();
      return;
    }
    // not in the list (not an active member): the state may still be on its way, so wait a moment before dropping the query
    const wait = window.setTimeout(finish, 2500);
    return () => window.clearTimeout(wait);
  }, [wantMember, wantDemo, rows, choose, measure, navigate, pathname, nowMin, s.club.settings]);

  // whenever someone new is opened (a tap, "Save and next", a link) the page shows the top of their detail, so the name is never out of sight
  // while the nurse takes the numbers: under the list when the detail wraps, and back to the top when the page had been scrolled down the last form
  useEffect(() => {
    const el = detailRef.current;
    const main = el?.closest('main');
    if (!pick || !el || !main || isPhone) return;
    const top = el.getBoundingClientRect().top - main.getBoundingClientRect().top;
    if (top < 0 || (stacked && top > 0)) main.scrollTo({ top: main.scrollTop + top - (stacked ? 12 : 0) });
  }, [pick]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = () => { stopDevice(); setSelKey(null); setSheet(false); };
  const save = async () => {
    if (!cur || !who || busy) return;
    const ev = evalDraft(draft, who.kind === 'member' ? lastBefore(s, who.id, today, 'weight')?.weight : undefined, limitsOf(s));
    if (!canSave(draft, ev)) return;
    const kind = kindFor({ suggested, taken: cur.today.map((r) => r.kind), person: who.kind, d: draft, ev });
    const input = toInput({ personId: who.id, person: who.kind, kind, d: draft, ev, canTell: who.kind === 'member' && recipients.length > 0 });
    const key = cur.key;
    setBusy(true);
    const r = await act('reading.save', input, {
      ok: (res) => {
        const st = (res.status as Health) || 'normal';
        const told = (res.told as string[]) || [];
        let text = kind === 'monthly' ? t('health.savedOnlyMonthly', { n: who.short }) : t('health.saved', { n: who.short, v: input.sys != null ? `${input.sys}/${input.dia}` : input.glucose != null ? `${input.glucose} mg/dL` : '', s: t('status.' + st) });
        if (told.length) text += t('health.famTold', { f: joinNames(told, t('common.and')) });
        if (res.recheckAt) text += t('health.savedRecheck', { t: String(res.recheckAt) });
        if (res.deferred) text += t('health.savedDeferred');
        return text;
      },
    });
    setBusy(false);
    if (!r.ok) return;
    setDrafts((m) => { const { [key]: _gone, ...rest } = m; return rest; });
    if (next) choose(next.key, true);
    else if (isPhone) setSheet(false);
  };

  // ----- the list -----
  const inClub = inClubCount(rows);
  const groupOf = (r: StationRow) => (r.presence === 'no' ? 'other' : 'in');
  const groupCount = { in: list.filter((r) => groupOf(r) === 'in').length, other: list.filter((r) => groupOf(r) === 'other').length };
  const pos = cur ? list.findIndex((r) => r.key === cur.key) : -1;

  const listCard = (
    <div data-testid="station-list" style={{ flex: stacked ? '1 1 100%' : '0 1 330px', minWidth: 290, background: '#FFFFFF', border: '1px solid #DBD7D6', borderRadius: 24, overflow: 'hidden' }}>
      <div style={{ padding: '16px 16px 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <SearchBox value={q} onChange={setQ} label={t('health.searchL')} placeholder={t('health.searchPh')} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: FONT_BODY, color: '#282828', fontWeight: 500, lineHeight: 1.4 }}>{t('health.inClubN', { n: inClub })}</span>
          <span style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{q.trim() ? t('health.foundN', { n: list.length }) : t('health.membersN', { n: rows.filter((r) => r.person.type === 'member').length })}</span>
        </div>
      </div>
      {closed ? (
        <div role="status" style={{ padding: '12px 16px', borderTop: '1px solid #EFECEA', background: '#FBF5E8', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <Icon name="event_busy" size={22} color="#7A5510" />
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{t('common.clubClosed')}</span>
            <span style={{ fontSize: FONT_BODY, color: '#282828', lineHeight: '20px' }}>{t(closedReason === 'weekend' ? 'common.weekendSub' : 'common.clubClosedSub', { date: fdl(nextOpenDay(s, today)) })}</span>
          </span>
        </div>
      ) : null}
      {paged.rows.map((r, i) => {
        const g = groupOf(r);
        const head = i === 0 || groupOf(paged.rows[i - 1]) !== g;
        return (
          <div key={r.key}>
            {head ? (
              <div style={{ padding: '10px 16px 8px', borderTop: '1px solid #EFECEA', background: '#FBFAF9', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                <Eyebrow color="#282828">{t(g === 'in' ? 'health.grpIn' : 'health.grpOther')}</Eyebrow>
                <span style={{ fontSize: FONT_BODY, color: '#6A6967' }}>{groupCount[g]}</span>
              </div>
            ) : null}
            <ListRow r={r} on={cur?.key === r.key} today={today} t={t} fds={fds} onClick={() => choose(r.key)} />
          </div>
        );
      })}
      {!list.length ? (
        <EmptyBlock icon={q.trim() ? 'search_off' : 'groups'} title={q.trim() ? t('common.noResults') : t('health.listEmpty')} sub={q.trim() ? t('health.noMatchSub') : undefined} />
      ) : null}
      <div style={{ borderTop: list.length ? '1px solid #EFECEA' : undefined }}><Pager page={paged.page} pages={paged.pages} onPage={paged.setPage} /></div>
    </div>
  );

  // ----- the detail -----
  const detail = cur && who ? (
    <>
      <DetailHead who={who} row={cur} s={s} today={today} t={t} isPhone={isPhone} />
      {cur.today.length ? (
        <div data-testid="today-block" style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 10, borderBottom: '1px solid #EFECEA' }}>
          <span style={smallCaps('1.5px')}>{t('health.todayHead', { n: cur.today.length })}</span>
          {cur.today.map((r) => <ReadingCard key={r.id} r={r} s={s} t={t} onEdit={() => setDlg({ t: 'edit', id: r.id })} onVoid={() => setDlg({ t: 'void', id: r.id })} />)}
        </div>
      ) : null}
      <ReadingForm who={who} s={s} today={today} draft={draft} patch={(fn) => patch(cur.key, fn)} isPhone={isPhone} busy={busy}
        lastBp={suggested === 'departure' ? 'departure' : 'arrival'} recipients={recipients} fds={fds} hasNext={!!next}
        onMeasure={(kinds) => void measure(cur.key, kinds, sim, { type: suggested })} onManual={() => { if (dev.current.key === cur.key) stopDevice(); }} onSave={save} onClose={close} />
    </>
  ) : (
    <EmptyBlock big icon="monitor_heart" title={t('health.choose')} />
  );

  return (
    <div style={{ padding: padFor(device), display: 'flex', flexDirection: 'column', gap: isPhone ? 12 : 22 }}>
      <PageHead size={40} eyebrow={`${t('health.healthStation')} · ${fdl(today)}`} title={t('health.healthChecks')}
        right={(
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {isPhone ? <IconButton icon="tune" label={t('health.limitsTitle')} size={36} onClick={() => setLimits(true)} />
              : <Button variant="secondary" size={44} icon="tune" label={t('health.limitsTitle')} onClick={() => setLimits(true)}>{t('health.limitsBtn')}</Button>}
            <span style={{ height: isPhone ? 30 : 36, padding: isPhone ? '0 12px 0 8px' : '0 14px 0 10px', borderRadius: 999, background: '#FFFFFF', border: '1px solid #DBD7D6', fontSize: isPhone ? 14 : FONT_BODY, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
              <Icon name="bluetooth_connected" size={isPhone ? 18 : 20} color="#3D6B4F" />
              {t('health.device')} · {t('health.connected')}
            </span>
            <span style={{ fontSize: isPhone ? 24 : 32, lineHeight: isPhone ? '30px' : '36px', fontWeight: isPhone ? 400 : 300, fontVariantNumeric: 'tabular-nums', letterSpacing: '-1px', paddingLeft: isPhone ? 0 : 8 }}>{now}</span>
          </div>
        )} />
      <div ref={bodyRef} style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
        {listCard}
        {!isPhone ? (
          <div ref={detailRef} style={{ flex: '1 1 520px', minWidth: 0, background: '#FFFFFF', border: '1px solid #DBD7D6', borderRadius: 24, overflowX: 'clip', overflowY: 'visible' }}>{detail}</div>
        ) : null}
      </div>
      {isPhone ? (
        <FullSheet open={sheetOpen} onClose={() => { stopDevice(); setSheet(false); }} back={t('health.healthChecks')} pos={pos >= 0 ? t('health.posOf', { i: pos + 1, n: list.length }) : ''} label={who?.name || t('health.healthChecks')}>{detail}</FullSheet>
      ) : null}
      {dlg?.t === 'edit' ? <EditReadingDialog readingId={dlg.id} onClose={() => setDlg(null)} /> : null}
      {dlg?.t === 'void' ? <VoidReadingDialog readingId={dlg.id} onClose={() => setDlg(null)} /> : null}
      <LimitsSheet open={limits} onClose={() => setLimits(false)} />
    </div>
  );
}

function EmptyBlock({ icon, title, sub, big }: { icon: string; title: string; sub?: string; big?: boolean }) {
  return (
    <div style={{ padding: big ? '80px 24px' : '36px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center', borderTop: big ? undefined : '1px solid #EFECEA' }}>
      <div style={{ width: big ? 72 : 64, height: big ? 72 : 64, borderRadius: 999, background: '#F4F0EE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={big ? 34 : 30} color="#8A755B" />
      </div>
      <div style={{ fontSize: big ? 20 : 18 }}>{title}</div>
      {sub ? <div style={{ fontSize: FONT_BODY, lineHeight: '20px', color: '#6A6967' }}>{sub}</div> : null}
    </div>
  );
}

/** One member (or guest) in the list: avatar and name, when they came, and the last reading with its status. */
function ListRow({ r, on, today, t, fds, onClick }: { r: StationRow; on: boolean; today: string; t: TFn; fds: (d: string) => string; onClick: () => void }) {
  const { isPhone } = useDevice();
  const w = whoOfRow(r);
  const meta = r.presence === 'in' ? t('health.rowSince', { t: r.since ?? '' }) : r.presence === 'gone' ? t('health.rowLeft', { t: r.left ?? '' }) : '';
  const last = r.last
    ? (r.last.date === today ? t('health.lastToday', { t: r.last.time, v: headlineValue(r.last) }) : t('health.lastL', { v: headlineValue(r.last), d: fds(r.last.date) }))
    : t('health.noReadingsYet');
  return (
    <button type="button" className="dh22" onClick={onClick} aria-current={on ? 'true' : undefined} data-testid="station-row" data-person={r.personId} data-presence={r.presence}
      style={{ width: '100%', display: 'flex', gap: 12, alignItems: 'flex-start', padding: isPhone ? '10px 14px' : '14px 16px', minHeight: isPhone ? 60 : 76, border: 'none', borderTop: '1px solid #EFECEA', background: on ? '#F4F0EE' : '#FFFFFF', boxShadow: on ? 'inset 0 0 0 2px #75624B' : 'none', textAlign: 'left', cursor: 'pointer', color: '#282828', fontFamily: 'Inter' }}>
      <Av name={w.name} tone={w.tone} src={w.photo} size={isPhone ? 38 : 44} font={isPhone ? 14 : 16} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: isPhone ? 2 : 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
          <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{rowName(r)}</span>
          {meta ? <span style={{ fontSize: 'max(13px, var(--cp-small, 0px))', color: '#6A6967', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', lineHeight: 1.4 }}>{meta}</span> : null}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: FONT_BODY, lineHeight: '20px', color: '#6A6967' }}>{last}</span>
          {r.last ? <Badge kind={r.last.status} icon={17} /> : null}
        </div>
      </div>
    </button>
  );
}
