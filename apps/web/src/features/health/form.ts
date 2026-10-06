// The reading form as plain data: every measurement on one form, when it can be saved (one complete measurement), the live status of
// what has been typed against the club's Watch / Alert limits, the kind of check it is saved as, and the `reading.save` input. Pure functions so the station can be tested without a browser.
import { DEFAULT_LIMITS, bpStatus, gluStatus, pulseStatus, spo2Status, tempStatus, weightStatus, worst, type Health, type HealthLimits, type QueueKind, type QuickNote } from '@cp/shared';
import { inRange, type ReadingField } from '@cp/shared/rules/healthStation';
import type { ReadingSaveInput } from '@cp/shared/actions/health';
import type { DeviceKind } from './device';

export type FieldKey = 'sys' | 'dia' | 'pulse' | 'spo2' | 'temp' | 'glu' | 'wt' | 'grip';
export type GroupId = 'bp' | 'vit' | 'glu' | 'wt';
export type PersonKind = 'member' | 'guest';

/** `rf` is the reading field it is saved as; `key` is the i18n label (SpO₂ is the same in every language). */
export const FIELD: Record<FieldKey, { rf: ReadingField; key?: string; label?: string; unit: string; len: number; decimal: boolean }> = {
  sys: { rf: 'sys', key: 'health.systolic', unit: 'mmHg', len: 3, decimal: false },
  dia: { rf: 'dia', key: 'health.diastolic', unit: 'mmHg', len: 3, decimal: false },
  pulse: { rf: 'pulse', key: 'health.pulse', unit: 'bpm', len: 3, decimal: false },
  spo2: { rf: 'spo2', label: 'SpO₂', unit: '%', len: 3, decimal: false },
  temp: { rf: 'temp', key: 'health.temp', unit: '°C', len: 4, decimal: true },
  glu: { rf: 'glucose', key: 'health.glucose', unit: 'mg/dL', len: 3, decimal: false },
  wt: { rf: 'weight', key: 'health.weight', unit: 'kg', len: 5, decimal: true },
  grip: { rf: 'grip', key: 'health.grip', unit: 'kg', len: 4, decimal: true },
};
export interface GroupDef { id: GroupId; icon: string; titleKey: string; fields: FieldKey[]; device: DeviceKind | null; monthly: boolean }
export const GROUPS: Record<GroupId, GroupDef> = {
  bp: { id: 'bp', icon: 'monitor_heart', titleKey: 'health.bp', fields: ['sys', 'dia', 'pulse'], device: 'bp', monthly: false },
  vit: { id: 'vit', icon: 'air', titleKey: 'health.vitals', fields: ['spo2', 'temp'], device: 'vit', monthly: false },
  glu: { id: 'glu', icon: 'water_drop', titleKey: 'health.gluMonthly', fields: ['glu'], device: 'glu', monthly: true },
  wt: { id: 'wt', icon: 'scale', titleKey: 'health.wtGrip', fields: ['wt', 'grip'], device: null, monthly: true },
};
export const MONTHLY_KEYS: FieldKey[] = ['glu', 'wt', 'grip'];

/** The form shows every measurement; none is required on its own. */
export const FORM_GROUPS: GroupDef[] = [GROUPS.bp, GROUPS.vit, GROUPS.glu, GROUPS.wt];
export const ALL_FIELDS: FieldKey[] = FORM_GROUPS.flatMap((g) => g.fields);
/** What makes one measurement complete (grip is optional with the weight). */
export const NEEDED: Record<GroupId, FieldKey[]> = { bp: ['sys', 'dia', 'pulse'], vit: ['spo2', 'temp'], glu: ['glu'], wt: ['wt'] };

export interface Draft {
  v: Partial<Record<FieldKey, string>>;
  src: Partial<Record<FieldKey, 'device' | 'keypad'>>;
  field: FieldKey; // the keypad types into this field
  meas: DeviceKind | null; // waiting for the (demo) device
  notes: QuickNote[];
  note: string;
  share: boolean;
  tell: boolean | null; // null = the default (on when the result is flagged)
}
export const newDraft = (): Draft => ({ v: {}, src: {}, field: 'sys', meas: null, notes: [], note: '', share: false, tell: null });
export const hasValues = (d: Draft) => Object.values(d.v).some((x) => (x ?? '') !== '');

/** Keypad press (design `press`): digits up to the field's length, one decimal point where decimals make sense, backspace. */
export function press(d: Draft, k: string): Draft {
  const f = d.field;
  let v = d.v[f] ?? '';
  if (k === 'back') v = v.slice(0, -1);
  else if (k === '.') { if (FIELD[f].decimal && !v.includes('.')) v += '.'; }
  else if (v.length < FIELD[f].len) v += k;
  return { ...d, v: { ...d.v, [f]: v }, src: { ...d.src, [f]: 'keypad' } };
}
/** Typing into a native input (phone): digits and one decimal point. */
export function typeText(d: Draft, f: FieldKey, raw: string): Draft {
  let v = raw.replace(',', '.').replace(/[^0-9.]/g, '');
  if (!FIELD[f].decimal) v = v.replace(/\./g, '');
  const i = v.indexOf('.');
  if (i >= 0) v = v.slice(0, i + 1) + v.slice(i + 1).replace(/\./g, '');
  return { ...d, field: f, v: { ...d.v, [f]: v.slice(0, FIELD[f].len) }, src: { ...d.src, [f]: 'keypad' } };
}
/** Values from the (demo) device. */
export function applyDevice(d: Draft, vals: Partial<Record<FieldKey, string>>): Draft {
  const src = { ...d.src };
  for (const k of Object.keys(vals)) src[k as FieldKey] = 'device';
  return { ...d, v: { ...d.v, ...vals }, src };
}

export interface Eval {
  st: Partial<Record<'bp' | 'pulse' | 'spo2' | 'temp' | 'glu' | 'wt', Health>>;
  invalid: FieldKey[]; // typed, but not a plausible number
  overall: Health | null;
}
const num = (v: string | undefined) => (v === undefined || v === '' ? null : Number(v));
/** Live status of what has been typed (design `evalDraft`, plus pulse). Implausible numbers get no status; they are listed as invalid. */
export function evalDraft(d: Draft, prevWeight?: number, L: HealthLimits = DEFAULT_LIMITS): Eval {
  const invalid: FieldKey[] = [];
  const val = (k: FieldKey) => {
    const n = num(d.v[k]);
    if (n === null) return null;
    if (!inRange(FIELD[k].rf, n)) { invalid.push(k); return null; }
    return n;
  };
  const sys = val('sys'), dia = val('dia'), pulse = val('pulse'), spo2 = val('spo2'), temp = val('temp'), glu = val('glu'), wt = val('wt');
  val('grip');
  const st: Eval['st'] = {};
  if (sys !== null && dia !== null) { if (dia >= sys) { invalid.push('dia'); } else st.bp = bpStatus(sys, dia, L); }
  if (pulse !== null) st.pulse = pulseStatus(pulse, L);
  if (spo2 !== null) st.spo2 = spo2Status(spo2, L);
  if (temp !== null) st.temp = tempStatus(temp, L);
  if (glu !== null) st.glu = gluStatus(glu, L);
  if (wt !== null) st.wt = weightStatus(wt, prevWeight, L);
  const all = Object.values(st);
  return { st, invalid: Array.from(new Set(invalid)), overall: all.length ? worst(all) : null };
}
export const groupStatus = (g: GroupId, ev: Eval): Health | null =>
  g === 'bp' ? (ev.st.bp || ev.st.pulse ? worst([ev.st.bp, ev.st.pulse].filter(Boolean) as Health[]) : null)
    : g === 'vit' ? (ev.st.spo2 || ev.st.temp ? worst([ev.st.spo2, ev.st.temp].filter(Boolean) as Health[]) : null)
      : g === 'glu' ? ev.st.glu ?? null : ev.st.wt ?? null;

const filled = (d: Draft, ev: Eval, k: FieldKey) => (d.v[k] ?? '') !== '' && !ev.invalid.includes(k);
export type GroupFill = 'empty' | 'partial' | 'complete';
export function groupFill(g: GroupId, d: Draft, ev: Eval): GroupFill {
  if (!GROUPS[g].fields.some((k) => (d.v[k] ?? '') !== '')) return 'empty';
  return NEEDED[g].every((k) => filled(d, ev, k)) ? 'complete' : 'partial';
}
/** Started but not finished (for the footer's "Finish or clear: …"). */
export const partialGroups = (d: Draft, ev: Eval): GroupId[] => FORM_GROUPS.filter((g) => groupFill(g.id, d, ev) === 'partial').map((g) => g.id);
/** One complete measurement is enough to save; a started one must be finished or cleared. */
export function canSave(d: Draft, ev: Eval): boolean {
  if (d.meas || ev.invalid.length) return false;
  return FORM_GROUPS.some((g) => groupFill(g.id, d, ev) === 'complete') && !partialGroups(d, ev).length;
}
/**
 * What the reading is saved as (the form no longer asks): with blood pressure, the check the station suggests (arrival, re-check,
 * departure), or a spot check when that one is already saved today; oxygen or temperature without blood pressure is a spot check;
 * glucose or weight alone is the monthly check (a spot check for a guest).
 */
export function kindFor(o: { suggested: QueueKind; taken: QueueKind[]; person: PersonKind; d: Draft; ev: Eval }): QueueKind {
  const has = (k: FieldKey) => filled(o.d, o.ev, k);
  if (!(['sys', 'dia', 'pulse', 'spo2', 'temp'] as FieldKey[]).some(has)) return o.person === 'guest' ? 'spot' : 'monthly';
  if (!has('sys') || o.suggested === 'monthly') return 'spot';
  if ((o.suggested === 'arrival' || o.suggested === 'departure') && o.taken.includes(o.suggested)) return 'spot';
  return o.suggested;
}

/** Tell the family: on by default when the result is flagged. (There is no re-check reminder any more: nothing is "due".) */
export const flagged = (ev: Eval) => !!ev.overall && ev.overall !== 'normal';
export const effTell = (d: Draft, ev: Eval) => (flagged(ev) ? d.tell ?? true : false);

/** The `reading.save` input for what is on the form. */
export function toInput(o: { personId: string; person: PersonKind; kind: QueueKind; d: Draft; ev: Eval; canTell: boolean }): ReadingSaveInput {
  const { d, ev } = o;
  const used = ALL_FIELDS.filter((k) => filled(d, ev, k));
  const values: Partial<Record<ReadingField, number>> = {};
  for (const k of used) values[FIELD[k].rf] = Number(d.v[k]);
  const fromDevice = used.filter((k) => d.src[k] === 'device').length;
  const source: ReadingSaveInput['source'] = !used.length || fromDevice === 0 ? 'keypad' : fromDevice === used.length ? 'device' : 'mixed';
  const note = d.note.trim();
  return {
    ...values,
    ...(o.person === 'member' ? { memberId: o.personId } : { guestId: o.personId }),
    kind: o.kind,
    noteKeys: d.notes,
    ...(note ? { note } : {}),
    shared: d.share,
    tellFamily: o.canTell && effTell(d, ev),
    recheck: false,
    deferMonthly: false,
    source,
  };
}
