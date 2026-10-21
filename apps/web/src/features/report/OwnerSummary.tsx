// Round 12: "Send to owner" from the month report. A short WhatsApp-style summary of the period (key numbers and how they moved since the period before),
// shown in the Broadcast bubble, with Copy and a simulated Send on WhatsApp.
import type { InsightPeriod } from '@cp/shared/rules/insights';
import type { Delta, MonthReport } from '@cp/shared/rules/monthReport';
import { Button, Dialog } from '../../components/ui';
import { useNow } from '../../lib/clock';
import { useT, type TFn } from '../../lib/i18n';
import { say } from '../../store/ui';
import { WaBubble } from '../mgmt/common';

export interface SummaryFmt { rp: (n: number) => string; pct: (n: number | null) => string; /** the period in words ("1 Oct – 21 Oct"); ISO dates without it */ range?: (p: InsightPeriod) => string }

/** A fraction as a whole percent ("80%"); a dash when unknown. */
export const pct = (n: number | null) => (n === null ? '—' : `${Math.round(n * 100)}%`);
/** +3 / −2 with a real minus sign; '' for no change or unknown. */
export const signed = (n: number | null, f: (n: number) => string = String): string => (n === null || n === 0 ? '' : n > 0 ? `+${f(n)}` : `−${f(-n)}`);

/** The summary for the owner, one line each: a heading, then the key numbers per group with their change since the period before. */
export function ownerSummaryLines(r: MonthReport, t: TFn, fmt: SummaryFmt): string[] {
  const range = fmt.range ? fmt.range(r.period) : `${r.period.from} – ${r.period.to}`;
  const one = (n: number) => String(Math.round(n * 10) / 10);
  const pts = (n: number) => `${Math.round(n * 100)} pt`;
  const row = (key: string, d: Delta<number | null>, f: (n: number) => string, df: (n: number) => string = f) => {
    const label = t(`month.${key}`), cur = d.cur === null ? '—' : f(d.cur), diff = signed(d.diff, df);
    return diff ? t('month.sum.rowDiff', { label, cur, diff }) : t('month.sum.row', { label, cur });
  };
  const n = String;
  const { money: m, members: mb, care: c, pipeline: p } = r;
  return [
    `*${t('month.sum.head', { period: range })}*`,
    '',
    `*${t('month.money')}*`,
    row('billed', m.billed, fmt.rp), row('collected', m.collected, fmt.rp), row('outstanding', m.outstanding, fmt.rp),
    '',
    `*${t('month.members')}*`,
    row('active', mb.active, n), row('joined', mb.joined, n), row('ended', mb.ended, n), row('utilisation', mb.utilisation, (x) => fmt.pct(x), pts),
    '',
    `*${t('month.care')}*`,
    row('index', c.index, one), row('alerts', c.alerts, n),
    '',
    `*${t('month.pipeline')}*`,
    t('month.sum.row', { label: t('month.leads'), cur: p.funnel.new }), t('month.sum.row', { label: t('month.converted'), cur: p.funnel.joined }),
  ];
}

export function OwnerSummary({ open, onClose, r, fmt }: { open: boolean; onClose: () => void; r: MonthReport; fmt: SummaryFmt }) {
  const t = useT();
  const { now } = useNow();
  if (!open) return null;
  const text = ownerSummaryLines(r, t, fmt).join('\n');
  const copy = () => {
    const failed = () => say(t('month.copyFailed'), { tone: 'error' });
    // no clipboard (an old browser, an insecure page) or a refusal: say so rather than nothing
    try { if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(() => say(t('month.copied')), failed); else failed(); } catch { failed(); }
  };
  const send = () => { say(t('month.sent')); onClose(); };
  return (
    <Dialog open onClose={onClose} title={t('month.summaryTitle')} maxWidth={520}
      footer={<><Button variant="secondary" size={44} icon="content_copy" onClick={copy}>{t('month.copy')}</Button><Button size={44} icon="send" onClick={send}>{t('month.sendWa')}</Button></>}>
      <WaBubble text={text} time={now} testId="owner-summary" />
      <span style={{ fontSize: 12, color: '#6B6259', lineHeight: 1.4 }}>{t('mgmt.simNote')}</span>
    </Dialog>
  );
}
