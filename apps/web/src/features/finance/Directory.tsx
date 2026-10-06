// Directory (design ScrDir): suppliers, doctors and services. Finance, management and the lobby add, edit, delete and choose what families see;
// families (the "Useful contacts" page, reached from Today) see the public entries and the club's emergency number.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fmtPhone, live, sortBy, type DirectoryContact } from '@cp/shared';
import { Button, Card, Chip, EmptyState, FilterChips, Icon, IconButton, PageHead, TextField, Toggle, usePaged, FONT_BODY } from '../../components/ui';
import { padFor, useDevice } from '../../hooks/useDevice';
import { useAct } from '../../lib/act';
import { useFmt, useT } from '../../lib/i18n';
import { useMe } from '../../lib/me';
import { useClub } from '../../store/replica';
import { matches } from './lib';
import { ConfirmDialog, FormOverlay, PagerBar, SearchField, fieldLabel } from './parts';
import { Badge } from './parts';

type Filter = 'all' | 'supplier' | 'doctor' | 'service' | 'public' | 'internal';
const FILTERS: Filter[] = ['all', 'supplier', 'doctor', 'service', 'public', 'internal'];
const KIND_ICON: Record<DirectoryContact['kind'], string> = { doctor: 'stethoscope', service: 'medical_services', supplier: 'local_shipping' };
const KINDS: DirectoryContact['kind'][] = ['doctor', 'service', 'supplier'];
const telOf = (p: string) => 'tel:' + p.replace(/[^\d+]/g, '');

export function Directory() {
  const s = useClub();
  const t = useT();
  const act = useAct();
  const navigate = useNavigate();
  const { lang } = useFmt();
  const { role } = useMe();
  const { device, isPhone } = useDevice();
  const fam = role === 'family';
  const canEdit = role === 'mgmt' || role === 'finance' || role === 'lobby';
  const [f, setF] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [form, setForm] = useState<null | 'new' | DirectoryContact>(null);
  const [del, setDel] = useState<DirectoryContact | null>(null);

  const all = useMemo(() => sortBy(live(s.directory), (d) => d.name), [s.directory]);
  const what = (d: DirectoryContact) => (lang === 'id' && d.whatId ? d.whatId : d.what);
  const inFilter = (d: DirectoryContact) => (fam ? d.public : f === 'all' || (f === 'public' ? d.public : f === 'internal' ? !d.public : d.kind === f));
  const hits = all.filter((d) => inFilter(d) && matches(q, d.name, what(d), d.what, d.whatId, d.phone, fmtPhone(d.phone), t('finance.kind.' + d.kind)));
  const paged = usePaged(hits, 20, q + f);
  const emergency = s.club.settings.emergencyPhone;
  const count = (k: Filter) => all.filter((d) => (k === 'all' ? true : k === 'public' ? d.public : k === 'internal' ? !d.public : d.kind === k)).length;

  const remove = async () => {
    if (!del) return;
    const r = await act('directory.delete', { id: del.id }, { ok: t('finance.toast.contactDeleted', { name: del.name }) });
    if (r.ok) setDel(null);
  };

  return (
    <div style={{ padding: padFor(device), display: 'flex', flexDirection: 'column', gap: isPhone ? 12 : 18, maxWidth: 900 }}>
      {fam ? (
        <button type="button" onClick={() => navigate('/today')} style={{ alignSelf: 'flex-start', height: 44, padding: '0 16px 0 10px', margin: '-6px 0 -8px -10px', borderRadius: 999, border: 'none', background: 'transparent', color: '#75624B', fontSize: 16, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontFamily: 'Inter' }}>
          <Icon name="arrow_back" size={20} color="#75624B" />{t('common.today')}
        </button>
      ) : null}
      <PageHead eyebrow={t('nav.contacts')} title={fam ? t('finance.dir.famTitle') : t('nav.directory')}
        right={canEdit ? <Button size={48} icon="add" onClick={() => setForm('new')} style={{ padding: '0 20px' }}>{t('finance.dir.add')}</Button> : undefined} />
      {fam ? (
        <div style={{ fontSize: isPhone ? 15 : 16, lineHeight: '22px' }}>
          {t('finance.dir.famSub')} <a href={telOf(emergency)} style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{emergency}</a>
        </div>
      ) : <div className="cp-desc" style={{ fontSize: 16, lineHeight: '22px' }}>{t('finance.dir.sub')}</div>}
      {!fam ? <FilterChips label={t('finance.dir.filter')} value={f} onChange={setF} options={FILTERS.map((k) => ({ value: k, label: t('finance.dir.f_' + k), count: count(k) }))} /> : null}
      {!fam || all.filter((d) => d.public).length > 6 ? <SearchField value={q} onChange={setQ} label={t('finance.dir.search')} placeholder={t('finance.dir.search')} /> : null}

      <Card>
        {paged.rows.map((d, i) => (
          <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: isPhone ? 8 : 12, flexWrap: 'wrap', padding: isPhone ? '8px 14px' : '12px 20px', borderBottom: i < paged.rows.length - 1 || paged.pages > 1 ? '1px solid #EFECEA' : 'none', minHeight: isPhone ? 56 : 68 }}>
            <span aria-hidden="true" style={{ width: isPhone ? 36 : 40, height: isPhone ? 36 : 40, borderRadius: 999, background: '#F4F0EE', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#75624B', flex: 'none' }}><Icon name={KIND_ICON[d.kind]} size={20} /></span>
            <div style={{ flex: `1 1 ${!fam && canEdit ? 160 : 220}px`, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2, ...(isPhone ? { order: 1 } : {}) }}>
              <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{d.name}</span>
              <span style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{t('finance.kind.' + d.kind)} · {what(d)}</span>
            </div>
            {isPhone && !fam && canEdit ? <span aria-hidden="true" style={{ order: 3, flex: '1 1 100%', height: 0 }} /> : null}
            <a href={telOf(d.phone)} aria-label={`${t('common.call')} ${d.name}`} style={{ ...(isPhone ? { order: 4 } : {}), minHeight: isPhone ? 38 : 44, padding: '0 14px', borderRadius: 999, border: '1px solid #DBD7D6', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 16, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', textDecoration: 'none', color: '#282828' }}>
              <Icon name="call" size={18} />{fmtPhone(d.phone)}
            </a>
            {!fam && isPhone && canEdit ? null : !fam ? (d.public ? <span style={isPhone ? { order: 5 } : undefined}><Badge kind="paid" label={t('finance.dir.public')} /></span> : (
              <span style={{ ...(isPhone ? { order: 5 } : {}), height: 28, padding: '0 10px 0 6px', borderRadius: 999, background: '#E8E1D8', color: '#282828', fontSize: 'max(13px, var(--cp-small, 0px))', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, flex: 'none', whiteSpace: 'nowrap' }}>
                <Icon name="lock" size={17} fill={1} />{t('finance.dir.internal')}
              </span>
            )) : null}
            {!fam && canEdit ? (
              isPhone ? (
                // phone: edit and delete sit beside the name; the phone, the badge and the public switch share the second line
                <>
                  <span style={{ order: 2, display: 'inline-flex', alignItems: 'center', gap: 0, flex: 'none' }}>
                    <IconButton icon="edit" label={`${t('common.edit')} ${d.name}`} bordered={false} size={40} onClick={() => setForm(d)} />
                    <IconButton icon="delete" label={`${t('common.delete')} ${d.name}`} bordered={false} size={40} onClick={() => setDel(d)} />
                  </span>
                  <button type="button" aria-label={`${d.public ? t('finance.dir.makeInternal') : t('finance.dir.makePublic')}: ${d.name}`} onClick={() => act('directory.togglePublic', { id: d.id }, { ok: t(d.public ? 'finance.toast.nowInternal' : 'finance.toast.nowPublic', { name: d.name }) })}
                    style={{ order: 6, marginLeft: 'auto', height: 38, padding: '0 8px', borderRadius: 999, border: 'none', background: 'transparent', color: '#75624B', fontSize: 14, fontWeight: 500, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 4, whiteSpace: 'nowrap', fontFamily: 'Inter' }}>
                    {d.public ? t('finance.dir.makeInternal') : t('finance.dir.makePublic')}
                  </button>
                </>
              ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, flex: 'none' }}>
                <button type="button" aria-label={`${d.public ? t('finance.dir.makeInternal') : t('finance.dir.makePublic')}: ${d.name}`} onClick={() => act('directory.togglePublic', { id: d.id }, { ok: t(d.public ? 'finance.toast.nowInternal' : 'finance.toast.nowPublic', { name: d.name }) })}
                  style={{ height: 44, padding: '0 12px', borderRadius: 999, border: 'none', background: 'transparent', color: '#75624B', fontSize: FONT_BODY, fontWeight: 500, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 4, whiteSpace: 'nowrap', fontFamily: 'Inter' }}>
                  {d.public ? t('finance.dir.makeInternal') : t('finance.dir.makePublic')}
                </button>
                <IconButton icon="edit" label={`${t('common.edit')} ${d.name}`} bordered={false} onClick={() => setForm(d)} />
                <IconButton icon="delete" label={`${t('common.delete')} ${d.name}`} bordered={false} onClick={() => setDel(d)} />
              </span>
              )
            ) : null}
          </div>
        ))}
        {!hits.length ? <EmptyState icon={q ? 'search_off' : 'contacts'} title={q ? t('common.noResults') : t('finance.dir.empty')} /> : null}
        <PagerBar paged={paged} label={t('nav.directory')} />
      </Card>

      <ContactForm value={form} onClose={() => setForm(null)} />
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} title={t('finance.dir.deleteTitle')} body={t('finance.dir.deleteBody', { name: del?.name || '' })} confirmLabel={t('common.delete')} onConfirm={remove} />
    </div>
  );
}

function ContactForm({ value, onClose }: { value: null | 'new' | DirectoryContact; onClose: () => void }) {
  const t = useT();
  const act = useAct();
  const editing = value && value !== 'new' ? value : null;
  const init = () => ({ kind: (editing?.kind || 'supplier') as DirectoryContact['kind'], name: editing?.name || '', what: editing?.what || '', whatId: editing?.whatId || '', phone: editing ? fmtPhone(editing.phone) : '', pub: editing?.public ?? false });
  const [v, setV] = useState(init);
  const key = value ? (value === 'new' ? 'new' : value.id) : null;
  const [prev, setPrev] = useState<string | null>(null);
  if (key !== prev) { setPrev(key); if (value) setV(init()); }
  if (!value) return null;
  const set = (p: Partial<typeof v>) => setV((x) => ({ ...x, ...p }));
  const phoneOk = v.phone.replace(/\D/g, '').length >= 6;
  const ok = !!v.name.trim() && !!v.what.trim() && phoneOk;
  const save = async () => {
    const body = { kind: v.kind, name: v.name.trim(), what: v.what.trim(), phone: v.phone.trim(), public: v.pub };
    const r = editing
      ? await act('directory.update', { id: editing.id, ...body, whatId: v.whatId.trim() || null }, { ok: t('finance.toast.contactSaved', { name: body.name }) })
      : await act('directory.add', { ...body, ...(v.whatId.trim() ? { whatId: v.whatId.trim() } : {}) }, { ok: t('finance.toast.contactAdded', { name: body.name }) });
    if (r.ok) onClose();
  };
  return (
    <FormOverlay open onClose={onClose} title={editing ? t('finance.dir.editTitle') : t('finance.dir.add')} maxWidth={560}
      footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button disabled={!ok} onClick={save}>{editing ? t('common.save') : t('finance.dir.addBtn')}</Button></>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={fieldLabel}>{t('finance.dir.kind')}</span>
        <div role="radiogroup" aria-label={t('finance.dir.kind')} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {KINDS.map((k) => <Chip key={k} selected={v.kind === k} onClick={() => set({ kind: k })}>{t('finance.kind.' + k)}</Chip>)}
        </div>
      </div>
      <TextField label={t('common.name')} value={v.name} onChange={(x) => set({ name: x })} maxLength={120} />
      <TextField label={t('finance.dir.what')} value={v.what} onChange={(x) => set({ what: x })} maxLength={160} placeholder={t('finance.dir.whatEx')} />
      <TextField label={t('finance.dir.whatId')} value={v.whatId} onChange={(x) => set({ whatId: x })} maxLength={160} hint={t('finance.dir.whatIdHint')} />
      <TextField label={t('common.phone')} value={v.phone} onChange={(x) => set({ phone: x })} inputMode="tel" type="tel" error={v.phone && !phoneOk ? t('finance.dir.phoneBad') : undefined} />
      <Toggle on={v.pub} onClick={() => set({ pub: !v.pub })} label={t('finance.dir.visibleToFamilies')} sub={t('finance.dir.visibleHelp')} />
    </FormOverlay>
  );
}
