// Text helpers for leads (shared by the enquiries board and the management overview).
import type { Enquiry } from '@cp/shared';
import type { TFn } from '../../lib/i18n';

/** The lead's next step as text ("Trial Wed 21 Oct, 10:30", "Call back Thu 22 Oct"); lost leads show why. */
export function nextText(t: TFn, fds: (d: string) => string, e: Pick<Enquiry, 'next' | 'stage' | 'lost'>) {
  if (e.stage === 'lost') return e.lost ? t('enq.lost.' + e.lost.reason) : t('enq.stage.lost');
  const n = e.next;
  if (!n) return t('enq.next.none');
  if (n.kind === 'custom' && n.text) return n.text;
  const when = n.date ? fds(n.date) + (n.time ? ', ' + n.time : '') : '';
  const label = t('enq.next.' + n.kind);
  return when ? `${label} ${when}` : label;
}
