// Messages for staff (their topics) and for families (their own threads, with a member switcher when linked to 2+ members).
// Phone: list, then thread with a back arrow. Wide: list beside the thread. A thread is marked read only when it is open on screen.
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { memberShort, type ThreadTopic } from '@cp/shared';
import { familyChoices, familyRows, resolveMemberSel, resolveRow, staffRows, topicsOf } from '@cp/shared/rules/chat';
import { Button, Card, EmptyState, FilterChips, FONT_BODY, FONT_SMALL, Pager, chipStyle, usePaged } from '../../components/ui';
import { padFor, useDevice } from '../../hooks/useDevice';
import { useT, useFmt } from '../../lib/i18n';
import { useNow } from '../../lib/clock';
import { useMe } from '../../lib/me';
import { useAct } from '../../lib/act';
import { useClub } from '../../store/replica';
import { readPref, writePref } from '../../store/session';
import { screenFor } from '../../app/nav';
import { useAtLeast } from '../lobby/useAtLeast';
import { StartThreadSheet } from './StartThreadSheet';
import { ThreadList } from './ThreadList';
import { ThreadPanel } from './ThreadPanel';

/** List 280 + gap 16 + thread 440: below this width the two panes behave as on a phone (list, then thread with a back arrow). */
const TWO_PANES = 736;
/** Conversations per page in the list. */
export const THREADS_PER_PAGE = 10;
/** The family app keeps its member choice under this key (member id or 'both'), so Messages follows the other family screens. */
const FAMILY_SEL = 'fam.sel';
type Team = ThreadTopic | 'all';

export function Chat({ audience }: { audience: 'staff' | 'family' }) {
  const t = useT();
  const { fds } = useFmt();
  const { device, isPhone } = useDevice();
  const { user, role, id } = useMe();
  const s = useClub();
  const { today } = useNow();
  const act = useAct();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const paneRef = useRef<HTMLDivElement>(null);
  const { wide: twoPanes, ready: measured } = useAtLeast(paneRef, TWO_PANES);

  const [team, setTeam] = useState<Team>('all');
  const [sel, setSel] = useState<string | null>(params.get('thread'));
  const [startOpen, setStartOpen] = useState(false);
  const [storedMember, setStoredMember] = useState<string>(() => readPref(id || undefined, FAMILY_SEL, 'both'));

  // deep link: /chat?thread=<id> (notifications, "New message") opens that conversation once, then drops the parameter
  const wanted = params.get('thread');
  useEffect(() => {
    if (!wanted) return;
    setSel(wanted);
    setTeam('all');
    const next = new URLSearchParams(params);
    next.delete('thread');
    setParams(next, { replace: true });
  }, [wanted]); // eslint-disable-line react-hooks/exhaustive-deps

  const ready = !!user && !!role && !!id;
  const family = audience === 'family' && ready ? familyChoices(s, id!, today) : { all: [] as string[], choices: [] as string[] };
  const switcher = family.choices.length > 1;
  const memberSel = resolveMemberSel(storedMember, family.choices); // a member id, or 'both'
  const filterIds = switcher && memberSel !== 'both' ? [memberSel] : null;
  const topics = audience === 'staff' ? topicsOf(role) : [];
  const rows = !ready ? [] : audience === 'staff' ? staffRows(s, role!, team) : familyRows(s, id!, filterIds, today);
  const paged = usePaged(rows, THREADS_PER_PAGE, `${audience}|${team}|${memberSel}`);
  const selRow = resolveRow(rows, sel) || (twoPanes ? rows[0] : undefined);
  // When another conversation is selected (a link, a reply that starts one), show the page of the list it is on.
  const selKey = selRow?.key;
  const selIndex = selKey ? rows.findIndex((r) => r.key === selKey) : -1;
  const setPage = paged.setPage;
  useEffect(() => { if (selIndex >= 0) setPage(Math.floor(selIndex / THREADS_PER_PAGE) + 1); }, [selKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const showList = twoPanes || !selRow;
  const showThread = !!selRow;

  // Mark read: only the thread that is displayed and selected, once per new message, and never from the unmeasured first render
  // (which would treat a phone as wide and "open" the first thread). A failed call is not retried in a loop.
  const attempted = useRef('');
  const unread = selRow?.unread || 0;
  const threadId = selRow?.thread?.id;
  const lastSeq = selRow?.thread?.lastSeq || 0;
  useEffect(() => {
    if (!measured || !threadId || !unread) return;
    const key = `${threadId}:${lastSeq}`;
    if (attempted.current === key) return;
    attempted.current = key;
    void act('thread.markRead', { threadId }, { silent: true });
  }, [measured, threadId, unread, lastSeq, act]);

  if (!ready || !id || !role) return null;
  const send = async (text: string): Promise<boolean> => {
    if (!selRow) return false;
    const input = selRow.thread ? { threadId: selRow.thread.id, text } : { memberId: selRow.member.id, topic: selRow.topic, text };
    const r = await act('message.send', input, { silent: true });
    if (r.ok && !selRow.thread && typeof r.result.threadId === 'string') setSel(r.result.threadId);
    return r.ok;
  };
  const about = selRow ? (audience === 'staff' ? (screenFor(role, 'members') ? () => navigate(`/members/${selRow.member.id}`) : null) : () => navigate(`/health?member=${selRow.member.id}`)) : null;
  const pickTeam = (k: Team) => { setTeam(k); setSel(null); };
  const pickMember = (k: string) => { setStoredMember(k); writePref(id, FAMILY_SEL, k); setSel(null); };

  return (
    <div style={{ padding: padFor(device), paddingBottom: isPhone ? 64 : 84, display: 'flex', flexDirection: 'column', gap: isPhone ? 12 : 18, height: '100%', minHeight: (isPhone ? 680 : 600) + (switcher ? 70 : 0) }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', flex: 'none' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: FONT_SMALL, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 500, color: '#6A6967', lineHeight: '18px' }}>{t(audience === 'staff' ? 'chat.eyebrowStaff' : 'chat.eyebrowFamily')}</div>
          <h1 style={{ margin: 0, fontSize: 36, lineHeight: '44px', fontWeight: 400, letterSpacing: '-0.5px', color: '#9A836C' }}>{t('nav.messages')}</h1>
        </div>
        {audience === 'staff' ? (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {topics.length > 1 && !isPhone ? (['all', ...topics] as Team[]).map((k) => {
              const c = chipStyle(team === k);
              return (
                <button key={k} type="button" aria-pressed={team === k} onClick={() => pickTeam(k)} style={{ height: 44, padding: '0 16px', borderRadius: 999, border: c.bd, background: c.bg, color: c.fg, fontSize: FONT_BODY, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Inter' }}>
                  {k === 'all' ? t('common.all') : t('chat.topic.' + k)}
                </button>
              );
            }) : null}
            {topics.length ? <Button size={44} icon="add_comment" onClick={() => setStartOpen(true)}>{t('chat.newMessage')}</Button> : null}
          </div>
        ) : null}
      </div>
      {audience === 'staff' && isPhone && topics.length > 1 ? (
        <FilterChips label={t('chat.filterTeam')} value={team} onChange={pickTeam} options={(['all', ...topics] as Team[]).map((k) => ({ value: k, label: k === 'all' ? t('common.all') : t('chat.topic.' + k) }))} style={{ flex: 'none' }} />
      ) : null}
      {switcher ? (
        <div role="tablist" aria-label={t('chat.member')} style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 999, background: '#F4F0EE', flex: 'none', width: '100%', maxWidth: 520 }}>
          {[...family.choices.map((m) => [m, memberShort(s.members[m])] as const), ['both', t('chat.both')] as const].map(([k, label]) => {
            const on = memberSel === k;
            return (
              <button key={k} type="button" role="tab" aria-selected={on} onClick={() => pickMember(k)}
                style={{ flex: 1, minWidth: 0, height: 44, borderRadius: 999, border: 'none', background: on ? '#FFFFFF' : 'transparent', boxShadow: on ? '0 1px 3px rgba(40,30,20,0.12)' : 'none', color: '#282828', fontSize: 16, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'Inter' }}>
                {label}
              </button>
            );
          })}
        </div>
      ) : null}

      <div ref={paneRef} style={{ flex: 1, minHeight: 0, display: 'flex', gap: 16, alignItems: 'stretch' }}>
        {showList ? (
          <div style={{ flex: twoPanes ? '0 1 360px' : '1 1 auto', minWidth: twoPanes ? 280 : 0, background: '#FFFFFF', border: '1px solid #DBD7D6', borderRadius: 24, overflowY: 'auto', alignSelf: twoPanes ? 'stretch' : 'flex-start', maxHeight: '100%' }} role="group" aria-label={t('nav.messages')}>
            {rows.length ? (
              <>
                <ThreadList t={t} s={s} rows={paged.rows} selKey={selRow?.key} audience={audience} meId={id} today={today} fds={fds} onPick={setSel} />
                <Pager page={paged.page} pages={paged.pages} onPage={paged.setPage} label={t('chat.pagerThreads')} />
              </>
            ) : (
              <EmptyState icon="forum" title={t(audience === 'staff' ? 'chat.none' : 'chat.noneFamily')} sub={t(audience === 'staff' ? 'chat.noneSub' : 'chat.noneFamilySub')} />
            )}
          </div>
        ) : null}
        {showThread && selRow ? (
          <ThreadPanel key={selRow.key} t={t} s={s} row={selRow} audience={audience} meId={id} today={today} fds={fds} singlePane={!twoPanes} onBack={() => setSel(null)} onSend={send} onAbout={about} />
        ) : twoPanes && !rows.length ? (
          <Card style={{ flex: '1 1 440px', minWidth: 0 }}>
            <EmptyState icon="chat" title={t('chat.pick')} sub={t('chat.pickSub')} />
          </Card>
        ) : null}
      </div>
      {audience === 'staff' ? <StartThreadSheet open={startOpen} onClose={() => setStartOpen(false)} /> : null}
    </div>
  );
}
