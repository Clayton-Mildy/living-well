// History tab (staff): every change to the record with who and when, read from the activity log. The log also covers members created from
// enquiries; "Everything" adds day-to-day activity (check-ins, readings).
import { useState } from 'react';
import { actorName, hasKey, sortBy } from '@cp/shared';
import type { ActivityEntry } from '@cp/shared';
import { Icon, Pager, Segmented, usePaged } from '../../../components/ui';
import { docLabel, HAIR, whenText } from '../lib';
import { ListCard } from './parts';
import type { P } from './types';

const OPERATIONAL = ['feed.checked', 'feed.reading', 'lobby.', 'health.', 'activity.', 'kitchen.', 'finance.', 'requests.', 'cal.', 'people.', 'family.'];
const isChange = (key: string) => !OPERATIONAL.some((k) => key.startsWith(k));
const FIELD_KEY: Record<string, string> = { title: 'title', name: 'name', dob: 'dob', address: 'address', usualArrival: 'usual', nanny: 'nanny', spouseId: 'spouse' };

export function HistoryTab({ p }: { p: P }) {
  const { s, m, t, fmt, today } = p;
  const [mode, setMode] = useState<'changes' | 'all'>('changes');
  const all = sortBy(Object.values(s.activity).filter((a) => a.memberId === m.id), (a) => a.at + a.id, -1);
  const entries = all.filter((a) => (mode === 'all' ? true : isChange(a.key)));
  const paged = usePaged(entries, 10, `${m.id}|${mode}`);
  const hasCreated = all.some((a) => /created|Created|convert|\.joined|joinPending/.test(a.key));
  const detail = (a: ActivityEntry): string => {
    const pr = a.params as Record<string, string | number>;
    const parts: string[] = [];
    if (pr.fields) parts.push(String(pr.fields).split(',').map((f) => t('profile.f.' + (FIELD_KEY[f] || f))).join(', '));
    if (pr.type) parts.push(String(pr.type).split(',').map((x) => docLabel(t, x as never)).join(', '));
    if (pr.kinds) parts.push(String(pr.kinds).split(',').map((x) => t('profile.consent.' + x)).join(', '));
    if (a.key === 'members.feed.plan' || a.key === 'members.feed.planApplied') parts.push(`${t('profile.plan.' + pr.plan)} · ${t('profile.fromDate', { d: fmt.fdy(String(pr.from)) })}`);
    if (a.key === 'members.feed.ending') parts.push(`${t('profile.endReason.' + pr.reason)} · ${t('profile.lastDay', { d: fmt.fdy(String(pr.date)) })}`);
    if (a.key === 'members.feed.reactivated') parts.push(t('profile.fromDate', { d: fmt.fdy(String(pr.from)) }));
    if (a.key.endsWith('reviewApproved') || a.key.endsWith('reviewReverted')) parts.push(t('review.' + pr.section));
    return parts.join(' · ');
  };
  const text = (a: ActivityEntry) => {
    if (hasKey(a.key)) {
      const pr = { ...a.params } as Record<string, string | number>;
      if (pr.section) pr.section = t('review.' + pr.section);
      return t(a.key, pr);
    }
    return t('profile.history.generic');
  };
  const who = (a: ActivityEntry) => {
    const by = (a.params as Record<string, string>).by;
    const doer = actorName(s, by || a.actor);
    return by && by !== a.actor ? `${doer} · ${t('profile.approvedBy', { n: actorName(s, a.actor) })}` : doer;
  };
  const ph = p.isPhone && !p.family; // round 6, phone: the list card is an iOS grouped section
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: ph ? 14 : 18, maxWidth: 860 }}>
      <Segmented label={t('profile.tab.history')} value={mode} onChange={setMode} items={[{ value: 'changes', label: t('profile.history.changes') }, { value: 'all', label: t('profile.history.all') }]} />
      <ListCard phone={ph} title={t('profile.history.title')}>
        {paged.rows.map((a, ai) => {
          const d = detail(a);
          return (
            <div key={a.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '14px 0', borderTop: ai ? HAIR : 'none' }}>
              <Icon name={a.icon || 'history'} size={20} color="#75624B" style={{ paddingTop: 1 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <span style={{ fontSize: 15, lineHeight: '22px' }}>{text(a)}</span>
                {d ? <span style={{ fontSize: 14, color: '#24201C', lineHeight: 1.4 }}>{d}</span> : null}
                <span style={{ fontSize: 13, color: '#6B6259', lineHeight: 1.4 }}>{who(a)} · {whenText(fmt.fds, today, a.at, t)}</span>
              </div>
            </div>
          );
        })}
        {!hasCreated && mode === 'changes' ? (
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '14px 0', borderTop: paged.rows.length ? HAIR : 'none' }}>
            <Icon name="person_add" size={20} color="#75624B" style={{ paddingTop: 1 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 15, lineHeight: '22px' }}>{t('profile.history.recordCreated')}</span>
              <span style={{ fontSize: 13, color: '#6B6259', lineHeight: 1.4 }}>{actorName(s, m.createdBy)} · {whenText(fmt.fds, today, m.createdAt, t)}</span>
            </div>
          </div>
        ) : null}
        {paged.pages > 1 ? <div style={{ padding: '12px 0 16px', borderTop: HAIR }}><Pager page={paged.page} pages={paged.pages} onPage={paged.setPage} label={t('profile.pagerHistory')} /></div> : null}
      </ListCard>
    </div>
  );
}
