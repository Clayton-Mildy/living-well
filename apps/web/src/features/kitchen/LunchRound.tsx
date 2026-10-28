// The F&B team's lunch round (round 14, "lunch belongs to F&B"): today's lunch photos at the top, then one row per person who came with how much they ate
// (one tap: All / Most / Half / Little / None, tap the chosen one again to clear it) and their lunch face. It opens at 11:30; before that the photos can
// still be taken. A pin marks the rest as "Ate all" after a confirmation. Marks save as you tap (the replica shows them at once); the amounts wait for
// management's approval like every entry by non-management staff, the faces do not.
import { useMemo, useState } from 'react';
import { displayName, listName, markOf, memberName, toMin, type Face, type Member } from '@cp/shared';
import { LUNCH_AMOUNTS, LUNCH_ROUND_OPENS, attendedOn, logsOn } from '@cp/shared/rules/activity';
import { Button, EmptyState, Group, MoodFaces, PageHead, Pin, Sheet, FONT_SMALL } from '../../components/ui';
import { useDevice, padFor } from '../../hooks/useDevice';
import { useT, useFmt } from '../../lib/i18n';
import { useAct } from '../../lib/act';
import { useNow } from '../../lib/clock';
import { useClub } from '../../store/replica';
import { say } from '../../store/ui';
import { Av, plural, rowLine } from '../activity/lib';
import { RoundChips, type RoundChoice } from '../activity/LogFields';
import { PendingDot } from '../activity/DailyLog';
import { LunchPhotos } from './LunchPhotos';

const HAIR = '0.5px solid var(--hairline, #E2E2E6)';

export function LunchRound() {
  const t = useT();
  const { fdl } = useFmt();
  const { device, isPhone } = useDevice();
  const s = useClub();
  const { today, nowMin } = useNow();
  const act = useAct();
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);

  const people = useMemo(() => attendedOn(s, today), [s, today]);
  const logs = useMemo(() => logsOn(s, today), [s, today]);
  const open = nowMin >= toMin(LUNCH_ROUND_OPENS);
  const left = people.filter((m) => logs.get(m.id)?.lunch === undefined);
  const marked = people.length - left.length;
  const choices: RoundChoice[] = LUNCH_AMOUNTS.map((v) => ({ value: v, label: t('activity.lunchShort.' + v), tone: v === 'all' ? 'normal' : v === 'none' ? 'alert' : 'other' }));
  const faceOf = (id: string): Face | undefined => markOf(s, today, id, 'lunch')?.face;

  const markAmount = (id: string, v: string | null) => { void act('kitchen.lunchMark', { date: today, memberIds: [id], lunch: v }, { silent: true }); }; // a failure toasts and rolls the mark back
  const markFace = (id: string, face: Face) => { void act('kitchen.lunchMark', { date: today, memberIds: [id], face }, { silent: true }); };
  const markRest = async () => {
    setAsk(false);
    if (busy || !left.length) return;
    setBusy(true);
    const r = await act('kitchen.lunchMark', { date: today, memberIds: left.map((m) => m.id), lunch: 'all', onlyEmpty: true }, { silent: true });
    setBusy(false);
    if (!r.ok) return;
    const msg = plural(t, 'activity.restMarked', Number(r.result.marked || 0));
    say(r.result.pending ? `${msg} ${t('approvals.waitingShort')}` : msg);
  };

  const rows = people.map((m, i) => <Row key={m.id} m={m} first={i === 0} choices={choices} value={logs.get(m.id)?.lunch} log={logs.get(m.id)} face={faceOf(m.id)} onAmount={(v) => markAmount(m.id, v)} onFace={(f) => markFace(m.id, f)} />);
  const allDone = people.length > 0 && !left.length;
  const photos = (
    <div className="cp-grey" style={{ background: 'var(--fill, #F4F4F5)', borderRadius: 16, overflow: 'hidden' }}>
      <LunchPhotos date={today} compact />
    </div>
  );

  return (
    <div className={isPhone ? 'cp-native' : undefined} style={{ padding: padFor(device), display: 'flex', flexDirection: 'column', gap: isPhone ? 14 : 'clamp(14px, 2vw, 22px)' }}>
      <PageHead eyebrow={fdl(today)} title={t('nav.lunch')} />
      {photos}
      {!open ? (
        <div role="status" data-testid="lunch-closed" style={{ padding: '28px 20px', borderRadius: 16, background: 'var(--fill, #F4F4F5)', textAlign: 'center', fontSize: 16, color: '#5E5852', lineHeight: 1.4 }}>{t('kitchen.lunch.opens', { time: LUNCH_ROUND_OPENS })}</div>
      ) : !people.length ? (
        <EmptyState icon="restaurant" title={t('kitchen.lunch.nobody')} />
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: 28 }}>
            <span data-testid="round-progress" style={{ fontSize: 14, fontWeight: 500, color: allDone ? '#3D6B4F' : '#5E5852', fontVariantNumeric: 'tabular-nums' }}>
              {allDone ? t('activity.allMarked') : t('activity.markedOf', { n: marked, total: people.length })}
            </span>
            {!isPhone && left.length ? <Button variant="secondary" size={44} icon="done_all" disabled={busy} onClick={() => setAsk(true)}>{t('kitchen.lunch.markRest')}</Button> : null}
          </div>
          <div data-testid="lunch-list">
            {isPhone ? <Group pad="0" gap={0}>{rows}</Group> : <div style={{ background: 'var(--fill, #F4F4F5)', borderRadius: 16, overflow: 'hidden' }}>{rows}</div>}
          </div>
        </>
      )}
      {isPhone && open && left.length ? <Pin icon="done_all" label={t('kitchen.lunch.markRest')} onClick={() => setAsk(true)} /> : null}
      <Sheet open={ask} onClose={() => setAsk(false)} title={plural(t, 'activity.markRestTitle', left.length, { what: t('kitchen.lunch.restWhat') })}
        footer={<div style={{ display: 'flex', gap: 8 }}><Button full variant="secondary" onClick={() => setAsk(false)}>{t('common.cancel')}</Button><Button full onClick={() => void markRest()}>{t('activity.markRestGo')}</Button></div>}>
        {null}
      </Sheet>
    </div>
  );
}

/** One person: name (with the allergy and diet hints the kitchen cares about), the five amounts and the five faces. */
function Row({ m, first, choices, value, log, face, onAmount, onFace }: { m: Member; first: boolean; choices: RoundChoice[]; value: string | undefined; log: Parameters<typeof PendingDot>[0]['log']; face: Face | undefined; onAmount: (v: string | null) => void; onFace: (f: Face) => void }) {
  const t = useT();
  const { isPhone } = useDevice();
  const allergies = [...m.health.food.map((a) => t('lobby.food.' + a)), ...(m.health.foodOther ? [m.health.foodOther] : [])];
  const diets = m.health.diet.map((d) => t('lobby.diet.' + d));
  return (
    <div data-testid="lunch-row" data-member={m.id} data-marked={value !== undefined ? '1' : '0'}
      style={{ padding: isPhone ? '10px 14px 10px 16px' : '12px 22px', display: 'flex', flexDirection: isPhone ? 'column' : 'row', alignItems: isPhone ? 'stretch' : 'center', gap: isPhone ? 8 : 12, ...(isPhone ? rowLine(first, 68) : first ? {} : { borderTop: HAIR }) }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: isPhone ? 'none' : 1, minWidth: 0 }}>
        <Av m={m} size={isPhone ? 40 : 44} fs={isPhone ? 14 : 15} />
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.35, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{listName(m)}</span>
            <PendingDot log={log} />
          </span>
          {allergies.length || diets.length ? (
            <span style={{ fontSize: FONT_SMALL, lineHeight: '18px', color: '#6B6259', display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              {allergies.length ? <span data-testid="allergy-hint" style={{ color: '#9A3D24', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 5 }}><span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 999, background: '#9A3D24', flex: 'none' }} />{t('lobby.drugAllergy', { d: allergies.join(', ') })}</span> : null}
              {diets.length ? <span>{diets.join(', ')}</span> : null}
            </span>
          ) : null}
        </span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: isPhone ? 'space-between' : 'flex-end', gap: 8 }}>
        <RoundChips choices={choices} value={value} onPick={onAmount} label={t('kitchen.lunch.rowAria', { name: memberName(m) })} />
        <MoodFaces value={face ?? null} onChange={onFace} size={32} name={displayName(m)} label={t('mood.ask', { name: displayName(m) })} />
      </div>
    </div>
  );
}
