// Pick people with a search and a short list, not a wall of everyone: the chosen ones sit on top as removable chips,
// a search box finds the rest, and the matches are paged. Used for the group photo and for editing a photo's tags.
import { useMemo, useState, type ReactNode } from 'react';
import { memberName, memberShort, type Member } from '@cp/shared';
import { searchMembers } from '@cp/shared/rules/activity';
import { Icon, Pager, TextField, usePaged, FONT_BODY, FONT_SMALL } from '../../components/ui';
import { useT } from '../../lib/i18n';
import { Av } from './lib';

export function MemberPicker({ members, value, onChange, suggested = [], sub, selectedLabel, emptyLabel, pageSize = 5 }: {
  members: Member[];
  value: string[];
  onChange: (ids: string[]) => void;
  /** ids offered as one tap "add suggested" (the simulated face matches) */
  suggested?: string[];
  /** a second line under each name in the list */
  sub?: (m: Member) => ReactNode;
  selectedLabel: string;
  emptyLabel: string;
  pageSize?: number;
}) {
  const t = useT();
  const [q, setQ] = useState('');
  const found = useMemo(() => searchMembers(members, q), [members, q]);
  const paged = usePaged(found, pageSize, q);
  const byId = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const chosen = value.map((id) => byId.get(id)).filter((m): m is Member => !!m);
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  const missing = suggested.filter((id) => !value.includes(id) && byId.has(id));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: FONT_BODY, fontWeight: 500, lineHeight: 1.4 }}>{selectedLabel} ({chosen.length})</span>
        {chosen.length ? (
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {chosen.map((m) => (
              <li key={m.id}>
                <button type="button" onClick={() => toggle(m.id)} aria-label={t('activity.removeName', { name: memberShort(m) })} style={{ height: 40, padding: '0 10px 0 14px', borderRadius: 12, border: '1px solid #24201C', background: '#24201C', color: '#FFFFFF', fontSize: FONT_BODY, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Inter' }}>
                  {memberShort(m)}<Icon name="close" size={18} />
                </button>
              </li>
            ))}
          </ul>
        ) : <span style={{ fontSize: FONT_BODY, color: '#5E5852', lineHeight: 1.4 }}>{emptyLabel}</span>}
        {missing.length ? (
          <div>
            <button type="button" onClick={() => onChange([...value, ...missing])} style={{ height: 44, padding: '0 16px 0 12px', borderRadius: 12, border: '1px solid #DCD3C8', background: '#FFFFFF', color: '#24201C', fontSize: FONT_BODY, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontFamily: 'Inter' }}>
              <Icon name="face" size={20} />{t('activity.addSuggested', { n: missing.length })}
            </button>
          </div>
        ) : null}
      </div>
      <TextField label={t('activity.searchMember')} value={q} onChange={setQ} placeholder={t('activity.searchMemberPh')} inputMode="search" />
      {found.length ? (
        <div style={{ border: '1px solid #E4DACD', borderRadius: 14, overflow: 'hidden' }}>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {paged.rows.map((m, i) => {
              const on = value.includes(m.id);
              return (
                <li key={m.id} style={{ borderTop: i ? '1px solid #F0EAE1' : 'none' }}>
                  <button type="button" aria-pressed={on} aria-label={`${memberName(m)}`} onClick={() => toggle(m.id)} className="h-row" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', minHeight: 56, border: 'none', background: on ? '#F3EEE8' : '#FFFFFF', cursor: 'pointer', color: '#24201C', textAlign: 'left', fontFamily: 'Inter' }}>
                    <Av m={m} size={36} fs={FONT_SMALL} />
                    <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: FONT_BODY, fontWeight: 500, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{memberName(m)}</span>
                      {sub ? <span style={{ fontSize: 12, color: '#5E5852' }}>{sub(m)}</span> : null}
                    </span>
                    <Icon name={on ? 'check_circle' : 'add_circle'} size={24} fill={on ? 1 : 0} color="#75624B" />
                  </button>
                </li>
              );
            })}
          </ul>
          <Pager page={paged.page} pages={paged.pages} onPage={paged.setPage} label={t('activity.memberPager')} />
        </div>
      ) : <div role="status" style={{ padding: '14px 4px', fontSize: FONT_BODY, color: '#5E5852', lineHeight: 1.4 }}>{t('activity.noMemberMatch', { q: q.trim() })}</div>}
    </div>
  );
}
