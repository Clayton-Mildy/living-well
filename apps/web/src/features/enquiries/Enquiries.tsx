// Enquiries board (design ScrEnq): phone = stage chips + cards, wide = five columns with drag (@dnd-kit, touch capable).
// "Move to" works everywhere. New lead, edit, archive, reopen; visits and trials with a picked day and time; join a lead as a member with the signed paper registration form.
import { Fragment, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DndContext, DragOverlay, MouseSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import type { Enquiry } from '@cp/shared';
import { ENQ_STAGES, archivedEnquiries, enquiriesByStage, formLinkState, seniorName, type EnqStage } from '@cp/shared/rules/enquiries';
import { Button, Dialog, FilterChips, HAIRLINE, Icon, IconButton, PageHead, Pager, Pin, Segmented, TextField, uiZoom, usePaged } from '../../components/ui';
import { useDevice, padFor } from '../../hooks/useDevice';
import { useT, useFmt } from '../../lib/i18n';
import { useNow } from '../../lib/clock';
import { useAct } from '../../lib/act';
import { useClub } from '../../store/replica';
import { say } from '../../store/ui';
import { Pill, BadgePill, ListCard, PillBtn, SearchBar, HPAD, groupCard, heroCard, labelStyle } from '../mgmt/common';
import { EnquiryDialogs, type Dlg } from './dialogs';
import { nextText } from './text';
import { LeadHistory, LeadTimeline } from './History';

const STAGE_ICON: Record<EnqStage, string> = { new: 'call', visit: 'meeting_room', trial: 'waving_hand', joined: 'how_to_reg', lost: 'block' };
const norm = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
/** A lead matches a search by the senior's name or the contact's name (any part of either, ignoring case and accents). */
export const leadMatches = (e: Pick<Enquiry, 'senior' | 'contact'>, q: string) => {
  const words = norm(q).split(/\s+/).filter(Boolean);
  const hay = norm(`${seniorName(e)} ${e.senior.name} ${e.contact.name}`);
  return words.every((w) => hay.includes(w));
};
const STAGE_COLOR: Record<EnqStage, string> = { new: '#5E4E3B', visit: '#5E4E3B', trial: '#3D6B4F', joined: '#3D6B4F', lost: '#9A3D24' };

export function Enquiries() {
  const t = useT();
  const { fdl, fds } = useFmt();
  const { device, isPhone } = useDevice();
  const s = useClub();
  const act = useAct();
  const navigate = useNavigate();
  const { today } = useNow();
  const [params, setParams] = useSearchParams();
  const [dlg, setDlg] = useState<Dlg | null>(null);
  const [stage, setStage] = useState<EnqStage>('new');
  const [moveFor, setMoveFor] = useState<Enquiry | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const searching = q.trim() !== '';
  // round 13: Leads (the board) or History (per month, how far each lead got); ?view=history, cleared on Leads
  const history = params.get('view') === 'history';
  const setView = (v: 'board' | 'history') => { const p = new URLSearchParams(params); if (v === 'history') p.set('view', 'history'); else p.delete('view'); setParams(p, { replace: true }); };
  const all = useMemo(() => enquiriesByStage(s), [s]);
  // the search narrows every column (and the archive) to the leads whose senior or contact name matches; paging starts over on a new search
  const by = useMemo(() => (searching ? (Object.fromEntries(ENQ_STAGES.map((k) => [k, all[k].filter((e) => leadMatches(e, q))])) as typeof all) : all), [all, q, searching]);
  const archivedAll = archivedEnquiries(s);
  const archived = searching ? archivedAll.filter((e) => leadMatches(e, q)) : archivedAll;
  const phonePaged = usePaged(by[stage], 6, `${stage}|${q}`);
  const archivedPaged = usePaged(archived, 6, q);

  // deep links from other screens: /enquiries?e=<id> opens that lead
  useEffect(() => {
    const id = params.get('e') || params.get('enquiry') || params.get('open');
    if (id && s.enquiries[id]) setDlg({ mode: 'edit', id });
    else return;
    const p = new URLSearchParams(params);
    ['e', 'enquiry', 'open'].forEach((k) => p.delete(k));
    setParams(p, { replace: true });
  }, [params]); // eslint-disable-line react-hooks/exhaustive-deps

  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 8 } }), useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }));

  const moveTo = async (e: Enquiry, to: EnqStage) => {
    if (e.stage === 'joined') { say(t('enq.alreadyMember', { name: seniorName(e) })); return; }
    if (to === e.stage && to !== 'visit' && to !== 'trial') return;
    if (e.stage === 'lost') {
      const r = await act('enquiry.reopen', { enquiryId: e.id }, { silent: true });
      if (!r.ok) return;
      say(t('enq.reopened', { name: seniorName(e) }));
      if (to === 'new' || to === 'lost') return;
    }
    if (to === 'new') { await act('enquiry.move', { enquiryId: e.id, stage: 'new' }, { ok: t('enq.moved', { name: seniorName(e), stage: t('enq.stage.new') }) }); return; }
    // joining asks for the plan, the first day and the signed paper registration form
    setDlg({ mode: to === 'joined' ? 'join' : to, id: e.id } as Dlg);
  };
  const handlers = {
    edit: (e: Enquiry) => setDlg({ mode: 'edit', id: e.id }),
    move: moveTo,
    openMove: (e: Enquiry) => setMoveFor(e),
    dialog: (mode: 'visit' | 'trial' | 'join' | 'lost' | 'link', e: Enquiry) => setDlg({ mode, id: e.id }),
    reopen: async (e: Enquiry) => { const r = await act('enquiry.reopen', { enquiryId: e.id }, { ok: t('enq.reopened', { name: seniorName(e) }) }); return r.ok; },
    profile: (e: Enquiry) => e.memberId && navigate(`/members/${e.memberId}`),
  };

  const onDragStart = (ev: DragStartEvent) => setActive(String(ev.active.id));
  const onDragEnd = (ev: DragEndEvent) => {
    setActive(null);
    const e = s.enquiries[String(ev.active.id)];
    const to = ev.over?.id as EnqStage | undefined;
    if (e && to && (ENQ_STAGES as readonly string[]).includes(to) && to !== e.stage) void moveTo(e, to);
  };
  const dragged = active ? s.enquiries[active] : undefined;

  return (
    <>
    {/* round 6, phone: cp-native flattens the cards; the lead cards and the archive are iOS-style groups */}
    <div className={isPhone ? 'cp-native' : undefined} style={{ padding: padFor(device), display: 'flex', flexDirection: 'column', gap: isPhone ? 12 : 20 }}>
      <PageHead eyebrow={fdl(today)} title={t('nav.enquiries')} size={40}
        right={history || (isPhone && !archivedAll.length) ? undefined : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {archivedAll.length ? <Button variant="secondary" icon="inventory_2" onClick={() => setShowArchived(!showArchived)}>{t('enq.archivedN', { n: archived.length })}</Button> : null}
            {isPhone ? null : <Button icon="add" onClick={() => setDlg({ mode: 'new' })}>{t('enq.newLead')}</Button>}
          </div>
        )} />

      <Segmented<'board' | 'history'> label={t('enq.viewLabel')} value={history ? 'history' : 'board'} onChange={setView} items={[{ value: 'board', label: t('enq.viewBoard') }, { value: 'history', label: t('enq.viewHistory') }]} />

      {history ? <LeadHistory wide={!isPhone} onOpen={(id) => setDlg({ mode: 'edit', id })} /> : null}

      {history ? null : isPhone ? <SearchBar value={q} onChange={setQ} label={t('enq.searchLabel')} placeholder={t('enq.searchPh')} /> : (
      <div style={{ maxWidth: 460 }}>
        <TextField label={t('enq.searchLabel')} type="search" inputMode="search" value={q} onChange={setQ} placeholder={t('enq.searchPh')} />
      </div>
      )}

      {history ? null : isPhone ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <FilterChips label={t('enq.stageLabel')} value={stage} onChange={setStage} options={ENQ_STAGES.map((k) => ({ value: k, label: t('enq.stage.' + k), count: by[k].length }))} />
          {phonePaged.rows.map((e) => <LeadCard key={e.id} e={e} phone h={handlers} />)}
          <Pager page={phonePaged.page} pages={phonePaged.pages} onPage={phonePaged.setPage} label={t('enq.pgColumn', { stage: t('enq.stage.' + stage) })} />
          {!by[stage].length ? <div style={{ padding: '28px 16px', borderRadius: 16, background: 'var(--fill, #F4F4F5)', textAlign: 'center', fontSize: 15, color: '#6B6259', lineHeight: 1.4 }}>{searching ? t('enq.noMatch', { q: q.trim() }) : t('enq.nobody')}</div> : null}
        </div>
      ) : (
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActive(null)}>
          <div className="cp-pillrow" style={{ display: 'flex', gap: 14, overflowX: 'auto', alignItems: 'flex-start', paddingBottom: 8 }}>
            {ENQ_STAGES.map((k) => (
              <Column key={k} stage={k} items={by[k]} resetKey={q} searching={searching} hint="" dragging={!!active} render={(e) => <DraggableCard key={e.id} e={e} h={handlers} />} />
            ))}
          </div>
          {/* the page is CSS-zoomed and dnd-kit works in screen px: undo the zoom on the overlay's wrapper (so its position and size are screen px), then give the card its zoom back */}
          <DragOverlay style={{ zoom: 1 / uiZoom() }}>{dragged ? <div style={{ zoom: uiZoom(), width: `${100 / uiZoom()}%` }}><LeadCard e={dragged} h={handlers} overlay /></div> : null}</DragOverlay>
        </DndContext>
      )}

      {!history && showArchived && archived.length ? (isPhone ? (
        // round 6, phone: the archive is a grouped list under a small header
        <ListCard title={t('enq.archivedTitle')}>
          {archivedPaged.rows.map((e) => (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: HAIRLINE }}>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.3 }}>{seniorName(e)}</span>
                <span style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.4 }}>{e.contact.name} · {t('enq.stage.' + e.stage)} · {fds(e.archivedAt!.slice(0, 10))}</span>
              </div>
              <PillBtn icon="unarchive" onClick={() => act('enquiry.archive', { enquiryId: e.id, restore: true }, { ok: t('enq.restored', { name: seniorName(e) }) })}>{t('enq.restore')}</PillBtn>
            </div>
          ))}
          <Pager page={archivedPaged.page} pages={archivedPaged.pages} onPage={archivedPaged.setPage} label={t('enq.pgArchived')} />
        </ListCard>
      ) : (
        <div className="cp-grey" style={{ ...heroCard, padding: `0 ${HPAD} 8px` }}>
          <div style={{ padding: '18px 0 8px' }}><span style={labelStyle}>{t('enq.archivedTitle')}</span></div>
          {archivedPaged.rows.map((e) => (
            <Fragment key={e.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '16px 0', borderTop: HAIRLINE }}>
                <div style={{ flex: '1 1 200px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontSize: 17, fontWeight: 500, lineHeight: 1.3 }}>{seniorName(e)}</span>
                  <span style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.4 }}>{e.contact.name} · {t('enq.stage.' + e.stage)} · {fds(e.archivedAt!.slice(0, 10))}</span>
                </div>
                <Button size={44} variant="secondary" icon="unarchive" onClick={() => act('enquiry.archive', { enquiryId: e.id, restore: true }, { ok: t('enq.restored', { name: seniorName(e) }) })}>{t('enq.restore')}</Button>
              </div>
            </Fragment>
          ))}
          <Pager page={archivedPaged.page} pages={archivedPaged.pages} onPage={archivedPaged.setPage} label={t('enq.pgArchived')} />
        </div>
      )) : null}

      <EnquiryDialogs dlg={dlg} onClose={() => setDlg(null)} onSwitch={setDlg} />
      <Dialog open={!!moveFor} onClose={() => setMoveFor(null)} eyebrow={t('enq.moveTo')} title={moveFor ? seniorName(moveFor) : ''} maxWidth={420}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {moveFor ? ENQ_STAGES.filter((k) => k !== moveFor.stage || k === 'visit' || k === 'trial').map((k) => (
            <Button key={k} variant="secondary" icon={STAGE_ICON[k]} full onClick={() => { const e = moveFor; setMoveFor(null); void moveTo(e, k); }}>{moveFor.stage === k ? (k === 'trial' ? t('enq.trialChange') : t('enq.reschedule', { stage: t('enq.stage.' + k).toLowerCase() })) : t('enq.stage.' + k)}</Button>
          )) : null}
        </div>
      </Dialog>
    </div>
    {isPhone ? <Pin icon="add" label={t('enq.newLead')} onClick={() => setDlg({ mode: 'new' })} /> : null}
    </>
  );
}

interface H {
  edit: (e: Enquiry) => void;
  move: (e: Enquiry, to: EnqStage) => Promise<void>;
  openMove: (e: Enquiry) => void;
  dialog: (mode: 'visit' | 'trial' | 'join' | 'lost' | 'link', e: Enquiry) => void;
  reopen: (e: Enquiry) => Promise<boolean>;
  profile: (e: Enquiry) => void;
}

function Column({ stage, items, resetKey, searching, hint, dragging, render }: { stage: EnqStage; items: Enquiry[]; resetKey: string; searching: boolean; hint: string; dragging: boolean; render: (e: Enquiry) => React.ReactNode }) {
  const t = useT();
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const over = isOver && dragging;
  const count = items.length;
  const paged = usePaged(items, 6, resetKey);
  return (
    <div ref={setNodeRef} data-stage={stage} role="region" aria-label={t('enq.stage.' + stage)} className="cp-grey"
      style={{ flex: '1 0 250px', minWidth: 250, maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 10, padding: 10, borderRadius: 16, background: over ? 'var(--press, #EEEEF0)' : 'var(--fill, #F4F4F5)', border: over ? '2px dashed var(--accent, #75624B)' : '2px solid transparent' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '4px 6px 0' }}>
        <span style={{ fontSize: 12, letterSpacing: '1.4px', textTransform: 'uppercase', fontWeight: 600, lineHeight: '18px', color: STAGE_COLOR[stage] }}>{t('enq.stage.' + stage)}</span>
        <span style={{ minWidth: 24, height: 24, padding: '0 7px', borderRadius: 8, background: 'var(--on-card, #FFFFFF)', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{count}</span>
      </div>
      {hint ? <div style={{ fontSize: 13, color: '#6B6259', padding: '0 6px', lineHeight: 1.4 }}>{hint}</div> : null}
      {paged.rows.map(render)}
      <Pager page={paged.page} pages={paged.pages} onPage={paged.setPage} label={t('enq.pgColumn', { stage: t('enq.stage.' + stage) })} />
      {!count ? <div style={{ padding: '20px 8px', borderRadius: 12, border: '1px dashed var(--outline, #D4D4D8)', textAlign: 'center', fontSize: 13, color: '#6B6259', lineHeight: 1.4 }}>{searching ? t('enq.noMatchShort') : t('enq.dropHere')}</div> : null}
    </div>
  );
}

function DraggableCard({ e, h }: { e: Enquiry; h: H }) {
  const { setNodeRef, listeners, isDragging } = useDraggable({ id: e.id });
  return (
    <div ref={setNodeRef} {...listeners} style={{ opacity: isDragging ? 0.4 : 1, touchAction: 'manipulation' }}>
      <LeadCard e={e} h={h} />
    </div>
  );
}

function LeadCard({ e, h, phone, overlay }: { e: Enquiry; h: H; phone?: boolean; overlay?: boolean }) {
  const t = useT();
  const { fds } = useFmt();
  const s = useClub();
  // registration is on paper: once the lead has joined, the member's signed registration form is attached (an upload, or a paper copy kept at the club)
  const member = e.stage === 'joined' && e.memberId ? s.members[e.memberId] : undefined;
  const regAttached = !!member?.documents.some((d) => d.type === 'membershipForm' && d.status === 'onFile');
  const pending = e.stage === 'joined' && e.memberId && s.members[e.memberId]?.review?.status === 'pending';
  const open = e.stage === 'new' || e.stage === 'visit' || e.stage === 'trial';
  const sz = phone ? 15 : 13;
  // KC round 10: where the online registration link stands (sent, opened, filled in, expired)
  const { today, now } = useNow();
  const formState = open ? formLinkState(e.form, `${today}T${now}`) : null;
  // round 6, phone: the actions are small 34px pills (ink for the main step, white for the next, tinted for the quiet ones)
  const A = (variant: 'primary' | 'secondary' | 'ghost', label: string, onClick: () => void, key = label) => phone
    ? <PillBtn key={key} tone={variant === 'ghost' ? 'quiet' : variant} onClick={onClick}>{label}</PillBtn>
    : <Button key={key} size={44} variant={variant} onClick={onClick} style={{ fontSize: sz }}>{label}</Button>;
  const actions: React.ReactNode[] = [];
  if (e.stage === 'new') actions.push(A('primary', t('enq.bookVisit'), () => h.dialog('visit', e)));
  if (e.stage === 'visit') actions.push(A('primary', t('enq.bookTrial'), () => h.dialog('trial', e)));
  if (e.stage === 'trial') actions.push(A('primary', t('enq.join'), () => h.dialog('join', e)));
  if (e.stage === 'joined' && e.memberId) actions.push(A('secondary', t('enq.openProfile'), () => h.profile(e)));
  if (e.stage === 'lost') actions.push(A('primary', t('enq.reopen'), () => void h.reopen(e)));
  if (e.stage === 'new' || e.stage === 'visit') actions.push(A('ghost', t('enq.join'), () => h.dialog('join', e)));
  if ((e.stage === 'visit' || e.stage === 'trial') && e.next?.date) actions.push(A('ghost', t(e.stage === 'trial' ? 'enq.changeDay' : 'enq.changeTime'), () => h.dialog(e.stage as 'visit' | 'trial', e)));
  if (open) actions.push(A('ghost', formState === 'submitted' ? t('enq.formState_submitted') : t('enq.sendForm'), () => h.dialog('link', e), 'form'));
  if (open) actions.push(A('ghost', t('enq.lostAction'), () => h.dialog('lost', e)));
  return (
    <div data-lead={e.id} className="cp-grey" style={phone
      ? { ...groupCard, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8, cursor: 'default' }
      : { background: overlay ? 'var(--fill, #F4F4F5)' : '#FFFFFF', borderRadius: 14, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, cursor: overlay ? 'default' : 'grab', boxShadow: overlay ? '0 12px 28px rgba(40,30,20,0.18)' : 'none' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: phone ? 17 : 15, fontWeight: 600, lineHeight: 1.35, overflowWrap: 'anywhere' }}>{seniorName(e)}</span>
          <span style={{ fontSize: 13, color: '#5E5852', lineHeight: 1.4, overflowWrap: 'anywhere' }}>{e.contact.name} · {t('enq.rel_' + e.contact.relation).toLowerCase()} · {t('enq.src_' + e.source)}</span>
        </div>
        <IconButton icon="edit" label={t('enq.editLead')} bordered={false} onClick={() => h.edit(e)} style={{ margin: '-6px -6px 0 0' }} />
      </div>
      {member || pending || formState ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {formState === 'submitted' ? <Pill icon="assignment_turned_in" fg="#3D6B4F" bg="#E3EFE6" label={t('enq.formState_submitted')} size={16} /> : null}
          {formState === 'sent' || formState === 'opened' ? <Pill icon={formState === 'opened' ? 'drafts' : 'send'} fg="#7A5510" bg="#F6ECD6" label={t('enq.formState_' + formState)} size={16} /> : null}
          {formState === 'inProgress' ? <Pill icon="edit_note" fg="#7A5510" bg="#F6ECD6" label={t('enq.formState_inProgress', { n: e.form?.step ?? 1 })} size={16} /> : null}
          {formState === 'expired' ? <Pill icon="link_off" fg="#6B6259" bg="var(--fill, #F4F4F5)" label={t('enq.formState_expired')} size={16} /> : null}
          {member ? (regAttached
            ? <Pill icon="check_circle" fg="#3D6B4F" bg="#E3EFE6" label={t('enq.regAttached')} size={16} />
            : <Pill icon="description" fg="#7A5510" bg="#F6ECD6" label={t('enq.regMissing')} size={16} />) : null}
          {pending ? <BadgePill kind="pending" label={t('common.pendingApproval')} /> : null}
        </div>
      ) : null}
      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: phone ? 15 : 13, lineHeight: phone ? '22px' : '19px' }}>
        <Icon name={STAGE_ICON[e.stage]} size={phone ? 19 : 17} color="var(--accent, #75624B)" />
        <span>{nextText(t, fds, e)}</span>
      </div>
      <LeadTimeline e={e} size={phone ? 14 : 13} />
      {e.stage === 'lost' && e.lost?.note ? <span style={{ fontSize: 13, color: '#5E5852', lineHeight: 1.4 }}>{e.lost.note}</span> : null}
      {e.notes ? <span style={{ fontSize: 13, color: '#5E5852', lineHeight: 1.4, overflowWrap: 'anywhere' }}>{e.notes}</span> : null}
      {actions.length ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{actions}</div> : null}
      {e.stage !== 'joined' && !overlay ? (
        phone ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, paddingTop: 8, borderTop: HAIRLINE }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#6B6259', lineHeight: 1.4, paddingRight: 2 }}>{t('enq.moveTo')}</span>
            <div style={{ display: 'contents' }}>
              {ENQ_STAGES.filter((k) => k !== e.stage).map((k) => (
                <button key={k} type="button" data-move={k} className="cp-press cp-fill" onClick={() => void h.move(e, k)} style={{ height: 34, padding: '0 14px', borderRadius: 999, border: 'none', background: 'var(--fill, #F4F4F5)', color: '#24201C', fontSize: 14, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Inter' }}>{t('enq.stage.' + k)}</button>
              ))}
            </div>
          </div>
        ) : (
          <div><Button size={44} variant="quiet" icon="swap_horiz" onClick={() => h.openMove(e)} style={{ fontSize: 13 }}>{t('enq.moveTo')}</Button></div>
        )
      ) : null}
    </div>
  );
}
