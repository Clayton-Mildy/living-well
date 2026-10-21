// Round 8: the family Health tab and history use these to grade, plot and pick a range.
import { describe, expect, it } from 'vitest';
import { buildSeed, projectForFamily } from '../index';
import { DEFAULT_LIMITS, limitsFor } from './health';
import { DAY_METRICS, averageText, bandOf, bpHero, dayChecks, familyReadings, heroBars, latestOf, latestReadings, metricRows, metricsWithData, metricText, monthCells, pickDay, quickRanges, worstCheck } from './famHealth';
import type { Reading } from '../types';

const rd = (o: Partial<Reading>): Reading => ({ id: 'r' + Math.random(), memberId: 'm1', date: '2026-10-01', time: '10:00', kind: 'arrival', status: 'normal', takenBy: 's6', source: 'device', noteKeys: [], shared: true, edits: [], ...o } as Reading);

describe('family health selectors', () => {
  const L = DEFAULT_LIMITS;
  it('texts and grades each measurement; weight only shows a change', () => {
    const rs = [rd({ sys: 124, dia: 76, pulse: 76, spo2: 97, temp: 36.4, date: '2026-10-05' }), rd({ glucose: 98, weight: 54.8, kind: 'monthly', date: '2026-10-05', time: '11:00' }), rd({ weight: 59, kind: 'monthly', date: '2026-11-05' })];
    expect(metricText(rs[0], 'bp')).toBe('124/76');
    expect(metricText(rs[0], 'temp')).toBe('36.4');
    expect(metricsWithData(rs)).toEqual(['bp', 'pulse', 'spo2', 'temp', 'glucose', 'weight']);
    expect(latestOf(rs, 'weight')?.weight).toBe(59);
    const w = metricRows(rs, 'weight', L);
    expect(w.map((x) => x.text)).toEqual(['54.8', '59.0']);
    expect(w.map((x) => x.status)).toEqual([null, 'watch']); // 4.2 kg more than last month passes the 3 kg line
    expect(metricRows(rs, 'bp', L)[0]).toMatchObject({ value: 124, low: 76, status: 'normal' });
  });
  it('grades against the member’s own limits', () => {
    const r = rd({ sys: 145, dia: 85 });
    expect(bpHero([r], L)?.status).toBe('watch');
    const own = { ...L, sysHigh: { watch: 150, alert: 170 } };
    expect(bpHero([r], own)?.status).toBe('normal');
    expect(bandOf('bp', own)).toEqual({ from: 100, to: 149 });
    expect(bandOf('weight', L)).toBeUndefined();
    expect(bandOf('pulse', L)).toEqual({ from: 60, to: 100 });
  });
  it('averages and draws the bars', () => {
    const rows = metricRows([rd({ sys: 120, dia: 80 }), rd({ sys: 130, dia: 70, date: '2026-10-02' })], 'bp', L);
    expect(averageText(rows, 'bp')).toBe('125/75');
    expect(averageText([], 'bp')).toBe('');
    expect(heroBars([rd({ sys: 120, dia: 80 })])).toEqual([]);
    const bars = heroBars(Array.from({ length: 20 }, (_, i) => rd({ sys: 110 + i, dia: 70, date: `2026-10-${String(i + 1).padStart(2, '0')}` })));
    expect(bars).toHaveLength(14);
    expect(Math.min(...bars)).toBeGreaterThanOrEqual(28);
    expect(Math.max(...bars)).toBe(100);
  });
  it('a family projection only holds readings the family may see, graded by the member’s limits', () => {
    const full = buildSeed().citra;
    const v = projectForFamily(full, 'f1');
    const rs = familyReadings(v, 'm1');
    expect(rs.length).toBeGreaterThan(20);
    expect(rs.every((r) => r.memberId === 'm1')).toBe(true);
    const sorted = rs.map((r) => r.date + r.time);
    expect(sorted).toEqual([...sorted].sort());
    expect(bpHero(rs, limitsFor(v, 'm1'))).toBeTruthy();
  });
});

describe('date-range picker', () => {
  it('a month starts on its weekday, Monday first', () => {
    const c = monthCells('2026-10'); // 1 Oct 2026 is a Thursday
    expect(c.slice(0, 4)).toEqual([null, null, null, 1]);
    expect(c.filter((x) => x !== null)).toHaveLength(31);
  });
  it('From then To; an earlier To swaps them; a new From keeps a later To', () => {
    let st = pickDay({ from: null, to: null, pick: 'from' }, '2026-10-05');
    expect(st).toEqual({ from: '2026-10-05', to: null, pick: 'to' });
    st = pickDay(st, '2026-10-12');
    expect(st).toEqual({ from: '2026-10-05', to: '2026-10-12', pick: 'from' });
    expect(pickDay(st, '2026-10-08')).toEqual({ from: '2026-10-08', to: '2026-10-12', pick: 'to' });
    expect(pickDay(st, '2026-10-20')).toEqual({ from: '2026-10-20', to: null, pick: 'to' });
    expect(pickDay({ from: '2026-10-10', to: null, pick: 'to' }, '2026-10-02')).toEqual({ from: '2026-10-02', to: '2026-10-10', pick: 'from' });
  });
  it('shortcuts: this month, last month, two weeks, and since the first reading when it is older', () => {
    const q = quickRanges('2026-10-13', '2026-03-03');
    expect(q.map((x) => x.key)).toEqual(['thisMonth', 'lastMonth', 'twoWeeks', 'since']);
    expect(q[0]).toMatchObject({ from: '2026-10-01', to: '2026-10-13' });
    expect(q[1]).toMatchObject({ from: '2026-09-01', to: '2026-09-30' });
    expect(q[2]).toMatchObject({ from: '2026-09-29', to: '2026-10-13' });
    expect(q[3]).toMatchObject({ from: '2026-03-01', month: '2026-03' });
    expect(quickRanges('2026-10-13', '2026-09-20').map((x) => x.key)).not.toContain('since');
  });
});

describe('latestReadings (the desktop list)', () => {
  const L = DEFAULT_LIMITS;
  it('newest first, everything a reading carries in chip order, the worst grade of its parts', () => {
    const rs = [
      rd({ sys: 120, dia: 78, pulse: 70, date: '2026-10-01' }),
      rd({ glucose: 98, weight: 54.8, kind: 'monthly', date: '2026-10-02', time: '11:00' }),
      rd({ sys: 150, dia: 92, pulse: 72, spo2: 97, date: '2026-10-03' }),
      rd({ weight: 59, grip: 20, kind: 'monthly', date: '2026-11-05' }),
    ];
    const out = latestReadings(rs, L, 3);
    expect(out.map((x) => x.r.date)).toEqual(['2026-11-05', '2026-10-03', '2026-10-02']);
    expect(out[1].parts.map((p) => p.metric)).toEqual(['bp', 'pulse', 'spo2']);
    expect(out[1].parts[0]).toMatchObject({ text: '150/92' });
    expect(out[1].status).not.toBe('normal'); // the blood pressure is out of range, the pulse is fine
    expect(out[0].parts.map((p) => p.metric)).toEqual(['weight', 'grip']);
    expect(out[0].parts[0].status).toBe('watch'); // 4.2 kg up on 54.8
    expect(out[2].status).toBe('normal');
    expect(latestReadings(rs, L)).toHaveLength(4);
    expect(latestReadings([], L)).toEqual([]);
  });
});

describe('dayChecks (Today’s Health section)', () => {
  const L = DEFAULT_LIMITS;
  const state = (rs: Reading[]) => ({ readings: rs, club: { settings: { limits: {} } } }) as never;
  it('the day’s checks in time order, each measurement in the family’s order (blood pressure, oxygen, temperature, pulse), graded', () => {
    const rs = [
      rd({ sys: 150, dia: 90, pulse: 80, spo2: 97, temp: 36.5, date: '2026-10-12', time: '10:20' }),
      rd({ sys: 120, dia: 80, pulse: 72, kind: 'departure', date: '2026-10-12', time: '15:50' }),
      rd({ sys: 118, dia: 76, date: '2026-10-09', time: '10:00' }),
    ];
    const checks = dayChecks(state(rs), 'm1', '2026-10-12', L);
    expect(checks.map((c) => [c.kind, c.time])).toEqual([['arrival', '10:20'], ['departure', '15:50']]);
    expect(checks[0].parts.map((p) => p.metric)).toEqual(['bp', 'spo2', 'temp', 'pulse']);
    expect(checks[0].parts.map((p) => p.text)).toEqual(['150/90', '97', '36.5', '80']);
    expect(checks[0].status).toBe('watch'); // 150 is past the club's watch line
    expect(checks[1].parts.map((p) => p.metric)).toEqual(['bp', 'pulse']); // only what was measured
    expect(checks[1].status).toBe('normal');
    expect(checks[0].by).toBe('s6');
    expect(worstCheck(checks)).toBe('watch');
    expect(DAY_METRICS.slice(0, 4)).toEqual(['bp', 'spo2', 'temp', 'pulse']);
  });
  it('no check that day is an empty list; a reading that waits for approval, or was removed, is not there', () => {
    const waiting = rd({ sys: 118, dia: 76, date: '2026-10-13', approval: { status: 'pending', by: 'staff:s6', at: '2026-10-13T10:00' } as never });
    const voided = rd({ sys: 120, dia: 80, date: '2026-10-13', voided: { at: '2026-10-13T10:05', by: 's1', reason: 'duplicate' } as never });
    expect(dayChecks(state([waiting, voided]), 'm1', '2026-10-13', L)).toEqual([]);
    expect(dayChecks(state([]), 'm1', '2026-10-13', L)).toEqual([]);
    expect(worstCheck([])).toBeNull();
  });
  it('the seed: a family sees the approved checks of a visit day, for the right member only', () => {
    const v = projectForFamily(buildSeed().citra, 'f1');
    const day = familyReadings(v, 'm1').pop()!.date;
    const checks = dayChecks(v, 'm1', day, limitsFor(v, 'm1'));
    expect(checks.length).toBeGreaterThan(0);
    expect(checks.every((c) => c.parts.length > 0)).toBe(true);
    const times = checks.map((c) => c.time);
    expect(times).toEqual([...times].sort());
    expect(dayChecks(v, 'm1', '2026-01-03', limitsFor(v, 'm1'))).toEqual([]);
  });
});
