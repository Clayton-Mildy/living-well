// Finance view helpers: wording, formatting, search, copy to clipboard.
import { rp, type InvoiceLine, type Lang, type Payment } from '@cp/shared';
import type { TFn } from '../../lib/i18n';

/** 15 -> "15th" in English; Indonesian just says "tanggal 15", so the number stays plain. */
export function ordinal(lang: Lang, n: number): string {
  if (lang === 'id') return String(n);
  const v = n % 100;
  const suffix = v >= 11 && v <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] || 'th';
  return `${n}${suffix}`;
}

/** Rupiah with the minus sign in front of the Rp: "−Rp 500.000". */
export const money = (n: number) => (n < 0 ? '−' + rp(-n) : rp(n));

/** An invoice line's wording: `inv.line.*` keys get their month spelled out; free text (staff adjustments) passes through. */
export function lineLabel(t: TFn, fmonth: (ym: string) => string, l: Pick<InvoiceLine, 'label' | 'params'>): string {
  const p = l.params ? { ...l.params, ...(l.params.month ? { month: fmonth(String(l.params.month)) } : {}) } : undefined;
  return t(l.label, p);
}

export function methodLabel(t: TFn, p: Pick<Payment, 'method' | 'bank'>): string {
  return p.method === 'dokuVa' ? `${t('finance.method.dokuVa')}${p.bank ? ' · ' + p.bank : ''}` : t('finance.method.' + p.method);
}

/** Copy text to the clipboard; falls back to a hidden textarea where the async API is blocked. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const el = document.createElement('textarea');
      el.value = text;
      el.setAttribute('readonly', '');
      el.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(el);
      return ok;
    } catch {
      return false;
    }
  }
}

/** Case-insensitive "contains" over any number of fields; an empty query matches everything. */
export const matches = (query: string, ...fields: (string | undefined | null)[]) => {
  const q = query.trim().toLowerCase();
  return !q || fields.some((f) => (f || '').toLowerCase().includes(q));
};

/** "21 Oct, 09:58" style stamp from a club DT. */
export const stampOf = (dt: string, fds: (d: string) => string) => `${fds(dt.slice(0, 10))}, ${dt.slice(11, 16)}`;

/** The text of a money input as a whole number ("5.500.000" -> 5500000). */
export const digits = (v: string) => +(String(v).replace(/\D/g, '') || 0);
