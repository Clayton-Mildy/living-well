// Admin › Settings (round 17, Owner and Management). Three grouped lists: Membership rules (round 18: the notice for a downgrade, a stop and a leave, each with
// a live "ask by" date; round 19: the upgrade's notice days and Leave in a row months too, one Save for the card; Management's change waits for the Owner), Few-visits alert (fewer than N visits, and
// the alert's days before next month, applied at once) and Terms and conditions (a row that opens the terms page, ?view=terms). Each group has its own Save and
// Cancel while edited. The live dates come from a copy of the club with the draft values in it.
import { useState, type ReactNode } from 'react';
import { fewDaysRange, fewVisitsAlertDay, fewVisitsSettings } from '@cp/shared/rules/fewVisits';
import { useSearchParams } from 'react-router-dom';
import { actorName, addMonths, dtDate, hasKey, LEAVE_MAX_LIMIT, leaveMaxMonths, type ClubState } from '@cp/shared';
import { NOTICE_KINDS, earliestMonth, noticeDeadline, noticeSettings, type NoticeDaysKind } from '@cp/shared/rules/notice';
import { currentTerms, termsAgreement } from '@cp/shared/rules/terms';
import { ownerApprovalOn } from '@cp/shared';
import { Button, Group, HAIRLINE, Icon, PageHead, FONT_SMALL } from '../../components/ui';
import { OwnerWaiting } from '../../components/OwnerWaiting';
import { useDevice } from '../../hooks/useDevice';
import { useAct } from '../../lib/act';
import { dayMonth, useFmt, useT } from '../../lib/i18n';
import { useNow } from '../../lib/clock';
import { useMe } from '../../lib/me';
import { useClub } from '../../store/replica';
import { Page, tn } from './common';
import { TermsPage } from './TermsPage';

const digits = (v: string) => v.replace(/\D/g, '').slice(0, 2);
const num = (v: string) => (v === '' ? NaN : Number(v));
const inRange = (n: number, lo: number, hi: number) => Number.isInteger(n) && n >= lo && n <= hi;
const NOTICE_MAX = 60;
const SLOT = '\u0000'; // where the field goes in a sentence template

const ROW = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 8px', minHeight: 52, padding: '6px 16px', fontSize: 15, lineHeight: 1.4, color: '#24201C' } as const;
const SUB = { fontSize: FONT_SMALL, lineHeight: 1.35, color: '#6B6259', fontVariantNumeric: 'tabular-nums' } as const;
const NOTICE_ICON: Record<NoticeDaysKind, string> = { downgrade: 'trending_down', stop: 'logout', leave: 'beach_access', upgrade: 'trending_up' };
const NO_DRAFT: Record<NoticeDaysKind, string | null> = { downgrade: null, stop: null, leave: null, upgrade: null };

/** A small whole-number field (44px tall); turns white on the grey group. */
function NumField({ name, label, value, onChange, onBlur, bad, width = 64 }: { name: string; label: string; value: string; onChange: (v: string) => void; onBlur?: () => void; bad: boolean; width?: number }) {
  return (
    <input data-field={name} aria-label={label} aria-invalid={bad || undefined} value={value} onChange={(e) => onChange(digits(e.target.value))} onBlur={onBlur} inputMode="numeric" maxLength={2} className="cp-input cp-fill"
      style={{ width, height: 44, border: 'none', borderRadius: 12, background: 'var(--fill, #F4F4F5)', boxShadow: bad ? 'inset 0 0 0 2px #9A3D24' : undefined, padding: '0 6px', fontSize: 16, fontFamily: 'Inter', color: '#24201C', textAlign: 'center', fontVariantNumeric: 'tabular-nums', flex: 'none' }} />
  );
}
/** A sentence with the number field inside it: "Flag below [5] visits". The template's {n} is where the field goes. */
function Sentence({ template, field }: { template: string; field: ReactNode }) {
  const [before, after] = template.split(SLOT);
  return <>{before ? <span>{before}</span> : null}{field}{after ? <span>{after}</span> : null}</>;
}
/** One rule: an icon in a grey circle, the title with its live line under it, and on the right a "[14] days" field or a fixed value. */
function RuleRow({ k, icon, title, sub, right, first }: { k: string; icon: string; title: string; sub: string; right: ReactNode; first?: boolean }) {
  return (
    <div data-setting={k} style={{ ...ROW, flexWrap: 'nowrap', gap: 12, minHeight: 60, padding: '8px 16px', borderTop: first ? undefined : HAIRLINE }}>
      <span style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--track, #E8E8EB)', display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name={icon} size={18} color="#4A433D" /></span>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontWeight: 500 }}>{title}</span>
        <span style={SUB}>{sub}</span>
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 'none', ...(typeof right === 'string' ? SUB : {}) }}>{right}</span>
    </div>
  );
}
function SaveRow({ busy, onSave, onCancel, label }: { busy: boolean; onSave: () => void; onCancel: () => void; /** "Send to owner" when the change waits for the Owner */ label?: string }) {
  const t = useT();
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '8px 16px 12px', borderTop: HAIRLINE }}>
      <Button variant="secondary" size={48} onClick={onCancel}>{t('mgmt.settings.cancel')}</Button>
      <Button size={48} disabled={busy} onClick={onSave}>{label || t('mgmt.settings.save')}</Button>
    </div>
  );
}

export function Settings() {
  const t = useT();
  const { isPhone } = useDevice();
  const s = useClub();
  const act = useAct();
  const { role, realRole } = useMe();
  const fmt = useFmt();
  const { today } = useNow();
  const [sp, setSp] = useSearchParams();
  const termsOpen = sp.get('view') === 'terms';
  const setTermsOpen = (on: boolean) => setSp(on ? { view: 'terms' } : {}, { replace: false });
  const st = s.club.settings;
  const few = fewVisitsSettings(s);
  const saved = noticeSettings(s);
  const [notice, setNotice] = useState(NO_DRAFT); // null = untouched (shows the saved value)
  const savedRun = leaveMaxMonths(s);
  const [leaveRun, setLeaveRun] = useState<string | null>(null);
  const [below, setBelow] = useState<string | null>(null);
  const [days, setDays] = useState<string | null>(null);
  const [shown, setShown] = useState<Record<string, boolean>>({}); // a group shows its errors once Save was tapped
  const [left, setLeft] = useState<Record<string, boolean>>({}); // a field shows its error once the cursor leaves it (not on each keystroke: "18" is not wrong after the "1")
  const blur = (name: string) => () => setLeft((x) => (x[name] ? x : { ...x, [name]: true }));
  const [busy, setBusy] = useState(false);

  const noticeV = (k: NoticeDaysKind) => notice[k] ?? String(saved[k]);
  const noticeBad = (k: NoticeDaysKind) => !inRange(num(noticeV(k)), 1, NOTICE_MAX);
  const noticeChanged = NOTICE_KINDS.filter((k) => num(noticeV(k)) !== saved[k]);
  const runV = leaveRun ?? String(savedRun);
  const runBad = !inRange(num(runV), 1, LEAVE_MAX_LIMIT);
  const runChanged = num(runV) !== savedRun;
  const membershipDirty = noticeChanged.length > 0 || runChanged;
  const range = fewDaysRange(s);
  const belowV = below ?? String(few.below);
  const daysV = days ?? String(few.daysBeforeMonth);
  const belowBad = !inRange(num(belowV), 1, 31);
  const daysBad = !inRange(num(daysV), range.min, range.max);
  const fewDirty = num(belowV) !== few.below || num(daysV) !== few.daysBeforeMonth;
  // a field out of range shows its message once it is left (blur) after an edit, or once Save was tapped (the few-visits range depends on the stop notice)
  const noticeShow = (k: NoticeDaysKind) => noticeBad(k) && ((notice[k] !== null && !!left[k]) || !!shown.membership);
  const daysShow = daysBad && ((days !== null && !!left.days) || !!shown.few);
  const runShow = runBad && ((leaveRun !== null && !!left.leaveRun) || !!shown.membership);

  // the club with the draft values (the valid ones), for the live dates
  const patched: ClubState = { ...s, club: { ...s.club, settings: {
    ...st,
    notice: Object.fromEntries(NOTICE_KINDS.map((k) => [k, noticeBad(k) ? saved[k] : num(noticeV(k))])) as Record<NoticeDaysKind, number>,
    fewVisits: { below: few.below, daysBeforeMonth: daysBad ? few.daysBeforeMonth : num(daysV) },
  } } };
  const day = (d: string) => fmt.fd(d, dayMonth(d, today));
  const subOf = (k: NoticeDaysKind) => {
    const month = earliestMonth(patched, k, today); // the first month this kind can still be asked for
    const d = day(noticeDeadline(patched, month, k));
    if (k === 'downgrade') return t('mgmt.settings.downgradeSub', { d });
    if (k === 'stop') return t('mgmt.settings.stopSub', { m: fmt.fmonth(addMonths(month, -1)), d }); // a stop from `month`: the month before is the last
    if (k === 'upgrade') return t('mgmt.settings.upgradeSub', { d });
    return t('mgmt.settings.leaveSub', { m: fmt.fmonth(month), d });
  };
  const fewMonth = earliestMonth(patched, 'stop', today); // the first month whose changes have not closed
  const fewSub = t('mgmt.settings.fewAlertSub', { m: fmt.fmonth(fewMonth), a: day(fewVisitsAlertDay(patched, addMonths(fewMonth, -1))), c: day(noticeDeadline(patched, fewMonth, 'stop')) });

  const run = async (group: 'membership' | 'few', input: Record<string, unknown>, reset: () => void) => {
    setShown((x) => ({ ...x, [group]: true }));
    if (busy) return;
    setBusy(true);
    try {
      const r = await act('club.updateSettings', input, { ok: t('mgmt.settings.saved') });
      if (r.ok) { reset(); setShown((x) => ({ ...x, [group]: false })); }
    } finally { setBusy(false); }
  };
  const resetMembership = () => { setNotice(NO_DRAFT); setLeaveRun(null); };
  const saveMembership = () => {
    if (NOTICE_KINDS.some(noticeBad) || runBad) { setShown((x) => ({ ...x, membership: true })); return; }
    // only what changed: the notice kinds, and Leave in a row in its own field (R2)
    void run('membership', {
      ...(noticeChanged.length ? { notice: Object.fromEntries(noticeChanged.map((k) => [k, num(noticeV(k))])) } : {}),
      ...(runChanged ? { leaveMaxMonths: num(runV) } : {}),
    }, resetMembership);
  };
  const saveFew = () => { if (belowBad || daysBad) { setShown((x) => ({ ...x, few: true })); return; } void run('few', { fewVisits: { below: num(belowV), daysBeforeMonth: num(daysV) } }, () => { setBelow(null); setDays(null); }); };

  const err = (text: string) => <div role="alert" style={{ padding: '0 16px 10px', fontSize: FONT_SMALL, color: '#9A3D24', lineHeight: 1.4 }}>{text}</div>;
  const daysField = (name: string, label: string, value: string, set: (v: string) => void, bad: boolean, unit = 'mgmt.settings.days') => (
    <><NumField name={name} label={label} value={value} onChange={(v) => { set(v); setLeft((x) => (x[name] ? { ...x, [name]: false } : x)); }} onBlur={blur(name)} bad={bad} width={46} /><span style={SUB}>{t(unit, { n: num(value) })}</span></>
  );
  const sentence = (key: string, name: string, value: string, set: (v: string) => void, bad: boolean, savedN: number) => {
    const label = tn(t, key, savedN);
    const one = num(value) === 1 && hasKey(key + 'One') ? key + 'One' : key; // "Flag below 1 visit"
    return <div style={ROW}><Sentence template={t(one, { n: SLOT })} field={<NumField name={name} label={label} value={value} onChange={set} bad={bad} />} /></div>;
  };
  const cur = currentTerms(s);
  const agreement = termsAgreement(s);
  const needsOwner = realRole !== 'owner' && ownerApprovalOn(s, role as 'mgmt', 'pricing');

  if (termsOpen && !isPhone) return <TermsPage onBack={() => setTermsOpen(false)} />;
  return (
    <Page>
      <PageHead title={t('mgmt.settings.title')} size={isPhone ? 28 : 40} />
      <div style={{ display: 'grid', gridTemplateColumns: isPhone ? '1fr' : 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', gap: isPhone ? 18 : 24, alignItems: 'start' }}>
        <Group title={t('mgmt.settings.membership')} label={t('mgmt.settings.membership')} pad={0} gap={0}>
          {NOTICE_KINDS.map((k, i) => (
            <RuleRow key={k} k={k} first={i === 0} icon={NOTICE_ICON[k]} title={t(`mgmt.settings.${k}`)} sub={subOf(k)}
              right={daysField(k, t(`mgmt.settings.${k}`), noticeV(k), (v) => setNotice((x) => ({ ...x, [k]: v })), noticeShow(k))} />
          ))}
          {NOTICE_KINDS.some(noticeShow) ? err(t('mgmt.err.noticeInvalid')) : null}
          <RuleRow k="leaveRun" icon="event_repeat" title={t('mgmt.settings.leaveRun')} sub={t('mgmt.settings.leaveRunSub')}
            right={daysField('leaveRun', t('mgmt.settings.leaveRun'), runV, setLeaveRun, runShow, 'mgmt.settings.months')} />
          {runShow ? err(t('mgmt.settings.err.leaveRun')) : null}
          <OwnerWaiting section="pricing" pad="4px 16px" only={(c) => c.action === 'club.updateSettings'} />
          {membershipDirty ? <SaveRow busy={busy} label={needsOwner ? t('mgmt.settings.sendOwner') : undefined} onSave={saveMembership} onCancel={() => { resetMembership(); setShown((x) => ({ ...x, membership: false })); }} /> : null}
        </Group>

        <Group title={t('mgmt.settings.fewVisits')} label={t('mgmt.settings.fewVisits')} pad={0} gap={0}>
          {sentence('mgmt.settings.fewBelow', 'below', belowV, setBelow, belowBad && !!shown.few, few.below)}
          {shown.few && belowBad ? err(t('mgmt.settings.err.few')) : null}
          <RuleRow k="days" icon="notifications" title={t('mgmt.settings.fewAlert')} sub={fewSub} right={daysField('days', t('mgmt.settings.fewAlert'), daysV, setDays, daysShow)} />
          {daysShow ? err(t('mgmt.err.fewDaysInvalid', range)) : null}
          {fewDirty ? <SaveRow busy={busy} onSave={saveFew} onCancel={() => { setBelow(null); setDays(null); setShown((x) => ({ ...x, few: false })); }} /> : null}
        </Group>

        <Group title={t('mgmt.settings.terms')} label={t('mgmt.settings.terms')} pad={0} gap={0}>
          <button type="button" data-row="terms" className="h-row cp-press" onClick={() => setTermsOpen(true)}
            style={{ ...ROW, width: '100%', minHeight: 56, flexWrap: 'nowrap', gap: 10, border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', fontFamily: 'Inter' }}>
            <span style={{ flex: 1, minWidth: 0, fontWeight: 500 }}>
              {cur ? t('mgmt.settings.termsRow', { v: cur.version, d: fmt.fd(dtDate(cur.publishedAt), dayMonth(dtDate(cur.publishedAt), today)), name: actorName(s, cur.publishedBy), a: agreement.agreed, n: agreement.total }) : t('mgmt.settings.noTerms')}
            </span>
            <Icon name="chevron_right" size={20} color="#8A8078" />
          </button>
        </Group>
      </div>
      {termsOpen && isPhone ? <TermsPage onBack={() => setTermsOpen(false)} /> : null}
    </Page>
  );
}
