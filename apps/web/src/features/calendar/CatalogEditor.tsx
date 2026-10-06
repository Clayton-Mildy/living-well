// Activity and room catalog editor: the schedule builder takes its rooms and activities from here. Activity teachers edit activities; management edits both.
// An activity's room is chosen from the catalog, or "Other" with the room typed as free text (it joins the catalog).
import { useState, type ReactNode } from 'react';
import { useResetOn } from '../../lib/useResetOn';
import { live } from '@cp/shared';
import { activityName, roomName } from '@cp/shared/rules/activity';
import { Button, Dialog, EmptyState, Icon, IconButton, InfoChip, Note, Pager, Segmented, Select, TextField, Toggle, usePaged, FONT_BODY } from '../../components/ui';
import { useT, useLang } from '../../lib/i18n';
import { useAct } from '../../lib/act';
import { useMe } from '../../lib/me';
import { useClub } from '../../store/replica';

const ICONS = ['music_note', 'palette', 'self_improvement', 'yard', 'extension', 'style', 'skillet', 'menu_book', 'interests', 'sports_esports', 'theater_comedy', 'brush', 'local_florist', 'fitness_center', 'celebration', 'directions_walk'];
const OTHER = '__other';
interface Form { type: 'activity' | 'room'; id?: string; name: string; nameId: string; icon: string; roomId: string; roomOther: string; active: boolean; venue: boolean }

export function CatalogEditor({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const lang = useLang();
  const s = useClub();
  const act = useAct();
  const { role } = useMe();
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
  const newActivity = (): Form => ({ type: 'activity', name: '', nameId: '', icon: 'interests', roomId: rooms[0]?.id || '', roomOther: '', active: true, venue: false });
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
      ? await act('activity.upsert', { ...(form.id ? { id: form.id } : {}), name: form.name.trim(), nameId: form.nameId.trim() || null, icon: form.icon, ...(form.roomId === OTHER ? { roomOther: form.roomOther.trim() } : { roomId: form.roomId }), active: form.active }, { ok: t('cal.catalogSaved') })
      : await act('room.upsert', { ...(form.id ? { id: form.id } : {}), name: form.name.trim(), nameId: form.nameId.trim() || null, venue: form.venue }, { ok: t('cal.catalogSaved') });
    setBusy(false);
    if (r.ok) { setForm(null); setTried(false); setErr(''); } else setErr(t(r.code, r.params));
  };

  const row = (key: string, icon: string, title: string, sub: string, extra: ReactNode, onEdit: () => void, editLabel: string) => (
    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 4px', borderTop: '1px solid #EFECEA', minHeight: 64 }}>
      <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 999, background: '#F4F0EE', color: '#75624B', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon name={icon} size={20} /></span>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{title}</span>
        <span style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: '20px' }}>{sub}</span>
      </div>
      {extra}
      <IconButton icon="edit" label={editLabel} onClick={onEdit} />
    </div>
  );

  return (
    <Dialog open={open} onClose={onClose} eyebrow={t('cal.catalog')} title={form ? (form.id ? t(form.type === 'activity' ? 'cal.editActivity' : 'cal.editRoom') : t(form.type === 'activity' ? 'cal.addActivity' : 'cal.addRoom')) : t('cal.catalogTitle')} maxWidth={560}
      footer={form ? (<><Button variant="secondary" onClick={() => { setForm(null); setTried(false); }}>{t('common.cancel')}</Button><Button disabled={busy} onClick={save}>{t('common.save')}</Button></>) : (<Button variant="secondary" onClick={onClose}>{t('common.done')}</Button>)}>
      {form ? (
        <>
          <TextField label={t('cal.nameEn')} value={form.name} onChange={(v) => set({ name: v })} maxLength={80} error={tried && !form.name.trim() && t('cal.errName')} />
          <TextField label={t('cal.nameId')} value={form.nameId} onChange={(v) => set({ nameId: v })} maxLength={80} hint={t('cal.nameIdHint')} />
          {form.type === 'activity' ? (
            <>
              <div role="group" aria-label={t('cal.icon')} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: FONT_BODY, fontWeight: 500, lineHeight: 1.4 }}>{t('cal.icon')}</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {ICONS.map((i) => (
                    <button key={i} type="button" aria-pressed={form.icon === i} aria-label={t('cal.icon_' + i)} title={t('cal.icon_' + i)} onClick={() => set({ icon: i })} style={{ width: 44, height: 44, borderRadius: 999, border: form.icon === i ? '1px solid #282828' : '1px solid #CAB8A2', background: form.icon === i ? '#282828' : '#FFFFFF', color: form.icon === i ? '#FFFFFF' : '#282828', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
                      <Icon name={i} size={22} />
                    </button>
                  ))}
                </div>
              </div>
              <Select label={t('cal.room')} value={form.roomId} onChange={(v) => set({ roomId: v })} error={tried && roomMissing && !form.roomId && t('cal.errRoom')}
                options={[...rooms.map((r) => ({ value: r.id, label: roomName(r, lang) })), { value: OTHER, label: t('cal.roomOther') }]} />
              {form.roomId === OTHER ? <TextField label={t('cal.roomOtherLabel')} value={form.roomOther} onChange={(v) => set({ roomOther: v })} maxLength={80} placeholder={t('cal.roomOtherPh')} error={tried && !form.roomOther.trim() && t('cal.errRoom')} /> : null}
              <Toggle on={form.active} onClick={() => set({ active: !form.active })} label={t('cal.active')} sub={t('cal.activeSub')} />
            </>
          ) : <Toggle on={form.venue} onClick={() => set({ venue: !form.venue })} label={t('cal.venueRoom')} sub={t('cal.venueRoomSub')} />}
          {err ? <Note tone="rust" icon="error">{err}</Note> : null}
        </>
      ) : (
        <>
          {canRooms ? <Segmented label={t('cal.catalog')} value={tab} onChange={setTab} items={[{ value: 'activities', label: t('cal.activities'), count: acts.length }, { value: 'rooms', label: t('cal.rooms'), count: rooms.length }]} /> : null}
          <div><Button icon="add" variant="secondary" onClick={() => setForm(tab === 'rooms' ? newRoom() : newActivity())}>{t(tab === 'rooms' ? 'cal.addRoom' : 'cal.addActivity')}</Button></div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {tab === 'activities'
              ? actPaged.rows.map((a) => row(a.id, a.icon, activityName(a, lang), roomName(s.rooms[a.roomId], lang), a.active ? null : <InfoChip label={t('cal.inactive')} tone="cream" />, () => setForm({ type: 'activity', id: a.id, name: a.name, nameId: a.nameId || '', icon: a.icon, roomId: a.roomId, roomOther: '', active: a.active, venue: false }), t('cal.editItem', { name: activityName(a, lang) })))
              : roomPaged.rows.map((r) => row(r.id, 'meeting_room', roomName(r, lang), r.venue ? t('cal.venueRoom') : '', null, () => setForm({ type: 'room', id: r.id, name: r.name, nameId: r.nameId || '', icon: '', roomId: '', roomOther: '', active: true, venue: r.venue }), t('cal.editItem', { name: roomName(r, lang) })))}
            {paged.total === 0 ? <EmptyState icon="interests" title={t('common.empty')} /> : null}
            <Pager page={paged.page} pages={paged.pages} onPage={paged.setPage} label={t('cal.pagerCatalog')} />
          </div>
        </>
      )}
    </Dialog>
  );
}
