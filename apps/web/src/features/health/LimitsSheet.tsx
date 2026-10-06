// Watch and Alert limits (club setting, nurse and management): when a reading counts as Watch or Alert. Each line is one limit with
// its Watch and Alert number; an empty box is not used. Saving grades every reading again with the new limits.
import { useState } from 'react';
import { DEFAULT_LIMITS, LIMIT_CMP, LIMIT_RANGE, limitOrderOk, limitsOf, type HealthLimits, type LimitKey } from '@cp/shared';
import { Button, Sheet, TextField, FONT_BODY } from '../../components/ui';
import { useAct } from '../../lib/act';
import { useT } from '../../lib/i18n';
import { useResetOn } from '../../lib/useResetOn';
import { useClub } from '../../store/replica';
import { smallCaps } from './lib';

const SECTIONS: { title: string; unit: string; keys: LimitKey[] }[] = [
  { title: 'health.bp', unit: 'mmHg', keys: ['sysHigh', 'diaHigh', 'sysLow'] },
  { title: 'health.pulse', unit: 'bpm', keys: ['pulseHigh', 'pulseLow'] },
  { title: 'health.vitals', unit: '', keys: ['spo2Low', 'tempHigh', 'tempLow'] },
  { title: 'health.glucose', unit: 'mg/dL', keys: ['gluHigh', 'gluLow'] },
  { title: 'health.weight', unit: 'kg', keys: ['weightChange'] },
];
const UNIT: Partial<Record<LimitKey, string>> = { spo2Low: '%', tempHigh: '°C', tempLow: '°C' };

type Text = Record<LimitKey, { watch: string; alert: string }>;
const show = (n: number | null) => (n == null ? '' : String(n));
const toText = (L: HealthLimits): Text => Object.fromEntries((Object.keys(LIMIT_CMP) as LimitKey[]).map((k) => [k, { watch: show(L[k].watch), alert: show(L[k].alert) }])) as Text;
const read = (v: string): number | null | 'bad' => {
  if (!v.trim()) return null;
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) ? n : 'bad';
};

export function LimitsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const s = useClub();
  const act = useAct();
  const [d, setD] = useState<Text>(() => toText(limitsOf(s)));
  const [busy, setBusy] = useState(false);
  useResetOn(open ? 'open' : null, () => setD(toText(limitsOf(s))));

  const keys = Object.keys(LIMIT_CMP) as LimitKey[];
  const errOf = (k: LimitKey): string => {
    const w = read(d[k].watch), a = read(d[k].alert);
    const [lo, hi] = LIMIT_RANGE[k];
    if ([w, a].some((x) => x === 'bad' || (typeof x === 'number' && (x < lo || x > hi)))) return t('health.limBadRange', { lo, hi });
    if (w === null && a === null) return t('health.limOneNeeded');
    if (!limitOrderOk(k, { watch: w as number | null, alert: a as number | null })) return t('health.limBadOrder');
    return '';
  };
  const errs = Object.fromEntries(keys.map((k) => [k, errOf(k)])) as Record<LimitKey, string>;
  const ok = keys.every((k) => !errs[k]);

  const save = async () => {
    if (!ok || busy) return;
    const limits = Object.fromEntries(keys.map((k) => [k, { watch: read(d[k].watch), alert: read(d[k].alert) }])) as HealthLimits;
    setBusy(true);
    const r = await act('health.setLimits', { limits }, { ok: () => t('health.limSaved') });
    setBusy(false);
    if (r.ok) onClose();
  };
  const set = (k: LimitKey, f: 'watch' | 'alert', v: string) => setD((x) => ({ ...x, [k]: { ...x[k], [f]: v.replace(/[^0-9.,]/g, '').slice(0, 5) } }));

  return (
    <Sheet open={open} onClose={onClose} title={t('health.limitsTitle')} maxWidth={640}
      footer={(
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'space-between', width: '100%' }}>
          <Button variant="ghost" size={44} onClick={() => setD(toText(DEFAULT_LIMITS))}>{t('health.limReset')}</Button>
          <Button size={44} icon="check" disabled={!ok || busy} onClick={() => void save()}>{t('common.save')}</Button>
        </div>
      )}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div className="cp-desc" style={{ fontSize: FONT_BODY, lineHeight: 1.45, color: '#282828' }}>{t('health.limitsNote')}</div>
        {SECTIONS.map((sec) => (
          <section key={sec.title} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={smallCaps('1.5px')}>{t(sec.title)}</div>
            {sec.keys.map((k) => {
              const cmp = LIMIT_CMP[k];
              const unit = UNIT[k] ?? sec.unit;
              return (
                <div key={k} data-limit={k} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 12, borderRadius: 16, background: '#F4F0EE' }}>
                  <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{t('health.lim.' + k)} <span style={{ color: '#6A6967', fontWeight: 400 }}>· {unit}</span></span>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ flex: '1 1 0', minWidth: 0 }}><TextField label={t('health.limW.' + cmp)} value={d[k].watch} onChange={(v) => set(k, 'watch', v)} inputMode="decimal" placeholder="—" /></div>
                    <div style={{ flex: '1 1 0', minWidth: 0 }}><TextField label={t('health.limA.' + cmp)} value={d[k].alert} onChange={(v) => set(k, 'alert', v)} inputMode="decimal" placeholder="—" /></div>
                  </div>
                  {errs[k] ? <span role="alert" style={{ fontSize: FONT_BODY, color: '#AF4B2F', lineHeight: 1.4 }}>{errs[k]}</span> : null}
                </div>
              );
            })}
          </section>
        ))}
      </div>
    </Sheet>
  );
}
