// Admin › Settings (round 17, Owner and Management). Three grouped lists: Membership rules (the notice period; Management's change waits for the Owner),
// Few-visits alert (the two numbers, applied at once) and Terms and conditions (a row that opens the terms page, ?view=terms). Each group has its own Save and Cancel while edited.
import { useState, type ReactNode } from 'react';
import { fewDaysRange, fewVisitsSettings } from '@cp/shared/rules/fewVisits';
import { useSearchParams } from 'react-router-dom';
import { actorName, dtDate, hasKey } from '@cp/shared';
import { noticeDays } from '@cp/shared/rules/notice';
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

const ROW = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 8px', minHeight: 52, padding: '6px 16px', fontSize: 15, lineHeight: 1.4, color: '#24201C' } as const;

/** A small whole-number field (44px tall); turns white on the grey group. */
function NumField({ name, label, value, onChange, bad }: { name: string; label: string; value: string; onChange: (v: string) => void; bad: boolean }) {
  return (
    <input data-field={name} aria-label={label} aria-invalid={bad || undefined} value={value} onChange={(e) => onChange(digits(e.target.value))} inputMode="numeric" maxLength={2} className="cp-input cp-fill"
      style={{ width: 64, height: 44, border: 'none', borderRadius: 12, background: 'var(--fill, #F4F4F5)', boxShadow: bad ? 'inset 0 0 0 2px #9A3D24' : undefined, padding: '0 10px', fontSize: 16, fontFamily: 'Inter', color: '#24201C', textAlign: 'center', fontVariantNumeric: 'tabular-nums', flex: 'none' }} />
  );
}
/** A sentence with the number field inside it: "Flag below [5] visits". The template's {n} is where the field goes. */
function Sentence({ template, field }: { template: string; field: ReactNode }) {
  const [before, after] = template.split('\u0000');
  return <>{before ? <span>{before}</span> : null}{field}{after ? <span>{after}</span> : null}</>;
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
  const [notice, setNotice] = useState<string | null>(null); // null = untouched (shows the saved value)
  const [below, setBelow] = useState<string | null>(null);
  const [days, setDays] = useState<string | null>(null);
  const [shown, setShown] = useState<Record<string, boolean>>({}); // a group shows its errors once Save was tapped
  const [busy, setBusy] = useState(false);

  const noticeV = notice ?? String(noticeDays(s, 'stop'));
  const belowV = below ?? String(few.below);
  const daysV = days ?? String(few.daysBeforeMonth);
  const range = fewDaysRange(s);
  const noticeBad = !inRange(num(noticeV), 1, 60);
  const belowBad = !inRange(num(belowV), 1, 31);
  const daysBad = !inRange(num(daysV), range.min, range.max);
  const noticeDirty = num(noticeV) !== noticeDays(s, 'stop') || (notice !== null && noticeBad);
  const fewDirty = num(belowV) !== few.below || num(daysV) !== few.daysBeforeMonth || (below !== null && belowBad) || (days !== null && daysBad);

  const run = async (group: 'membership' | 'few', input: Record<string, unknown>, reset: () => void) => {
    setShown((x) => ({ ...x, [group]: true }));
    if (busy) return;
    setBusy(true);
    try {
      const r = await act('club.updateSettings', input, { ok: t('mgmt.settings.saved') });
      if (r.ok) { reset(); setShown((x) => ({ ...x, [group]: false })); }
    } finally { setBusy(false); }
  };
  const saveNotice = () => { if (noticeBad) { setShown((x) => ({ ...x, membership: true })); return; } void run('membership', { notice: { downgrade: num(noticeV), stop: num(noticeV), leave: num(noticeV) } }, () => setNotice(null)); }; // round 18: one value for the three kinds
  const saveFew = () => { if (belowBad || daysBad) { setShown((x) => ({ ...x, few: true })); return; } void run('few', { fewVisits: { below: num(belowV), daysBeforeMonth: num(daysV) } }, () => { setBelow(null); setDays(null); }); };

  const err = (text: string) => <div role="alert" style={{ padding: '0 16px 10px', fontSize: FONT_SMALL, color: '#9A3D24', lineHeight: 1.4 }}>{text}</div>;
  const sentence = (key: string, name: string, value: string, set: (v: string) => void, bad: boolean, saved: number) => {
    const label = tn(t, key, saved);
    const one = num(value) === 1 && hasKey(key + 'One') ? key + 'One' : key; // "Flag below 1 visit"
    return <div style={ROW}><Sentence template={t(one, { n: '\u0000' })} field={<NumField name={name} label={label} value={value} onChange={set} bad={bad} />} /></div>;
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
          <div style={ROW}>
            <span style={{ flex: 1, minWidth: 0, fontWeight: 500 }}>{t('mgmt.settings.notice')}</span>
            <NumField name="notice" label={t('mgmt.settings.notice')} value={noticeV} onChange={setNotice} bad={noticeBad && !!shown.membership} />
          </div>
          {shown.membership && noticeBad ? err(t('mgmt.err.noticeInvalid')) : null}
          <OwnerWaiting section="pricing" pad="4px 16px" only={(c) => c.action === 'club.updateSettings'} />
          {noticeDirty ? <SaveRow busy={busy} label={needsOwner ? t('mgmt.settings.sendOwner') : undefined} onSave={saveNotice} onCancel={() => { setNotice(null); setShown((x) => ({ ...x, membership: false })); }} /> : null}
        </Group>

        <Group title={t('mgmt.settings.fewVisits')} label={t('mgmt.settings.fewVisits')} pad={0} gap={0}>
          {sentence('mgmt.settings.fewBelow', 'below', belowV, setBelow, belowBad && !!shown.few, few.below)}
          {shown.few && belowBad ? err(t('mgmt.settings.err.few')) : null}
          <div style={{ borderTop: HAIRLINE }} />
          {sentence('mgmt.settings.fewDays', 'days', daysV, setDays, daysBad && !!shown.few, few.daysBeforeMonth)}
          {shown.few && daysBad ? err(t('mgmt.err.fewDaysInvalid', range)) : null}
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
