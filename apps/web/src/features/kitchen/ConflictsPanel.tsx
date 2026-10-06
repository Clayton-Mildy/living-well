// "Allergy conflicts today": the members who have checked in and the booked guests against today's dishes (live: it grows as people
// arrive), with the "Alternative prepared" check-off, guests whose allergies are unknown ("ask <escort>"), and dishes whose
// allergens nobody has checked. Members who have not arrived yet are in the "Allergies on file" card.
import { useMemo, useState } from 'react';
import { ALLERGY_COVERS, actorName } from '@cp/shared';
import { dishesByCourse, type KitchenConflict, type UnknownGuest } from '@cp/shared/rules/kitchenOps';
import type { Dish } from '@cp/shared';
import { Button, Card, CardHead, Chip, Icon, Note, Pager, Sheet, TextField, usePaged, FONT_BODY } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { useT } from '../../lib/i18n';
import { useAct } from '../../lib/act';
import { useClub } from '../../store/replica';
import { DishDialog } from './dish';
import { OutlineButton, Pill, PillButton, TextButton, useResetOn } from './parts';

type Conflicts = { conflicts: KitchenConflict[]; unknownGuests: UnknownGuest[]; unreviewed: Dish[]; covers: { total: number }; today: string };

export function ConflictsPanel({ vals }: { vals: Conflicts }) {
  const t = useT();
  const s = useClub();
  const act = useAct();
  const { isPhone } = useDevice();
  const [pick, setPick] = useState<KitchenConflict | null>(null);
  const [dishId, setDishId] = useState<string | null>(null);
  const paged = usePaged(vals.conflicts, 10);
  const todo = vals.conflicts.filter((c) => !c.resolved).length;
  const done = vals.conflicts.length - todo;
  const clear = !vals.conflicts.length && !vals.unknownGuests.length;
  const undo = async (c: KitchenConflict) => { await act('allergyPlan.clear', { date: vals.today, person: c.person, dishId: c.dish.id }, { ok: t('kitchen.conflicts.cleared', { name: c.name }) }); };
  return (
    <Card>
      <CardHead title={t('kitchen.conflicts.title')} meta={vals.conflicts.length ? t('kitchen.conflicts.meta', { todo, done }) : t('kitchen.conflicts.metaNone')} />
      {paged.rows.map((c) => {
        const plan = c.plan;
        return (
          <div key={c.person + c.dish.id} data-testid="conflict-row" data-resolved={c.resolved ? 'yes' : 'no'} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px 12px', padding: '14px 20px', borderTop: '1px solid #EFECEA' }}>
            <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 999, background: c.resolved ? '#E6EFE8' : '#AF4B2F', color: c.resolved ? '#3D6B4F' : '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
              <Icon name={c.resolved ? 'check_circle' : 'no_food'} size={22} fill={1} />
            </span>
            <div style={{ flex: '1 1 200px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{c.name}{c.diner.type === 'guest' ? <span style={{ fontWeight: 400, color: '#6A6967' }}> · {t('kitchen.conflicts.guest')}</span> : null}</span>
              <span style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{t('kitchen.conflicts.line', { allergy: t('kitchen.food.' + c.allergy).toLocaleLowerCase(), dish: c.dish.name, allergen: t('kitchen.allergen.' + c.allergen).toLocaleLowerCase() })}</span>
              {plan ? <span style={{ fontSize: FONT_BODY, lineHeight: 1.4 }}>{t('kitchen.conflicts.serving', { alt: plan.alternative, by: actorName(s, plan.by), time: plan.at.slice(11, 16) })}</span> : null}
            </div>
            {c.resolved ? <Pill icon="check_circle" fg="#3D6B4F" bg="#E6EFE8" label={t('kitchen.conflicts.prepared')} /> : <Pill icon="warning" fg="#FFFFFF" bg="#AF4B2F" label={t('kitchen.conflicts.needs')} />}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flex: isPhone ? '1 1 100%' : 'none', justifyContent: 'flex-end' }}>
              {c.resolved ? (
                <>
                  <TextButton onClick={() => undo(c)} color="#AF4B2F">{t('kitchen.conflicts.undo')}</TextButton>
                  <OutlineButton onClick={() => setPick(c)} icon="edit">{t('kitchen.conflicts.change')}</OutlineButton>
                </>
              ) : (
                <PillButton height={isPhone ? 48 : 44} pad="0 18px" icon="check" grow={isPhone} onClick={() => setPick(c)}>{t('kitchen.conflicts.markPrepared')}</PillButton>
              )}
            </div>
          </div>
        );
      })}
      <div style={{ padding: paged.pages > 1 ? '8px 20px' : 0, borderTop: paged.pages > 1 ? '1px solid #EFECEA' : 'none' }}><Pager page={paged.page} pages={paged.pages} onPage={paged.setPage} label={t('kitchen.conflicts.title')} /></div>
      {vals.unknownGuests.map((u) => (
        <div key={u.guest.id} data-testid="unknown-guest-row" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px 12px', padding: '14px 20px', borderTop: '1px solid #EFECEA' }}>
          <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 999, background: '#F6ECD6', color: '#7A5510', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon name="help" size={22} fill={1} /></span>
          <div style={{ flex: '1 1 200px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{u.guest.name}<span style={{ fontWeight: 400, color: '#6A6967' }}> · {t('kitchen.conflicts.guest')}</span></span>
            <span style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{t('kitchen.conflicts.unknown', { who: u.escort })}</span>
          </div>
          <Pill icon="help" fg="#7A5510" bg="#F6ECD6" label={t('kitchen.conflicts.ask', { who: u.escort })} />
          {u.phone ? (
            <a href={`tel:${u.phone}`} className="h-cream" style={{ height: 44, padding: '0 16px', borderRadius: 999, border: '1px solid #75624B', background: '#FFFFFF', color: '#75624B', fontSize: FONT_BODY, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none', whiteSpace: 'nowrap', flex: 'none' }}>
              <Icon name="call" size={18} />{t('common.call')}
            </a>
          ) : null}
        </div>
      ))}
      {clear || vals.unreviewed.length ? (
        <div style={{ padding: '14px 20px 18px', display: 'flex', flexDirection: 'column', gap: 10, borderTop: vals.conflicts.length || vals.unknownGuests.length ? '1px solid #EFECEA' : undefined }}>
          {clear ? <Note tone={vals.covers.total ? 'sage' : 'cream'} icon={vals.covers.total ? 'verified_user' : 'hourglass_empty'}>{vals.covers.total ? t('kitchen.conflicts.clear', { n: vals.covers.total }) : t('kitchen.conflicts.nobody')}</Note> : null}
          {vals.unreviewed.length ? (
            <Note tone="ochre" icon="help">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span>{t('kitchen.conflicts.unreviewed', { names: vals.unreviewed.map((d) => d.name).join(', ') })}</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {vals.unreviewed.map((d) => <OutlineButton key={d.id} onClick={() => setDishId(d.id)} icon="fact_check">{t('kitchen.conflicts.check', { name: d.name })}</OutlineButton>)}
                </div>
              </div>
            </Note>
          ) : null}
        </div>
      ) : null}
      <AlternativeSheet conflict={pick} date={vals.today} onClose={() => setPick(null)} />
      <DishDialog open={!!dishId} dishId={dishId ?? undefined} onClose={() => setDishId(null)} />
    </Card>
  );
}

/** What will be served instead: quick picks from dishes that are safe for this person, or any text. */
export function AlternativeSheet({ conflict, date, onClose }: { conflict: KitchenConflict | null; date: string; onClose: () => void }) {
  const t = useT();
  const s = useClub();
  const act = useAct();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  useResetOn(conflict ? `${conflict.person}|${conflict.dish.id}` : '', () => setText(conflict?.plan?.alternative ?? ''));
  const picks = useMemo(() => {
    if (!conflict) return [];
    const food = conflict.diner.food || [];
    return dishesByCourse(s, conflict.dish.course)
      .filter((d) => d.id !== conflict.dish.id && !food.some((a) => d.allergens.some((x) => ALLERGY_COVERS[a]?.includes(x))))
      .slice(0, 8);
  }, [s.dishes, conflict]);
  const ok = text.trim().length > 0;
  const save = async () => {
    if (!conflict || !ok || busy) return;
    setBusy(true);
    const c = conflict;
    const r = await act('allergyPlan.set', { date, person: c.person, dishId: c.dish.id, alternative: text }, { ok: t(c.diner.type === 'member' ? 'kitchen.conflicts.doneMember' : 'kitchen.conflicts.doneGuest', { name: c.name, alt: text.trim(), dish: c.dish.name }) });
    setBusy(false);
    if (r.ok) onClose();
  };
  return (
    <Sheet open={!!conflict} onClose={onClose} title={conflict ? t('kitchen.alt.title', { name: conflict.name }) : ''}
      footer={<Button full style={{ flex: 'none' }} onClick={save} disabled={!ok || busy} icon="check">{t('kitchen.conflicts.markPrepared')}</Button>}>
      {conflict ? (
        <>
          <Note tone="rust" icon="no_food">{t('kitchen.alt.why', { dish: conflict.dish.name, allergen: t('kitchen.allergen.' + conflict.allergen).toLocaleLowerCase(), name: conflict.name, allergy: t('kitchen.food.' + conflict.allergy).toLocaleLowerCase() })}</Note>
          <TextField label={t('kitchen.alt.label')} value={text} onChange={setText} placeholder={t('kitchen.alt.ph')} maxLength={80} autoFocus onEnter={save} />
          {picks.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: FONT_BODY, fontWeight: 500, lineHeight: 1.4 }}>{t('kitchen.alt.picks')}</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {picks.map((d) => <Chip key={d.id} selected={text.trim().toLocaleLowerCase() === d.name.toLocaleLowerCase()} onClick={() => setText(d.name)}>{d.name}</Chip>)}
              </div>
            </div>
          ) : null}
          <span style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{conflict.diner.type === 'member' ? t('kitchen.alt.tellsFamily') : t('kitchen.alt.guestNote')}</span>
        </>
      ) : null}
    </Sheet>
  );
}
