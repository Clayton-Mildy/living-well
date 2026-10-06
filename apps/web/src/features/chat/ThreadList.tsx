// The conversation list (design ScrChat left card): avatar, name, time, "About … · team", last message, unread dot.
import { staffCall, type ClubState } from '@cp/shared';
import { memberShort } from '@cp/shared';
import { senderKind, teamStaff, type ThreadRow } from '@cp/shared/rules/chat';
import { Avatar } from '../../components/ui';
import type { TFn } from '../../lib/i18n';
import { messageBody, teamName, teamSub, whenOf } from './text';

export function ThreadList({ t, s, rows, selKey, audience, meId, today, fds, onPick }: {
  t: TFn; s: ClubState; rows: ThreadRow[]; selKey: string | undefined; audience: 'staff' | 'family'; meId: string; today: string; fds: (d: string) => string; onPick: (key: string) => void;
}) {
  const prefix = (r: ThreadRow) => {
    const m = r.last;
    if (!m) return '';
    const kind = senderKind(m);
    if (audience === 'family') return kind === 'family' ? t('chat.youColon') : '';
    if (kind === 'family') return '';
    if (kind === 'system') return `${t('chat.autoReply')}: `;
    return m.from === `staff:${meId}` ? t('chat.youColon') : `${staffCall(s.staff[m.from.slice(6)])}: `;
  };
  return (
    <>
      {rows.map((r) => {
        const on = selKey === r.key;
        const staff = teamStaff(s, r.topic);
        const name = audience === 'staff' ? r.family.name : teamName(t, s, r.topic);
        const avatarName = audience === 'staff' ? r.family.name : staff?.name || name;
        const team = audience === 'staff' ? t('chat.topic.' + r.topic) : teamSub(t, s, r.topic);
        const about = t('chat.about', { n: memberShort(r.member), team: r.feedback ? `${team} · ${r.feedback.dish}` : team });
        return (
          <button key={r.key} type="button" className="dh48" onClick={() => onPick(r.key)} aria-current={on ? 'true' : undefined} data-thread={r.key}
            style={{ width: '100%', display: 'flex', gap: 12, alignItems: 'flex-start', padding: '14px 16px', border: 'none', borderBottom: '1px solid #EFECEA', background: on ? '#F4F0EE' : '#FFFFFF', textAlign: 'left', cursor: 'pointer', color: '#282828', fontFamily: 'Inter' }}>
            <Avatar name={avatarName} size={44} />
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 16, fontWeight: r.unread ? 600 : 500, lineHeight: 1.4 }}>{name}</span>
                <span style={{ fontSize: 12, color: '#6A6967', whiteSpace: 'nowrap' }}>{r.last ? whenOf(t, fds, today, r.last.at) : ''}</span>
              </span>
              <span style={{ fontSize: 'max(13px, var(--cp-body, 0px))', color: '#6A6967', lineHeight: 1.4 }}>{about}</span>
              <span style={{ fontSize: 'max(14px, var(--cp-body, 0px))', lineHeight: '20px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.last ? `${prefix(r)}${messageBody(t, s, r.last, r.thread)}` : t('chat.startConv')}
              </span>
            </span>
            {r.unread ? <span role="img" aria-label={t('chat.unreadAria')} data-unread="1" style={{ width: 10, height: 10, borderRadius: 999, background: '#75624B', flex: 'none', marginTop: 6 }} /> : null}
          </button>
        );
      })}
    </>
  );
}
