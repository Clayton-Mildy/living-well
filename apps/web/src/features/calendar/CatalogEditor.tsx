// Activity and room catalog editor: the schedule builder takes its rooms and activities from here. Activity teachers edit activities; management edits both.
// An activity's room is chosen from the catalog, or "Other" with the room typed as free text (it joins the catalog).
// Round 6 (phone): a pushed full screen (PhoneScreen) with grouped lists and fields, instead of the centred dialog.
import { useState, type ReactNode } from 'react';
import { useResetOn } from '../../lib/useResetOn';
import { live } from '@cp/shared';
import { activityName, roomName } from '@cp/shared/rules/activity';
import { Button, CameraCapture, Dialog, EmptyState, Eyebrow, Group, Icon, IconButton, InfoChip, Note, Pager, PhoneScreen, Segmented, Select, TextField, Toggle, usePaged, FONT_BODY } from '../../components/ui';
import { activityPhoto, mediaUrl, photoFill, uploadMedia } from '../../lib/media';
import { ApiError } from '../../lib/api';
import { say } from '../../store/ui';
import { hasKey } from '@cp/shared';
import { useDevice } from '../../hooks/useDevice';
import { useT, useLang } from '../../lib/i18n';
import { useAct } from '../../lib/act';
import { useMe } from '../../lib/me';
import { useClub } from '../../store/replica';
import { NativeSeg, rowLine } from '../activity/lib';

const ICONS = ['music_note', 'palette', 'self_improvement', 'yard', 'extension', 'style', 'skillet', 'menu_book', 'interests', 'sports_esports', 'theater_comedy', 'brush', 'local_florist', 'fitness_center', 'celebration', 'directions_walk'];
const OTHER = '__other';
interface Form { type: 'activity' | 'room'; id?: string; name: string; nameId: string; icon: string; roomId: string; roomOther: string; active: boolean; venue: boolean; photoMediaId?: string | null }

export function CatalogEditor({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const lang = useLang();
  const s = useClub();
  const act = useAct();
  const { role } = useMe();
  const { isPhone } = useDevice();
  const canRooms = role === 'mgmt';
  const [tab, setTab] = useState<'activities' | 'rooms'>('activities');
  const [form, setForm] = useState<Form | null>(null);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useResetOn(open ? 'open' : null, () => { setForm(null); setTab('activities'); setTried(false); setErr(''); });

  const rooms = live(s.rooms).sort((a, b) => a.name.localeCompare(b.name));
  const acts = live(s.activities).sort((a, b) => a.name.localeCompare(b.name));
  const set = (p: Partial<Form>) => setForm((f) => (f ? { ...f, ...p } : f));
  const newActivity = (): Form => ({ type: 'activity', name: '', nameId: '', icon: 'interests', roomId: rooms[0]?.id || '', roomOther: '', active: true, venue: false, photoMediaId: null });
  const newRoom = (): Form => ({ type: 'room', name: '', nameId: '', icon: '', roomId: '', roomOther: '', active: true, venue: false });

  const roomMissing = !!form && (form.roomId === OTHER ? !form.roomOther.trim() : !form.roomId);
  const actPaged = usePaged(acts, 6);
  const roomPaged = usePaged(rooms, 6);
  const paged = tab === 'rooms' ? roomPaged : actPaged;
  const save = async () => {
    if (!form) return;
    setTried(true);
    if (!form.name.trim() || (form.type === 'activity' && roomMissing) || busy) return;
    setBusy(true);
    const r = form.type === 'activity'
      ? await act('activity.upsert', { ...(form.id ? { id: form.id } : {}), name: form.name.trim(), nameId: form.nameId.trim() || null, icon: form.icon, photoMediaId: form.photoMediaId ?? null, ...(form.roomId === OTHER ? { roomOther: form.roomOther.trim() } : { roomId: form.roomId }), active: form.active }, { ok: t('cal.catalogSaved') })
      : await act('room.upsert', { ...(form.id ? { id: form.id } : {}), name: form.name.trim(), nameId: form.nameId.trim() || null, venue: form.venue }, { ok: t('cal.catalogSaved') });
    setBusy(false);
    if (r.ok) { setForm(null); setTried(false); setErr(''); } else setErr(t(r.code, r.params));
  };

  const row = (key: string, icon: string, title: string, sub: string, extra: ReactNode, onEdit: () => void, editLabel: string, i = 1, src?: string) => isPhone ? (
    // round 6, phone: a grouped row (tinted icon tile, the name over its room, a 34px edit pill), the hairline starting at the text
    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px 8px 16px', minHeight: 58, ...rowLine(i === 0, 62) }}>
      <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: 9, background: photoFill(src, '#F3EEE8'), color: '#75624B', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{src ? null : <Icon name={icon} size={19} />}</span>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.35 }}>{title}</span>
        <span style={{ fontSize: 14, color: '#6B6259', lineHeight: '20px' }}>{sub}</span>
      </div>
      {extra}
      <button type="button" className="cp-press" onClick={onEdit} aria-label={editLabel} title={editLabel} style={{ width: 34, height: 34, borderRadius: 999, border: 'none', background: '#F3EEE8', color: '#75624B', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flex: 'none', padding: 0 }}><Icon name="edit" size={19} /></button>
    </div>
  ) : (
    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 4px', borderTop: '1px solid #F0EAE1', minHeight: 64 }}>
      <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 999, background: photoFill(src, '#F3EEE8'), color: '#75624B', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{src ? null : <Icon name={icon} size={20} />}</span>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{title}</span>
        <span style={{ fontSize: FONT_BODY, color: '#5E5852', lineHeight: '20px' }}>{sub}</span>
      </div>
      {extra}
      <IconButton icon="edit" label={editLabel} onClick={onEdit} />
    </div>
  );
  const activityRows = actPaged.rows.map((a, i) => row(a.id, a.icon, activityName(a, lang), roomName(s.rooms[a.roomId], lang), a.active ? null : <InfoChip label={t('cal.inactive')} tone="cream" />, () => setForm({ type: 'activity', id: a.id, name: a.name, nameId: a.nameId || '', icon: a.icon, photoMediaId: a.photoMediaId ?? null, roomId: a.roomId, roomOther: '', active: a.active, venue: false }), t('cal.editItem', { name: activityName(a, lang) }), i, activityPhoto(a)));
  const roomRows = roomPaged.rows.map((r, i) => row(r.id, 'meeting_room', roomName(r, lang), r.venue ? t('cal.venueRoom') : '', null, () => setForm({ type: 'room', id: r.id, name: r.name, nameId: r.nameId || '', icon: '', roomId: '', roomOther: '', active: true, venue: r.venue }), t('cal.editItem', { name: roomName(r, lang) }), i));
  const heading = form ? (form.id ? t(form.type === 'activity' ? 'cal.editActivity' : 'cal.editRoom') : t(form.type === 'activity' ? 'cal.addActivity' : 'cal.addRoom')) : t('cal.catalogTitle');
  const cancelForm = () => { setForm(null); setTried(false); };

  // round 6, phone: a pushed screen ("‹ Done" on the list, "‹ Cancel" on a form), a centred header, grouped fields and lists, Save pinned at the bottom
  if (isPhone) {
    const pager = <Pager page={paged.page} pages={paged.pages} onPage={paged.setPage} label={t('cal.pagerCatalog')} />;
    return (
      <PhoneScreen open={open} onClose={form ? cancelForm : onClose} label={heading} back={form ? t('common.cancel') : t('common.done')}
        footer={form ? <button type="button" className="h-bronze cp-press" aria-disabled={busy || undefined} onClick={busy ? undefined : save} style={{ width: '100%', height: 50, borderRadius: 999, border: 'none', background: '#24201C', color: '#FFFFFF', fontSize: 16, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter' }}>{t('common.save')}</button> : undefined}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 4 }}>
          <Eyebrow>{t('cal.catalog')}</Eyebrow>
          <h2 style={{ margin: 0, fontSize: 26, lineHeight: 1.15, fontWeight: 400, letterSpacing: '-0.6px', color: '#2B231C' }}>{heading}</h2>
        </div>
        {form ? (
          <>
            <Group pad="14px 14px 16px" gap={14}>
              <TextField label={t('cal.nameEn')} value={form.name} onChange={(v) => set({ name: v })} maxLength={80} error={tried && !form.name.trim() && t('cal.errName')} />
              <TextField label={t('cal.nameId')} value={form.nameId} onChange={(v) => set({ nameId: v })} maxLength={80} />
              {form.type === 'activity' ? <ActivityPhotoField icon={form.icon} value={form.photoMediaId ?? null} onChange={(v) => set({ photoMediaId: v })} /> : null}
            </Group>
            {form.type === 'activity' ? (
              <>
                <Group title={t('cal.icon')} pad="12px 14px">
                  <div role="group" aria-label={t('cal.icon')} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {ICONS.map((i) => (
                      <button key={i} type="button" className="cp-press" aria-pressed={form.icon === i} aria-label={t('cal.icon_' + i)} title={t('cal.icon_' + i)} onClick={() => set({ icon: i })} style={{ width: 44, height: 44, borderRadius: 999, border: form.icon === i ? '1px solid #24201C' : '1px solid #DCD3C8', background: form.icon === i ? '#24201C' : '#FFFFFF', color: form.icon === i ? '#FFFFFF' : '#24201C', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
                        <Icon name={i} size={22} />
                      </button>
                    ))}
                  </div>
                </Group>
                <Group pad="14px 14px 16px" gap={14}>
                  <Select label={t('cal.room')} value={form.roomId} onChange={(v) => set({ roomId: v })} error={tried && roomMissing && !form.roomId && t('cal.errRoom')}
                    options={[...rooms.map((r) => ({ value: r.id, label: roomName(r, lang) })), { value: OTHER, label: t('cal.roomOther') }]} />
                  {form.roomId === OTHER ? <TextField label={t('cal.roomOtherLabel')} value={form.roomOther} onChange={(v) => set({ roomOther: v })} maxLength={80} placeholder={t('cal.roomOtherPh')} error={tried && !form.roomOther.trim() && t('cal.errRoom')} /> : null}
                </Group>
                <Group pad="10px 12px"><Toggle on={form.active} onClick={() => set({ active: !form.active })} label={t('cal.active')} /></Group>
              </>
            ) : <Group pad="10px 12px"><Toggle on={form.venue} onClick={() => set({ venue: !form.venue })} label={t('cal.venueRoom')} /></Group>}
            {err ? <Note tone="rust" icon="error">{err}</Note> : null}
          </>
        ) : (
          <>
            {canRooms ? <NativeSeg label={t('cal.catalog')} value={tab} onChange={setTab} items={[{ value: 'activities', label: t('cal.activities'), n: acts.length }, { value: 'rooms', label: t('cal.rooms'), n: rooms.length }]} /> : null}
            <div style={{ background: '#FFFFFF', borderRadius: 14, overflow: 'hidden' }}>
              <button type="button" className="cp-tap-self" onClick={() => setForm(tab === 'rooms' ? newRoom() : newActivity())} style={{ width: '100%', minHeight: 50, padding: '6px 10px 6px 16px', border: 'none', backgroundColor: '#FFFFFF', color: '#24201C', fontSize: 16, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', fontFamily: 'Inter', textAlign: 'left' }}>
                <span aria-hidden="true" style={{ width: 30, height: 30, borderRadius: 8, background: '#24201C', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon name="add" size={19} /></span>
                <span style={{ flex: 1, minWidth: 0 }}>{t(tab === 'rooms' ? 'cal.addRoom' : 'cal.addActivity')}</span>
              </button>
            </div>
            <div style={{ background: '#FFFFFF', borderRadius: 14, overflow: 'hidden' }}>
              {tab === 'activities' ? activityRows : roomRows}
              {paged.total === 0 ? <EmptyState icon="interests" title={t('common.empty')} /> : null}
              {pager}
            </div>
          </>
        )}
      </PhoneScreen>
    );
  }
  return (
    <Dialog open={open} onClose={onClose} eyebrow={t('cal.catalog')} title={heading} maxWidth={560}
      footer={form ? (<><Button variant="secondary" onClick={cancelForm}>{t('common.cancel')}</Button><Button disabled={busy} onClick={save}>{t('common.save')}</Button></>) : (<Button variant="secondary" onClick={onClose}>{t('common.done')}</Button>)}>
      {form ? (
        <>
          <TextField label={t('cal.nameEn')} value={form.name} onChange={(v) => set({ name: v })} maxLength={80} error={tried && !form.name.trim() && t('cal.errName')} />
          <TextField label={t('cal.nameId')} value={form.nameId} onChange={(v) => set({ nameId: v })} maxLength={80} />
          {form.type === 'activity' ? <ActivityPhotoField icon={form.icon} value={form.photoMediaId ?? null} onChange={(v) => set({ photoMediaId: v })} /> : null}
          {form.type === 'activity' ? (
            <>
              <div role="group" aria-label={t('cal.icon')} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: FONT_BODY, fontWeight: 500, lineHeight: 1.4 }}>{t('cal.icon')}</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {ICONS.map((i) => (
                    <button key={i} type="button" aria-pressed={form.icon === i} aria-label={t('cal.icon_' + i)} title={t('cal.icon_' + i)} onClick={() => set({ icon: i })} style={{ width: 44, height: 44, borderRadius: 999, border: form.icon === i ? '1px solid #24201C' : '1px solid #DCD3C8', background: form.icon === i ? '#24201C' : '#FFFFFF', color: form.icon === i ? '#FFFFFF' : '#24201C', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
                      <Icon name={i} size={22} />
                    </button>
                  ))}
                </div>
              </div>
              <Select label={t('cal.room')} value={form.roomId} onChange={(v) => set({ roomId: v })} error={tried && roomMissing && !form.roomId && t('cal.errRoom')}
                options={[...rooms.map((r) => ({ value: r.id, label: roomName(r, lang) })), { value: OTHER, label: t('cal.roomOther') }]} />
              {form.roomId === OTHER ? <TextField label={t('cal.roomOtherLabel')} value={form.roomOther} onChange={(v) => set({ roomOther: v })} maxLength={80} placeholder={t('cal.roomOtherPh')} error={tried && !form.roomOther.trim() && t('cal.errRoom')} /> : null}
              <Toggle on={form.active} onClick={() => set({ active: !form.active })} label={t('cal.active')} />
            </>
          ) : <Toggle on={form.venue} onClick={() => set({ venue: !form.venue })} label={t('cal.venueRoom')} />}
          {err ? <Note tone="rust" icon="error">{err}</Note> : null}
        </>
      ) : (
        <>
          {canRooms ? <Segmented label={t('cal.catalog')} value={tab} onChange={setTab} items={[{ value: 'activities', label: t('cal.activities'), count: acts.length }, { value: 'rooms', label: t('cal.rooms'), count: rooms.length }]} /> : null}
          <div><Button icon="add" variant="secondary" onClick={() => setForm(tab === 'rooms' ? newRoom() : newActivity())}>{t(tab === 'rooms' ? 'cal.addRoom' : 'cal.addActivity')}</Button></div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {tab === 'activities' ? activityRows : roomRows}
            {paged.total === 0 ? <EmptyState icon="interests" title={t('common.empty')} /> : null}
            <Pager page={paged.page} pages={paged.pages} onPage={paged.setPage} label={t('cal.pagerCatalog')} />
          </div>
        </>
      )}
    </Dialog>
  );
}

/** KC round 6: the activity's picture. Take one or choose a file (CameraCapture does both), or remove it; the icon tile stands in until there is one. */
function ActivityPhotoField({ icon, value, onChange }: { icon: string; value: string | null; onChange: (id: string | null) => void }) {
  const t = useT();
  const [camera, setCamera] = useState(false);
  const [busy, setBusy] = useState(false);
  const take = async (blob: Blob) => {
    setCamera(false);
    setBusy(true);
    try { onChange(await uploadMedia(blob)); } catch (e) { say(e instanceof ApiError && hasKey(e.code) ? t(e.code) : t('profile.photoUploadFailed'), { tone: 'error', icon: 'error' }); } finally { setBusy(false); }
  };
  return (
    <div role="group" aria-label={t('cal.photo')} data-testid="activity-photo" style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
      <span aria-hidden="true" style={{ width: 96, height: 72, borderRadius: 12, background: photoFill(value ? mediaUrl(value) : undefined, '#F3EEE8'), color: '#75624B', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{value ? null : <Icon name={icon} size={30} />}</span>
      <div style={{ flex: '1 1 160px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: FONT_BODY, fontWeight: 500, lineHeight: 1.4 }}>{t('cal.photo')}</span>
        <span style={{ fontSize: 13, color: '#6B6259', lineHeight: 1.4 }}>{t('cal.photoHint')}</span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="secondary" size={44} icon="photo_camera" disabled={busy} onClick={() => setCamera(true)}>{busy ? t('profile.photoUploading') : value ? t('profile.photoChange') : t('profile.photoAdd')}</Button>
          {value && !busy ? <Button variant="ghost" size={44} onClick={() => onChange(null)}>{t('profile.photoRemove')}</Button> : null}
        </div>
      </div>
      {camera ? <CameraCapture open onClose={() => setCamera(false)} onCapture={(b) => void take(b)} facing="environment" allowUpload /> : null}
    </div>
  );
}
