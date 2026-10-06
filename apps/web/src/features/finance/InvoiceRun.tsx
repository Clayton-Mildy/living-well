// Invoice run: preview what the run would bill (plan lines, extra days from the month before, adjustments, account credit), then issue.
import { useEffect, useMemo, useState } from 'react';
import { useResetOn } from '../../lib/useResetOn';
import { addDays, memberName, rp, runDone, ym } from '@cp/shared';
import { nextRunPeriod, runPlan, type RunPlan } from '@cp/shared/rules/finance';
import { Avatar, Button, Chip, Note, usePaged, FONT_BODY, FONT_SMALL } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { useAct } from '../../lib/act';
import { useNow } from '../../lib/clock';
import { useFmt, useT } from '../../lib/i18n';
import { useClub } from '../../store/replica';
import { lineLabel, money } from './lib';
import { FormOverlay, PagerBar, caps } from './parts';
import { memberPhoto } from '../../lib/media';

export function InvoiceRunSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useClub();
  const t = useT();
  const act = useAct();
  const { fds, fmonth } = useFmt();
  const { today } = useNow();
  const { isPhone } = useDevice();
  const [period, setPeriod] = useState(() => nextRunPeriod(s, today));
  const [confirm, setConfirm] = useState(false);
  useResetOn(open ? 'open' : null, () => { setPeriod(nextRunPeriod(s, today)); setConfirm(false); });
  useEffect(() => setConfirm(false), [period]);

  const plan = useMemo(() => (open ? runPlan(s, period, today) : null), [open, s, period, today]);
  const periods = [ym(today), ym(addDays(`${ym(today)}-28`, 7))];
  const paged = usePaged(plan?.issue ?? [], 15, period);
  if (!plan) return null;

  const n = plan.issue.length;
  const noPayer = plan.skipped.filter((r) => r.skipped === 'noPayer');
  const nothing = plan.skipped.filter((r) => r.skipped === 'nothingToBill');
  const issue = async () => {
    const r = await act('run.issue', { period, early: plan.early }, { ok: (res) => t('finance.run.issued', { n: Number(res.count || n) }) });
    if (r.ok) onClose();
  };

  const footer = confirm ? (
    <>
      <span style={{ fontSize: FONT_BODY, lineHeight: 1.4, flex: '1 1 220px', alignSelf: 'center' }}>{t('finance.run.confirm', { n, total: rp(plan.total) })}</span>
      <Button variant="secondary" full={isPhone} onClick={() => setConfirm(false)}>{t('common.back')}</Button>
      <Button full={isPhone} onClick={issue}>{plan.early ? t('finance.run.issueEarly', { n }) : t('finance.run.issueNow', { n })}</Button>
    </>
  ) : (
    <>
      <Button variant="secondary" full={isPhone} onClick={onClose}>{t('common.close')}</Button>
      <Button full={isPhone} disabled={!n} onClick={() => setConfirm(true)}>{t('finance.run.issueBtn', { n, total: rp(plan.total) })}</Button>
    </>
  );

  return (
    <FormOverlay open={open} onClose={onClose} title={t('finance.run.title')} eyebrow={t('finance.run.eyebrow')} maxWidth={720} footer={footer}>
      <div role="radiogroup" aria-label={t('finance.run.period')} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {periods.map((p) => (
          <Chip key={p} selected={p === period} icon={p !== period && runDone(s, p) ? 'task_alt' : undefined} onClick={() => setPeriod(p)}>{fmonth(p, true)}</Chip>
        ))}
      </div>
      <Summary plan={plan} />
      {n ? (
        <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid #DBD7D6', borderRadius: 20, overflow: 'hidden' }}>
          {paged.rows.map((r, i) => (
            <div key={r.member.id} style={{ padding: '12px 16px', borderTop: i ? '1px solid #EFECEA' : 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Avatar name={memberName(r.member)} tone={r.member.photoTone} src={memberPhoto(r.member)} size={40} />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{memberName(r.member)}</span>
                  <span style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{t('finance.run.billTo', { name: s.familyContacts[r.payerId]?.name || '' })}</span>
                </div>
                <span style={{ fontSize: 16, fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{rp(r.total)}</span>
              </div>
              <div style={{ paddingLeft: 52, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {r.lines.map((l) => (
                  <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: FONT_BODY, lineHeight: 1.4 }}>
                    <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <span>{lineLabel(t, fmonth, l)}</span>
                      {l.dates?.length ? <span style={{ fontSize: FONT_SMALL, color: '#6A6967' }}>{l.dates.map(fds).join(' · ')}</span> : null}
                    </span>
                    <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: l.amount < 0 ? '#3D6B4F' : undefined }}>{money(l.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <PagerBar paged={paged} label={t('finance.run.title')} />
        </div>
      ) : (
        <Note tone="cream" icon="task_alt">{plan.done ? t('finance.run.allDone', { month: fmonth(period, true) }) : t('finance.run.nothing')}</Note>
      )}
      {noPayer.length ? (
        <Note tone="ochre" icon="warning">
          <b style={{ fontWeight: 600 }}>{t('finance.run.noPayer')}</b>{' '}
          {noPayer.map((r) => memberName(r.member)).join(', ')}. {t('finance.run.noPayerHelp')}
        </Note>
      ) : null}
      {nothing.length && !plan.done ? <span style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{t('finance.run.nothingFor', { names: nothing.map((r) => memberName(r.member)).join(', ') })}</span> : null}
      {n ? <span style={{ ...caps, color: '#6A6967' }}>{t('finance.run.total', { n, total: rp(plan.total) })}</span> : null}
    </FormOverlay>
  );
}

function Summary({ plan }: { plan: RunPlan }) {
  const t = useT();
  const { fds, fdy, fmonth } = useFmt();
  return (
    <>
      {plan.done ? (
        <Note tone="sage" icon="task_alt">{t('finance.run.alreadyRun', { month: fmonth(plan.period, true) })}</Note>
      ) : plan.early ? (
        <Note tone="ochre" icon="schedule">{t('finance.run.early', { usual: fdy(plan.usualDate) })}</Note>
      ) : null}
      {plan.partialMonth && !plan.done ? <Note tone="cream" icon="info">{t('finance.run.partialMonth', { month: fmonth(plan.partialMonth, true) })}</Note> : null}
      <div style={{ fontSize: 16, lineHeight: '24px' }}>{t('finance.run.dates', { issue: fds(plan.issueDate), due: fds(plan.dueDate) })}</div>
    </>
  );
}
