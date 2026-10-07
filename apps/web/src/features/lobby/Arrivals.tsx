// Arrivals board (Prototype v3 ScrArrivals) for a drop-in club: members come on any open day, so nothing is "expected".
// Three number tabs pick the list: Not in yet (the check-in list, with the face camera card in the side rail), In the club (the check-out list)
// and Gone home. One hero card shows the selected list with an underline search, with "Also today" (trial and visit guests, unread messages)
// right below it; on the check-in tab a side rail carries the face camera. A check-in toast carries Undo; a visit that is an extra Flex day says so before it is
// confirmed and in the toast. When the rail drops below the list (narrow screens) a manual check-in is confirmed in a bottom sheet instead.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { dayStatus, famNames, lobbyGroups, memberShort, nextOpenDay, priceOn, rp, toMin, type GuestVisit } from '@cp/shared';
import { checkoutCandidates, faceRecognisable, goneHomeRows, manualCandidates, nextFaceArrival, visitInfo } from '@cp/shared/rules/lobby';
import { Dialog, EmptyState, Eyebrow, Note, Sheet } from '../../components/ui';
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
import { memberFlags } from './parts';
import { useAtLeast } from './useAtLeast';
import { WhoPicker } from './WhoPicker';

/** Width of the tab panel at which the list (440) and the rail (300) sit side by side with their gap (24–56); below it the rail drops under the list. */
const TWO_COLUMNS = 800;
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
  const [whoFor, setWhoFor] = useState<string | null>(null); // "Not this person" on a face match: pick who it really is
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [coId, setCoId] = useState<string | null>(null);
  const [query, setQuery] = useState(''); // the check-in list's search
  const [outQuery, setOutQuery] = useState(''); // the search of the In the club and Gone home lists (shared: switching between the two keeps it)
  const columnsRef = useRef<HTMLDivElement>(null);
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
  const hdr = !status.open ? { text: t('common.clubClosed'), dot: '#A89C8E' }
    : openNow ? { text: t('lobby.openUntil', { t: settings.close }), dot: '#3F7A55' }
    : nowMin < toMin(settings.open) ? { text: t('lobby.opensAt', { t: settings.open }), dot: '#C9A35A' }
    : { text: t('lobby.closedNow'), dot: '#A89C8E' };

  // A pick from the list is a manual check-in, not a face match (KC): it confirms in its own dialog (a bottom sheet on phones),
  // never inside the face camera card.
  const sheetMode = scan.state === 'matched' && !!scan.manual;
  // A scan (or a pick from the list) shows in the camera card: bring that card fully into view if it is cut off. When the rail is
  // stacked under the list, this also follows the scan as it starts.
  const scanKey = scan.state === 'idle' ? '' : `${scan.state}:${scan.id}`;
  useEffect(() => {
    if (!scanKey || sheetMode || mode !== 'in') return;
    cameraRef.current?.scrollIntoView?.({ block: 'nearest', behavior: scrollBehavior() });
  }, [scanKey, sheetMode, mode]);
  const pickMode = (m: Mode) => {
    if (m !== 'in') rejectScan(); // the camera card only exists on the Not in yet tab: drop any scan in progress
    setMode(m);
  };

  const visit = scanMember ? visitInfo(s, scanMember, today) : null;
  const matchedPanel = scanMember ? (
    <MatchedPanel t={t} m={scanMember} plan={visitLine(t, s, scanMember, today)} flags={memberFlags(t, scanMember, true)} busy={busy} onConfirm={() => void confirmScan()}
      rejectLabel={scan.state === 'matched' && scan.manual ? t('common.cancel') : undefined}
      onReject={scan.state === 'matched' && !scan.manual ? () => { const wrong = scan.id; rejectScan(); setWhoFor(wrong); } : rejectScan}>
      {visit?.extra ? <Note tone="ochre" icon="payments">{t('lobby.extraVisit', { n: visit.n, q: visit.quota ?? 0, p: price(priceOn(s, today).extra) })}</Note> : null}
    </MatchedPanel>
  ) : null;

  // ----- the lists (one hero card, picked by the number tabs) -----
  const members = groups.inClub.length + groups.goneHome.length + groups.others.length;
  const list = mode === 'in' ? (
    <MemberList t={t} listId="checkin" title={t('lobby.checkInTitle')} rows={manualCandidates(s, today, query)} total={groups.others.length}
      query={query} onQuery={setQuery} empty={{ icon: 'task_alt', title: t(members === 0 ? 'lobby.noMembers' : 'lobby.allIn') }} noMatch={(q) => t('lobby.noMatch', { q })}
      selectedId={scan.state === 'matched' && scan.manual ? scan.id : undefined} onOpen={setDrawerId} onCheckIn={startManual} />
  ) : mode === 'out' ? (
    <MemberList t={t} listId="inclub" title={t('lobby.inClub')} rows={checkoutCandidates(s, today, outQuery)} total={groups.inClub.length}
      query={outQuery} onQuery={setOutQuery} empty={{ icon: 'chair', title: t('lobby.emptyIn') }} noMatch={(q) => t('lobby.noMatchIn', { q })}
      onOpen={setDrawerId} onCheckOut={setCoId} />
  ) : (
    <MemberList t={t} listId="gonehome" title={t('lobby.goneHome')} rows={goneHomeRows(s, today, outQuery)} total={groups.goneHome.length}
      query={outQuery} onQuery={setOutQuery} empty={{ icon: 'home', title: t('lobby.emptyOut') }} noMatch={(q) => t('lobby.noMatchGone', { q })}
      onOpen={setDrawerId} onUndoOut={(id) => void undoOut(id)} />
  );
  const camera = (
    <div ref={cameraRef} style={{ scrollMarginBottom: 16 }}>
      <FaceCard t={t} scan={sheetMode ? { state: 'idle' } : scan} member={scanMember} onSimulate={simulate} matched={matchedPanel} />
    </div>
  );
  const gap = 'clamp(18px, 2.8vw, 36px)';

  return (
    <>
      <div style={{ padding: padFor(device), display: 'flex', flexDirection: 'column', gap: isPhone ? 14 : gap }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, ...(isPhone ? { flex: '1 1 100%' } : {}) }}>
            {/* phone: the time sits in the eyebrow (the big clock is for wider screens) */}
            <Eyebrow className={isPhone ? 'cp-eyebrow1' : undefined}>
              {isPhone ? <><span>{fdl(today)}</span> · <span style={{ fontVariantNumeric: 'tabular-nums' }}>{now}</span></> : fdl(today)}
            </Eyebrow>
            <h1 style={{ margin: 0, fontSize: 'clamp(32px, 3.6vw, 48px)', lineHeight: 1.05, fontWeight: 400, letterSpacing: '-1.2px', color: '#2B231C' }}>{t('lobby.arrivals')}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#6B6259', lineHeight: 1.4 }}>
              <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 999, background: hdr.dot, flex: 'none' }} />
              {hdr.text}
            </div>
          </div>
          {isPhone ? null : <div style={{ fontSize: 48, lineHeight: 1, fontWeight: 300, fontVariantNumeric: 'tabular-nums', letterSpacing: '-1.5px', color: '#2B231C' }}>{now}</div>}
        </div>

        {!status.open ? (
          <div style={{ background: '#FFFFFF', border: '1px solid #EFE7DC', borderRadius: 20, boxShadow: 'var(--card-shadow)' }}>
            <EmptyState icon="event_busy" title={status.event ? (lang === 'id' && status.event.titleId ? status.event.titleId : status.event.title) : t('common.clubClosed')}
              sub={t(status.reason === 'weekend' ? 'common.weekendSub' : 'common.clubClosedSub', { date: fdl(nextOpenDay(s, today)) })} />
          </div>
        ) : (
          <>
            <ModeToggle t={t} mode={mode} counts={{ in: groups.others.length, out: groups.inClub.length, gone: groups.goneHome.length }} onChange={pickMode} />

            <div ref={columnsRef} id={PANEL_ID} role="tabpanel" aria-labelledby={TAB_ID(mode)} style={{ display: 'flex', flexWrap: 'wrap', gap: 'clamp(24px, 4vw, 56px)', alignItems: 'flex-start' }}>
              {/* KC: "Also today" sits below the check-in list on every width; the rail only carries the face camera */}
              <div style={{ flex: '1 1 440px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'clamp(24px, 3vw, 36px)' }}>
                {list}
                <AlsoToday role={role || 'lobby'} guest={guest} />
              </div>
              {mode === 'in' ? (
                <aside style={{ flex: twoColumns ? '0 1 300px' : '1 1 100%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'clamp(24px, 3vw, 32px)' }}>
                  {camera}
                </aside>
              ) : null}
            </div>
          </>
        )}
      </div>

      <WhoPicker open={whoFor !== null} phone={isPhone} today={today} exclude={whoFor ?? undefined} onClose={() => setWhoFor(null)} onPick={(id) => { setWhoFor(null); startManual(id); }} />
      {sheetMode && scanMember ? (isPhone
        ? <Sheet open onClose={rejectScan} title={t('lobby.checkIn')}>{matchedPanel}</Sheet>
        : <Dialog open onClose={rejectScan} title={t('lobby.checkIn')} maxWidth={480}>{matchedPanel}</Dialog>) : null}
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
