// Drafts (KC round 7, "shoot first, sort later"): everything the quick camera took and nobody has sent yet, newest first, grouped by session. The (simulated) AI has
// already linked each shot: who is in it, the session it belongs to, or the meal. A rust "Check" says the AI was unsure; "Blurry?" and a star on the best of a burst
// help to throw the extras away. Tap a draft to fix it, then send them all (management) or send them for approval (everyone else). Private to the person who took them.
// It is the first tab of the Camera (activity, management) and the Drafts page of the kitchen.
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { displayName, toMin, type Photo } from '@cp/shared';
import { attendedOn, curAct, faceTagging, pictureDays, pictureSessions } from '@cp/shared/rules/activity';
import { draftGroupKey, draftKindOf, draftKindsFor, draftMeal, draftNotes, draftsOf, type DraftKind } from '@cp/shared/rules/photoAi';
import { Button, Card, EmptyState, Group, Icon, Note, PageHead, PhotoImg, Segmented, Select, Sheet, SectionLabel, FONT_BODY } from '../../components/ui';
import { padFor, useDevice } from '../../hooks/useDevice';
import { useT, useLang, useFmt } from '../../lib/i18n';
import { useAct } from '../../lib/act';
import { useMe } from '../../lib/me';
import { useNow } from '../../lib/clock';
import { useClub } from '../../store/replica';
import { linkingLeft, useQuickCam } from '../../store/quickCam';
import { say, useUi } from '../../store/ui';
import { AiMark, activityLabel, plural, rowLine } from './lib';
import { MemberPicker } from './MemberPicker';

/** "Linking…" for a moment the first time a shot taken on this device is shown. */
function useLinking(id: string, index: number): boolean {
  const [left, setLeft] = useState(() => linkingLeft(id, index));
  useEffect(() => {
    if (left <= 0) return;
    const h = setTimeout(() => setLeft(0), left);
    return () => clearTimeout(h);
  }, [left]);
  return left > 0;
}

const shimmer: CSSProperties = { background: 'linear-gradient(90deg,var(--press, #EEEEF0) 0,var(--inset, #F8F8F9) 40%,var(--press, #EEEEF0) 80%)', backgroundSize: '800px 100%', animation: 'cpShimmer 1.4s linear infinite' };
const chip = (bg: string, fg: string): CSSProperties => ({ height: 22, padding: '0 8px 0 6px', borderRadius: 7, background: bg, color: fg, fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap', flex: 'none' });

/** What the shot is filed under, as the tile's title. */
function useTitle() {
  const t = useT();
  const lang = useLang();
  const s = useClub();
  return (p: Photo): string => {
    const kind = draftKindOf(p);
    if (kind === 'food') return t(draftMeal(p) === 'tea' ? 'drafts.teaPhoto' : 'drafts.lunchPhoto');
    if (kind === 'scene') return p.activity ? t('drafts.sessionChip', { name: activityLabel(s, p.activity, t, lang) }) : t('drafts.pickSession');
    const names = p.memberIds.map((id) => (s.members[id] ? displayName(s.members[id]) : '')).filter(Boolean);
    return names.length ? names.slice(0, 2).join(', ') + (names.length > 2 ? ` +${names.length - 2}` : '') : t('drafts.whoIsThis');
  };
}

function DraftTile({ p, index, selecting, selected, onPress }: { p: Photo; index: number; selecting: boolean; selected: boolean; onPress: () => void }) {
  const t = useT();
  const linking = useLinking(p.id, index);
  const title = useTitle()(p);
  const n = draftNotes(p);
  const aria = [p.time, title, n.check ? t('drafts.check') : '', n.blurry ? t('drafts.blurry') : '', n.best ? t('drafts.best') : '', linking ? t('drafts.linking') : ''].filter(Boolean).join(', ');
  return (
    <button type="button" className="cp-press" data-testid="draft-tile" data-draft-id={p.id} data-linking={linking || undefined} data-check={n.check || undefined} aria-label={aria} aria-pressed={selecting ? selected : undefined} onClick={onPress}
      style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, padding: 0, border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', fontFamily: 'Inter', color: '#24201C' }}>
      <span style={{ position: 'relative', display: 'block', width: '100%', aspectRatio: '4 / 3', borderRadius: 12, overflow: 'hidden', background: '#E8E1D8', outline: selected ? '3px solid #24201C' : 'none', outlineOffset: -3 }}>
        <span aria-hidden="true" style={{ position: 'absolute', inset: 0 }}><PhotoImg photo={p} /></span>
        <span aria-hidden="true" style={{ position: 'absolute', left: 6, bottom: 6, height: 22, padding: '0 7px', borderRadius: 7, background: '#FFFFFF', fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', fontVariantNumeric: 'tabular-nums' }}>{p.time}</span>
        {p.media === 'video' ? <span aria-hidden="true" style={{ position: 'absolute', right: 6, bottom: 6, width: 24, height: 24, borderRadius: 999, background: 'rgba(40,40,40,0.55)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="videocam" size={15} fill={1} /></span> : null}
        {n.best ? <span data-testid="draft-best" aria-hidden="true" style={{ position: 'absolute', right: 6, top: 6, height: 24, padding: '0 8px 0 5px', borderRadius: 8, background: '#24201C', color: '#FFFFFF', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}><Icon name="star" size={15} fill={1} color="#F3D9A4" />{t('drafts.best')}</span> : null}
        {selecting ? <span aria-hidden="true" style={{ position: 'absolute', left: 6, top: 6, width: 26, height: 26, borderRadius: 9, border: '2px solid #FFFFFF', background: selected ? '#24201C' : 'rgba(40,40,40,0.4)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }}>{selected ? <Icon name="check" size={18} /> : null}</span> : null}
      </span>
      {linking ? (
        <span aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: '1px 2px 0', minHeight: 44 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 500, color: 'var(--eyebrow, #6E5A43)' }}><Icon name="auto_awesome" size={15} fill={1} style={{ animation: 'cpPulse 1s ease-in-out infinite' }} />{t('drafts.linking')}</span>
          <span style={{ ...shimmer, height: 10, borderRadius: 5, width: '78%' }} />
        </span>
      ) : (
        <span style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: '1px 2px 0', minHeight: 44 }}>
          <span style={{ fontSize: 14, fontWeight: 500, lineHeight: '19px', color: n.needs ? '#9A3D24' : '#24201C', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere' }}>{title}</span>
          {n.ai || n.check || n.blurry ? (
            <span style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {n.ai ? <AiMark label={t('drafts.ai')} /> : null}
              {n.check ? <span data-testid="draft-check" style={chip('#F9E3DB', '#9A3D24')}><Icon name="warning" size={14} fill={1} />{t('drafts.check')}</span> : null}
              {n.blurry ? <span data-testid="draft-blurry" style={chip('#F6ECD6', '#7A5510')}><Icon name="blur_on" size={14} />{t('drafts.blurry')}</span> : null}
            </span>
          ) : null}
        </span>
      )}
    </button>
  );
}

/** Fix a draft: what it is filed under, who is in it, the session, the meal; or throw it away. */
function DraftSheet({ draft, onClose }: { draft: Photo; onClose: () => void }) {
  const t = useT();
  const lang = useLang();
  const { fds } = useFmt();
  const s = useClub();
  const { role } = useMe();
  const { today } = useNow();
  const act = useAct();
  const kinds = draftKindsFor(role);
  const [kind, setKind] = useState<DraftKind>(draftKindOf(draft));
  const [ids, setIds] = useState<string[]>(draft.memberIds);
  const [activity, setActivity] = useState<string>(draftKindOf(draft) === 'food' ? '' : draft.activity || '');
  const [date, setDate] = useState(draft.date);
  const [meal, setMeal] = useState<'lunch' | 'tea'>(draftMeal(draft));
  const [busy, setBusy] = useState(false);
  const ai = draft.ai;
  const unnamed = ai?.kind === 'people' && !ai.reviewed ? ai.faces.filter((f) => !f.memberId).length : 0;
  const sure = ai && ai.faces.length ? Math.round(Math.min(...ai.faces.map((f) => f.confidence)) * 100) : 0;
  const suggested = useMemo(() => (ai?.faces ?? []).flatMap((f) => (f.memberId ? [f.memberId] : [])), [ai]);
  const here = useMemo(() => {
    const list = attendedOn(s, draft.date);
    const extra = [...ids, ...suggested].filter((id) => s.members[id] && !list.some((m) => m.id === id)).map((id) => s.members[id]);
    return [...list, ...extra.filter((m, i) => extra.indexOf(m) === i)];
  }, [s, draft.date, ids, suggested]);
  const days = useMemo(() => { const d = pictureDays(s, today); return d.includes(date) ? d : [date, ...d]; }, [s, today, date]);
  const sessions = useMemo(() => pictureSessions(s, date), [s, date]);
  const sessionOptions = sessions.map((x) => ({ value: x.activity?.name || '', label: activityLabel(s, x.activity?.name || '', t, lang) }));

  const pickKind = (k: DraftKind) => {
    setKind(k);
    if (k === 'scene' && !sessions.some((x) => x.activity?.name === activity)) {
      const cur = curAct(s, today, toMin(draft.time));
      setActivity(sessions.find((x) => x.activity?.name === cur.name)?.activity?.name || sessions[0]?.activity?.name || '');
    }
  };
  const pickDay = (d: string) => {
    setDate(d);
    const list = pictureSessions(s, d);
    if (!list.some((x) => x.activity?.name === activity)) setActivity(list[0]?.activity?.name || '');
  };
  const save = async () => {
    if (busy) return;
    setBusy(true);
    const input = kind === 'people' ? { id: draft.id, kind, memberIds: ids } : kind === 'scene' ? { id: draft.id, kind, activity, date } : { id: draft.id, kind, meal };
    const r = await act('photo.editDraft', input, { silent: true });
    setBusy(false);
    if (r.ok) { say(t('drafts.saved')); onClose(); }
  };
  const remove = async () => {
    if (busy) return;
    setBusy(true);
    const r = await act('photo.deleteDraft', { id: draft.id }, { silent: true });
    setBusy(false);
    if (r.ok) { say(plural(t, 'drafts.deletedN', 1)); onClose(); }
  };
  const kindLabel: Record<DraftKind, string> = { people: t('drafts.kindPeople'), scene: t('drafts.kindScene'), food: t('drafts.kindFood') };
  return (
    <Sheet open onClose={() => !busy && onClose()} title={t('drafts.editTitle')}
      footer={(
        <div style={{ position: 'sticky', bottom: -32, margin: '0 -20px -32px', padding: '12px 20px 28px', background: '#FFFFFF', borderTop: '0.5px solid var(--hairline, #E2E2E6)', display: 'flex', gap: 8 }}>
          <Button variant="secondary" icon="delete" disabled={busy} onClick={() => void remove()} label={t('drafts.deleteDraft')} title={t('drafts.deleteDraft')} style={{ color: '#9A3D24', padding: '0 14px' }} />
          <Button disabled={busy} onClick={() => void save()} style={{ flex: 1, minWidth: 0 }}>{t('common.save')}</Button>
        </div>
      )}>
      <div data-testid="draft-sheet" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ position: 'relative', height: 150, borderRadius: 12, overflow: 'hidden', background: '#E8E1D8' }}>
          <span role="img" aria-label={t('drafts.preview')} style={{ position: 'absolute', inset: 0 }}><PhotoImg photo={draft} controls={draft.media === 'video'} /></span>
        </div>
        {ai ? <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--eyebrow, #6E5A43)' }}><AiMark label={t('drafts.aiSuggested')} />{sure ? <span>{t('drafts.aiLine', { pct: sure })}</span> : null}</div> : null}
        {kinds.length > 1 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: FONT_BODY, fontWeight: 500 }}>{t('drafts.filedAs')}</span>
            <Segmented label={t('drafts.filedAs')} value={kind} onChange={pickKind} items={kinds.map((k) => ({ value: k, label: kindLabel[k] }))} />
          </div>
        ) : null}
        {kind === 'people' ? (
          <>
            {unnamed ? <Note tone="ochre" icon="face">{plural(t, 'drafts.unnamed', unnamed)}</Note> : null}
            <MemberPicker members={here} value={ids} onChange={setIds} suggested={suggested} selectedLabel={t('activity.inThisPhoto')} emptyLabel={t('activity.nobodyAdded')}
              sub={(m) => { const tag = faceTagging(m); return tag === 'on' ? t('activity.suggested') : t(tag === 'optOut' ? 'activity.faceOptOut' : 'activity.faceNotEnrolled'); }} />
          </>
        ) : null}
        {kind === 'scene' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(0,3fr)', gap: 8, alignItems: 'start' }}>
            <Select label={t('drafts.day')} value={date} onChange={pickDay} options={days.map((d) => ({ value: d, label: d === today ? `${t('common.today')} · ${fds(d)}` : fds(d) }))} />
            <Select label={t('drafts.session')} value={activity} onChange={setActivity} placeholder={t('drafts.pickSession')} options={sessionOptions} />
          </div>
        ) : null}
        {kind === 'food' ? <Segmented label={t('drafts.meal')} value={meal} onChange={setMeal} items={[{ value: 'lunch' as const, label: t('activity.lunch') }, { value: 'tea' as const, label: t('activity.tea') }]} /> : null}
      </div>
    </Sheet>
  );
}

/** The buttons pinned to the bottom: on a phone floating pills just above the tab bar (a Pin that makes the quick camera button step up), elsewhere a bar that sticks to the page bottom. */
function Bar({ phone, children }: { phone: boolean; children: ReactNode }) {
  const pin = useUi((st) => st.pin);
  useEffect(() => { if (!phone) return; pin(1); return () => pin(-1); }, [phone, pin]);
  if (phone) return <div style={{ position: 'fixed', right: 0, bottom: 'calc(86px + env(safe-area-inset-bottom, 0px))', zIndex: 44, padding: '4px 14px 10px', display: 'flex', justifyContent: 'flex-end', gap: 8, pointerEvents: 'none' }}>{children}</div>;
  return <div style={{ position: 'sticky', bottom: 16, alignSelf: 'flex-start', zIndex: 5, padding: 8, borderRadius: 16, background: '#FFFFFF', border: '0.5px solid var(--hairline, #E2E2E6)', boxShadow: '0 10px 28px rgba(40,30,20,0.16)', display: 'flex', alignItems: 'center', gap: 8 }}>{children}</div>;
}
const pillBtn = (primary: boolean, disabled = false): CSSProperties => ({ pointerEvents: 'auto', height: 44, padding: '0 18px', borderRadius: 12, border: primary ? 'none' : '1px solid var(--hairline, #E2E2E6)', background: disabled ? 'var(--press, #EEEEF0)' : primary ? '#24201C' : '#FFFFFF', color: disabled ? '#8A8078' : primary ? '#FFFFFF' : '#24201C', fontSize: 15, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: disabled ? 'not-allowed' : 'pointer', boxShadow: '0 10px 24px rgba(40,30,20,0.18)', fontFamily: 'Inter', whiteSpace: 'nowrap' });

export function DraftsBody({ onMore }: { /** the Camera page offers its older ways to take a photo under "More ways" */ onMore?: (to: 'manual' | 'activity') => void }) {
  const t = useT();
  const lang = useLang();
  const { fds } = useFmt();
  const { isPhone } = useDevice();
  const s = useClub();
  const { id, role } = useMe();
  const { today } = useNow();
  const act = useAct();
  const openCam = useQuickCam((q) => q.openCam);
  const review = role !== 'mgmt'; // everyone but management sends for approval
  const drafts = useMemo(() => (id ? draftsOf(s, id) : []), [s, id]);
  const [selecting, setSelecting] = useState(false);
  const [sel, setSel] = useState<string[]>([]);
  const [edit, setEdit] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const chosen = useMemo(() => sel.filter((x) => drafts.some((d) => d.id === x)), [sel, drafts]);
  const editing = edit ? drafts.find((d) => d.id === edit) : undefined;
  useEffect(() => { if (!drafts.length) { setSelecting(false); setSel([]); } }, [drafts.length]);

  const groups = useMemo(() => {
    const out: { key: string; label: string; photos: Photo[] }[] = [];
    for (const p of drafts) {
      const key = draftGroupKey(p);
      let g = out.find((x) => x.key === key);
      if (!g) {
        const name = p.kind === 'lunch' ? t(draftMeal(p) === 'tea' ? 'activity.tea' : 'activity.lunch') : p.activity ? activityLabel(s, p.activity, t, lang) : t('drafts.none');
        g = { key, label: p.date === today ? name : `${name} · ${fds(p.date)}`, photos: [] };
        out.push(g);
      }
      g.photos.push(p);
    }
    return out;
  }, [drafts, s, t, lang, fds, today]);

  const send = async (list: string[]) => {
    if (!list.length || busy) return;
    setBusy(true);
    const r = await act('photo.sendDrafts', { ids: list }, { silent: true });
    setBusy(false);
    if (!r.ok) return; // the toast says why (nobody named, no session…)
    const sent = Number(r.result.sent ?? 0), left = Array.isArray(r.result.skipped) ? r.result.skipped.length : 0;
    const sentIds = Array.isArray(r.result.photoIds) ? (r.result.photoIds as string[]) : [];
    say([plural(t, review ? 'drafts.sentReviewN' : 'drafts.sentN', sent), left ? plural(t, 'drafts.notAll', left) : ''].filter(Boolean).join(' '), {
      icon: review ? 'hourglass_top' : 'check_circle',
      ...(sentIds.length ? { action: { label: t('common.undo'), run: () => void act('photo.unsend', { ids: sentIds }, { ok: t('drafts.undone') }) } } : {}),
    });
    setSelecting(false); setSel([]);
  };
  const removeSel = async () => {
    if (!chosen.length || busy) return;
    setBusy(true);
    const r = await act('photo.deleteDraft', { ids: chosen }, { silent: true });
    setBusy(false);
    if (r.ok) { say(plural(t, 'drafts.deletedN', Number(r.result.deleted ?? chosen.length))); setSelecting(false); setSel([]); }
  };
  const toggle = (x: string) => setSel((v) => (v.includes(x) ? v.filter((y) => y !== x) : [...v, x]));

  let index = 0;
  const grid = (photos: Photo[]) => (
    <div style={{ display: 'grid', gridTemplateColumns: isPhone ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fill, minmax(190px, 1fr))', gap: isPhone ? '12px 10px' : '16px 14px' }}>
      {photos.map((p) => <DraftTile key={p.id} p={p} index={index++} selecting={selecting} selected={chosen.includes(p.id)} onPress={() => (selecting ? toggle(p.id) : setEdit(p.id))} />)}
    </div>
  );
  const more = onMore ? (
    isPhone ? (
      <Group title={t('drafts.more')} pad={0} gap={0}>
        {([['manual', 'groups', t('drafts.moreManual')], ['activity', 'event', t('drafts.moreActivity')]] as const).map(([to, icon, label], i) => (
          <button key={to} type="button" className="cp-tap-self" data-testid={`more-${to}`} onClick={() => onMore(to)} style={{ width: '100%', minHeight: 50, padding: '6px 10px 6px 16px', border: 'none', backgroundColor: 'transparent', color: '#24201C', fontSize: 16, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', fontFamily: 'Inter', textAlign: 'left', ...rowLine(i === 0, 58) }}>
            <span aria-hidden="true" className="cp-fill" style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--fill, #F4F4F5)', color: 'var(--accent, #75624B)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon name={icon} size={19} /></span>
            <span style={{ flex: 1, minWidth: 0 }}>{label}</span>
            <Icon name="chevron_right" size={22} color="#A89C8E" />
          </button>
        ))}
      </Group>
    ) : (
      <Card style={{ padding: '14px 22px 6px' }}>
        <SectionLabel>{t('drafts.more')}</SectionLabel>
        {([['manual', 'groups', t('drafts.moreManual')], ['activity', 'event', t('drafts.moreActivity')]] as const).map(([to, icon, label]) => (
          <button key={to} type="button" className="h-row" data-testid={`more-${to}`} onClick={() => onMore(to)} style={{ width: '100%', minHeight: 56, margin: '0', padding: '8px 0', border: 'none', borderTop: '0.5px solid var(--hairline, #E2E2E6)', background: 'transparent', color: '#24201C', fontSize: 16, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', fontFamily: 'Inter', textAlign: 'left' }}>
            <Icon name={icon} size={22} color="var(--accent, #75624B)" /><span style={{ flex: 1, minWidth: 0 }}>{label}</span><Icon name="chevron_right" size={22} color="#A89C8E" />
          </button>
        ))}
      </Card>
    )
  ) : null;

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: isPhone ? 14 : 20 }}>
        <div data-testid="drafts-open-camera"><Button size={56} full={isPhone} icon="photo_camera" onClick={openCam}>{t('drafts.openCamera')}</Button></div>
        {selecting ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: isPhone ? '0 16px' : 0, fontSize: 14, color: '#6B6259' }}>
            <span>{t('drafts.nSelected', { n: chosen.length })}</span>
            <button type="button" className="cp-press" onClick={() => setSel(chosen.length === drafts.length ? [] : drafts.map((d) => d.id))} style={{ border: 'none', background: 'transparent', color: 'var(--accent, #75624B)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter', padding: '6px 0' }}>{t('drafts.selectAll')}</button>
          </div>
        ) : null}
        {drafts.length ? groups.map((g) => (isPhone
          ? <Group key={g.key} title={g.label} meta={plural(t, 'drafts.nShots', g.photos.length)} pad="12px 12px 14px" gap={0}>{grid(g.photos)}</Group>
          : <Card key={g.key} pad="18px 22px 22px" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}><SectionLabel>{g.label}</SectionLabel><span style={{ fontSize: 13, color: '#6B6259' }}>{plural(t, 'drafts.nShots', g.photos.length)}</span></div>
              {grid(g.photos)}
            </Card>
        )) : (isPhone
          ? <Group pad={0} gap={0}><EmptyState icon="photo_camera" title={t('drafts.empty')} /></Group>
          : <Card><EmptyState icon="photo_camera" title={t('drafts.empty')} sub={t('drafts.emptyAll')} /></Card>)}
        {more}
      </div>
      {drafts.length ? (
        <Bar phone={isPhone}>
          {selecting ? (
            <>
              <button type="button" className="cp-press" onClick={() => { setSelecting(false); setSel([]); }} style={pillBtn(false)}>{t('common.cancel')}</button>
              <button type="button" className="cp-press" data-testid="drafts-delete" aria-disabled={!chosen.length || busy} onClick={() => void removeSel()} style={{ ...pillBtn(false, !chosen.length), color: chosen.length ? '#9A3D24' : '#8A8078' }}>{t('drafts.deleteSel', { n: chosen.length })}</button>
              <button type="button" className="cp-press" data-testid="drafts-send" aria-disabled={!chosen.length || busy} onClick={() => void send(chosen)} style={pillBtn(true, !chosen.length)}>{t('drafts.sendSel', { n: chosen.length })}</button>
            </>
          ) : (
            <>
              <button type="button" className="cp-press" data-testid="drafts-select" onClick={() => setSelecting(true)} style={pillBtn(false)}>{t('drafts.select')}</button>
              <button type="button" className="cp-press" data-testid="drafts-send" aria-disabled={busy} onClick={() => void send(drafts.map((d) => d.id))} style={pillBtn(true)}>
                <Icon name="send" size={19} />{t(review ? 'drafts.sendAllReview' : 'drafts.sendAll', { n: drafts.length })}
              </button>
            </>
          )}
        </Bar>
      ) : null}
      {editing ? <DraftSheet key={editing.id} draft={editing} onClose={() => setEdit(null)} /> : null}
    </>
  );
}

/** The kitchen's (and anybody's) Drafts page: `/drafts`. */
export function Drafts() {
  const t = useT();
  const { device, isPhone } = useDevice();
  const { today } = useNow();
  const { fdl } = useFmt();
  return (
    <div className={isPhone ? 'cp-native' : undefined} style={{ padding: padFor(device), display: 'flex', flexDirection: 'column', gap: isPhone ? 14 : 'clamp(16px, 2.4vw, 28px)', minHeight: '100%' }}>
      <PageHead eyebrow={fdl(today)} title={t('drafts.title')} />
      <DraftsBody />
    </div>
  );
}

