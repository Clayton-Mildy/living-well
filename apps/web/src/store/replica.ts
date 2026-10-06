// Client replica of the club state: snapshot + live patches (SSE) + optimistic actions reconciled by mutation id.
import { create } from 'zustand';
import { applyPatches } from 'immer';
import { execute, getUser, DomainError, type ClubState, type Patch, type User } from '@cp/shared';
import { api, apiToken, ApiError } from '../lib/api';

export interface ClockAnchor { today: string; startMin: number; realStart: number; offset: number }
interface Pending { mutationId: string; name: string; input: unknown }
interface ReplicaState {
  club: string | null;
  userId: string | null;
  confirmed: ClubState | null;
  view: ClubState | null;
  rev: number;
  pending: Pending[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  connected: boolean;
  clock: ClockAnchor | null;
  /** the signed-in user as the server resolved them (across clubhouses) */
  self: User | null;
  load(club: string, userId: string): Promise<void>;
  stop(): void;
  act(name: string, input: unknown): Promise<ActResult>;
}
export type ActResult = { ok: true; result: Record<string, unknown>; reviewed?: 'gate' | 'flag' } | { ok: false; code: string; params: Record<string, string | number> };

let es: EventSource | null = null;
let refetchT: ReturnType<typeof setTimeout> | undefined;
let seq = 0;

export const clockNow = (c: ClockAnchor | null) => {
  if (!c) return { today: '2026-10-21', nowMin: 598 };
  return { today: c.today, nowMin: Math.min(23 * 60 + 59, c.startMin + Math.floor((Date.now() + c.offset - c.realStart) / 60000)) };
};
const isFamilyUser = (s: ClubState | null, userId: string | null) => !!(s && userId && s.familyContacts[userId] && !s.staff[userId]);

/** The user for actions on `s`: their row in that clubhouse, else the server-resolved user (managers viewing another clubhouse). */
export const userIn = (s: ClubState, userId: string | null, self: User | null): User | null =>
  userId ? getUser({ [s.clubId]: s }, userId) || (self?.id === userId ? self : null) : null;

export const useReplica = create<ReplicaState>((set, get) => {
  const rebuild = (confirmed: ClubState, pending: Pending[]) => {
    let view = confirmed;
    const user = userIn(confirmed, get().userId, get().self);
    const keep: Pending[] = [];
    for (const p of pending) {
      if (!user) break;
      try { view = execute(view, p.name, p.input, user, clockNow(get().clock), p.mutationId).state; keep.push(p); }
      catch { /* dropped: no longer valid on the confirmed state */ }
    }
    return { view, pending: keep };
  };
  const snapshot = async () => {
    const { club, userId } = get();
    if (!club || !userId) return;
    const r = await api<{ rev: number; state: ClubState; clock: { today: string; startMin: number; realStart: number }; serverTime: number; self?: User }>(`/api/snapshot?club=${club}`);
    const offset = r.serverTime - Date.now();
    set({ clock: { today: r.clock.today, startMin: r.clock.startMin, realStart: r.clock.realStart, offset }, self: r.self || null });
    const { view, pending } = rebuild(r.state, isFamilyUser(r.state, userId) ? [] : get().pending);
    set({ confirmed: r.state, rev: r.rev, view, pending, status: 'ready' });
  };
  const applyServer = (rev: number, mutationId: string, patches: Patch[]) => {
    const { confirmed, rev: cur } = get();
    if (!confirmed) return;
    if (rev <= cur) return; // already applied (response + SSE both deliver it)
    if (rev !== cur + 1) { void snapshot(); return; }
    const next = { ...(applyPatches(confirmed, patches) as ClubState), rev };
    const { view, pending } = rebuild(next, get().pending.filter((p) => p.mutationId !== mutationId));
    set({ confirmed: next, rev, view, pending });
  };
  const connect = () => {
    const { club, userId } = get();
    es?.close();
    const token = apiToken();
    if (!club || !userId || !token) return;
    es = new EventSource(`/api/events?club=${club}&token=${encodeURIComponent(token)}`); // EventSource cannot set headers
    es.addEventListener('hello', (ev) => {
      set({ connected: true });
      const d = JSON.parse((ev as MessageEvent).data);
      if (d.rev !== get().rev) void snapshot();
    });
    es.addEventListener('patch', (ev) => {
      const d = JSON.parse((ev as MessageEvent).data);
      applyServer(d.rev, d.mutationId, d.patches);
    });
    es.addEventListener('changed', () => {
      clearTimeout(refetchT);
      refetchT = setTimeout(() => void snapshot(), 250);
    });
    es.addEventListener('reset', () => { set({ pending: [] }); void snapshot(); });
    es.addEventListener('clock', (ev) => {
      const d = JSON.parse((ev as MessageEvent).data).clock;
      set({ clock: { today: d.today, startMin: d.startMin, realStart: d.realStart, offset: get().clock?.offset || 0 } });
    });
    es.onerror = () => set({ connected: false });
  };
  return {
    club: null, userId: null, confirmed: null, view: null, rev: 0, pending: [], status: 'idle', connected: false, clock: null, self: null,
    async load(club, userId) {
      set({ club, userId, status: 'loading', pending: [] });
      // retry with backoff: the API may be restarting (dev) or the tunnel briefly unavailable
      const waits = [0, 300, 700, 1200, 2000, 3000, 4000];
      for (const w of waits) {
        if (w) await new Promise((r) => setTimeout(r, w));
        if (get().club !== club || get().userId !== userId) return; // superseded by another load
        try { await snapshot(); connect(); return; } catch (e) {
          if (e instanceof ApiError && (e.status === 401 || e.status === 403)) break;
        }
      }
      set({ status: 'error' });
    },
    stop() { es?.close(); es = null; set({ club: null, userId: null, confirmed: null, view: null, rev: 0, pending: [], status: 'idle', connected: false, self: null }); },
    async act(name, input) {
      const { view, userId, club } = get();
      if (!view || !userId || !club) return { ok: false, code: 'err.network', params: {} };
      const user = userIn(view, userId, get().self);
      if (!user) return { ok: false, code: 'err.forbidden', params: {} };
      const mutationId = `${userId}-${Date.now().toString(36)}-${(++seq).toString(36)}`;
      let optimistic: { reviewed?: 'gate' | 'flag'; result: Record<string, unknown> } | null = null;
      try {
        const r = execute(view, name, input, user, clockNow(get().clock), mutationId);
        optimistic = { reviewed: r.reviewed, result: r.result };
        set({ view: r.state, pending: [...get().pending, { mutationId, name, input }] });
      } catch (e) {
        if (e instanceof DomainError) return { ok: false, code: e.code, params: e.params };
        // unexpected client-side error: still try the server
      }
      try {
        const r = await api<{ rev: number; patches?: Patch[]; result: Record<string, unknown>; reviewed?: 'gate' | 'flag' }>(`/api/actions/${name}`, { body: { mutationId, club, input } });
        if (r.patches) applyServer(r.rev, mutationId, r.patches);
        else { // family: projection refetch
          set({ pending: get().pending.filter((p) => p.mutationId !== mutationId) });
          clearTimeout(refetchT);
          await snapshot();
        }
        return { ok: true, result: r.result || optimistic?.result || {}, reviewed: r.reviewed ?? optimistic?.reviewed };
      } catch (e) {
        const confirmed = get().confirmed;
        if (confirmed) { const { view, pending } = rebuild(confirmed, get().pending.filter((p) => p.mutationId !== mutationId)); set({ view, pending }); }
        if (e instanceof ApiError) return { ok: false, code: e.code, params: e.params };
        return { ok: false, code: 'err.network', params: {} };
      }
    },
  };
});

/** The current club state (view = confirmed + pending). Screens read from this. */
export const useClub = () => useReplica((s) => s.view) as ClubState;
