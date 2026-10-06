// Signed-in user, language and clubhouse (persisted). Per-user UI preferences live under cp.ui.<userId>.
import { create } from 'zustand';
import type { Lang } from '@cp/shared';
import { api, setApiToken, setUnauthorizedHandler } from '../lib/api';
import { useReplica } from './replica';

export interface PublicUser {
  kind: 'staff' | 'family';
  id: string;
  name: string;
  knownAs?: string;
  firstName?: string;
  role: string;
  title?: string;
  clubId: string;
  clubs: string[];
  memberIds?: string[];
  lang?: Lang;
}
interface SessionState {
  user: PublicUser | null;
  /** signed session token from /api/login or /api/verify: sent with every request */
  token: string | null;
  lang: Lang;
  club: string;
  signIn(u: PublicUser, token: string): void;
  signOut(): void;
  setLang(l: Lang): void;
  setClub(c: string): void;
}
const KEY = 'cp.session';
const load = (): Partial<SessionState> => {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
};
const loaded = load();
// a session saved before sign-in tokens existed has no token: sign in again
const saved = loaded.user && !loaded.token ? { ...loaded, user: null } : loaded;
if (saved.user && saved.token) setApiToken(saved.token);
const persist = (s: Pick<SessionState, 'user' | 'token' | 'lang' | 'club'>) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode */ } };

export const useSession = create<SessionState>((set, get) => ({
  user: saved.user || null,
  token: (saved.user && saved.token) || null,
  lang: (saved.lang as Lang) || 'en',
  club: 'citra', // one clubhouse in this demo (the Adina switcher is gone)
  signIn(u, token) {
    setApiToken(token);
    const next = { user: u, token, lang: u.lang || get().lang, club: u.clubId };
    set(next);
    persist(next);
  },
  signOut() {
    const u = get().user;
    if (u) { try { localStorage.removeItem('cp.ui.' + u.id); } catch { /* ignore */ } }
    setApiToken(null);
    useReplica.getState().stop(); // close the live stream opened with this session
    const next = { user: null, token: null, lang: get().lang, club: 'citra' };
    set(next);
    persist(next);
  },
  setLang(lang) { set({ lang }); persist({ user: get().user, token: get().token, lang, club: get().club }); },
  setClub(club) { set({ club }); persist({ user: get().user, token: get().token, lang: get().lang, club }); },
}));

// an expired or forged token (any request answered 401) ends the session
setUnauthorizedHandler(() => { if (useSession.getState().user) useSession.getState().signOut(); });

/** One-tap demo sign-in (login page, Demo panel, guided demo): no password, still gets a signed session token. */
export async function signInDemo(userId: string): Promise<PublicUser | null> {
  const r = await api<{ ok: boolean; user: PublicUser; token: string }>('/api/verify', { body: { userId, code: '000000' } });
  if (!r.ok) return null;
  useSession.getState().signIn(r.user, r.token);
  return r.user;
}

/** Per-user UI preference stored in localStorage (cleared on sign-out). */
export function readPref<T>(userId: string | undefined, key: string, fallback: T): T {
  if (!userId) return fallback;
  try { const o = JSON.parse(localStorage.getItem('cp.ui.' + userId) || '{}'); return key in o ? o[key] : fallback; } catch { return fallback; }
}
export function writePref(userId: string | undefined, key: string, value: unknown) {
  if (!userId) return;
  try { const o = JSON.parse(localStorage.getItem('cp.ui.' + userId) || '{}'); o[key] = value; localStorage.setItem('cp.ui.' + userId, JSON.stringify(o)); } catch { /* ignore */ }
}
