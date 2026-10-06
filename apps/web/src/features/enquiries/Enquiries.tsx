// Enquiries board (design ScrEnq): phone = stage chips + cards, wide = five columns with drag (@dnd-kit, touch capable).
// "Move to" works everywhere. New lead, edit, archive, reopen; visits and trials with a picked day and time; send the form link; review any ready form.
import { Fragment, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DndContext, DragOverlay, MouseSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import type { Enquiry } from '@cp/shared';
import { ENQ_STAGES, archivedEnquiries, enquiriesByStage, enquiryForm, formBadge, seniorName, type EnqStage, type FormBadge } from '@cp/shared/rules/enquiries';
import { Button, Dialog, FilterChips, Icon, IconButton, Pager, TextField, usePaged, FONT_BODY, FONT_SMALL } from '../../components/ui';
import { useDevice, padFor } from '../../hooks/useDevice';
import { useT, useFmt } from '../../lib/i18n';
import { useNow } from '../../lib/clock';
import { useAct } from '../../lib/act';
import { useClub } from '../../store/replica';
import { say } from '../../store/ui';
import { Pill, BadgePill, labelStyle } from '../mgmt/common';
import { EnquiryDialogs, type Dlg } from './dialogs';
import { nextText } from './text';

const STAGE_ICON: Record<EnqStage, string> = { new: 'call', visit: 'meeting_room', trial: 'waving_hand', joined: 'how_to_reg', lost: 'block' };
const norm = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
/** A lead matches a search by the senior's name or the contact's name (any part of either, ignoring case and accents). */
export const leadMatches = (e: Pick<Enquiry, 'senior' | 'contact'>, q: string) => {
  const words = norm(q).split(/\s+/).filter(Boolean);
  const hay = norm(`${seniorName(e)} ${e.senior.name} ${e.contact.name}`);
  return words.every((w) => hay.includes(w));
};
const FORM_STYLE: Record<FormBadge, [string, string, string]> = {
  sent: ['schedule', '#282828', '#E8E1D8'], opened: ['mark_email_read', '#282828', '#E8E1D8'], draft: ['edit_note', '#282828', '#E8E1D8'],
  ready: ['assignment_turned_in', '#7A5510', '#F6ECD6'], returned: ['undo', '#7A5510', '#F6ECD6'], approved: ['check_circle', '#3D6B4F', '#E6EFE8'],
};

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
  const all = useMemo(() => enquiriesByStage(s), [s]);
  // the search narrows every column (and the archive) to the leads whose senior or contact name matches; paging starts over on a new search
  const by = useMemo(() => (searching ? (Object.fromEntries(ENQ_STAGES.map((k) => [k, all[k].filter((e) => leadMatches(e, q))])) as typeof all) : all), [all, q, searching]);
  const archivedAll = archivedEnquiries(s);
  const archived = searching ? archivedAll.filter((e) => leadMatches(e, q)) : archivedAll;
  const phonePaged = usePaged(by[stage], 6, `${stage}|${q}`);
  const archivedPaged = usePaged(archived, 6, q);

  // deep links from other screens: /enquiries?e=<id> opens that lead, /enquiries?review=<id> opens the family's form for review (then Approve and join)
  useEffect(() => {
    const review = params.get('review');
    const id = params.get('e') || params.get('enquiry') || params.get('open');
    if (review && s.enquiries[review]) setDlg(enquiryForm(s, s.enquiries[review]) ? { mode: 'review', id: review } : { mode: 'edit', id: review });
    else if (id && s.enquiries[id]) setDlg({ mode: 'edit', id });
    else return;
    const p = new URLSearchParams(params);
    ['e', 'enquiry', 'open', 'review'].forEach((k) => p.delete(k));
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
    // a form waiting for review is reviewed first: approving it is the join
    const ready = formBadge(enquiryForm(s, e)) === 'ready';
    setDlg({ mode: to === 'joined' ? (ready ? 'review' : 'join') : to, id: e.id } as Dlg);
  };
  const sendForm = async (e: Enquiry) => {
    const r = await act('form.send', { target: { type: 'enquiry', id: e.id } }, { silent: true });
    if (r.ok) { say(t('enq.formSent', { contact: e.contact.name })); setDlg({ mode: 'link', id: e.id }); }
  };
  const handlers = {
    edit: (e: Enquiry) => setDlg({ mode: 'edit', id: e.id }),
    move: moveTo,
    openMove: (e: Enquiry) => setMoveFor(e),
    dialog: (mode: 'visit' | 'trial' | 'review' | 'join' | 'lost' | 'link', e: Enquiry) => setDlg({ mode, id: e.id }),
    sendForm,
    reopen: async (e: Enquiry) => { const r = await act('enquiry.reopen', { enquiryId: e.id }, { ok: t('enq.reopened', { name: seniorName(e) }) }); return r.ok; },
    profile: (e: Enquiry) => e.memberId && navigate(`/members/${e.memberId}`),
    fill: (token: string) => navigate(`/form/${token}`),
  };

  const onDragStart = (ev: DragStartEvent) => setActive(String(ev.active.id));
  const onDragEnd = (ev: DragEndEvent) => {
    setActive(null);
    const e = s.enquiries[String(ev.active.id)];
    const to = ev.over?.id as EnqStage | undefined;
    if (e && to && (ENQ_STAGES as readonly string[]).includes(to) && to !== e.stage) void moveTo(e, to);
  };
  const dragged = active ? s.enquiries[active] : undefined;
  const wide = !isPhone;

  return (
    <div style={{ padding: padFor(device), display: 'flex', flexDirection: 'column', gap: isPhone ? 12 : 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 640 }}>
          <div style={{ ...labelStyle, color: '#6A6967' }}>{fdl(today)}</div>
          <h1 style={{ margin: 0, fontSize: 40, lineHeight: '48px', fontWeight: 400, letterSpacing: '-0.5px', color: '#9A836C' }}>{t('nav.enquiries')}</h1>
          {wide ? <div style={{ fontSize: 16, lineHeight: '22px' }}>{t('enq.intro')}</div> : null}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {archivedAll.length ? <Button variant="secondary" icon="inventory_2" onClick={() => setShowArchived(!showArchived)}>{t('enq.archivedN', { n: archived.length })}</Button> : null}
          <Button icon="add" onClick={() => setDlg({ mode: 'new' })}>{t('enq.newLead')}</Button>
        </div>
      </div>

      <div style={{ maxWidth: 460 }}>
        <TextField label={isPhone ? <span className="sr-only">{t('enq.searchLabel')}</span> : t('enq.searchLabel')} type="search" inputMode="search" value={q} onChange={setQ} placeholder={t('enq.searchPh')} />
      </div>

      {isPhone ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <FilterChips label={t('enq.stageLabel')} value={stage} onChange={setStage} options={ENQ_STAGES.map((k) => ({ value: k, label: t('enq.stage.' + k), count: by[k].length }))} />
          {phonePaged.rows.map((e) => <LeadCard key={e.id} e={e} phone h={handlers} />)}
          <Pager page={phonePaged.page} pages={phonePaged.pages} onPage={phonePaged.setPage} label={t('enq.pgColumn', { stage: t('enq.stage.' + stage) })} />
          {!by[stage].length ? <div style={{ padding: '28px 16px', borderRadius: 20, border: '1px dashed #CAB8A2', textAlign: 'center', fontSize: 16, color: '#6A6967', lineHeight: 1.4 }}>{searching ? t('enq.noMatch', { q: q.trim() }) : t('enq.nobody')}</div> : null}
        </div>
      ) : (
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActive(null)}>
          <div style={{ display: 'flex', gap: 14, overflowX: 'auto', alignItems: 'flex-start', paddingBottom: 8 }}>
            {ENQ_STAGES.map((k) => (
              <Column key={k} stage={k} items={by[k]} resetKey={q} searching={searching} hint={k === 'trial' ? t('enq.trialHint') : ''} dragging={!!active} render={(e) => <DraggableCard key={e.id} e={e} h={handlers} />} />
            ))}
          </div>
          <DragOverlay>{dragged ? <LeadCard e={dragged} h={handlers} overlay /> : null}</DragOverlay>
        </DndContext>
      )}

      {showArchived && archived.length ? (
        <div style={{ background: '#FFFFFF', border: '1px solid #DBD7D6', borderRadius: 24, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px 10px' }}><span style={labelStyle}>{t('enq.archivedTitle')}</span></div>
          {archivedPaged.rows.map((e) => (
            <Fragment key={e.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 20px', borderTop: '1px solid #EFECEA' }}>
                <div style={{ flex: '1 1 200px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{seniorName(e)}</span>
                  <span style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{e.contact.name} · {t('enq.stage.' + e.stage)} · {fds(e.archivedAt!.slice(0, 10))}</span>
                </div>
                <Button size={44} variant="secondary" icon="unarchive" onClick={() => act('enquiry.archive', { enquiryId: e.id, restore: true }, { ok: t('enq.restored', { name: seniorName(e) }) })}>{t('enq.restore')}</Button>
              </div>
            </Fragment>
          ))}
          <Pager page={archivedPaged.page} pages={archivedPaged.pages} onPage={archivedPaged.setPage} label={t('enq.pgArchived')} />
        </div>
      ) : null}

      <EnquiryDialogs dlg={dlg} onClose={() => setDlg(null)} />
      <Dialog open={!!moveFor} onClose={() => setMoveFor(null)} eyebrow={t('enq.moveTo')} title={moveFor ? seniorName(moveFor) : ''} maxWidth={420}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {moveFor ? ENQ_STAGES.filter((k) => k !== moveFor.stage || k === 'visit' || k === 'trial').map((k) => (
            <Button key={k} variant="secondary" icon={STAGE_ICON[k]} full onClick={() => { const e = moveFor; setMoveFor(null); void moveTo(e, k); }}>{moveFor.stage === k ? (k === 'trial' ? t('enq.trialChange') : t('enq.reschedule', { stage: t('enq.stage.' + k).toLowerCase() })) : t('enq.stage.' + k)}</Button>
          )) : null}
        </div>
      </Dialog>
    </div>
  );
}

interface H {
  edit: (e: Enquiry) => void;
  move: (e: Enquiry, to: EnqStage) => Promise<void>;
  openMove: (e: Enquiry) => void;
  dialog: (mode: 'visit' | 'trial' | 'review' | 'join' | 'lost' | 'link', e: Enquiry) => void;
  sendForm: (e: Enquiry) => Promise<void>;
  reopen: (e: Enquiry) => Promise<boolean>;
  profile: (e: Enquiry) => void;
  fill: (token: string) => void;
}

function Column({ stage, items, resetKey, searching, hint, dragging, render }: { stage: EnqStage; items: Enquiry[]; resetKey: string; searching: boolean; hint: string; dragging: boolean; render: (e: Enquiry) => React.ReactNode }) {
  const t = useT();
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const over = isOver && dragging;
  const count = items.length;
  const paged = usePaged(items, 6, resetKey);
  return (
    <div ref={setNodeRef} data-stage={stage} role="region" aria-label={t('enq.stage.' + stage)}
      style={{ flex: '1 0 250px', minWidth: 250, maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 10, padding: 12, borderRadius: 24, background: over ? '#E8E1D8' : '#F4F0EE', border: over ? '2px dashed #75624B' : '2px solid transparent' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '4px 6px 0' }}>
        <span style={{ fontSize: FONT_SMALL, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600, lineHeight: '18px' }}>{t('enq.stage.' + stage)}</span>
        <span style={{ minWidth: 28, height: 28, padding: '0 8px', borderRadius: 999, background: '#FFFFFF', fontSize: FONT_BODY, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{count}</span>
      </div>
      {hint ? <div style={{ fontSize: FONT_SMALL, color: '#282828', padding: '0 6px', lineHeight: 1.4 }}>{hint}</div> : null}
      {paged.rows.map(render)}
      <Pager page={paged.page} pages={paged.pages} onPage={paged.setPage} label={t('enq.pgColumn', { stage: t('enq.stage.' + stage) })} />
      {!count ? <div style={{ padding: '20px 8px', borderRadius: 16, border: '1px dashed #CAB8A2', textAlign: 'center', fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{searching ? t('enq.noMatchShort') : t('enq.dropHere')}</div> : null}
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
  const form = enquiryForm(s, e);
  const badge = formBadge(form);
  const fs = badge ? FORM_STYLE[badge] : null;
  const pending = e.stage === 'joined' && e.memberId && s.members[e.memberId]?.review?.status === 'pending';
  const open = e.stage === 'new' || e.stage === 'visit' || e.stage === 'trial';
  const sz = phone ? 16 : FONT_BODY;
  const A = (variant: 'primary' | 'secondary' | 'ghost', label: string, onClick: () => void, key = label) => <Button key={key} size={44} variant={variant} onClick={onClick} style={{ fontSize: sz }}>{label}</Button>;
  const actions: React.ReactNode[] = [];
  // a form waiting for review comes first: approving it opens Join (plan and first day) in the same flow, so there is no separate Join button next to it
  const ready = badge === 'ready';
  const stageAction = ready ? 'secondary' : 'primary';
  if (ready) actions.push(A('primary', t('enq.reviewForm'), () => h.dialog('review', e)));
  if (e.stage === 'new') actions.push(A(stageAction, t('enq.bookVisit'), () => h.dialog('visit', e)));
  if (e.stage === 'visit') actions.push(A(stageAction, t('enq.bookTrial'), () => h.dialog('trial', e)));
  if (e.stage === 'trial' && !ready) actions.push(A('primary', t('enq.join'), () => h.dialog('join', e)));
  if (open && badge === 'approved') actions.push(A('primary', t('enq.join'), () => h.dialog('join', e)));
  if (e.stage === 'joined' && e.memberId) actions.push(A('secondary', t('enq.openProfile'), () => h.profile(e)));
  if (e.stage === 'lost') actions.push(A('primary', t('enq.reopen'), () => void h.reopen(e)));
  if (badge === 'approved') actions.push(A('ghost', t('enq.viewForm'), () => h.dialog('review', e)));
  if (open && !form) actions.push(A('secondary', t('enq.sendForm'), () => void h.sendForm(e)));
  if (form && ['sent', 'opened', 'draft', 'returned'].includes(form.status) && open) {
    actions.push(A('ghost', t('enq.formLink'), () => h.dialog('link', e)));
    actions.push(A('ghost', t('enq.fillAsFamily'), () => h.fill(form.token)));
  }
  if ((e.stage === 'visit' || e.stage === 'trial') && e.next?.date) actions.push(A('ghost', t(e.stage === 'trial' ? 'enq.changeDay' : 'enq.changeTime'), () => h.dialog(e.stage as 'visit' | 'trial', e)));
  if (open) actions.push(A('ghost', t('enq.lostAction'), () => h.dialog('lost', e)));
  const chipStyle: CSSProperties = { height: phone ? 28 : 26, padding: '0 10px', borderRadius: 999, background: '#F4F0EE', fontSize: phone ? FONT_BODY : FONT_SMALL, display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' };
  return (
    <div data-lead={e.id} style={{ background: '#FFFFFF', border: '1px solid #DBD7D6', borderRadius: phone ? 20 : 18, padding: phone ? 12 : 14, display: 'flex', flexDirection: 'column', gap: phone ? 8 : 10, cursor: phone || overlay ? 'default' : 'grab', boxShadow: overlay ? '0 12px 28px rgba(117,98,75,0.22)' : phone ? undefined : '0 2px 6px rgba(117,98,75,0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: phone ? 17 : 16, fontWeight: 500, lineHeight: 1.4, overflowWrap: 'anywhere' }}>{seniorName(e)}</span>
          <span style={{ fontSize: phone ? 16 : FONT_BODY, color: '#6A6967', lineHeight: 1.4, overflowWrap: 'anywhere' }}>{e.contact.name} · {t('enq.rel_' + e.contact.relation).toLowerCase()}</span>
        </div>
        <IconButton icon="edit" label={t('enq.editLead')} bordered={false} onClick={() => h.edit(e)} style={{ margin: '-6px -6px 0 0' }} />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <span style={chipStyle}>{t('enq.src_' + e.source)}</span>
        {fs && badge && e.stage !== 'joined' ? <Pill icon={fs[0]} fg={fs[1]} bg={fs[2]} label={t('enq.form_' + badge)} size={16} /> : null}
        {pending ? <BadgePill kind="pending" label={t('common.pendingApproval')} /> : null}
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: phone ? 16 : FONT_BODY, lineHeight: phone ? '22px' : '20px' }}>
        <Icon name={STAGE_ICON[e.stage]} size={phone ? 20 : 18} color="#75624B" />
        <span>{nextText(t, fds, e)}</span>
      </div>
      {e.stage === 'lost' && e.lost?.note ? <span style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{e.lost.note}</span> : null}
      {e.notes ? <span style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4, overflowWrap: 'anywhere' }}>{e.notes}</span> : null}
      {actions.length ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{actions}</div> : null}
      {e.stage !== 'joined' && !overlay ? (
        phone ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, paddingTop: 8, borderTop: '1px solid #EFECEA' }}>
            <span style={{ fontSize: FONT_BODY, fontWeight: 500, color: '#6A6967', lineHeight: 1.4, paddingRight: 2 }}>{t('enq.moveTo')}</span>
            <div style={{ display: 'contents' }}>
              {ENQ_STAGES.filter((k) => k !== e.stage).map((k) => (
                <button key={k} type="button" data-move={k} className="cp-chip" onClick={() => void h.move(e, k)} style={{ height: 44, padding: '0 14px', borderRadius: 999, border: '1px solid #CAB8A2', background: '#FFFFFF', color: '#282828', fontSize: 16, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Inter' }}>{t('enq.stage.' + k)}</button>
              ))}
            </div>
          </div>
        ) : (
          <div><Button size={44} variant="quiet" icon="swap_horiz" onClick={() => h.openMove(e)} style={{ fontSize: FONT_BODY }}>{t('enq.moveTo')}</Button></div>
        )
      ) : null}
    </div>
  );
}
