// Guided-demo runtime: sign in as a demo user, wait for their data, act, move the shared clock, navigate.
import { api } from '../../lib/api';
import { useSession, signInDemo } from '../../store/session';
import { useReplica } from '../../store/replica';
import { routerRef } from '../../app/routerRef';
import { say } from '../../store/ui';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function waitFor(cond: () => boolean, ms = 8000) {
  const t0 = Date.now();
  while (!cond()) { if (Date.now() - t0 > ms) throw new Error('demo: timed out'); await sleep(60); }
}
export const demo = {
  sleep,
  async signInAs(userId: string) {
    if (useSession.getState().user?.id === userId && useReplica.getState().userId === userId && useReplica.getState().status === 'ready') return;
    await signInDemo(userId);
    await waitFor(() => useReplica.getState().userId === userId && useReplica.getState().status === 'ready');
  },
  async act(name: string, input: unknown, ok?: string) {
    const r = await useReplica.getState().act(name, input);
    if (!r.ok) { say(r.code, { tone: 'error', icon: 'error' }); return null; }
    if (ok) say(ok);
    return r.result;
  },
  async setClock(hm: string) {
    await api('/api/demo/clock', { body: { hm } });
    await waitFor(() => { const c = useReplica.getState().clock; return !!c && c.startMin >= +hm.slice(0, 2) * 60 + +hm.slice(3); }, 3000).catch(() => {});
  },
  go(path: string) { routerRef.navigate(path); },
  state() { return useReplica.getState().view; },
};
