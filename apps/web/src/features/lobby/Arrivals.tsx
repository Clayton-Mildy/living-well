// Arrivals board (design ScrLobby) for a drop-in club: members come on any open day, so nothing is "expected".
// A Check in | Check out switch at the top picks what the desk is doing:
//   Check in  = the check-in list (members not in yet, with their usual arrival time, and a search) and the face camera card;
//   Check out = a searchable list of the members in the club, each with Check out, and the "Gone home" list.
// The In the club / Gone home tiles show the day's counts and jump to the check-out mode. "Also today" (trial and visit guests,
// unread messages) sits below the list in both modes. A check-in toast carries Undo; a visit that is an extra Flex day says so
// before it is confirmed and in the toast. On narrow screens a manual check-in is confirmed in a bottom sheet.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { dayStatus, famNames, lobbyGroups, memberShort, nextOpenDay, priceOn, rp, toMin, type GuestVisit } from '@cp/shared';
import { checkoutCandidates, faceRecognisable, goneHomeRows, manualCandidates, nextFaceArrival, visitInfo } from '@cp/shared/rules/lobby';
import { EmptyState, FONT_BODY, FONT_SMALL, Icon, Note, Sheet } from '../../components/ui';
import { padFor, useDevice } from '../../hooks/useDevice';
import { useT, useFmt, useLang } from '../../lib/i18n';
import { useNow } from '../../lib/clock';
import { useMe } from '../../lib/me';
import { useAct } from '../../lib/act';
import { useClub } from '../../store/replica';
import { say } from '../../store/ui';
import { AlsoToday, type GuestActions } from './AlsoToday';
import { CheckoutDialog } from './CheckoutDialog';
import { FaceCard, MatchedPanel, SCAN_MS, type Scan } from './FaceCard';
import { MemberDrawer, visitLine } from './MemberDrawer';
import { MemberList } from './MemberList';
import { ModeToggle, PANEL_ID, TAB_ID, type Mode } from './ModeToggle';
import { localHours, memberFlags } from './parts';
import { useAtLeast } from './useAtLeast';

type Tile = 'inClub' | 'goneHome';
/** The day's counts. Tapping one switches to Check out and brings that list into view. */
const TILES: [Tile, string, string][] = [['inClub', 'how_to_reg', 'lobby.tileIn'], ['goneHome', 'home', 'lobby.tileGone']];
/** Width at which the design's two columns (430 + gap 24 + 480) sit side by side instead of wrapping. */
const TWO_COLUMNS = 934;
/** Smooth scrolling unless the viewer asked for less motion. */
const scrollBehavior = (): ScrollBehavior => (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ? 'auto' : 'smooth');
/** A price that never breaks across two lines ('Rp' / '650.000'). */
const price = (n: number) => rp(n).replace(/\s/g, '\u00a0');

export function Arrivals() {
  const t = useT();
  const lang = useLang();
  const { fdl } = useFmt();
  const { device, isPhone } = useDevice();
  const { role } = useMe();
  const s = useClub();
  const { today, nowMin, now } = useNow();
  const act = useAct();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();

  const [mode, setMode] = useState<Mode>('in');
  const [scan, setScan] = useState<Scan>({ state: 'idle' });
  const [busy, setBusy] = useState(false);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [coId, setCoId] = useState<string | null>(null);
  const [query, setQuery] = useState(''); // the check-in list's search
  const [outQuery, setOutQuery] = useState(''); // the check-out list's search (it also narrows "Gone home")
  const columnsRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const goneRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<HTMLDivElement>(null);
  const { wide: twoColumns } = useAtLeast(columnsRef, TWO_COLUMNS);

  const status = dayStatus(s, today);
  const groups = lobbyGroups(s, today);
  const scanMember = scan.state !== 'idle' ? s.members[scan.id] : undefined;

  // Timers read the latest state through a ref so a late callback never acts on stale data.
  const latest = useRef({ s, groups, scan, today });
  latest.current = { s, groups, scan, today };
  const scanTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(scanTimer.current), []);

  // ----- toasts and actions -----
  const checkedInText = (memberId: string, time: string) => {
    const cur = latest.current;
    const n = memberShort(cur.s.members[memberId]);
    const f = famNames(cur.s, memberId, t('common.and'));
    return f ? t('lobby.tCheckedIn', { n, t: time, f }) : t('lobby.checkInPlain', { n, t: time });
  };
  const undoIn = useCallback(async (memberId: string) => {
    const m = latest.current.s.members[memberId];
    await act('attendance.undoCheckIn', { memberId }, { ok: t('lobby.tUndoIn', { n: memberShort(m) }) });
  }, [act, t]);
  const undoOut = useCallback(async (memberId: string) => {
    const m = latest.current.s.members[memberId];
    await act('attendance.undoCheckOut', { memberId }, { ok: t('lobby.tUndoOut', { n: memberShort(m) }) });
  }, [act, t]);

  /** Check a member in. The toast carries Undo, and says when the visit is an extra day. */
  const doCheckIn = async (memberId: string, method: 'face' | 'manual'): Promise<boolean> => {
    const cur = latest.current;
    const r = await act('attendance.checkIn', { memberId, method }, { silent: true });
    if (!r.ok) return false;
    let text = checkedInText(memberId, String(r.result.time || ''));
    if (r.result.extra) text += ' ' + t('lobby.extraToast', { p: price(priceOn(cur.s, cur.today).extra) });
    say(text, { action: { label: t('common.undo'), run: () => void undoIn(memberId) } });
    return true;
  };
  const doCheckOut = async (memberId: string): Promise<boolean> => {
    const m = latest.current.s.members[memberId];
    const r = await act('attendance.checkOut', { memberId }, { silent: true });
    if (!r.ok) return false;
    setOutQuery(''); // ready for the next person
    say(t('lobby.tCheckedOut', { n: memberShort(m), t: String(r.result.time || '') }), { action: { label: t('common.undo'), run: () => void undoOut(memberId) } });
    return true;
  };
  const askDeparture = async (memberId: string) => {
    const m = latest.current.s.members[memberId];
    await act('attendance.askDeparture', { memberId }, { ok: t('lobby.nurseQ', { n: memberShort(m) }) });
  };

  // ----- door camera -----
  const startScan = (id: string) => {
    setScan({ state: 'scanning', id });
    clearTimeout(scanTimer.current);
    scanTimer.current = setTimeout(() => setScan((c) => (c.state === 'scanning' && c.id === id ? { state: 'matched', id, manual: false } : c)), SCAN_MS);
  };
  const simulate = () => {
    const next = nextFaceArrival(s, today);
    if ('none' in next) { say(t(next.none === 'everyoneIn' ? 'lobby.allIn' : 'lobby.noneByFace')); return; }
    startScan(next.id);
  };
  const startManual = (id: string) => {
    setDrawerId(null);
    setMode('in'); // the confirm opens beside the camera card (or in a sheet), which only exist in check-in mode
    clearTimeout(scanTimer.current);
    setScan({ state: 'matched', id, manual: true });
  };
  const rejectScan = () => { clearTimeout(scanTimer.current); setScan({ state: 'idle' }); };
  const confirmScan = async () => {
    const cur = latest.current;
    if (cur.scan.state !== 'matched') return;
    setBusy(true);
    const ok = await doCheckIn(cur.scan.id, cur.scan.manual ? 'manual' : 'face');
    setBusy(false);
    if (ok) { setScan({ state: 'idle' }); setQuery(''); }
  };

  // Guided-demo deep link: /today?demo=arrival plays Oma Lina's face check-in (scan, match, auto-confirm), then clears the param.
  const demo = params.get('demo');
  useEffect(() => {
    if (demo !== 'arrival') return;
    const clear = () => navigate({ pathname: location.pathname, search: '' }, { replace: true });
    const cur = latest.current;
    setMode('in');
    const lina = cur.s.members.m1;
    if (!lina || !dayStatus(cur.s, cur.today).open || !cur.groups.others.some((r) => r.m.id === 'm1') || !faceRecognisable(lina)) { clear(); return; } // not in yet, recognisable, club open: otherwise do nothing
    startScan('m1');
    const timer = setTimeout(async () => {
      const c = latest.current;
      // confirm only if the camera card still shows her (someone may have tapped "Not this person") and she is not in yet
      if (c.scan.state === 'matched' && c.scan.id === 'm1' && c.groups.others.some((r) => r.m.id === 'm1')) await doCheckIn('m1', 'face');
      setScan((x) => (x.state !== 'idle' && x.id === 'm1' ? { state: 'idle' } : x));
      clear();
    }, SCAN_MS * 2);
    return () => clearTimeout(timer);
  }, [demo]); // eslint-disable-line react-hooks/exhaustive-deps

  // ----- guests -----
  const guestToast = (g: GuestVisit, key: string, time: string, undo: string, undoKey: string) =>
    say(t(key, { n: g.name, t: time }), { action: { label: t('common.undo'), run: () => void act(undo, { guestId: g.id }, { ok: t(undoKey, { n: g.name }) }) } });
  const guest: GuestActions = {
    onIn: async (g) => { const r = await act('guest.checkIn', { guestId: g.id }, { silent: true }); if (r.ok) guestToast(g, g.healthCheck ? 'lobby.tGuestInHealth' : 'lobby.tGuestIn', String(r.result.time || ''), 'guest.undoCheckIn', 'lobby.tUndoGuest'); },
    onOut: async (g) => { const r = await act('guest.checkOut', { guestId: g.id }, { silent: true }); if (r.ok) say(t('lobby.tGuestOut', { n: g.name, t: String(r.result.time || '') })); },
    onNoShow: async (g) => { const r = await act('guest.noShow', { guestId: g.id }, { silent: true }); if (r.ok) say(t('lobby.tNoShow', { n: g.name }), { action: { label: t('common.undo'), run: () => void act('guest.undoNoShow', { guestId: g.id }, { silent: true }) } }); },
    onUndoNoShow: async (g) => { await act('guest.undoNoShow', { guestId: g.id }, { silent: true }); },
  };

  // ----- header -----
  const settings = s.club.settings;
  const openNow = status.open && nowMin >= toMin(settings.open) && nowMin < toMin(settings.close);
  const pill = !status.open ? { text: t('common.clubClosed'), short: t('common.clubClosed'), icon: 'event_busy', bg: '#EFECEA', fg: '#6A6967' }
    : openNow ? { text: `${t('lobby.clubOpen')} · ${localHours(settings.hoursLabel, lang)}`, short: t('lobby.clubOpen'), icon: 'storefront', bg: '#E6EFE8', fg: '#3D6B4F' }
    : nowMin < toMin(settings.open) ? { text: t('lobby.opensAt', { t: settings.open }), short: t('lobby.opensAt', { t: settings.open }), icon: 'schedule', bg: '#E8E1D8', fg: '#282828' }
    : { text: t('lobby.closedNow'), short: t('lobby.closedNow'), icon: 'bedtime', bg: '#E8E1D8', fg: '#282828' };

  const sheetMode = scan.state === 'matched' && scan.manual && !twoColumns;
  // A scan (or a pick from the list) shows in the camera card: bring that card fully into view if it is cut off. In the
  // stacked layout the camera sits below the check-in list, so this also follows the scan as it starts.
  const scanKey = scan.state === 'idle' ? '' : `${scan.state}:${scan.id}`;
  useEffect(() => {
    if (!scanKey || sheetMode || mode !== 'in') return;
    cameraRef.current?.scrollIntoView?.({ block: 'nearest', behavior: scrollBehavior() });
  }, [scanKey, sheetMode, mode]);
  const pickMode = (m: Mode) => {
    if (m === 'out') rejectScan(); // the camera card is hidden in check-out mode: drop any scan in progress
    setMode(m);
  };
  /** A tile: switch to Check out and, when the lists sit below the tiles, bring the tile's list into view. */
  const pickTile = (k: Tile) => {
    pickMode('out');
    requestAnimationFrame(() => (k === 'goneHome' ? goneRef : mainRef).current?.scrollIntoView?.({ behavior: scrollBehavior(), block: 'start' }));
  };

  const visit = scanMember ? visitInfo(s, scanMember, today) : null;
  const matchedPanel = scanMember ? (
    <MatchedPanel t={t} m={scanMember} plan={visitLine(t, s, scanMember, today)} flags={memberFlags(t, scanMember, true)} busy={busy} onConfirm={() => void confirmScan()} onReject={rejectScan}>
      {visit?.extra ? <Note tone="ochre" icon="payments">{t('lobby.extraVisit', { n: visit.n, q: visit.quota ?? 0, p: price(priceOn(s, today).extra) })}</Note> : null}
    </MatchedPanel>
  ) : null;
  const column = { display: 'flex', flexDirection: 'column', gap: 20 } as const;

  // ----- the lists -----
  const members = groups.inClub.length + groups.goneHome.length + groups.others.length;
  const checkInList = (
    <MemberList t={t} listId="checkin" title={t('lobby.checkInTitle')} hint={t('lobby.manualHint')} hintIcon="touch_app" rows={manualCandidates(s, today, query)} total={groups.others.length}
      query={query} onQuery={setQuery} empty={{ icon: 'task_alt', title: t(members === 0 ? 'lobby.noMembers' : 'lobby.allIn') }} noMatch={(q) => t('lobby.noMatch', { q })}
      selectedId={scan.state === 'matched' && scan.manual ? scan.id : undefined} onOpen={setDrawerId} onCheckIn={startManual} />
  );
  const checkOutList = (
    <MemberList t={t} listId="inclub" title={t('lobby.inClub')} hint={t('lobby.checkOutHint')} hintIcon="logout" rows={checkoutCandidates(s, today, outQuery)} total={groups.inClub.length}
      query={outQuery} onQuery={setOutQuery} empty={{ icon: 'chair', title: t('lobby.emptyIn'), sub: t('lobby.emptyInSub') }} noMatch={(q) => t('lobby.noMatchIn', { q })}
      onOpen={setDrawerId} onCheckOut={setCoId} />
  );
  const goneHomeList = (
    <MemberList t={t} listId="gonehome" title={t('lobby.goneHome')} hint={t('lobby.goneHint')} hintIcon="home" rows={goneHomeRows(s, today, outQuery)} total={groups.goneHome.length}
      query={outQuery} empty={{ icon: 'home', title: t('lobby.emptyOut'), sub: t('lobby.emptyOutSub') }} noMatch={(q) => t('lobby.noMatchGone', { q })} onOpen={setDrawerId} />
  );
  const camera = (
    <div ref={cameraRef} style={{ scrollMarginBottom: 16 }}>
      <FaceCard t={t} scan={sheetMode ? { state: 'idle' } : scan} member={scanMember} onSimulate={simulate} matched={matchedPanel} />
    </div>
  );
  // main = the list the desk works from (check-in or check-out); side = what goes with it (the camera, or who has gone home).
  const main = <div ref={mainRef} style={{ scrollMarginTop: 12 }}>{mode === 'in' ? checkInList : checkOutList}</div>;
  const side = mode === 'in' ? camera : <div ref={goneRef} style={{ scrollMarginTop: 12 }}>{goneHomeList}</div>;
  const also = <AlsoToday role={role || 'lobby'} guest={guest} />;

  return (
    <>
      <div style={{ padding: padFor(device), display: 'flex', flexDirection: 'column', gap: isPhone ? 14 : 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: isPhone ? 10 : 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, ...(isPhone ? { flex: '1 1 100%' } : {}) }}>
            {/* phone: the time sits in the eyebrow, so the club-open pill and the title share one line */}
            <div className={isPhone ? 'cp-eyebrow1' : undefined} style={{ fontSize: FONT_SMALL, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 500, color: '#6A6967', lineHeight: '18px' }}>
              {isPhone ? <><span>{fdl(today)}</span> · <span style={{ fontVariantNumeric: 'tabular-nums' }}>{now}</span></> : fdl(today)}
            </div>
            {isPhone ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <h1 style={{ margin: 0, fontSize: 40, lineHeight: '48px', fontWeight: 400, letterSpacing: '-0.5px', color: '#9A836C' }}>{t('lobby.arrivals')}</h1>
                <span title={pill.text} style={{ height: 30, padding: '0 12px 0 8px', borderRadius: 999, background: pill.bg, color: pill.fg, fontSize: 14, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
                  <Icon name={pill.icon} size={18} fill={1} />
                  {pill.short}
                </span>
              </div>
            ) : <h1 style={{ margin: 0, fontSize: 40, lineHeight: '48px', fontWeight: 400, letterSpacing: '-0.5px', color: '#9A836C' }}>{t('lobby.arrivals')}</h1>}
          </div>
          {isPhone ? null : (
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px 16px' }}>
              <span style={{ minHeight: 36, padding: '4px 14px 4px 10px', borderRadius: 999, background: pill.bg, color: pill.fg, fontSize: FONT_BODY, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6, maxWidth: '100%', lineHeight: 1.3 }}>
                <Icon name={pill.icon} size={20} fill={1} />
                {pill.text}
              </span>
              <div style={{ fontSize: 44, lineHeight: '48px', fontWeight: 300, fontVariantNumeric: 'tabular-nums', letterSpacing: '-1px' }}>{now}</div>
            </div>
          )}
        </div>

        {!status.open ? (
          <div style={{ background: '#FFFFFF', border: '1px solid #DBD7D6', borderRadius: 24 }}>
            <EmptyState icon="event_busy" title={status.event ? (lang === 'id' && status.event.titleId ? status.event.titleId : status.event.title) : t('common.clubClosed')}
              sub={t(status.reason === 'weekend' ? 'common.weekendSub' : 'common.clubClosedSub', { date: fdl(nextOpenDay(s, today)) })} />
          </div>
        ) : (
          <>
            <ModeToggle t={t} mode={mode} counts={{ in: groups.others.length, out: groups.inClub.length }} onChange={pickMode} />

            {/* phone: the Check in / Check out switch already shows the two counts, so the tiles go */}
            <div className="cp-hide-phone" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, maxWidth: 560 }} role="group" aria-label={t('lobby.todayCounts')}>
              {TILES.map(([k, icon, hintKey]) => (
                <button key={k} type="button" className="dh15" onClick={() => pickTile(k)} aria-label={`${t('lobby.' + k)}: ${groups[k].length}. ${t(hintKey)}`} data-tile={k}
                  style={{ minHeight: 96, padding: '16px 18px', borderRadius: 20, border: '1px solid #DBD7D6', background: '#FFFFFF', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, cursor: 'pointer', color: '#282828', textAlign: 'left', fontFamily: 'Inter' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>
                    <Icon name={icon} size={20} color="#75624B" />
                    {t('lobby.' + k)}
                  </span>
                  <span data-testid={`tile-${k}`} style={{ fontSize: 36, lineHeight: '40px', fontWeight: 300, fontVariantNumeric: 'tabular-nums', letterSpacing: '-1px' }}>{groups[k].length}</span>
                </button>
              ))}
            </div>

            <div ref={columnsRef} id={PANEL_ID} role="tabpanel" aria-labelledby={TAB_ID(mode)} style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>
              {twoColumns ? (
                <>
                  <div style={{ flex: '0 1 430px', minWidth: 300, ...column }}>{side}</div>
                  <div style={{ flex: '1 1 480px', minWidth: 0, ...column }}>{main}{also}</div>
                </>
              ) : (
                <div style={{ flex: '1 1 100%', minWidth: 0, ...column }}>{main}{side}{also}</div>
              )}
            </div>
          </>
        )}
      </div>

      {sheetMode && scanMember ? <Sheet open onClose={rejectScan} title={t('lobby.checkIn')}>{matchedPanel}</Sheet> : null}
      <MemberDrawer memberId={drawerId} onClose={() => setDrawerId(null)} actions={{
        onCheckIn: startManual,
        onCheckOut: (id) => { setDrawerId(null); setCoId(id); },
        onUndoIn: (id) => void undoIn(id),
        onUndoOut: (id) => void undoOut(id),
      }} />
      {coId ? <CheckoutDialog key={coId} memberId={coId} onClose={() => setCoId(null)} onConfirm={doCheckOut} onAskDeparture={askDeparture} /> : null}
    </>
  );
}
