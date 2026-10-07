// "Allergies on file": active members with a food allergy, here today or not, against a day's menu. Members drop in on any open
// day, so this is the planning view: pick a day, see who would clash ("if they come today"), and prepare the alternative
// before anyone arrives. Members who are already in the club are handled in the live conflicts panel above.
import { useMemo, useState } from 'react';
import { actorName, memberShort, nextOpenDay } from '@cp/shared';
import { allergiesOnFile, type KitchenConflict, type OnFileRow } from '@cp/shared/rules/kitchenOps';
import { Card, CardHead, Icon, Pager, usePaged, FONT_BODY } from '../../components/ui';
import { useT, useFmt } from '../../lib/i18n';
import { useAct } from '../../lib/act';
import { useNow } from '../../lib/clock';
import { useClub } from '../../store/replica';
import { AlternativeSheet } from './ConflictsPanel';
import { FilterChip, OutlineButton, PillButton, StatusDot, TextButton } from './parts';

const PRESENCE: Record<NonNullable<OnFileRow['presence']>, { fg: string; key: string }> = {
  in: { fg: '#3D6B4F', key: 'kitchen.onfile.in' },
  gone: { fg: '#6B6259', key: 'kitchen.onfile.gone' },
  notYet: { fg: '#8A8078', key: 'kitchen.onfile.notYet' },
};

export function AllergiesOnFile() {
  const t = useT();
  const { fds } = useFmt();
  const s = useClub();
  const act = useAct();
  const { today } = useNow();
  const [picked, setPicked] = useState<string | null>(null);
  const [pick, setPick] = useState<KitchenConflict | null>(null);
  const days = useMemo(() => {
    const out: string[] = [];
    let d = nextOpenDay(s, today, true); // today when the club is open, else the next open day
    for (let i = 0; i < 6; i++) { out.push(d); d = nextOpenDay(s, d); }
    return out;
  }, [s.calendarEvents, today]); // eslint-disable-line react-hooks/exhaustive-deps
  const date = picked && days.includes(picked) ? picked : days[0];
  const rows = useMemo(() => allergiesOnFile(s, date, today), [s, date, today]);
  const paged = usePaged(rows, 6, date); // another day starts again on page 1
  const undo = (c: KitchenConflict) => act('allergyPlan.clear', { date, person: c.person, dishId: c.dish.id }, { ok: t('kitchen.conflicts.cleared', { name: c.name }) });
  return (
    <Card>
      <CardHead title={t('kitchen.onfile.title')} meta={t('kitchen.onfile.meta', { n: rows.length })} />
      <div style={{ padding: '0 22px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }} role="group" aria-label={t('kitchen.onfile.day')}>
          {days.map((d) => <FilterChip key={d} selected={d === date} onClick={() => setPicked(d)} label={d === today ? t('common.today') : fds(d)} />)}
        </div>
      </div>
      {paged.rows.map((r) => {
        const here = r.presence === 'in' || r.presence === 'gone';
        const pill = r.presence ? PRESENCE[r.presence] : null;
        const meta = [r.food.length ? t('kitchen.onfile.on', { list: r.food.map((a) => t('kitchen.food.' + a)).join(', ') }) : '', r.other ? t('kitchen.onfile.other', { text: r.other }) : ''].filter(Boolean).join(' · ');
        return (
          <div key={r.m.id} data-testid="onfile-row" data-member={r.m.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: '10px 14px', margin: '0 22px', padding: '16px 0', borderTop: '1px solid #F0EAE1' }}>
            <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 999, background: '#F3EEE8', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon name="no_food" size={20} color="#75624B" /></span>
            <div style={{ flex: '1 1 220px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 17, fontWeight: 500, lineHeight: 1.4 }}>{memberShort(r.m)}</span>
                <span style={{ fontSize: FONT_BODY, color: '#5E5852', lineHeight: 1.4 }}>{meta}</span>
              </div>
              {r.clashes.length ? (
                <>
                  {!here ? <span style={{ fontSize: 'max(13px, var(--cp-body, 0px))', fontWeight: 600, color: '#7A5510', lineHeight: 1.4 }}>{t(date === today ? 'kitchen.onfile.ifToday' : 'kitchen.onfile.ifDay')}</span> : null}
                  {r.clashes.map((c) => (
                    <div key={c.dish.id} data-testid="onfile-clash" data-resolved={c.resolved ? 'yes' : 'no'} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span style={{ fontSize: FONT_BODY, lineHeight: 1.4, color: c.resolved ? '#3D6B4F' : '#9A3D24', fontWeight: 500 }}>{t('kitchen.onfile.clash', { dish: c.dish.name, allergen: t('kitchen.allergen.' + c.allergen).toLocaleLowerCase() })}</span>
                      {c.plan ? <span style={{ fontSize: FONT_BODY, lineHeight: 1.4 }}>{t('kitchen.conflicts.serving', { alt: c.plan.alternative, by: actorName(s, c.plan.by), time: c.plan.at.slice(11, 16) })}</span> : null}
                      {!here ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                          {c.plan ? (
                            <>
                              <OutlineButton icon="edit" onClick={() => setPick(c)}>{t('kitchen.conflicts.change')}</OutlineButton>
                              <TextButton color="#9A3D24" onClick={() => void undo(c)}>{t('kitchen.conflicts.undo')}</TextButton>
                            </>
                          ) : <PillButton height={44} pad="0 18px" icon="check" onClick={() => setPick(c)}>{t('kitchen.onfile.prepare')}</PillButton>}
                        </div>
                      ) : null}
                    </div>
                  ))}
                  {here ? <span style={{ fontSize: FONT_BODY, color: '#5E5852', lineHeight: 1.4 }}>{t('kitchen.onfile.here')}</span> : null}
                </>
              ) : <span style={{ fontSize: FONT_BODY, color: '#3D6B4F', lineHeight: 1.4 }}>{t('kitchen.onfile.clear')}</span>}
            </div>
            {pill ? <StatusDot color={pill.fg}>{t(pill.key)}</StatusDot> : null}
          </div>
        );
      })}
      {!rows.length ? <div style={{ margin: '0 22px', padding: '18px 0 22px', borderTop: '1px solid #F0EAE1', fontSize: 16, color: '#6B6259', lineHeight: '22px' }}>{t('kitchen.onfile.empty')}</div> : null}
      <div style={{ margin: '0 22px', padding: paged.pages > 1 ? '8px 0 12px' : 0, borderTop: paged.pages > 1 ? '1px solid #F0EAE1' : 'none' }}><Pager page={paged.page} pages={paged.pages} onPage={paged.setPage} label={t('kitchen.onfile.title')} /></div>
      <AlternativeSheet conflict={pick} date={date} onClose={() => setPick(null)} />
    </Card>
  );
}
