// Demo accounts (login page + demo panel), fetched from the API so they work before sign-in.
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useSession } from '../store/session';
import { translate } from '@cp/shared';

export interface DemoAccount { id: string; name: string; kind: 'staff' | 'family'; roleKey: string; member?: string; billing?: boolean; role: string; lands: string }
let cache: Omit<DemoAccount, 'role' | 'lands'>[] | null = null;
export function useDemoAccounts(): DemoAccount[] {
  const lang = useSession((s) => s.lang);
  const [list, setList] = useState(cache || []);
  useEffect(() => { if (!cache) void api<{ accounts: typeof list }>('/api/demo/accounts').then((r) => { cache = r.accounts; setList(r.accounts); }).catch(() => {}); }, []);
  return list.map((a) => ({
    ...a,
    role: a.kind === 'family' ? `${translate(lang, 'roles.family')} · ${a.member}${a.billing ? ' · ' + translate(lang, 'roles.billing') : ''}` : translate(lang, 'roles.' + a.roleKey),
    lands: translate(lang, 'roles.lands_' + a.roleKey),
  }));
}
