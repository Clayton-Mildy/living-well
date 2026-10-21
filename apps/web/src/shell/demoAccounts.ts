// Demo accounts (login page + demo panel), fetched from the API so they work before sign-in.
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useSession } from '../store/session';
import { translate } from '@cp/shared';

export interface DemoAccount { id: string; name: string; kind: 'staff' | 'family'; roleKey: string; member?: string; billing?: boolean; role: string; lands: string }
let cache: Omit<DemoAccount, 'role' | 'lands'>[] | null = null;
/** KC round 12: whether this server runs as a demo (CP_DEMO_LOGIN is not '0'); null until the API answers. */
let demoCache: boolean | null = null;
let inflight: Promise<void> | null = null;
const fetchDemo = () => (inflight ??= api<{ accounts: Omit<DemoAccount, 'role' | 'lands'>[]; demoLogin?: boolean }>('/api/demo/accounts')
  .then((r) => { cache = r.accounts; demoCache = r.demoLogin !== false; })
  .catch(() => { inflight = null; }));
export function useDemoAccounts(): DemoAccount[] {
  const lang = useSession((s) => s.lang);
  const [list, setList] = useState(cache || []);
  useEffect(() => { if (!cache) void fetchDemo().then(() => { if (cache) setList(cache); }); }, []);
  return list.map((a) => ({
    ...a,
    role: a.kind === 'family' ? `${translate(lang, 'roles.family')} · ${a.member}${a.billing ? ' · ' + translate(lang, 'roles.billing') : ''}` : translate(lang, 'roles.' + a.roleKey),
    lands: translate(lang, 'roles.lands_' + a.roleKey),
  }));
}
/** KC round 12: demo-only helpers (such as "Use sample form" in the registration) show when the server runs as a demo. False until it answers. */
export function useDemoLogin(): boolean {
  const [on, setOn] = useState(demoCache ?? false);
  useEffect(() => { if (demoCache === null) void fetchDemo().then(() => setOn(!!demoCache)); }, []);
  return on;
}
