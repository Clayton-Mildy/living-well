// Activity pictures (KC round 7): pictures of a session itself ("activity is only for activity, it can be anyone in that activity"), kept apart from group photos.
// The teacher picks a day (today, or an open day in the last 7) and one activity of that day's plan, takes or chooses a picture (no member tags) and sees every
// picture of that session with its state: waiting for approval, approved, or rejected with the reason (then "Upload another"). Management's own are approved at once.
// It is the third tab of the Camera. The bell notice for a rejection links back here (?tab=activity&date=…&act=…).
import { useMemo, useState, type CSSProperties } from 'react';
import { useSearchParams } from 'react-router-dom';
import { staffCall, type Activity, type ISODate } from '@cp/shared';
import { activityName, curAct, logDateOk, pictureDays, pictureSessions, sessionPictures, type PictureState, type SessionPicture } from '@cp/shared/rules/activity';
import { Button, Card, CameraCapture, EmptyState, Group, Icon, PhotoImg, Pin, Select } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { useT, useLang, useFmt } from '../../lib/i18n';
import { useAct } from '../../lib/act';
import { ApiError } from '../../lib/api';
import { useMe } from '../../lib/me';
import { uploadMedia } from '../../lib/media';
import { useNow } from '../../lib/clock';
import { useClub } from '../../store/replica';
import { say } from '../../store/ui';
import { StatusDot, plural, rowLine } from './lib';
import { PhotoViewer } from './PhotoViewer';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const STATE_LOOK: Record<PictureState, { color: string; key: string }> = {
  pending: { color: '#7A5510', key: 'activity.pendingTag' },
  approved: { color: '#3D6B4F', key: 'activity.picApproved' },
  hidden: { color: '#6B6259', key: 'activity.hiddenBadge' },
  rejected: { color: '#9A3D24', key: 'activity.picRejected' },
};

export function ActivityPicturesBody() {
  const t = useT();
  const lang = useLang();
  const { fds } = useFmt();
  const { isPhone } = useDevice();
  const s = useClub();
  const { today, nowMin } = useNow();
  const act = useAct();
  const { role } = useMe();
  const review = role !== 'mgmt'; // everyone but management waits for approval
  const [params, setParams] = useSearchParams();
  const [cap, setCap] = useState(false);
  const [busy, setBusy] = useState(false);
  const [viewer, setViewer] = useState<string | null>(null);

  // the day: today and the open days of the last week that have a session; a day a link asks for is offered too (so a late rejection can still be opened)
  const asked = params.get('date') || '';
  const dates = useMemo(() => {
    const days = pictureDays(s, today);
    return ISO.test(asked) && asked <= today && !days.includes(asked) && pictureSessions(s, asked).length ? [...days, asked].sort().reverse() : days;
  }, [s, today, asked]);
  const date: ISODate = dates.includes(asked) ? asked : dates[0] || today;
  const sessions = useMemo(() => (dates.length ? pictureSessions(s, date) : []), [s, date, dates.length]);
  // the activity: the one asked for, else the one running now (today), else the first of the day
  const cur = useMemo(() => curAct(s, today, nowMin), [s, today, nowMin]);
  const pickDefault = (d: ISODate, list: typeof sessions) => (d === today && cur.session?.activity && list.some((x) => x.activity?.name === cur.session?.activity?.name) ? cur.session.activity.name : list[0]?.activity?.name || '');
  const askedAct = params.get('act') || '';
  const actName = sessions.some((x) => x.activity?.name === askedAct) ? askedAct : pickDefault(date, sessions);
  const activity: Activity | undefined = sessions.find((x) => x.activity?.name === actName)?.activity;
  const slot = sessions.find((x) => x.activity?.name === actName)?.time;
  const pics = useMemo(() => sessionPictures(s, date, activity), [s, date, activity]);
  const canAdd = !!activity && logDateOk(today, date);
  const shown = pics.filter((x) => x.state !== 'rejected').map((x) => x.photo);

  const select = (d: ISODate, a: string) => setParams({ tab: 'activity', date: d, act: a }, { replace: true });
  const onDay = (d: ISODate) => select(d, pickDefault(d, pictureSessions(s, d)));
  const label = (x: Pick<Activity, 'name' | 'nameId'> | undefined) => activityName(x, lang);

  const onCapture = async (blob: Blob) => {
    if (!activity || busy) return;
    setBusy(true);
    let mediaId: string;
    try { mediaId = await uploadMedia(blob); } catch (e) {
      say(e instanceof ApiError ? t(e.code, e.params) : t('activity.uploadFailed'), { tone: 'error', icon: 'error' });
      setBusy(false);
      return;
    }
    const r = await act('photo.addActivity', { date, activity: activity.name, mediaId }, { silent: true });
    setBusy(false);
    if (r.ok) say(t(review ? 'activity.picSentPending' : 'activity.picSent'));
  };
  const addLabel = busy ? t('activity.uploading') : t('activity.picAdd');

  const row = (x: SessionPicture, i: number) => {
    const p = x.photo;
    const look = STATE_LOOK[x.state];
    const rejected = x.state === 'rejected';
    const aria = t('activity.picAria', { a: label(activity), t: p.time, s: t(look.key) });
    const who = staffCall(s.staff[p.takenBy]);
    const size = isPhone ? 52 : 64;
    const thumb: CSSProperties = { position: 'relative', width: size, height: size, borderRadius: 10, overflow: 'hidden', background: '#E8E1D8', flex: 'none', border: 'none', padding: 0 };
    return (
      <div key={p.id} data-picture={p.id} data-state={x.state} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: isPhone ? '10px 12px 10px 16px' : '12px 0', minHeight: size + 20, ...(isPhone ? rowLine(i === 0, 80) : { borderTop: i ? '1px solid #F0EAE1' : 'none' }) }}>
        {rejected
          ? <span aria-hidden="true" style={{ ...thumb, opacity: 0.45 }}><PhotoImg photo={p} /></span>
          : <button type="button" className="cp-press" onClick={() => setViewer(p.id)} aria-label={aria} data-photo-id={p.id} style={{ ...thumb, cursor: 'pointer' }}><PhotoImg photo={p} /></button>}
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.35, fontVariantNumeric: 'tabular-nums' }}>{p.time}{who ? <span style={{ fontWeight: 400, color: '#6B6259' }}> · {who}</span> : null}</span>
          <span style={{ display: 'flex' }}><StatusDot color={look.color}>{t(look.key)}</StatusDot></span>
          {rejected && x.reason ? <span style={{ fontSize: 14, lineHeight: '20px', color: '#9A3D24' }}>{t('activity.picReason', { reason: x.reason })}</span> : null}
        </span>
        {rejected && canAdd ? (
          <button type="button" className="cp-press" onClick={() => !busy && setCap(true)} aria-disabled={busy} style={{ height: isPhone ? 34 : 44, padding: '0 14px 0 10px', borderRadius: 999, border: '1px solid #DCD3C8', background: '#FFFFFF', color: '#24201C', fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', flex: 'none', fontFamily: 'Inter' }}>
            <Icon name="add_a_photo" size={18} />{t('activity.picUploadAnother')}
          </button>
        ) : null}
      </div>
    );
  };

  const pick = dates.length ? (
    <div style={{ display: 'grid', gridTemplateColumns: isPhone ? 'minmax(0,2fr) minmax(0,3fr)' : 'repeat(auto-fit,minmax(220px,1fr))', gap: isPhone ? 8 : 12, alignItems: 'start' }}>
      <Select label={t('activity.picDay')} value={date} onChange={onDay} options={dates.map((d) => ({ value: d, label: d === today ? `${t('common.today')} · ${fds(d)}` : fds(d) }))} />
      <Select label={t('activity.fActivity')} value={actName} onChange={(a) => select(date, a)} options={sessions.map((x) => ({ value: x.activity?.name || '', label: label(x.activity) }))} />
    </div>
  ) : null;
  const count = plural(t, 'activity.picCount', pics.length);
  const meta = [slot, count].filter(Boolean).join(' · ');
  const list = pics.length ? pics.map(row) : [<div key="empty" style={{ padding: isPhone ? '18px 16px' : '20px 0', fontSize: 15, color: '#5E5852', lineHeight: 1.4 }}>{t('activity.picsEmpty')}</div>];
  const note = (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: isPhone ? '0 16px' : 0, fontSize: 13, lineHeight: '18px', color: '#6B6259' }}>
      <Icon name={review ? 'hourglass_top' : 'lock'} size={16} color="#75624B" style={{ marginTop: 1 }} />{t(review ? 'activity.picNoteReview' : 'activity.picNote')}
    </div>
  );

  if (!dates.length) {
    const empty = <EmptyState icon="event_busy" title={t('activity.picsNoSession')} />;
    return isPhone ? <Group pad={0} gap={0}>{empty}</Group> : <Card>{empty}</Card>;
  }
  return (
    <>
      {isPhone ? (
        // round 6, phone: the day and the activity are one flat group; the session's pictures are a grouped list with the activity as its header
        <>
          <Group pad="14px 16px" gap={0}>{pick}</Group>
          <Group title={label(activity)} meta={meta} pad={0} gap={0}><div data-testid="activity-pictures">{list}</div></Group>
          {note}
          {canAdd ? <Pin icon="add_a_photo" label={addLabel} onClick={() => !busy && setCap(true)} /> : null}
        </>
      ) : (
        <Card pad={22} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {pick}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 20, lineHeight: '28px', fontWeight: 400, letterSpacing: '-0.3px', color: '#2B231C' }}>{label(activity)}<span style={{ fontSize: 14, color: '#6B6259', letterSpacing: 0 }}> · {meta}</span></span>
            {canAdd ? <Button size={48} icon="add_a_photo" disabled={busy} onClick={() => setCap(true)}>{addLabel}</Button> : null}
          </div>
          <div data-testid="activity-pictures">{list}</div>
          {note}
        </Card>
      )}
      <CameraCapture open={cap} onClose={() => setCap(false)} onCapture={(b) => void onCapture(b)} facing="environment" mode="photo" allowUpload />
      {viewer ? <PhotoViewer photos={shown} startId={viewer} onClose={() => setViewer(null)} audience="staff" /> : null}
    </>
  );
}
