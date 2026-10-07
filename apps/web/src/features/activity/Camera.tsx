// Camera (design ScrCamera): the real camera (CameraCapture) for group and solo photos, a search-and-pick for who is in a group photo, a searchable paged list
// of members for solo photos, "Sent today", and a Library tab. Photos are tagged with today's session (curAct) and uploaded with uploadMedia().
// Short videos (up to 15 s, with sound when the microphone is allowed) are real too: recorded in CameraCapture's video mode (or chosen from the device)
// and sent through the same Solo / Group flow. Photos and videos taken by anyone but management are sent for approval: families see them only once management approves.
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useSearchParams } from 'react-router-dom';
import { famNames, memberName, memberShort, primaryContact, type Photo } from '@cp/shared';
import { curAct, faceTagging, inClubMembers, photoCountByMember, searchMembers, sentToday, sortByPhotoCount, suggestedFaces, activityName, roomName } from '@cp/shared/rules/activity';
import { Button, CameraCapture, Icon, PageHead, Pager, Pin, PhotoImg, Segmented, Sheet, TextField, usePaged, FONT_BODY, FONT_SMALL, type CaptureInfo } from '../../components/ui';
import { useDevice, padFor } from '../../hooks/useDevice';
import { useT, useLang, useFmt } from '../../lib/i18n';
import { useAct } from '../../lib/act';
import { ApiError } from '../../lib/api';
import { useMe } from '../../lib/me';
import { uploadMedia } from '../../lib/media';
import { useNow } from '../../lib/clock';
import { useClub } from '../../store/replica';
import { say } from '../../store/ui';
import { Av, plural } from './lib';
import { MemberPicker } from './MemberPicker';
import { PhotoLibraryBody } from './PhotoLibrary';
import { PhotoViewer } from './PhotoViewer';

const corner = (pos: CSSProperties): CSSProperties => ({ position: 'absolute', width: 32, height: 32, ...pos });
const label: CSSProperties = { fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 500, lineHeight: '18px', color: '#6E5A43' };

type Capture = null | { kind: 'group'; media: 'photo' | 'video' } | { kind: 'solo'; id: string; media: 'photo' | 'video' };
type GroupDraft = { media: 'photo' | 'video'; blob: Blob | null; durationSec?: number; pick: string[] };

export function Camera() {
  const t = useT();
  const lang = useLang();
  const { fdl } = useFmt();
  const { device, isPhone } = useDevice();
  const s = useClub();
  const { today, nowMin } = useNow();
  const act = useAct();
  const { role } = useMe();
  const review = role !== 'mgmt'; // everyone but management sends photos for approval
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'library' ? 'library' : 'camera';
  const [cap, setCap] = useState<Capture>(null);
  const [group, setGroup] = useState<GroupDraft | null>(null);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null); // 'group' or the member being photographed
  const [viewer, setViewer] = useState<string | null>(null);

  const cur = useMemo(() => curAct(s, today, nowMin), [s, today, nowMin]);
  const here = useMemo(() => inClubMembers(s, today), [s, today]);
  const sug = useMemo(() => suggestedFaces(here), [here]);
  const sent = useMemo(() => sentToday(s, today), [s, today]);
  // today's photos per member (solo and group, pending included): the members with none come first, so staff see who still needs one
  const counts = useMemo(() => photoCountByMember(sent), [sent]);
  const found = useMemo(() => sortByPhotoCount(searchMembers(here, q), counts), [here, q, counts]);
  const paged = usePaged(found, 5, q);
  const nowAct = (() => {
    const when = cur.kind === 'session' && cur.session ? t(cur.phase === 'now' ? 'activity.nowAt' : cur.phase === 'next' ? 'activity.nextAt' : 'activity.lastAt', { time: cur.session.time }) : cur.kind === 'outing' ? t('activity.outingLabel') : t('activity.generalAct');
    const name = cur.kind === 'session' ? activityName(cur.session?.activity, lang) : cur.kind === 'outing' ? cur.outing?.titleId && lang === 'id' ? cur.outing.titleId : cur.name : '';
    const room = cur.kind === 'session' ? roomName(cur.session?.room, lang) : '';
    return [when, name, room].filter(Boolean).join(' · ');
  })();
  // members who left while the picker was open drop out of the pick
  const pick = group ? group.pick.filter((id) => here.some((m) => m.id === id)) : [];
  // a preview of the shot while choosing who is in it
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!group?.blob) { setPreview(null); return; }
    const url = URL.createObjectURL(group.blob);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [group?.blob]);

  const households = (ids: string[]) => new Set(ids.map((id) => primaryContact(s, id)?.id || id)).size;
  /** Upload the shot; false when it failed (the toast says why), undefined when there is nothing to upload. */
  const upload = async (blob: Blob | null): Promise<string | undefined | false> => {
    if (!blob) return undefined;
    try { return await uploadMedia(blob); } catch (e) {
      say(e instanceof ApiError ? t(e.code, e.params) : t('activity.uploadFailed'), { tone: 'error', icon: 'error' });
      return false;
    }
  };

  const onCapture = (blob: Blob, info?: CaptureInfo) => {
    if (!cap) return;
    const media = info?.media ?? cap.media;
    if (cap.kind === 'group') setGroup({ media, blob, durationSec: info?.durationSec, pick: [] });
    else void sendSolo(cap.id, media, blob, info?.durationSec);
  };
  const sendGroup = async () => {
    if (!group || !pick.length || busy) return;
    setBusy('group');
    const mediaId = await upload(group.blob);
    if (mediaId === false) { setBusy(null); return; }
    const r = await act('photo.take', { kind: 'group', memberIds: pick, media: group.media, activity: cur.name, ...(group.media === 'video' && group.durationSec ? { durationSec: group.durationSec } : {}), ...(mediaId ? { mediaId } : {}) }, { silent: true });
    setBusy(null);
    if (r.ok) {
      say(review ? t(group.media === 'video' ? 'activity.sentGroupVideoPending' : 'activity.sentGroupPending') : plural(t, group.media === 'video' ? 'activity.sentGroupVideo' : 'activity.sentGroupPhoto', households(pick)));
      setGroup(null);
    }
  };
  const sendSolo = async (id: string, media: 'photo' | 'video', blob: Blob | null, durationSec?: number) => {
    const m = s.members[id];
    if (!m || busy) return;
    setBusy(id);
    const mediaId = await upload(blob);
    if (mediaId === false) { setBusy(null); return; }
    const r = await act('photo.take', { kind: 'solo', memberIds: [id], media, activity: cur.name, ...(media === 'video' && durationSec ? { durationSec } : {}), ...(mediaId ? { mediaId } : {}) }, { silent: true });
    setBusy(null);
    if (r.ok) say(review ? t(media === 'video' ? 'activity.sentSoloVideoPending' : 'activity.sentSoloPending', { name: memberShort(m) }) : t(media === 'video' ? 'activity.sentSoloVideo' : 'activity.sentSoloPhoto', { name: memberShort(m), fam: famNames(s, id, t('common.and')) || t('activity.theFamily') }));
  };
  const todayCount = (id: string) => counts[id] ?? 0;
  const caption = (p: Photo) => [p.visibility === 'pending' ? t('activity.pendingTag') : '', p.media === 'video' ? t('activity.video') : '', p.kind === 'group' ? t('activity.group') : ''].filter(Boolean).concat([p.memberIds.slice(0, 3).map((id) => (s.members[id] ? memberShort(s.members[id]) : '')).filter(Boolean).join(', ') + (p.memberIds.length > 3 ? ` +${p.memberIds.length - 3}` : '')]).join(' · ');

  const header = (
    <>
      <PageHead eyebrow={tab === 'camera' ? nowAct : fdl(today)} title={t('nav.camera')} />
      <Segmented label={t('nav.camera')} value={tab} onChange={(v) => setParams(v === 'library' ? { tab: 'library' } : {}, { replace: true })} items={[{ value: 'camera', label: t('nav.camera') }, { value: 'library', label: t('activity.library') }]} />
    </>
  );

  if (tab === 'library') {
    return (
      <div style={{ padding: padFor(device), display: 'flex', flexDirection: 'column', gap: 'clamp(16px, 2.4vw, 28px)', maxWidth: 1100 }}>
        {header}
        <PhotoLibraryBody />
      </div>
    );
  }
  const can = here.length > 0;
  const takeLabel = t('activity.takeGroup');
  return (
    <>
      <div style={{ padding: padFor(device), display: 'flex', flexDirection: 'column', gap: 'clamp(16px, 2.4vw, 24px)', maxWidth: 760 }}>
        {header}
        {!can ? <div style={{ padding: '32px 20px', borderRadius: 16, background: '#FFFFFF', border: '1px solid #EFE7DC', boxShadow: 'var(--card-shadow)', textAlign: 'center', fontSize: 16, color: '#5E5852', lineHeight: 1.4 }}>{t('activity.nobodyYet')}</div> : null}
        <div style={{ position: 'relative', aspectRatio: '4/3', maxHeight: 300, width: '100%', borderRadius: 16, background: '#2E2924', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: '#F3EEE8', textAlign: 'center', padding: 24 }}>
          <div style={corner({ top: 18, left: 18, borderTop: '2px solid #CAB8A2', borderLeft: '2px solid #CAB8A2', borderTopLeftRadius: 10 })} />
          <div style={corner({ top: 18, right: 18, borderTop: '2px solid #CAB8A2', borderRight: '2px solid #CAB8A2', borderTopRightRadius: 10 })} />
          <div style={corner({ bottom: 18, left: 18, borderBottom: '2px solid #CAB8A2', borderLeft: '2px solid #CAB8A2', borderBottomLeftRadius: 10 })} />
          <div style={corner({ bottom: 18, right: 18, borderBottom: '2px solid #CAB8A2', borderRight: '2px solid #CAB8A2', borderBottomRightRadius: 10 })} />
          <Icon name="groups" size={44} color="#CAB8A2" />
          <span style={{ fontSize: 18 }}>{t('activity.groupPhoto')}</span>
        </div>

        {!isPhone ? (
          <button type="button" className={can ? 'dh46' : undefined} aria-disabled={!can} onClick={() => can && setCap({ kind: 'group', media: 'photo' })} style={{ height: 56, borderRadius: 999, border: 'none', background: can ? '#24201C' : '#E8E1D8', color: can ? '#FFFFFF' : '#5E5852', fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: can ? 'pointer' : 'not-allowed', fontFamily: 'Inter' }}>
            <Icon name="photo_camera" size={24} />{takeLabel}
          </button>
        ) : null}
        <button type="button" aria-disabled={!can} onClick={() => can && setCap({ kind: 'group', media: 'video' })} style={{ height: 52, borderRadius: 999, border: can ? '1px solid #DCD3C8' : '1px solid #E4DACD', background: '#FFFFFF', color: can ? '#24201C' : '#5E5852', fontSize: 15, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: can ? 'pointer' : 'not-allowed', fontFamily: 'Inter' }}>
          <Icon name="videocam" size={22} color={can ? '#24201C' : '#5E5852'} />{t('activity.recordGroupVideo')}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: FONT_BODY, lineHeight: '20px', color: '#24201C' }}>
          <Icon name={review ? 'hourglass_top' : 'lock'} size={20} color="#75624B" />{t(review ? 'activity.privacyNoteReview' : 'activity.privacyNote')}
        </div>

        {sent.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={label}>{t('activity.sentToday')}</div>
            <div className="scroll-x" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
              {sent.slice(0, 8).map((p) => (
                <button key={p.id} type="button" onClick={() => setViewer(p.id)} aria-label={`${p.time}, ${caption(p)}`} data-photo-id={p.id} style={{ flex: 'none', width: 132, display: 'flex', flexDirection: 'column', gap: 4, background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', color: '#24201C', fontFamily: 'Inter' }}>
                  <span style={{ position: 'relative', display: 'block', width: '100%', aspectRatio: '1', borderRadius: 10, overflow: 'hidden', background: '#E8E1D8' }}>
                    <span aria-hidden="true" style={{ position: 'absolute', inset: 0 }}><PhotoImg photo={p} /></span>
                    <span style={{ position: 'absolute', left: 6, bottom: 6, height: 22, padding: '0 7px', borderRadius: 8, background: '#FFFFFF', fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center' }}>{p.time}</span>
                    {p.visibility === 'pending' ? <span style={{ position: 'absolute', left: 6, top: 6, height: 22, padding: '0 7px 0 5px', borderRadius: 8, background: '#F6ECD6', color: '#7A5510', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}><Icon name="hourglass_top" size={14} fill={1} />{t('activity.pendingTag')}</span> : null}
                  </span>
                  <span style={{ fontSize: FONT_SMALL, lineHeight: '18px' }}>{caption(p).replace(t('activity.pendingTag') + ' · ', '')}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div style={{ background: '#FFFFFF', border: '1px solid #EFE7DC', borderRadius: 16, boxShadow: 'var(--card-shadow)', overflow: 'hidden' }}>
          <div style={{ padding: '18px 22px 8px', ...label }}>{t('activity.soloTitle')}</div>
          <div style={{ padding: '0 22px 12px' }}>
            <TextField label={t('activity.searchMember')} value={q} onChange={setQ} placeholder={t('activity.searchMemberPh')} inputMode="search" />
          </div>
          {paged.rows.map((m) => {
            const n = todayCount(m.id);
            const tag = faceTagging(m);
            const mine = busy === m.id;
            const sub = mine ? t('activity.uploading') : [n ? '' : t('activity.noPhotosToday'), tag !== 'on' ? t('activity.byNameOnly') : ''].filter(Boolean).join(' · ');
            return (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '0 22px', padding: '12px 0', borderTop: '1px solid #F0EAE1', minHeight: 68 }}>
                <Av m={m} size={44} fs={16} />
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4, minWidth: 0 }}>{memberName(m)}</span>
                    {n ? <span data-today-count={n} style={{ flex: 'none', color: '#3D6B4F', fontSize: 13, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}><span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 999, background: '#3D6B4F' }} />{t('activity.nToday', { n })}</span> : null}
                  </span>
                  {sub ? <span style={{ fontSize: 'max(13px, var(--cp-body, 0px))', color: '#6B6259', lineHeight: 1.4 }}>{sub}</span> : null}
                </span>
                <button type="button" onClick={() => !busy && setCap({ kind: 'solo', id: m.id, media: 'video' })} aria-disabled={!!busy} aria-label={t('activity.videoOf', { name: memberShort(m) })} style={{ width: 48, height: 48, borderRadius: 999, border: '1px solid #DCD3C8', background: '#FFFFFF', color: '#24201C', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flex: 'none' }}>
                  <Icon name="videocam" size={22} color="#75624B" />
                </button>
                <button type="button" onClick={() => !busy && setCap({ kind: 'solo', id: m.id, media: 'photo' })} aria-disabled={!!busy} aria-label={t('activity.photoOf', { name: memberShort(m) })} style={{ height: 48, padding: '0 16px 0 12px', borderRadius: 12, border: '1px solid #DCD3C8', background: '#FFFFFF', color: '#24201C', fontSize: 16, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', flex: 'none', fontFamily: 'Inter' }}>
                  <Icon name="photo_camera" size={20} />{t('activity.photo')}
                </button>
              </div>
            );
          })}
          {!found.length ? <div role="status" style={{ margin: '0 22px', padding: '16px 0 20px', borderTop: '1px solid #F0EAE1', fontSize: FONT_BODY, color: '#5E5852', lineHeight: 1.4 }}>{here.length ? t('activity.noMemberMatch', { q: q.trim() }) : t('activity.nobodyYet')}</div> : null}
          <Pager page={paged.page} pages={paged.pages} onPage={paged.setPage} label={t('activity.memberPager')} />
        </div>
      </div>
      {isPhone && can ? <Pin icon="photo_camera" label={takeLabel} onClick={() => setCap({ kind: 'group', media: 'photo' })} /> : null}
      <CameraCapture open={!!cap} onClose={() => setCap(null)} onCapture={onCapture} facing="environment" mode={cap?.media === 'video' ? 'video' : 'photo'} />
      <Sheet open={!!group} onClose={() => !busy && setGroup(null)} title={t(group?.media === 'video' ? 'activity.whoVideo' : 'activity.whoPhoto')}
        footer={(
          <div style={{ position: 'sticky', bottom: -32, margin: '0 -20px -32px', padding: '12px 20px 28px', background: '#FFFFFF', borderTop: '1px solid #F0EAE1', display: 'flex', gap: 8 }}>
            <Button variant="secondary" onClick={() => setGroup(null)} disabled={!!busy}>{t('common.cancel')}</Button>
            <Button full disabled={!pick.length || !!busy} onClick={() => void sendGroup()}>
              {busy === 'group' ? t('activity.uploading') : !pick.length ? t('activity.pickWho') : review ? t('activity.sendForReview') : plural(t, 'activity.sendTo', households(pick))}
            </Button>
          </div>
        )}>
        {preview ? (group?.media === 'video'
          ? <video src={preview} controls playsInline preload="metadata" aria-label={t('ds.videoPreview')} style={{ width: '100%', maxHeight: 180, objectFit: 'contain', borderRadius: 12, background: '#000000' }} />
          : <img src={preview} alt={t('common.photoPreview')} style={{ width: '100%', maxHeight: 140, objectFit: 'cover', borderRadius: 12, background: '#E8E1D8' }} />) : null}
        <MemberPicker members={here} value={pick} onChange={(ids) => setGroup((g) => (g ? { ...g, pick: ids } : g))} suggested={sug}
          selectedLabel={t(group?.media === 'video' ? 'activity.inThisVideo' : 'activity.inThisPhoto')} emptyLabel={t('activity.nobodyAdded')}
          sub={(m) => { const tag = faceTagging(m); return tag === 'on' ? t('activity.suggested') : t(tag === 'optOut' ? 'activity.faceOptOut' : 'activity.faceNotEnrolled'); }} />
      </Sheet>
      {viewer ? <PhotoViewer photos={sent} startId={viewer} onClose={() => setViewer(null)} audience="staff" /> : null}
    </>
  );
}
