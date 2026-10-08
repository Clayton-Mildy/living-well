// The reading form: one form with every measurement, one complete measurement is enough, live status against the limits, keypad,
// the kind of check it is saved as, and the input it sends. Plus the PC-303 simulation.
import { describe, it, expect } from 'vitest';
import { DEFAULT_LIMITS, buildSeed, limitsFor } from '@cp/shared';
import { FORM_GROUPS, applyDevice, canSave, effTell, evalDraft, groupFill, groupStatus, kindFor, newDraft, partialGroups, press, toInput, typeText, type Draft } from './form';
import { simulate, GUEST_SIM } from './device';

const fill = (d: Draft, v: Draft['v'], src: Draft['src'] = {}): Draft => ({ ...d, v: { ...d.v, ...v }, src: { ...d.src, ...src } });
const ev = (d: Draft, prev?: number) => evalDraft(d, prev);

describe('one form, one complete measurement', () => {
  it('shows every measurement', () => {
    expect(FORM_GROUPS.map((g) => g.id)).toEqual(['bp', 'vit', 'glu', 'wt']);
  });
  it('blood pressure alone is enough once all three numbers are in; a started measurement must be finished or cleared', () => {
    let d = fill(newDraft(), { sys: '128', dia: '80' });
    expect(groupFill('bp', d, ev(d))).toBe('partial');
    expect(canSave(d, ev(d))).toBe(false);
    d = fill(d, { pulse: '74' });
    expect(canSave(d, ev(d))).toBe(true);
    const half = fill(d, { spo2: '97' });
    expect(partialGroups(half, ev(half))).toEqual(['vit']);
    expect(canSave(half, ev(half))).toBe(false);
    expect(canSave(fill(half, { temp: '36.6' }), ev(fill(half, { temp: '36.6' })))).toBe(true);
    expect(canSave({ ...d, meas: 'bp' }, ev(d))).toBe(false); // still waiting for the device
    expect(canSave(newDraft(), ev(newDraft()))).toBe(false);
  });
  it('glucose alone, or weight without grip, is complete', () => {
    expect(canSave(fill(newDraft(), { glu: '150' }), ev(fill(newDraft(), { glu: '150' })))).toBe(true);
    expect(canSave(fill(newDraft(), { wt: '54.2' }), ev(fill(newDraft(), { wt: '54.2' })))).toBe(true);
    expect(canSave(fill(newDraft(), { grip: '17' }), ev(fill(newDraft(), { grip: '17' })))).toBe(false);
  });
});

describe('the kind of check it is saved as', () => {
  const k = (v: Draft['v'], suggested: Parameters<typeof kindFor>[0]['suggested'], taken: Parameters<typeof kindFor>[0]['taken'] = [], person: 'member' | 'guest' = 'member') => {
    const d = fill(newDraft(), v);
    return kindFor({ suggested, taken, person, d, ev: ev(d) });
  };
  it('follows the station with blood pressure, falls back to a spot check, and glucose or weight alone is the monthly check', () => {
    expect(k({ sys: '128', dia: '80', pulse: '74' }, 'arrival')).toBe('arrival');
    expect(k({ sys: '128', dia: '80', pulse: '74' }, 'arrival', ['arrival'])).toBe('spot');
    expect(k({ sys: '150', dia: '92', pulse: '74' }, 'recheck')).toBe('recheck');
    expect(k({ spo2: '97', temp: '36.6' }, 'arrival')).toBe('spot');
    expect(k({ glu: '150' }, 'arrival')).toBe('monthly');
    expect(k({ glu: '150' }, 'arrival', [], 'guest')).toBe('spot');
  });
});

describe('keypad and typing', () => {
  it('types into the focused field, with the design’s lengths and decimals', () => {
    let d = newDraft();
    for (const k of ['1', '6', '4', '5']) d = press(d, k);
    expect(d.v.sys).toBe('164'); // three digits at most
    d = press(d, 'back');
    expect(d.v.sys).toBe('16');
    d = press({ ...d, field: 'sys' }, '.');
    expect(d.v.sys).toBe('16'); // no decimals in blood pressure
    d = { ...d, field: 'temp' };
    for (const k of ['3', '6', '.', '6', '9']) d = press(d, k);
    expect(d.v.temp).toBe('36.6');
    d = press({ ...d, field: 'wt' }, '5');
    for (const k of ['4', '.', '2', '.', '9']) d = press(d, k);
    expect(d.v.wt).toBe('54.29');
    expect(d.src).toMatchObject({ sys: 'keypad', temp: 'keypad', wt: 'keypad' });
  });
  it('native inputs keep digits and one decimal point only', () => {
    expect(typeText(newDraft(), 'sys', '1a6,4').v.sys).toBe('164'); // letters go, and the comma (a point) is dropped from a whole-number field
    expect(typeText(newDraft(), 'temp', '36,6').v.temp).toBe('36.6');
    expect(typeText(newDraft(), 'wt', '5.4.2kg').v.wt).toBe('5.42');
    expect(typeText(newDraft(), 'pulse', '1234').v.pulse).toBe('123');
  });
});

describe('live status', () => {
  it('Hendra’s 164/98 is an Alert; pulse and oxygen have their own thresholds', () => {
    let d = fill(newDraft(), { sys: '164', dia: '98', pulse: '84', spo2: '96', temp: '36.7' });
    expect(ev(d).st).toEqual({ bp: 'alert', pulse: 'normal', spo2: 'normal', temp: 'normal' });
    expect(ev(d).overall).toBe('alert');
    d = fill(d, { sys: '128', dia: '80', pulse: '112', spo2: '93' });
    expect(ev(d).st).toMatchObject({ bp: 'normal', pulse: 'watch', spo2: 'watch' });
    expect(ev(d).overall).toBe('watch');
    expect(groupStatus('bp', ev(d))).toBe('watch');
    expect(groupStatus('vit', ev(d))).toBe('watch');
  });
  it('weight is judged against the last one; glucose has its own band', () => {
    const d = fill(newDraft(), { glu: '196', wt: '60.2' });
    expect(ev(d, 54.6).st).toEqual({ glu: 'watch', wt: 'watch' });
    expect(ev(d, 59).st.wt).toBe('normal');
    expect(ev(d, undefined).st.wt).toBe('normal');
    expect(groupStatus('glu', ev(d))).toBe('watch');
  });
  it('implausible values and a lower number that is not lower get no status and block saving', () => {
    const bad = fill(newDraft(), { sys: '600', dia: '98', pulse: '84', spo2: '96', temp: '36.7' });
    expect(ev(bad).invalid).toEqual(['sys']);
    expect(ev(bad).st.bp).toBeUndefined();
    expect(canSave(bad, ev(bad))).toBe(false);
    const flip = fill(newDraft(), { sys: '90', dia: '120', pulse: '70', spo2: '96', temp: '36.7' });
    expect(ev(flip).invalid).toEqual(['dia']);
  });
  it('follows the club’s limits', () => {
    const d = fill(newDraft(), { sys: '135', dia: '80', pulse: '74' });
    expect(ev(d).st.bp).toBe('normal');
    const L = { ...DEFAULT_LIMITS, sysHigh: { watch: 130, alert: 150 } };
    expect(evalDraft(d, undefined, L).st.bp).toBe('watch');
    expect(evalDraft(fill(d, { sys: '150' }), undefined, L).st.bp).toBe('alert');
    expect(evalDraft(fill(newDraft(), { spo2: '96', temp: '36.6' }), undefined, { ...DEFAULT_LIMITS, spo2Low: { watch: null, alert: 90 } }).st.spo2).toBe('normal');
  });
});

describe('a member’s own limits', () => {
  it('the form grades with them (Opa Hendra: Watch from 135), and with the club’s for everyone else', () => {
    const s = buildSeed().citra;
    const d = fill(newDraft(), { sys: '138', dia: '80', pulse: '74' });
    expect(evalDraft(d, undefined, limitsFor(s, 'm2')).st.bp).toBe('watch');
    expect(evalDraft(d, undefined, limitsFor(s, 'm20')).st.bp).toBe('normal');
    expect(evalDraft(fill(d, { sys: '156' }), undefined, limitsFor(s, 'm2')).st.bp).toBe('alert'); // his Alert is 155, the club's 160
  });
});

describe('saving', () => {
  const vitals = { sys: '128', dia: '80', pulse: '74', spo2: '97', temp: '36.6' };
  it('builds the action input: numbers, notes, flags and where the values came from', () => {
    let d = fill(newDraft(), vitals, { sys: 'device', dia: 'device', pulse: 'device', spo2: 'device', temp: 'device' });
    d = { ...d, notes: ['rested'], note: ' sat first ', share: true };
    const base = { personId: 'm2', person: 'member' as const, kind: 'arrival' as const, canTell: true };
    const a = toInput({ ...base, d, ev: ev(d) });
    expect(a).toEqual({ sys: 128, dia: 80, pulse: 74, spo2: 97, temp: 36.6, memberId: 'm2', kind: 'arrival', noteKeys: ['rested'], note: 'sat first', shared: true, tellFamily: false, recheck: false, deferMonthly: false, source: 'device' });
    // typed monthly values make it "mixed"; a flagged result turns on telling the family, and the re-check for an Alert
    const hi = fill(d, { sys: '164', dia: '98', glu: '150' }, { sys: 'keypad', glu: 'keypad' });
    const b = toInput({ ...base, d: hi, ev: ev(hi) });
    expect(b).toMatchObject({ sys: 164, dia: 98, glucose: 150, source: 'mixed', tellFamily: true, recheck: false }); // no re-check reminder any more
    expect(b.weight).toBeUndefined();
    // the nurse can switch them off, and nobody to tell means nothing is sent
    const off = { ...hi, tell: false };
    expect(toInput({ ...base, d: off, ev: ev(off) })).toMatchObject({ tellFamily: false, recheck: false });
    expect(toInput({ ...base, canTell: false, d: hi, ev: ev(hi) }).tellFamily).toBe(false);
    expect(effTell(hi, ev(hi))).toBe(true);
  });
  it('a guest is sent by guestId; typed-only values are "keypad"', () => {
    const g = toInput({ personId: 'g-e1', person: 'guest', kind: 'arrival', d: fill(newDraft(), vitals), ev: ev(fill(newDraft(), vitals)), canTell: false });
    expect(g).toMatchObject({ guestId: 'g-e1', kind: 'arrival', source: 'keypad', deferMonthly: false });
    expect(g.memberId).toBeUndefined();
  });
  it('values from the device are marked as device values', () => {
    const d = applyDevice(newDraft(), { sys: '164', dia: '98', pulse: '84' });
    expect(d.src).toEqual({ sys: 'device', dia: 'device', pulse: 'device' });
    expect(press({ ...d, field: 'sys' }, 'back').src.sys).toBe('keypad');
  });
});

describe('PC-303 simulation', () => {
  const hendra = { sys: 146, dia: 90, pulse: 78, spo2: 96, glucose: 132, weight: 68.4, temp: 36.7, grip: 17, script: { arrival: { sys: 164, dia: 98, pulse: 84 }, recheck: { sys: 152, dia: 92, pulse: 78 } } };
  const lina = { sys: 128, dia: 80, pulse: 74, spo2: 97, glucose: 118, weight: 54, temp: 36.6, grip: 17, script: { demoHigh: { sys: 152, dia: 94, pulse: 82 } } };
  it('replays the script: Hendra’s arrival is 164/98 and his re-check 152/92, every time', () => {
    for (const rand of [() => 0, () => 0.99]) {
      expect(simulate('bp', hendra, { type: 'arrival', rand })).toEqual({ sys: '164', dia: '98', pulse: '84' });
      expect(simulate('bp', hendra, { type: 'recheck', rand })).toEqual({ sys: '152', dia: '92', pulse: '78' });
    }
  });
  it('is random around the baseline when nothing is scripted, within the design’s spread', () => {
    const lo = simulate('bp', hendra, { type: 'departure', rand: () => 0 });
    const hi = simulate('bp', hendra, { type: 'departure', rand: () => 1 });
    expect([lo.sys, lo.dia, lo.pulse]).toEqual(['142', '87', '74']);
    expect([hi.sys, hi.dia, hi.pulse]).toEqual(['150', '93', '82']);
    expect(simulate('vit', lina, { type: 'arrival', rand: () => 0 })).toEqual({ spo2: '96', temp: '36.4' });
    expect(simulate('vit', lina, { type: 'arrival', rand: () => 1 })).toEqual({ spo2: '98', temp: '36.8' });
    expect(simulate('glu', hendra, { type: 'monthly', rand: () => 0.5 })).toEqual({ glu: '132' });
  });
  it('the guided demo: Lina’s high BP (152/94, pulse 82) with her normal oxygen, temperature and glucose, exactly', () => {
    const o = { type: 'arrival' as const, demoHigh: true, exact: true };
    expect(simulate('bp', lina, o)).toEqual({ sys: '152', dia: '94', pulse: '82' });
    expect(simulate('vit', lina, o)).toEqual({ spo2: '97', temp: '36.6' });
    expect(simulate('glu', lina, o)).toEqual({ glu: '118' });
    expect(simulate('bp', lina, { type: 'arrival', exact: true })).toEqual({ sys: '128', dia: '80', pulse: '74' });
  });
  it('a trial guest has a baseline too', () => {
    expect(simulate('bp', GUEST_SIM, { type: 'arrival', exact: true })).toEqual({ sys: '132', dia: '80', pulse: '74' });
  });
});
