// Directory (design ScrDir): suppliers, doctors and services. Finance, management and the lobby add, edit, delete and choose what families see;
// families (the "Useful contacts" page, reached from Today) see the public entries and the club's emergency number;
// staff who don't keep the directory see the same public list from the Contacts button in the header (KC round 6).
// KC round 15 (phase 2): the list is grouped under editable categories (AC and electrical, Plumbing…), each contact with a 44 px call button;
// the front desk, finance and management add, rename and retire the categories; a contact with none, or in a retired one, sits under Other.
import { Fragment, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { fmtPhone, live, sortBy, type DirectoryContact, type DirectoryGroup, type SpendCategory } from '@cp/shared';
import { activeGroups, groupKeyOf, groupKeys, groupName, OTHER } from '@cp/shared/rules/directory';
import { SPEND_CATEGORIES } from '@cp/shared/rules/purchasing';
import { Button, Chip, EmptyState, FilterChips, Icon, IconButton, PageHead, Pin, Select, Sheet, TextField, Toggle, usePaged } from '../../components/ui';
import { padFor, useDevice } from '../../hooks/useDevice';
import { useAct } from '../../lib/act';
import { useFmt, useT } from '../../lib/i18n';
import { useMe } from '../../lib/me';
import { useClub } from '../../store/replica';
import { matches } from './lib';
import { ConfirmDialog, Dot, FormOverlay, Hero, HeroHead, PGroup, PagerBar, PillBtn, SearchField, fieldLabel, hrow, prow, rowSub, rowTitle } from './parts';

type Filter = 'all' | 'supplier' | 'doctor' | 'service' | 'public' | 'internal';
const FILTERS: Filter[] = ['all', 'supplier', 'doctor', 'service', 'public', 'internal'];
const KIND_ICON: Record<DirectoryContact['kind'], string> = { doctor: 'stethoscope', service: 'medical_services', supplier: 'local_shipping' };
const KINDS: DirectoryContact['kind'][] = ['doctor', 'service', 'supplier'];
type CatFilter = SpendCategory | 'all';
/** The group heading above a run of contacts. */
const groupHead = { margin: 0, fontSize: 13, fontWeight: 600, lineHeight: '18px', letterSpacing: '0.02em', color: '#6B6259' } as const;
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
  // KC round 6: staff who don't keep the directory get the family app's contacts (the public doctors and services, read-only)
  const simple = fam || !canEdit;
  const [f, setF] = useState<Filter>('all');
  const [cat, setCat] = useState<CatFilter>('all'); // round 14 p2: the supplier's spending category, while the Suppliers filter is on
  const [grp, setGrp] = useState<string>('all'); // round 15: the directory category ('all' or a group id / OTHER)
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [sp, setSp] = useSearchParams();
  const [q, setQ] = useState(() => sp.get('q') ?? ''); // a search result: /directory?q=<name> pre-fills the search whenever the parameter appears, then the parameter goes
  useEffect(() => {
    const w = sp.get('q');
    if (!w) return;
    setQ(w); // also when the search overlay sends us here while we are already on the Directory
    setF('all'); // and an earlier filter must not hide the supplier that was asked for
    setCat('all');
    setGrp('all');
    const p = new URLSearchParams(sp);
    p.delete('q');
    setSp(p, { replace: true });
  }, [sp]); // eslint-disable-line react-hooks/exhaustive-deps
  const [form, setForm] = useState<null | 'new' | DirectoryContact>(null);
  const [del, setDel] = useState<DirectoryContact | null>(null);

  const all = useMemo(() => sortBy(live(s.directory), (d) => d.name), [s.directory]);
  const what = (d: DirectoryContact) => (lang === 'id' && d.whatId ? d.whatId : d.what);
  // a supplier's row also says what it sells (staff only: families see doctors and services)
  const sub = (d: DirectoryContact) => `${t('finance.kind.' + d.kind)} · ${what(d)}${!simple && d.kind === 'supplier' && d.category ? ` · ${t('purchasing.cat.' + d.category)}` : ''}`;
  const inFilter = (d: DirectoryContact) => (simple ? d.public : f === 'all' || (f === 'public' ? d.public : f === 'internal' ? !d.public : d.kind === f && (f !== 'supplier' || cat === 'all' || d.category === cat)));
  const st = s.club.settings;
  // the buckets in display order (the active categories, Other last); a category retired while chosen falls back to All
  const keys = groupKeys(st);
  const gsel = keys.includes(grp) ? grp : 'all';
  const nameOfKey = (k: string) => (k === OTHER ? t('finance.dir.otherGroup') : groupName(activeGroups(st).find((g) => g.id === k)!, lang));
  const keyOf = (d: DirectoryContact) => groupKeyOf(st, d);
  const visible = all.filter((d) => inFilter(d));
  const populated = keys.filter((k) => visible.some((d) => keyOf(d) === k));
  const rank = new Map(keys.map((k, i) => [k, i]));
  const hits = sortBy(visible.filter((d) => (gsel === 'all' || keyOf(d) === gsel) && matches(q, d.name, what(d), d.what, d.whatId, d.phone, fmtPhone(d.phone), t('finance.kind.' + d.kind), nameOfKey(keyOf(d)))), (d) => String(rank.get(keyOf(d)) ?? 99).padStart(3, '0') + d.name.toLowerCase());
  const paged = usePaged(hits, 20, q + f + cat + gsel);
  const emergency = s.club.settings.emergencyPhone;
  const count = (k: Filter) => all.filter((d) => (k === 'all' ? true : k === 'public' ? d.public : k === 'internal' ? !d.public : d.kind === k)).length;

  const remove = async () => {
    if (!del) return;
    const r = await act('directory.delete', { id: del.id }, { ok: t('finance.toast.contactDeleted', { name: del.name }) });
    if (r.ok) setDel(null);
  };

  // one contact's row: phone (call, visibility, edit) laid out per device below
  const rows = paged.rows.map((d, i) => {
    const first = i === 0 || keyOf(paged.rows[i - 1]) !== keyOf(d); // the first contact of a group gets its heading
    const head = first ? <h2 data-dir-group={keyOf(d)} style={{ ...groupHead, padding: isPhone ? `${i === 0 ? 4 : 18}px 16px 6px` : `${i === 0 ? 8 : 20}px 0 6px` }}>{nameOfKey(keyOf(d))}</h2> : null;
    const toggle = () => act('directory.togglePublic', { id: d.id }, { ok: t(d.public ? 'finance.toast.nowInternal' : 'finance.toast.nowPublic', { name: d.name }) });
    const manage = canEdit;
    const tel = (
      <a href={telOf(d.phone)} aria-label={t('finance.dir.call', { name: d.name })} className={isPhone ? 'h-fill cp-fill cp-press' : 'h-fill cp-fill'} style={{ height: 44, padding: '0 16px', borderRadius: isPhone ? 999 : 12, border: 'none', background: 'var(--fill, #F4F4F5)', display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 14, fontWeight: 500, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', textDecoration: 'none', color: '#24201C', flex: 'none' }}>
        <Icon name="call" size={18} weight={300} />{fmtPhone(d.phone)}
      </a>
    );
    const nameEl = <span style={isPhone ? { ...rowTitle, fontSize: 16 } : rowTitle}>{d.name}</span>;
    const vis = !simple ? (d.public ? <Dot color="#3D6B4F">{t('finance.dir.public')}</Dot> : <Dot color="#8A8078">{t('finance.dir.internal')}</Dot>) : null;
    const toggleLabel = d.public ? t('finance.dir.makeInternal') : t('finance.dir.makePublic');
    const toggleBtn = manage ? (
      isPhone ? <PillBtn label={`${toggleLabel}: ${d.name}`} onClick={toggle}>{toggleLabel}</PillBtn> : (
        <button type="button" aria-label={`${toggleLabel}: ${d.name}`} onClick={toggle}
          style={{ height: 40, padding: '0 6px', borderRadius: 12, border: 'none', background: 'transparent', color: 'var(--accent, #75624B)', fontSize: 14, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Inter' }}>
          {toggleLabel}
        </button>
      )
    ) : null;
    const icons = manage ? (
      <span style={{ display: 'inline-flex', alignItems: 'center', flex: 'none' }}>
        <IconButton icon="edit" label={`${t('common.edit')} ${d.name}`} bordered={false} size={isPhone ? 36 : 40} color="#6B6259" onClick={() => setForm(d)} />
        <IconButton icon="delete" label={`${t('common.delete')} ${d.name}`} bordered={false} size={isPhone ? 36 : 40} color="#6B6259" onClick={() => setDel(d)} />
      </span>
    ) : null;
    if (isPhone) {
      // round 6, phone: icon, name and one meta line, a quiet visibility status; under it the call pill, the visibility switch and the edit and delete icons
      return (
        <Fragment key={d.id}>
        {head}
        <div data-dir-row={d.name} style={{ ...prow(first), display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span aria-hidden="true" style={{ width: 36, height: 36, borderRadius: 999, background: 'var(--on-card, #FFFFFF)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--eyebrow, #6E5A43)', flex: 'none' }}><Icon name={KIND_ICON[d.kind]} size={19} weight={300} /></span>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {nameEl}
              <span style={{ ...rowSub, fontSize: 13 }}>{sub(d)}</span>
            </div>
            {vis ? <span style={{ fontSize: 13, whiteSpace: 'nowrap', flex: 'none' }}>{vis}</span> : null}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingLeft: 48 }}>
            {tel}
            {toggleBtn}
            <span style={{ marginLeft: 'auto', marginRight: -6 }}>{icons}</span>
          </div>
        </div>
        </Fragment>
      );
    }
    return (
      <Fragment key={d.id}>
      {head}
      <div data-dir-row={d.name} style={{ ...hrow, ...(first ? { borderTop: 'none' } : {}), display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span aria-hidden="true" style={{ width: 46, height: 46, borderRadius: 999, background: 'var(--on-card, #FFFFFF)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--eyebrow, #6E5A43)', flex: 'none' }}><Icon name={KIND_ICON[d.kind]} size={22} weight={300} /></span>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {nameEl}
            <span style={rowSub}>{sub(d)}</span>
          </div>
          {vis}
          {tel}
          {toggleBtn}
          {icons}
        </div>
      </div>
      </Fragment>
    );
  });

  return (
    <>
    <div className={isPhone ? 'cp-native' : undefined} style={{ padding: padFor(device), display: 'flex', flexDirection: 'column', gap: isPhone ? 16 : 'clamp(18px, 2.8vw, 28px)' }}>
      {fam ? (
        <button type="button" onClick={() => navigate('/today')} className={isPhone ? 'cp-press' : undefined} style={{ alignSelf: 'flex-start', height: 44, padding: isPhone ? '0 16px 0 0' : '0 16px 0 10px', margin: isPhone ? '-6px 0 -8px -8px' : '-6px 0 -8px -10px', borderRadius: 12, border: 'none', background: 'transparent', color: 'var(--accent, #75624B)', fontSize: 16, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontFamily: 'Inter' }}>
          {isPhone ? <Icon name="chevron_left" size={30} weight={300} color="var(--accent, #75624B)" /> : <Icon name="arrow_back" size={20} color="var(--accent, #75624B)" />}{t('common.today')}
        </button>
      ) : null}
      <PageHead eyebrow={t('nav.contacts')} title={simple ? t('finance.dir.famTitle') : t('nav.directory')}
        right={canEdit && !isPhone ? <Button size={48} icon="add" onClick={() => setForm('new')} style={{ padding: '0 20px' }}>{t('finance.dir.add')}</Button> : undefined} />
      {fam ? (
        <div style={{ fontSize: 15, lineHeight: '22px', color: '#6B6259' }}>
          {t('finance.dir.famSub')} <a href={telOf(emergency)} style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{emergency}</a>
        </div>
      ) : null}
      {!simple ? <FilterChips label={t('finance.dir.filter')} value={f} onChange={setF} options={FILTERS.map((k) => ({ value: k, label: t('finance.dir.f_' + k), count: count(k) }))} /> : null}
      {canEdit || populated.length > 1 ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'stretch', flexWrap: 'wrap' }}>
          {populated.length > 1 || gsel !== 'all' ? (
            <div style={{ flex: '1 1 200px', maxWidth: isPhone ? undefined : 280 }}>
              <Select ariaLabel={t('finance.dir.group')} value={gsel} onChange={setGrp} options={[{ value: 'all', label: t('finance.dir.allGroups') }, ...keys.map((k) => ({ value: k, label: nameOfKey(k) }))]} />
            </div>
          ) : null}
          {!simple && f === 'supplier' ? (
            <div style={{ flex: '1 1 200px', maxWidth: isPhone ? undefined : 280 }}>
              <Select ariaLabel={t('finance.dir.spendCat')} value={cat} onChange={setCat} options={[{ value: 'all', label: t('purchasing.allCategories') }, ...SPEND_CATEGORIES.map((c) => ({ value: c, label: t('purchasing.cat.' + c) }))]} />
            </div>
          ) : null}
          {canEdit ? <Button size={44} variant="secondary" icon="category" onClick={() => setGroupsOpen(true)}>{t('finance.dir.groups')}</Button> : null}
        </div>
      ) : null}
      {!simple || all.filter((d) => d.public).length > 6 ? <SearchField value={q} onChange={setQ} label={t('finance.dir.search')} placeholder={t('finance.dir.search')} /> : null}

      {isPhone ? (
        // round 6, phone: the list is one grouped list under a small header
        <PGroup title={t('nav.directory')} meta={q && hits.length !== all.length ? t('finance.bill.matches', { n: hits.length, of: all.length }) : undefined} pad={0} gap={0}>
          {rows}
          {!hits.length ? <EmptyState icon={q ? 'search_off' : 'contacts'} title={q ? t('common.noResults') : t('finance.dir.empty')} /> : null}
          <PagerBar paged={paged} label={t('nav.directory')} />
        </PGroup>
      ) : (
      <Hero>
        <HeroHead title={t('nav.directory')} meta={q && hits.length !== all.length ? t('finance.bill.matches', { n: hits.length, of: all.length }) : undefined} />
        {rows}
        {!hits.length ? <EmptyState icon={q ? 'search_off' : 'contacts'} title={q ? t('common.noResults') : t('finance.dir.empty')} /> : null}
        <PagerBar paged={paged} label={t('nav.directory')} />
      </Hero>
      )}

      <ContactForm value={form} onClose={() => setForm(null)} />
      {groupsOpen ? <GroupsSheet onClose={() => setGroupsOpen(false)} /> : null}
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} title={t('finance.dir.deleteTitle')} body={t('finance.dir.deleteBody', { name: del?.name || '' })} confirmLabel={t('common.delete')} onConfirm={remove} />
    </div>
    {isPhone && canEdit ? <Pin icon="add" label={t('finance.dir.add')} onClick={() => setForm('new')} /> : null}
    </>
  );
}

function ContactForm({ value, onClose }: { value: null | 'new' | DirectoryContact; onClose: () => void }) {
  const t = useT();
  const act = useAct();
  const editing = value && value !== 'new' ? value : null;
  const st = useClub().club.settings;
  const { lang } = useFmt();
  const groups = activeGroups(st);
  // the picker holds the active categories only; a contact with none (or a retired one) shows as Other: the club's own Other when it has one, else "no category"
  const other = groups.find((g) => g.name.trim().toLowerCase() === 'other');
  const groupInit = editing ? (groupKeyOf(st, editing) === OTHER ? 'none' : groupKeyOf(st, editing)) : (other?.id ?? 'none');
  const init = () => ({ kind: (editing?.kind || 'supplier') as DirectoryContact['kind'], name: editing?.name || '', what: editing?.what || '', whatId: editing?.whatId || '', phone: editing ? fmtPhone(editing.phone) : '', pub: editing?.public ?? false, cat: (editing?.category ?? 'none') as SpendCategory | 'none', group: groupInit });
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
    // only a supplier has a category; changing a contact to another kind drops it
    const category = v.kind === 'supplier' && v.cat !== 'none' ? v.cat : null;
    // the directory category: sent when it differs from where the contact sits now (a retired one is left alone unless changed)
    const groupId = v.group === 'none' ? null : v.group;
    const groupChanged = v.group !== groupInit;
    const r = editing
      ? await act('directory.update', { id: editing.id, ...body, whatId: v.whatId.trim() || null, category, ...(groupChanged ? { groupId } : {}) }, { ok: t('finance.toast.contactSaved', { name: body.name }) })
      : await act('directory.add', { ...body, ...(v.whatId.trim() ? { whatId: v.whatId.trim() } : {}), ...(category ? { category } : {}), ...(groupId ? { groupId } : {}) }, { ok: t('finance.toast.contactAdded', { name: body.name }) });
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
      <Select label={t('finance.dir.group')} value={v.group} onChange={(x) => set({ group: x })} options={[...(other ? [] : [{ value: 'none', label: t('finance.dir.otherGroup') }]), ...groups.map((g) => ({ value: g.id, label: groupName(g, lang) }))]} />
      {v.kind === 'supplier' ? (
        <Select label={t('finance.dir.spendCat')} value={v.cat} onChange={(x) => set({ cat: x })} options={[{ value: 'none', label: t('purchasing.noCategory') }, ...SPEND_CATEGORIES.map((c) => ({ value: c, label: t('purchasing.cat.' + c) }))]} />
      ) : null}
      <TextField label={t('common.name')} value={v.name} onChange={(x) => set({ name: x })} maxLength={120} />
      <TextField label={t('finance.dir.what')} value={v.what} onChange={(x) => set({ what: x })} maxLength={160} placeholder={t('finance.dir.whatEx')} />
      <TextField label={t('finance.dir.whatId')} value={v.whatId} onChange={(x) => set({ whatId: x })} maxLength={160} />
      <TextField label={t('common.phone')} value={v.phone} onChange={(x) => set({ phone: x })} inputMode="tel" type="tel" error={v.phone && !phoneOk ? t('finance.dir.phoneBad') : undefined} />
      <Toggle on={v.pub} onClick={() => set({ pub: !v.pub })} label={t('finance.dir.visibleToFamilies')} />
    </FormOverlay>
  );
}

/** The categories: add, rename (a name in English and Indonesian) and retire. A retired category leaves the pickers; its contacts show under Other. */
function GroupsSheet({ onClose }: { onClose: () => void }) {
  const t = useT();
  const act = useAct();
  const { lang } = useFmt();
  const groups = useClub().club.settings.directoryGroups ?? [];
  const [edit, setEdit] = useState<null | 'new' | DirectoryGroup>(null);
  const editing = edit && edit !== 'new' ? edit : null;
  const [f, setF] = useState({ name: '', nameId: '', active: true });
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const begin = (g: 'new' | DirectoryGroup) => { setEdit(g); setTouched(false); setF(g === 'new' ? { name: '', nameId: '', active: true } : { name: g.name, nameId: g.nameId ?? '', active: g.active }); };
  const save = async () => {
    setTouched(true);
    if (!f.name.trim() || busy) return;
    setBusy(true);
    try {
      const name = f.name.trim();
      const r = await act('directory.setGroup', { ...(editing ? { id: editing.id } : {}), name, ...(f.nameId.trim() ? { nameId: f.nameId.trim() } : {}), active: f.active }, { ok: t(editing ? 'finance.dir.groupSaved' : 'finance.dir.groupAdded', { name }) });
      if (r.ok) setEdit(null);
    } finally { setBusy(false); }
  };
  return (
    <Sheet open onClose={onClose} title={edit ? (editing ? t('finance.dir.editGroup') : t('finance.dir.addGroup')) : t('finance.dir.groups')}
      footer={edit ? <div style={{ display: 'flex', gap: 10 }}><Button size={56} variant="secondary" onClick={() => setEdit(null)} style={{ flex: '0 1 160px' }}>{t('common.cancel')}</Button><Button size={56} onClick={save} disabled={busy} style={{ flex: 1 }}>{t('common.save')}</Button></div> : undefined}>
      {edit ? (
        <>
          <TextField label={t('finance.dir.groupName')} value={f.name} maxLength={60} onChange={(x) => setF((p) => ({ ...p, name: x }))} error={touched && !f.name.trim() ? t('common.required') : undefined} />
          <TextField label={t('finance.dir.groupNameId')} value={f.nameId} maxLength={60} onChange={(x) => setF((p) => ({ ...p, nameId: x }))} />
          {editing ? <Toggle on={f.active} onClick={() => setF((p) => ({ ...p, active: !p.active }))} label={t('finance.dir.groupActive')} sub={t('finance.dir.groupKeep')} /> : null}
        </>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {groups.map((g, i) => (
              <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 48, borderTop: i ? '0.5px solid var(--hairline, #E2E2E6)' : undefined }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 16, color: g.active ? '#24201C' : '#8A8078', overflowWrap: 'anywhere' }}>{groupName(g, lang)}</span>
                {!g.active ? <span style={{ fontSize: 13, color: '#8A8078', flex: 'none' }}>{t('finance.dir.groupRetired')}</span> : null}
                <IconButton icon="edit" label={`${t('finance.dir.editGroup')} ${g.name}`} bordered={false} color="#6B6259" onClick={() => begin(g)} />
              </div>
            ))}
            {!groups.length ? <EmptyState icon="category" title={t('finance.dir.groupsEmpty')} /> : null}
          </div>
          <Button size={48} variant="secondary" icon="add" onClick={() => begin('new')}>{t('finance.dir.addGroup')}</Button>
        </>
      )}
    </Sheet>
  );
}
