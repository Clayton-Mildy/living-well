// Watch and Alert limits (nurse and management): when a reading counts as Watch or Alert. Each line is one limit with
// its Watch and Alert number; an empty box is not used. Saving grades every reading again with the new limits.
// Club mode sets the club's limits. Member mode (KC round 7, `member`) shows the member's effective limits: a line changed from the club's
// becomes their own, the other lines keep following the club; saving grades that member's readings again.
import { useState } from 'react';
import { DEFAULT_LIMITS, LIMIT_CMP, LIMIT_RANGE, limitOrderOk, limitsFor, limitsOf, live, memberShort, ownLimitKeys, type HealthLimits, type LimitKey, type Member } from '@cp/shared';
import { Button, GROUP_HEAD, Sheet, TextField, FONT_BODY } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { useAct } from '../../lib/act';
import { useT } from '../../lib/i18n';
import { useResetOn } from '../../lib/useResetOn';
import { useClub } from '../../store/replica';
import { smallCaps } from './lib';

export const SECTIONS: { title: string; unit: string; keys: LimitKey[] }[] = [
  { title: 'health.bp', unit: 'mmHg', keys: ['sysHigh', 'diaHigh', 'sysLow'] },
  { title: 'health.pulse', unit: 'bpm', keys: ['pulseHigh', 'pulseLow'] },
  { title: 'health.vitals', unit: '', keys: ['spo2Low', 'tempHigh', 'tempLow'] },
  { title: 'health.glucose', unit: 'mg/dL', keys: ['gluHigh', 'gluLow'] },
  { title: 'health.weight', unit: 'kg', keys: ['weightChange'] },
];
const UNIT: Partial<Record<LimitKey, string>> = { spo2Low: '%', tempHigh: '°C', tempLow: '°C' };
/** The unit shown next to a limit's name. */
export const unitOf = (k: LimitKey): string => UNIT[k] ?? SECTIONS.find((sec) => sec.keys.includes(k))?.unit ?? '';
/** The limits in the order the sheet lists them. */
export const LIMIT_ORDER: LimitKey[] = SECTIONS.flatMap((sec) => sec.keys);
const samePair = (a: { watch: number | null; alert: number | null }, b: { watch: number | null; alert: number | null }) => a.watch === b.watch && a.alert === b.alert;

type Text = Record<LimitKey, { watch: string; alert: string }>;
const show = (n: number | null) => (n == null ? '' : String(n));
const toText = (L: HealthLimits): Text => Object.fromEntries((Object.keys(LIMIT_CMP) as LimitKey[]).map((k) => [k, { watch: show(L[k].watch), alert: show(L[k].alert) }])) as Text;
const read = (v: string): number | null | 'bad' => {
  if (!v.trim()) return null;
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) ? n : 'bad';
};

export function LimitsSheet({ open, onClose, member }: { open: boolean; onClose: () => void; member?: Member }) {
  const t = useT();
  const { isPhone } = useDevice();
  const s = useClub();
  const act = useAct();
  const club = limitsOf(s);
  const mem = member ? s.members[member.id] ?? member : undefined; // the live row, so the sheet follows what was saved
  const start = () => toText(mem ? limitsFor(s, mem) : club);
  const [d, setD] = useState<Text>(start);
  const [busy, setBusy] = useState(false);
  useResetOn(open ? 'open' : null, () => setD(start()));

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
  const typed = () => Object.fromEntries(keys.map((k) => [k, { watch: read(d[k].watch), alert: read(d[k].alert) }])) as HealthLimits;
  /** member mode: the lines that differ from the club's are the member's own */
  const ownOf = (L: HealthLimits): Partial<HealthLimits> | null => {
    const own: Partial<HealthLimits> = {};
    for (const k of keys) if (!samePair(L[k], club[k])) own[k] = L[k];
    return Object.keys(own).length ? own : null;
  };
  const isOwn = (k: LimitKey) => { const w = read(d[k].watch), a = read(d[k].alert); return w !== 'bad' && a !== 'bad' && !samePair({ watch: w, alert: a }, club[k]); };
  const dirty = !mem || (ok && JSON.stringify(ownOf(typed()) ?? {}) !== JSON.stringify(mem.limits ?? {}));
  const withOwn = mem ? 0 : live(s.members).filter((x) => ownLimitKeys(x).length).length;

  const save = async () => {
    if (!ok || busy || !dirty) return;
    setBusy(true);
    const L = typed();
    const r = mem
      ? await act('health.setMemberLimits', { memberId: mem.id, limits: ownOf(L) }, { ok: () => t(ownOf(L) ? 'health.limSavedMember' : 'health.limClearedMember', { n: memberShort(mem) }) })
      : await act('health.setLimits', { limits: L }, { ok: () => t('health.limSaved') });
    setBusy(false);
    if (r.ok) onClose();
  };
  const set = (k: LimitKey, f: 'watch' | 'alert', v: string) => setD((x) => ({ ...x, [k]: { ...x[k], [f]: v.replace(/[^0-9.,]/g, '').slice(0, 5) } }));

  return (
    <Sheet open={open} onClose={onClose} title={mem ? t('health.limitsForTitle', { n: memberShort(mem) }) : t('health.limitsTitle')} maxWidth={640}
      footer={(
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'space-between', width: '100%' }}>
          {mem ? <Button variant="ghost" size={44} onClick={() => setD(toText(club))}>{t('health.limResetClub')}</Button>
            : <Button variant="ghost" size={44} onClick={() => setD(toText(DEFAULT_LIMITS))}>{t('health.limReset')}</Button>}
          <Button size={44} icon="check" disabled={!ok || busy || !dirty} onClick={() => void save()}>{t('common.save')}</Button>
        </div>
      )}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: isPhone ? 22 : 18 }}>
        {mem ? <span style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.4, marginBottom: isPhone ? -10 : -6 }}>{t('health.limMemberNote', { n: memberShort(mem) })}</span> : null}
        {withOwn ? <span data-testid="limits-own-count" style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.4, marginBottom: isPhone ? -10 : -6 }}>{t('health.limOwnCount', { n: withOwn })}</span> : null}
        {SECTIONS.map((sec) => (
          <section key={sec.title} style={{ display: 'flex', flexDirection: 'column', gap: isPhone ? 6 : 10 }}>
            {/* round 6, phone: the section title is a small grey header over soft grey boxes (no outlines), like the iOS settings groups */}
            <div style={isPhone ? { ...GROUP_HEAD, padding: '0 4px' } : { ...smallCaps('2px'), color: '#6E5A43' }}>{t(sec.title)}</div>
            {sec.keys.map((k) => {
              const cmp = LIMIT_CMP[k];
              const unit = UNIT[k] ?? sec.unit;
              return (
                <div key={k} data-limit={k} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 12, borderRadius: 12, background: isPhone ? '#F5F5F3' : '#FFFFFF', border: isPhone ? 'none' : '1px solid #E4DACD' }}>
                  <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{t('health.lim.' + k)} <span style={{ color: '#6B6259', fontWeight: 400 }}>· {unit}</span>
                    {mem && isOwn(k) ? <span data-testid="limit-own" style={{ marginLeft: 8, padding: '1px 8px', borderRadius: 999, background: '#F3EEE8', color: '#75624B', fontSize: 12, fontWeight: 500, lineHeight: '18px', verticalAlign: 'middle' }}>{t('health.limOwn')}</span> : null}</span>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ flex: '1 1 0', minWidth: 0 }}><TextField label={t('health.limW.' + cmp)} value={d[k].watch} onChange={(v) => set(k, 'watch', v)} inputMode="decimal" placeholder="—" /></div>
                    <div style={{ flex: '1 1 0', minWidth: 0 }}><TextField label={t('health.limA.' + cmp)} value={d[k].alert} onChange={(v) => set(k, 'alert', v)} inputMode="decimal" placeholder="—" /></div>
                  </div>
                  {errs[k] ? <span role="alert" style={{ fontSize: FONT_BODY, color: '#9A3D24', lineHeight: 1.4 }}>{errs[k]}</span> : null}
                </div>
              );
            })}
          </section>
        ))}
      </div>
    </Sheet>
  );
}
