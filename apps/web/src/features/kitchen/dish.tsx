// Dish pieces: the allergen editor dialog, the "add a dish" picker sheet, and the chip field used for each course of a day.
import { useMemo, useState } from 'react';
import type { Dish, DishAllergen } from '@cp/shared';
import { actorName, memberShort } from '@cp/shared';
import { COURSES, DISH_ALLERGENS, DISH_TAGS, dishesByCourse, membersAffectedBy, type Course } from '@cp/shared/rules/kitchenOps';
import { Button, ChipGroup, Dialog, Icon, Note, Pager, Sheet, TextField, Toggle, usePaged, FONT_BODY } from '../../components/ui';
import { useT, useFmt, type TFn } from '../../lib/i18n';
import { useAct } from '../../lib/act';
import { useNow } from '../../lib/clock';
import { useClub } from '../../store/replica';
import { useResetOn } from './parts';

export const allergenText = (t: TFn, d: Pick<Dish, 'allergens'>) => (d.allergens.length ? d.allergens.map((a) => t('kitchen.allergen.' + a)).join(', ') : t('kitchen.noAllergens'));

/** Create or edit a dish: name, course, allergen chips, tags, and whether its allergens have been checked. */
export function DishDialog({ open, onClose, dishId, preset, onSaved }: { open: boolean; onClose: () => void; dishId?: string; preset?: { name?: string; course?: Course }; onSaved?: (id: string) => void }) {
  const t = useT();
  const { fdy } = useFmt();
  const s = useClub();
  const act = useAct();
  const dish = dishId ? s.dishes[dishId] : undefined;
  const [name, setName] = useState('');
  const [course, setCourse] = useState<Course>('lunch');
  const [allergens, setAllergens] = useState<DishAllergen[]>([]);
  const [tags, setTags] = useState<Dish['tags']>([]);
  const [checked, setChecked] = useState(true);
  const [askDelete, setAskDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  useResetOn(open ? dishId ?? '' : null, () => {
    if (!open) return;
    setName(dish?.name ?? preset?.name ?? '');
    setCourse(dish?.course ?? preset?.course ?? 'lunch');
    setAllergens(dish?.allergens ?? []);
    setTags(dish?.tags ?? []);
    setChecked(dish ? !!dish.reviewedAt : true);
    setAskDelete(false);
  });
  const changed = !dish || allergens.length !== dish.allergens.length || allergens.some((a) => !dish.allergens.includes(a));
  const alreadyChecked = !!dish?.reviewedAt && !changed;
  const ok = name.trim().length > 0;
  const save = async () => {
    if (!ok || busy) return;
    setBusy(true);
    const r = await act('dish.upsert', { id: dishId, name, course, allergens, tags, reviewed: !alreadyChecked && checked }, { ok: t('kitchen.dish.saved', { name: name.trim() }) });
    setBusy(false);
    if (r.ok) { onSaved?.((r.result.dishId as string) || dishId || ''); onClose(); }
  };
  const remove = async () => {
    if (!dishId || busy) return;
    setBusy(true);
    const r = await act('dish.delete', { dishId }, { ok: t('kitchen.dish.deleted', { name: dish?.name ?? '' }) });
    setBusy(false);
    if (r.ok) onClose();
  };
  const footer = askDelete ? (
    <>
      <span style={{ flex: '1 1 220px', fontSize: 16, lineHeight: '22px', alignSelf: 'center' }}>{t('kitchen.dish.deleteAsk', { name: dish?.name ?? '' })}</span>
      <Button variant="secondary" onClick={() => setAskDelete(false)}>{t('kitchen.dish.keep')}</Button>
      <Button variant="danger" onClick={remove} disabled={busy}>{t('kitchen.dish.delete')}</Button>
    </>
  ) : (
    <>
      {dish ? <Button variant="ghost" style={{ marginRight: 'auto', color: '#9A3D24' }} onClick={() => setAskDelete(true)}>{t('kitchen.dish.delete')}</Button> : null}
      <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
      <Button onClick={save} disabled={!ok || busy}>{t('kitchen.dish.save')}</Button>
    </>
  );
  return (
    <Dialog open={open} onClose={onClose} eyebrow={t('kitchen.dish.eyebrow')} title={dish ? dish.name : t('kitchen.dish.new')} footer={footer}>
      <TextField label={t('kitchen.dish.name')} value={name} onChange={setName} placeholder={t('kitchen.dish.namePh')} maxLength={60} autoFocus={!dish} onEnter={save} />
      <ChipGroup<Course> label={t('kitchen.dish.course')} value={course} onChange={(v) => setCourse(v as Course)} options={COURSES.map((c) => ({ value: c, label: t('kitchen.course.' + c) }))} />
      <ChipGroup<DishAllergen> label={t('kitchen.dish.contains')} multi value={allergens} onChange={(v) => { setAllergens(v as DishAllergen[]); setChecked(true); }} options={DISH_ALLERGENS.map((a) => ({ value: a, label: t('kitchen.allergen.' + a) }))} />
      <span style={{ fontSize: FONT_BODY, color: '#5E5852', lineHeight: 1.4, marginTop: -8 }}>{t('kitchen.dish.containsHint')}</span>
      <ChipGroup<Dish['tags'][number]> label={t('kitchen.dish.tags')} multi value={tags} onChange={(v) => setTags(v as Dish['tags'])} options={DISH_TAGS.map((x) => ({ value: x, label: t('kitchen.tag.' + x) }))} />
      {alreadyChecked && dish?.reviewedAt ? (
        <Note tone="sage" icon="verified">{t('kitchen.dish.checkedBy', { name: actorName(s, dish.reviewedBy ? `staff:${dish.reviewedBy}` : undefined) || '—', date: fdy(dish.reviewedAt.slice(0, 10)) })}</Note>
      ) : (
        <Toggle on={checked} onClick={() => setChecked((x) => !x)} label={t('kitchen.dish.checked')} sub={t('kitchen.dish.checkedSub')} />
      )}
    </Dialog>
  );
}

/** Pick dishes of one course to add to a day; or type a new name to create it (allergens are asked right after). */
export function DishPicker({ open, onClose, title, course, picked, onToggle, onCreated }: { open: boolean; onClose: () => void; title: string; course: Course; picked: string[]; onToggle: (id: string) => void; onCreated: (id: string) => void }) {
  const t = useT();
  const s = useClub();
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  useResetOn(open, () => { if (open) { setQ(''); setCreating(false); } });
  const all = useMemo(() => dishesByCourse(s, course), [s.dishes, course]); // eslint-disable-line react-hooks/exhaustive-deps
  const { today } = useNow();
  // planning hint: members on file whose allergy this dish would meet
  const affectedNames = (d: Dish) => membersAffectedBy(s, d, today).map(memberShort).join(', ');
  const needle = q.trim().toLocaleLowerCase();
  const found = all.filter((d) => !needle || d.name.toLocaleLowerCase().includes(needle));
  const paged = usePaged(found, 8, needle); // searching starts again on page 1
  const shown = paged.rows;
  const exact = all.some((d) => d.name.toLocaleLowerCase() === needle);
  return (
    <>
      <Sheet open={open && !creating} onClose={onClose} title={title} footer={<Button full style={{ flex: 'none' }} onClick={onClose}>{t('common.done')}</Button>}>
        <TextField label={t('kitchen.picker.search')} value={q} onChange={setQ} placeholder={t('kitchen.picker.ph')} inputMode="search" autoFocus />
        <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid #E4DACD', borderRadius: 14, overflow: 'hidden', flexShrink: 0 }}>
          {shown.map((d, k) => {
            const on = picked.includes(d.id);
            return (
              <button key={d.id} type="button" role="checkbox" aria-checked={on} onClick={() => onToggle(d.id)} className="h-row"
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', minHeight: 56, border: 'none', borderTop: k ? '1px solid #F0EAE1' : 'none', background: '#FFFFFF', textAlign: 'left', cursor: 'pointer', color: '#24201C', fontFamily: 'Inter', width: '100%' }}>
                <Icon name={on ? 'check_circle' : 'radio_button_unchecked'} size={24} fill={on ? 1 : 0} color={on ? '#3D6B4F' : '#8A755B'} />
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{d.name}</span>
                  <span style={{ fontSize: FONT_BODY, color: '#5E5852', lineHeight: 1.4 }}>{allergenText(t, d)}{d.reviewedAt ? '' : ' · ' + t('kitchen.notChecked')}</span>
                  {affectedNames(d) ? <span style={{ fontSize: FONT_BODY, color: '#9A3D24', lineHeight: 1.4, fontWeight: 500 }}>{t('kitchen.picker.affects', { names: affectedNames(d) })}</span> : null}
                </span>
              </button>
            );
          })}
          {!shown.length ? <div style={{ padding: '16px 14px', fontSize: 16, color: '#5E5852' }}>{t('kitchen.picker.none')}</div> : null}
          {needle && !exact ? (
            <button type="button" onClick={() => setCreating(true)} className="h-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', minHeight: 56, border: 'none', borderTop: '1px solid #F0EAE1', background: '#FBF8F4', textAlign: 'left', cursor: 'pointer', color: '#75624B', fontFamily: 'Inter', fontSize: 16, fontWeight: 500, width: '100%' }}>
              <Icon name="add_circle" size={24} />
              {t('kitchen.picker.create', { name: q.trim() })}
            </button>
          ) : null}
        </div>
        <Pager page={paged.page} pages={paged.pages} onPage={paged.setPage} label={t('kitchen.picker.pages')} />
      </Sheet>
      <DishDialog open={open && creating} onClose={() => setCreating(false)} preset={{ name: q.trim(), course }} onSaved={(id) => { onCreated(id); setCreating(false); }} />
    </>
  );
}

/** One course of one day: dish chips (tap to remove) and an add button. The box looks like the design's text fields. */
export function DishField({ label, course, ids, onRemove, onAdd, flex, testId }: { label: string; course: Course; ids: string[]; onRemove: (id: string) => void; onAdd: () => void; flex: string; testId?: string }) {
  const t = useT();
  const s = useClub();
  const { today } = useNow();
  return (
    <div role="group" aria-label={label} data-testid={testId} style={{ flex, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <span style={{ fontSize: 'max(13px, var(--cp-body, 0px))', color: '#5E5852', lineHeight: 1.4 }}>{label}</span>
      <div style={{ minHeight: 48, border: '1px solid #E4DACD', borderRadius: 10, padding: 6, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', background: '#FFFFFF' }}>
        {ids.map((id) => {
          const d = s.dishes[id];
          if (!d || d.deletedAt) return null;
          const hit = membersAffectedBy(s, d, today).map(memberShort).join(', ');
          const name = t('kitchen.plan.remove', { name: d.name }) + (hit ? `. ${t('kitchen.plan.affects', { names: hit })}` : '');
          return (
            <button key={id} type="button" onClick={() => onRemove(id)} aria-label={name} title={name} data-clash={hit ? 'yes' : undefined} className="h-cream"
              style={{ minHeight: 44, padding: '0 10px 0 14px', borderRadius: 12, border: 'none', background: '#F3EEE8', color: '#24201C', fontSize: 15, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontFamily: 'Inter', textAlign: 'left' }}>
              <span>{d.name}</span>
              {hit ? <Icon name="no_food" size={17} fill={1} color="#9A3D24" style={{ marginLeft: 2 }} /> : null}
              {!d.reviewedAt ? <Icon name="help" size={17} fill={1} color="#7A5510" style={{ marginLeft: 2 }} /> : null}
              <Icon name="close" size={18} color="#5E5852" />
            </button>
          );
        })}
        <button type="button" onClick={onAdd} aria-label={t('kitchen.plan.addTo', { course: t('kitchen.course.' + course) })} className="h-cream"
          style={{ minHeight: 44, padding: '0 14px 0 10px', borderRadius: 12, border: '1px dashed #CAB8A2', background: '#FFFFFF', color: '#75624B', fontSize: 15, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontFamily: 'Inter' }}>
          <Icon name="add" size={20} />
          {t('kitchen.plan.add')}
        </button>
      </div>
    </div>
  );
}
