// Directory (design ScrDir): suppliers, doctors and services. Finance, management and the lobby add, edit, delete and choose what families see;
// families (the "Useful contacts" page, reached from Today) see the public entries and the club's emergency number.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fmtPhone, live, sortBy, type DirectoryContact } from '@cp/shared';
import { Button, Chip, EmptyState, FilterChips, Icon, IconButton, PageHead, TextField, Toggle, usePaged } from '../../components/ui';
import { padFor, useDevice } from '../../hooks/useDevice';
import { useAct } from '../../lib/act';
import { useFmt, useT } from '../../lib/i18n';
import { useMe } from '../../lib/me';
import { useClub } from '../../store/replica';
import { matches } from './lib';
import { ConfirmDialog, Dot, FormOverlay, Hero, HeroHead, PagerBar, SearchField, fieldLabel, hrow, rowSub, rowTitle } from './parts';

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
    <div style={{ padding: padFor(device), display: 'flex', flexDirection: 'column', gap: isPhone ? 14 : 'clamp(18px, 2.8vw, 28px)', maxWidth: 960 }}>
      {fam ? (
        <button type="button" onClick={() => navigate('/today')} style={{ alignSelf: 'flex-start', height: 44, padding: '0 16px 0 10px', margin: '-6px 0 -8px -10px', borderRadius: 12, border: 'none', background: 'transparent', color: '#75624B', fontSize: 16, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontFamily: 'Inter' }}>
          <Icon name="arrow_back" size={20} color="#75624B" />{t('common.today')}
        </button>
      ) : null}
      <PageHead eyebrow={t('nav.contacts')} title={fam ? t('finance.dir.famTitle') : t('nav.directory')}
        right={canEdit ? <Button size={48} icon="add" onClick={() => setForm('new')} style={{ padding: '0 20px' }}>{t('finance.dir.add')}</Button> : undefined} />
      {fam ? (
        <div style={{ fontSize: 15, lineHeight: '22px', color: '#6B6259' }}>
          {t('finance.dir.famSub')} <a href={telOf(emergency)} style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{emergency}</a>
        </div>
      ) : null}
      {!fam ? <FilterChips label={t('finance.dir.filter')} value={f} onChange={setF} options={FILTERS.map((k) => ({ value: k, label: t('finance.dir.f_' + k), count: count(k) }))} /> : null}
      {!fam || all.filter((d) => d.public).length > 6 ? <SearchField value={q} onChange={setQ} label={t('finance.dir.search')} placeholder={t('finance.dir.search')} /> : null}

      <Hero>
        <HeroHead title={t('nav.directory')} meta={q && hits.length !== all.length ? t('finance.bill.matches', { n: hits.length, of: all.length }) : undefined} />
        {paged.rows.map((d) => {
          const toggle = () => act('directory.togglePublic', { id: d.id }, { ok: t(d.public ? 'finance.toast.nowInternal' : 'finance.toast.nowPublic', { name: d.name }) });
          const manage = !fam && canEdit;
          const call = (
            <a href={telOf(d.phone)} aria-label={`${t('common.call')} ${d.name}`} className="h-cream" style={{ height: 40, padding: '0 16px', borderRadius: 12, border: '1px solid #DCD3C8', background: '#FFFFFF', display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 14, fontWeight: 500, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', textDecoration: 'none', color: '#24201C', flex: 'none' }}>
              <Icon name="call" size={18} weight={300} />{fmtPhone(d.phone)}
            </a>
          );
          const vis = !fam ? (d.public ? <Dot color="#3D6B4F">{t('finance.dir.public')}</Dot> : <Dot color="#8A8078">{t('finance.dir.internal')}</Dot>) : null;
          const toggleBtn = manage ? (
            <button type="button" aria-label={`${d.public ? t('finance.dir.makeInternal') : t('finance.dir.makePublic')}: ${d.name}`} onClick={toggle}
              style={{ height: 40, padding: '0 6px', borderRadius: 12, border: 'none', background: 'transparent', color: '#75624B', fontSize: 14, fontWeight: 500, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 4, whiteSpace: 'nowrap', fontFamily: 'Inter' }}>
              {d.public ? t('finance.dir.makeInternal') : t('finance.dir.makePublic')}
            </button>
          ) : null;
          const icons = manage ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', flex: 'none' }}>
              <IconButton icon="edit" label={`${t('common.edit')} ${d.name}`} bordered={false} size={40} color="#6B6259" onClick={() => setForm(d)} />
              <IconButton icon="delete" label={`${t('common.delete')} ${d.name}`} bordered={false} size={40} color="#6B6259" onClick={() => setDel(d)} />
            </span>
          ) : null;
          return (
            <div key={d.id} style={{ ...hrow, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: isPhone ? 12 : 16 }}>
                <span aria-hidden="true" style={{ width: isPhone ? 40 : 46, height: isPhone ? 40 : 46, borderRadius: 999, background: '#F3EEE8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6E5A43', flex: 'none' }}><Icon name={KIND_ICON[d.kind]} size={isPhone ? 20 : 22} weight={300} /></span>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={rowTitle}>{d.name}</span>
                  <span style={rowSub}>{t('finance.kind.' + d.kind)} · {what(d)}</span>
                </div>
                {isPhone ? icons : (
                  <>
                    {vis}
                    {call}
                    {toggleBtn}
                    {icons}
                  </>
                )}
              </div>
              {isPhone ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', paddingLeft: 52 }}>
                  {call}
                  {vis}
                  <span style={{ marginLeft: 'auto' }}>{toggleBtn}</span>
                </div>
              ) : null}
            </div>
          );
        })}
        {!hits.length ? <EmptyState icon={q ? 'search_off' : 'contacts'} title={q ? t('common.noResults') : t('finance.dir.empty')} /> : null}
        <PagerBar paged={paged} label={t('nav.directory')} />
      </Hero>

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
      <TextField label={t('finance.dir.whatId')} value={v.whatId} onChange={(x) => set({ whatId: x })} maxLength={160} />
      <TextField label={t('common.phone')} value={v.phone} onChange={(x) => set({ phone: x })} inputMode="tel" type="tel" error={v.phone && !phoneOk ? t('finance.dir.phoneBad') : undefined} />
      <Toggle on={v.pub} onClick={() => set({ pub: !v.pub })} label={t('finance.dir.visibleToFamilies')} />
    </FormOverlay>
  );
}
