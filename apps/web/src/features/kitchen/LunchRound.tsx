// The F&B team's lunch round (round 14, "lunch belongs to F&B"): today's lunch photos at the top, then one row per person who came with how much they ate
// (one tap: All / Most / Half / Little / None, tap the chosen one again to clear it) and their lunch face. It opens at 11:30; before that the photos can
// still be taken. KC 28 Oct: laid out like the Daily log (day chips with the last days to correct, a member search, in the club / went home, a card). A pin marks the rest as "Ate all" after a confirmation. Marks save as you tap (the replica shows them at once); the amounts wait for
// management's approval like every entry by non-management staff, the faces do not.
import { useMemo, useState, type ReactNode } from 'react';
import { addDays, attId, displayName, listName, markOf, memberName, toMin, type Face, type Member } from '@cp/shared';
import { LUNCH_AMOUNTS, LUNCH_ROUND_OPENS, attendedOn, logDates, logsOn, searchMembers } from '@cp/shared/rules/activity';
import { Button, Card, Chip, EmptyState, GROUP_HEAD, Group, MoodFaces, Note, PageHead, Pin, Sheet, TextField, FONT_SMALL } from '../../components/ui';
import { useDevice, padFor } from '../../hooks/useDevice';
import { useT, useFmt } from '../../lib/i18n';
import { useAct } from '../../lib/act';
import { useNow } from '../../lib/clock';
import { useClub } from '../../store/replica';
import { say } from '../../store/ui';
import { Av, SearchBar, plural, rowLine } from '../activity/lib';
import { RoundChips, type RoundChoice } from '../activity/LogFields';
import { PendingDot } from '../activity/DailyLog';
import { LunchPhotos } from './LunchPhotos';

const HAIR = '0.5px solid var(--hairline, #E2E2E6)';

export function LunchRound() {
  const t = useT();
  const { fdl, fds } = useFmt();
  const { device, isPhone } = useDevice();
  const s = useClub();
  const { today, nowMin } = useNow();
  const act = useAct();
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  // KC 28 Oct ("like the daily log"): the same day chips (today and the last days anyone came), a search, and in the club / went home
  const [date, setDate] = useState(today);
  const [q, setQ] = useState('');
  const dates = useMemo(() => logDates(s, today), [s, today]);
  const isToday = date === today;

  const people = useMemo(() => attendedOn(s, date), [s, date]);
  const logs = useMemo(() => logsOn(s, date), [s, date]);
  const open = !isToday || nowMin >= toMin(LUNCH_ROUND_OPENS);
  const left = people.filter((m) => logs.get(m.id)?.lunch === undefined);
  const marked = people.length - left.length;
  const choices: RoundChoice[] = LUNCH_AMOUNTS.map((v) => ({ value: v, label: t('activity.lunchShort.' + v), tone: v === 'all' ? 'normal' : v === 'none' ? 'alert' : 'other' }));
  const faceOf = (id: string): Face | undefined => markOf(s, date, id, 'lunch')?.face;

  const markAmount = (id: string, v: string | null) => { void act('kitchen.lunchMark', { date, memberIds: [id], lunch: v }, { silent: true }); }; // a failure toasts and rolls the mark back
  const markFace = (id: string, face: Face) => { void act('kitchen.lunchMark', { date, memberIds: [id], face }, { silent: true }); };
  const markRest = async () => {
    setAsk(false);
    if (busy || !left.length) return;
    setBusy(true);
    const r = await act('kitchen.lunchMark', { date, memberIds: left.map((m) => m.id), lunch: 'all', onlyEmpty: true }, { silent: true });
    setBusy(false);
    if (!r.ok) return;
    const msg = plural(t, 'activity.restMarked', Number(r.result.marked || 0));
    say(r.result.pending ? `${msg} ${t('approvals.waitingShort')}` : msg);
  };
  const pickDate = (d: string) => { setDate(d); setQ(''); };

  const found = useMemo(() => searchMembers(people, q), [people, q]);
  const wentHome = (m: Member) => isToday && !!s.attendance[attId(date, m.id)]?.checkOut;
  const inClub = found.filter((m) => !wentHome(m));
  const gone = found.filter(wentHome);
  const split = isToday && inClub.length > 0 && gone.length > 0;
  const allDone = people.length > 0 && !left.length;
  // the faces are today's mood marks, so a past day shows the amounts only
  const block = (title: string | undefined, meta: ReactNode, list: Member[]) => {
    const rows = list.map((m, i) => <Row key={m.id} m={m} first={i === 0} choices={choices} value={logs.get(m.id)?.lunch} log={logs.get(m.id)} faces={isToday} face={faceOf(m.id)} onAmount={(v) => markAmount(m.id, v)} onFace={(f) => markFace(m.id, f)} />);
    return isPhone ? <Group key={title ?? 'all'} title={title} meta={meta} pad="0" gap={0}>{rows}</Group> : (
      <section key={title ?? 'all'} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {title ? <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, padding: '0 4px' }}><h2 style={GROUP_HEAD}>{title}</h2><span style={{ fontSize: 13, color: '#6B6259' }}>{meta}</span></div> : null}
        <Card>{rows}</Card>
      </section>
    );
  };
  const photos = (
    <div className="cp-grey" style={{ background: 'var(--fill, #F4F4F5)', borderRadius: 16, overflow: 'hidden' }}>
      <LunchPhotos date={date} compact />
    </div>
  );

  return (
    <div className={isPhone ? 'cp-native' : undefined} style={{ padding: padFor(device), display: 'flex', flexDirection: 'column', gap: isPhone ? 10 : 'clamp(14px, 2vw, 22px)' }}>
      <PageHead eyebrow={fdl(date)} title={t('nav.lunch')} />
      <div className="scroll-x cp-pillrow" style={{ display: 'flex', gap: 8, paddingBottom: 4 }} role="group" aria-label={t('activity.pickDay')}>
        {dates.map((d) => <Chip key={d} selected={d === date} onClick={() => pickDate(d)}>{d === today ? t('common.today') : d === addDays(today, -1) ? t('common.yesterday') : fds(d)}</Chip>)}
      </div>
      {isToday ? null : <Note tone="ochre" icon="history">{t('activity.editingPast', { date: fdl(date) })}</Note>}
      {photos}
      {!open ? (
        <div role="status" data-testid="lunch-closed" style={{ padding: '28px 20px', borderRadius: 16, background: 'var(--fill, #F4F4F5)', textAlign: 'center', fontSize: 16, color: '#5E5852', lineHeight: 1.4 }}>{t('kitchen.lunch.opens', { time: LUNCH_ROUND_OPENS })}</div>
      ) : !people.length ? (
        isToday ? <EmptyState icon="restaurant" title={t('kitchen.lunch.nobody')} /> : <div style={{ padding: '40px 20px', borderRadius: 16, background: 'var(--fill, #F4F4F5)', textAlign: 'center', fontSize: 16, color: '#5E5852', lineHeight: 1.4 }}>{t('activity.nobodyThatDay')}</div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: 28 }}>
            <span data-testid="round-progress" style={{ fontSize: 14, fontWeight: 500, color: allDone ? '#3D6B4F' : '#5E5852', display: 'inline-flex', alignItems: 'center', gap: 6, fontVariantNumeric: 'tabular-nums' }}>
              {allDone ? <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 999, background: '#3D6B4F' }} /> : null}
              {allDone ? t('activity.allMarked') : t('activity.markedOf', { n: marked, total: people.length })}
            </span>
            {!isPhone && left.length ? <Button variant="secondary" size={44} icon="done_all" disabled={busy} onClick={() => setAsk(true)}>{t('kitchen.lunch.markRest')}</Button> : null}
          </div>
          {isPhone ? <SearchBar value={q} onChange={setQ} label={t('activity.searchMember')} placeholder={t('activity.searchMemberPh')} /> : <TextField label={t('activity.searchMember')} value={q} onChange={setQ} placeholder={t('activity.searchMemberPh')} inputMode="search" />}
          <div data-testid="lunch-list" style={{ display: 'flex', flexDirection: 'column', gap: isPhone ? 14 : 18 }}>
            {split ? (
              <>
                {block(t('activity.inClub'), inClub.length, inClub)}
                {block(t('activity.wentHome'), gone.length, gone)}
              </>
            ) : found.length ? block(undefined, null, found) : null}
          </div>
          {!found.length ? <div role="status" style={{ padding: '28px 20px', borderRadius: 16, background: 'var(--fill, #F4F4F5)', textAlign: 'center', fontSize: 16, color: '#5E5852', lineHeight: 1.4 }}>{t('activity.noMemberMatch', { q: q.trim() })}</div> : null}
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
function Row({ m, first, choices, value, log, faces, face, onAmount, onFace }: { m: Member; first: boolean; choices: RoundChoice[]; value: string | undefined; log: Parameters<typeof PendingDot>[0]['log']; faces: boolean; face: Face | undefined; onAmount: (v: string | null) => void; onFace: (f: Face) => void }) {
  const t = useT();
  const { isPhone } = useDevice();
  const allergies = [...m.health.food.map((a) => t('lobby.food.' + a)), ...(m.health.foodOther ? [m.health.foodOther] : [])];
  const diets = m.health.diet.map((d) => t('lobby.diet.' + d));
  return (
    <div data-testid="lunch-row" data-member={m.id} data-marked={value !== undefined ? '1' : '0'}
      // wider screens: the name keeps at least 220 px; when the amounts and faces do not fit beside it (a tablet upright) they drop under it, right-aligned
      style={{ padding: isPhone ? '10px 14px 10px 16px' : '12px 22px', display: 'flex', flexDirection: isPhone ? 'column' : 'row', flexWrap: isPhone ? undefined : 'wrap', alignItems: isPhone ? 'stretch' : 'center', gap: isPhone ? 8 : '8px 12px', ...(isPhone ? rowLine(first, 68) : first ? {} : { borderTop: HAIR }) }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: isPhone ? 'none' : '1 1 220px', minWidth: 0 }}>
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
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: isPhone ? 'space-between' : 'flex-end', gap: 8, marginLeft: isPhone ? undefined : 'auto' }}>
        <RoundChips choices={choices} value={value} onPick={onAmount} label={t('kitchen.lunch.rowAria', { name: memberName(m) })} />
        {faces ? <MoodFaces value={face ?? null} onChange={onFace} size={isPhone ? 32 : 36} name={displayName(m)} label={t('mood.ask', { name: displayName(m) })} /> : null}
      </div>
    </div>
  );
}
