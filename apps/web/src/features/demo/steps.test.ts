// The guided demo's "log" step signs in as the activity teacher and saves Oma Lina's log; since round 14 the server refuses a lunch value from the teacher
// (lunch is the F&B team's), so the step must not send one and its action must succeed as s5.
import { describe, expect, it, vi } from 'vitest';
import { buildSeed, execute, getUser } from '@cp/shared';
import { useReplica } from '../../store/replica';

const calls: { name: string; input: unknown; as: string }[] = [];
let as = '';
vi.mock('./runner', () => ({
  demo: {
    state: () => ({ attendance: { '2026-10-21:m1': { checkIn: { at: '10:00' } } } }),
    setClock: async () => {}, signInAs: async (id: string) => { as = id; }, go: () => {}, sleep: async () => {},
    act: async (name: string, input: unknown) => { calls.push({ name, input, as }); return null; },
  },
}));

describe('demo steps', () => {
  it('the log step saves Oma Lina’s log as s5 without a lunch value, and the server accepts it', async () => {
    useReplica.setState({ clock: { today: '2026-10-21', startMin: 795, realStart: Date.now(), offset: 0 } });
    const { DEMO_STEPS } = await import('./steps');
    await DEMO_STEPS.find((x) => x.id === 'log')!.run();
    const save = calls.find((c) => c.name === 'log.save')!;
    expect(save.as).toBe('s5');
    expect(save.input).not.toHaveProperty('lunch');
    // the same call against the seed (Oma Lina checked in first)
    let s = buildSeed().citra;
    const clk = { today: '2026-10-21', nowMin: 795 };
    const user = (id: string) => getUser({ [s.clubId]: s }, id)!;
    s = execute(s, 'attendance.checkIn', { memberId: 'm1', method: 'face' }, user('s1'), clk, 'c1').state;
    const r = execute(s, 'log.save', save.input, user('s5'), clk, 'c2');
    expect(r.result.logId).toBe('log-m1-2026-10-21');
  });
});
