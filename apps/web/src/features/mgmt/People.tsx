// People / HR (design ScrHr, now real staff records): list + detail with Profile, Contract and KTP, Salary and bank,
// Notes and ratings, Attendance. Add, edit, deactivate; app access; masked pay; contract expiry warnings.
// On phone the list opens the detail as a full-screen panel with a back button.
import { Fragment, useEffect, useMemo, useState } from 'react';
import { useResetOn } from '../../lib/useResetOn';
import { useSearchParams } from 'react-router-dom';
import { addMonths, e164, fmtN, fmtPhone, live, parseN, rp, translate, ym, type Bank, type Staff, type StaffHr, type StaffRole, type StaffTime } from '@cp/shared';
import { BANKS, CONTRACTS, HR_NOTE_KINDS, STAFF_ROLES, TIME_KINDS, contractState, hoursLabel, minutesBetween, staffList, staffRating, staffTimeFor } from '@cp/shared/rules/mgmt';
import { Avatar, Button, Chip, DateField, Dialog, EmptyState, Icon, IconButton, InfoChip, Note, Pager, SectionLabel, TextField, TimeField, Toggle, usePaged, FONT_BODY } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { useT, useFmt } from '../../lib/i18n';
import { useNow } from '../../lib/clock';
import { useAct } from '../../lib/act';
import { api, ApiError } from '../../lib/api';
import { useMe } from '../../lib/me';
import { say } from '../../store/ui';

/** Job titles are free text; one that is just the English role name is shown in the reader's language. */
const titleOf = (t: (k: string) => string, x: Pick<Staff, 'title' | 'role'>) => (x.title === translate('en', `roles.${x.role}`) ? t(`roles.${x.role}`) : x.title);
import { useClub } from '../../store/replica';
import { Fact, ListCard, Page, PushPanel, labelStyle, chipRow, tn } from './common';

type Tab = 'profile' | 'contract' | 'pay' | 'notes' | 'att';
const TABS: Tab[] = ['profile', 'contract', 'pay', 'notes', 'att'];

export function People() {
  const t = useT();
  const { isPhone } = useDevice();
  const s = useClub();
  const [params, setParams] = useSearchParams();
  const [adding, setAdding] = useState(false);
  const list = staffList(s);
  const paged = usePaged(list, 8);
  const wanted = params.get('staff') || '';
  const selId = s.staff[wanted] && !s.staff[wanted].deletedAt ? wanted : isPhone ? '' : list[0]?.id || '';
  const sel = selId ? s.staff[selId] : undefined;
  const pick = (id: string) => setParams(id ? { staff: id } : {});
  // show the page the selected person is on (a new staff member or a deep link can land on a later page)
  useEffect(() => {
    const at = list.findIndex((x) => x.id === selId);
    if (at >= 0) paged.setPage(Math.floor(at / 8) + 1);
  }, [selId]); // eslint-disable-line react-hooks/exhaustive-deps
  const detail = sel ? <StaffDetail key={sel.id} staff={sel} /> : null;

  return (
    <Page max={1180}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ ...labelStyle, color: '#6A6967' }}>{t('people.eyebrow')}</div>
          <h1 style={{ margin: 0, fontSize: 36, lineHeight: '44px', fontWeight: 400, letterSpacing: '-0.5px', color: '#9A836C' }}>{t('nav.people')}</h1>
        </div>
        <Button icon="person_add" onClick={() => setAdding(true)}>{t('people.add')}</Button>
      </div>
      <div className="cp-hide-phone" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 16, background: '#282828', color: '#FFFFFF', fontSize: 16, lineHeight: '22px' }}>
        <Icon name="lock" size={22} color="#CAB8A2" />
        <span>{t('people.mgmtOnly')}</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
        <div style={{ flex: isPhone ? '1 1 100%' : '0 1 320px', minWidth: isPhone ? 0 : 260, background: '#FFFFFF', border: '1px solid #DBD7D6', borderRadius: 24, overflow: 'hidden' }}>
          {list.length ? paged.rows.map((x) => <StaffRow key={x.id} staff={x} selected={!isPhone && x.id === selId} onClick={() => pick(x.id)} />) : <EmptyState icon="badge" title={t('people.empty')} />}
          <Pager page={paged.page} pages={paged.pages} onPage={paged.setPage} label={t('people.pgStaff')} />
        </div>
        {!isPhone ? <div style={{ flex: '1 1 520px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>{detail}</div> : null}
      </div>
      {isPhone ? <PushPanel open={!!sel} onBack={() => pick('')} backLabel={t('nav.people')} title={sel?.name}><div style={{ padding: '16px 16px 28px', display: 'flex', flexDirection: 'column', gap: 14 }}>{detail}</div></PushPanel> : null}
      <StaffDialog open={adding} onClose={() => setAdding(false)} onSaved={(id) => { setAdding(false); if (id) pick(id); }} />
    </Page>
  );
}

function StaffRow({ staff: x, selected, onClick }: { staff: Staff; selected: boolean; onClick: () => void }) {
  const t = useT();
  const { today } = useNow();
  const c = contractState(x.hr, today);
  return (
    <button type="button" className="dh56" data-staff={x.id} onClick={onClick} aria-current={selected || undefined}
      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', minHeight: 64, border: 'none', borderBottom: '1px solid #EFECEA', background: selected ? '#F4F0EE' : '#FFFFFF', boxShadow: selected ? 'inset 3px 0 0 #75624B' : 'none', textAlign: 'left', cursor: 'pointer', color: '#282828', fontFamily: 'Inter', opacity: x.active ? 1 : 0.7 }}>
      <Avatar name={x.name} size={40} />
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{x.name}</span>
        <span style={{ fontSize: 'max(13px, var(--cp-body, 0px))', color: '#6A6967', lineHeight: 1.4 }}>{titleOf(t, x)}{!x.active ? ` · ${t('people.inactive')}` : ''}</span>
      </span>
      {x.active && (c.kind === 'soon' || c.kind === 'ended') ? <Icon name="schedule" size={22} color={c.kind === 'ended' ? '#AF4B2F' : '#7A5510'} fill={1} /> : null}
      <Icon name="chevron_right" size={22} color="#6A6967" />
    </button>
  );
}

// ---------- detail ----------
function StaffDetail({ staff: x }: { staff: Staff }) {
  const t = useT();
  const { fdy } = useFmt();
  const s = useClub();
  const act = useAct();
  const { id: meId } = useMe();
  const { today } = useNow();
  const [tab, setTab] = useState<Tab>('profile');
  const [reveal, setReveal] = useState(false);
  const [editing, setEditing] = useState(false);
  const [off, setOff] = useState(false);
  const [reset, setReset] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const c = contractState(x.hr, today);
  const h = x.hr;
  const mask = (v: string) => (reveal ? v : '•••• ••••');
  const roleOk = (r: StaffRole) => t('roles.' + r);
  // the server puts the password back to the default (never in club state); the username stays
  const doReset = async () => {
    if (resetBusy) return;
    setResetBusy(true);
    try {
      const r = await api<{ defaultPassword?: string }>('/api/account/reset-password', { body: { userId: x.id } });
      say(t('people.resetDone', { name: x.name, password: r.defaultPassword ?? '' }));
      setReset(false);
    } catch (e) {
      say(e instanceof ApiError ? t(e.code, e.params) : t('err.network'), { tone: 'error', icon: 'error' });
    } finally { setResetBusy(false); }
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <Avatar name={x.name} size={64} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: '1 1 200px', minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 28, lineHeight: '36px', fontWeight: 400, letterSpacing: '-0.5px', color: '#9A836C', overflowWrap: 'anywhere' }}>{x.name}</h2>
          <span style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{titleOf(t, x)} · {fmtPhone(x.phone)}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button size={44} variant="secondary" icon="edit" onClick={() => setEditing(true)}>{t('common.edit')}</Button>
          {x.active ? <Button size={44} variant="secondary" icon="person_off" onClick={() => setOff(true)} disabled={x.id === meId}>{t('people.deactivate')}</Button>
            : <Button size={44} icon="person_check" onClick={() => act('staff.reactivate', { staffId: x.id }, { ok: t('people.reactivated', { name: x.name }) })}>{t('people.reactivate')}</Button>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <InfoChip icon="badge" label={roleOk(x.role)} tone="cream" />
        {!x.active ? <InfoChip icon="person_off" label={t('people.inactive')} tone="rust" /> : null}
        {x.appAccess ? <InfoChip icon="smartphone" label={t('people.appOn')} tone="sage" /> : <InfoChip icon="phonelink_erase" label={t('people.appOff')} tone="linen" />}
        {c.kind === 'soon' ? <InfoChip icon="schedule" label={c.days === 0 ? t('people.endsToday') : tn(t, 'people.endsIn', c.days)} tone="ochre" /> : null}
        {c.kind === 'ended' ? <InfoChip icon="event_busy" label={tn(t, 'people.endedAgo', c.days)} tone="rust" /> : null}
      </div>
      <div role="tablist" aria-label={t('nav.people')} style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: 4, borderRadius: 24, background: '#F4F0EE' }}>
        {TABS.map((k) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            style={{ flex: 'none', height: 44, padding: '0 16px', borderRadius: 999, border: 'none', background: tab === k ? '#FFFFFF' : 'transparent', boxShadow: tab === k ? '0 1px 3px rgba(40,30,20,0.12)' : 'none', color: '#282828', fontSize: 16, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Inter' }}>{t('people.tab_' + k)}</button>
        ))}
      </div>

      {tab === 'profile' ? (
        <>
          <Facts rows={[
            [t('people.fRole'), roleOk(x.role)], [t('common.phone'), fmtPhone(x.phone)], [t('people.fUsername'), x.username || t('people.usernameNone')],
            [t('people.fApp'), x.appAccess ? t('common.yes') : t('common.no')], [t('people.fClub'), s.club.name],
            [t('people.fKnown'), x.knownAs || x.name.split(' ')[0]], [t('people.fSupervisor'), x.supervisor ? t('common.yes') : t('common.no')], [t('people.fRated'), x.rateable ? t('common.yes') : t('common.no')],
          ]} />
          <Toggle on={x.appAccess} disabled={!x.active || x.id === meId} label={t('people.toggleApp')} sub={x.role === 'housekeeping' || x.role === 'driver' ? t('people.toggleAppReq') : t('people.toggleAppSub')}
            onClick={() => act('staff.setAppAccess', { staffId: x.id, on: !x.appAccess }, { ok: x.appAccess ? t('people.appRevoked', { name: x.name }) : t('people.appGranted', { name: x.name }) })} />
          {x.appAccess ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
              <Button size={44} variant="secondary" icon="lock_reset" onClick={() => setReset(true)}>{t('people.resetPw')}</Button>
              <span style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{t('people.usernameHint')}</span>
            </div>
          ) : null}
        </>
      ) : null}

      {tab === 'contract' ? (
        <>
          <Facts rows={[
            [t('people.fContract'), t('people.contract_' + h.contract)], [t('people.fStart'), fdy(h.start)], [t('people.fEnd'), h.end ? fdy(h.end) : t('people.noEnd')],
            [t('people.fKtp'), h.ktpLast4 ? `•••• •••• •••• ${h.ktpLast4}` : '—'], [t('people.fKtpFile'), h.ktpOnFile ? t('people.onFile') : t('people.missing')],
          ]} />
          {c.kind === 'soon' ? <Note tone="ochre" icon="schedule">{c.days === 0 ? t('people.warnToday') : tn(t, 'people.warnSoon', c.days, { date: fdy(h.end!) })}</Note> : null}
          {c.kind === 'ended' ? <Note tone="rust" icon="event_busy">{t('people.warnEnded', { date: fdy(h.end!) })}</Note> : null}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12 }}>
            {([[t('people.docContract'), h.signed], [t('people.docKtp'), h.ktpOnFile]] as [string, boolean][]).map(([label, has]) => (
              <button key={label} type="button" onClick={() => say(has ? t('people.docOpened', { doc: label }) : t('people.docAsk', { name: x.name.split(' ')[0] }))}
                style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', color: '#282828', fontFamily: 'Inter' }}>
                <span style={{ width: '100%', aspectRatio: '4/3', borderRadius: 16, background: has ? 'linear-gradient(135deg, #FBF8F4 0%, #EADFD3 60%, #DCCFC0 100%)' : '#F6F5F5', border: has ? '1px solid #DBD7D6' : '1px dashed #CAB8A2' }} />
                <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{label + (has ? '' : ` · ${t('people.missingLc')}`)}</span>
              </button>
            ))}
          </div>
        </>
      ) : null}

      {tab === 'pay' ? (
        <>
          <div><Button variant="secondary" icon={reveal ? 'visibility_off' : 'visibility'} onClick={() => setReveal(!reveal)}>{reveal ? t('people.hidePay') : t('people.showPay')}</Button></div>
          <Facts rows={[
            [t('people.fSalary'), reveal ? rp(h.salary) : 'Rp ••••••••'], [t('people.fAllowance'), reveal ? rp(h.allowance) : 'Rp ••••••'], [t('people.fBank'), h.bank],
            [t('people.fAccount'), h.account ? (reveal ? h.account.replace(/(\d{4})(?=\d)/g, '$1 ') : `${mask('')} ${h.account.slice(-2)}`) : '—'], [t('people.fPaidOn'), t('people.paidOn')],
          ]} />
        </>
      ) : null}

      {tab === 'notes' ? <NotesTab staff={x} /> : null}
      {tab === 'att' ? <AttendanceTab staff={x} /> : null}

      <StaffDialog open={editing} onClose={() => setEditing(false)} staff={x} onSaved={() => setEditing(false)} />
      <Dialog open={reset} onClose={() => setReset(false)} eyebrow={x.username || undefined} title={t('people.resetTitle', { name: x.name })} maxWidth={480}
        footer={<><Button variant="secondary" onClick={() => setReset(false)}>{t('common.cancel')}</Button><Button onClick={doReset} disabled={resetBusy}>{t('people.resetPw')}</Button></>}>
        <div style={{ fontSize: 16, lineHeight: '24px' }}>{t('people.resetText', { name: x.knownAs || x.name.split(' ')[0] })}</div>
      </Dialog>
      <Dialog open={off} onClose={() => setOff(false)} title={t('people.deactivateTitle', { name: x.name })} maxWidth={480}
        footer={<><Button variant="secondary" onClick={() => setOff(false)}>{t('common.cancel')}</Button><Button variant="danger" onClick={async () => { const r = await act('staff.deactivate', { staffId: x.id }, { ok: t('people.deactivated', { name: x.name }) }); if (r.ok) setOff(false); }}>{t('people.deactivate')}</Button></>}>
        <div style={{ fontSize: 16, lineHeight: '24px' }}>{t('people.deactivateText')}</div>
      </Dialog>
    </>
  );
}

function Facts({ rows }: { rows: [string, string][] }) {
  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #DBD7D6', borderRadius: 24, padding: '8px 20px' }}>
      {rows.map(([k, v], i) => <Fact key={k} k={k} v={v} last={i === rows.length - 1} />)}
    </div>
  );
}

// ---------- notes and warnings, ratings ----------
function NotesTab({ staff: x }: { staff: Staff }) {
  const t = useT();
  const { fds } = useFmt();
  const s = useClub();
  const act = useAct();
  const [kind, setKind] = useState<(typeof HR_NOTE_KINDS)[number]>('note');
  const [text, setText] = useState('');
  const [del, setDel] = useState<string | null>(null);
  const notes = live(s.hrNotes).filter((n) => n.staffId === x.id).sort((a, b) => (a.on < b.on ? 1 : a.on > b.on ? -1 : 0));
  const notesPaged = usePaged(notes, 5);
  const rating = staffRating(s, x.id);
  const add = async () => {
    const r = await act('hrNote.add', { staffId: x.id, kind, text: text.trim() }, { ok: t('people.noteAdded') });
    if (r.ok) setText('');
  };
  const who = (a: string) => (a.startsWith('staff:') ? s.staff[a.slice(6)]?.knownAs || s.staff[a.slice(6)]?.name || '' : '');
  const KC = { warning: { icon: 'warning', fg: '#7A5510', bg: '#F6ECD6' }, note: { icon: 'sticky_note_2', fg: '#282828', bg: '#E8E1D8' }, praise: { icon: 'favorite', fg: '#3D6B4F', bg: '#E6EFE8' } } as const;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,280px),1fr))', gap: 16, alignItems: 'start' }}>
      <ListCard title={t('people.notesTitle')}>
        {notesPaged.rows.map((n) => (
          <Fragment key={n.id}>
            <div style={{ padding: '12px 20px', borderTop: '1px solid #EFECEA', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ height: 28, padding: '0 10px 0 6px', borderRadius: 999, background: KC[n.kind].bg, color: KC[n.kind].fg, fontSize: 'max(13px, var(--cp-small, 0px))', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name={KC[n.kind].icon} size={17} fill={1} />{t('people.nk_' + n.kind)}</span>
                <span style={{ flex: 1 }} />
                <IconButton icon="delete" label={t('people.deleteNote')} bordered={false} onClick={() => setDel(n.id)} />
              </div>
              <span style={{ fontSize: 16, lineHeight: '22px', overflowWrap: 'anywhere' }}>{n.text}</span>
              <span style={{ fontSize: 'max(13px, var(--cp-body, 0px))', color: '#6A6967', lineHeight: 1.4 }}>{[who(n.createdBy), fds(n.on)].filter(Boolean).join(' · ')}</span>
            </div>
          </Fragment>
        ))}
        {!notes.length ? <div style={{ padding: '12px 20px 18px', borderTop: '1px solid #EFECEA', fontSize: 16, color: '#6A6967' }}>{t('people.noneOnFile')}</div> : null}
        <Pager page={notesPaged.page} pages={notesPaged.pages} onPage={notesPaged.setPage} label={t('people.pgNotes')} />
        <div style={{ padding: '14px 20px 18px', borderTop: '1px solid #EFECEA', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SectionLabel>{t('people.addNote')}</SectionLabel>
          <div style={chipRow} role="radiogroup" aria-label={t('people.addNote')}>
            {HR_NOTE_KINDS.map((k) => <Chip key={k} selected={kind === k} onClick={() => setKind(k)}>{t('people.nk_' + k)}</Chip>)}
          </div>
          <TextField multiline rows={3} value={text} onChange={setText} placeholder={t('people.notePh')} label={t('people.noteText')} />
          <div><Button size={44} disabled={!text.trim()} onClick={add}>{t('people.addNoteBtn')}</Button></div>
        </div>
      </ListCard>
      <div style={{ background: '#FFFFFF', border: '1px solid #DBD7D6', borderRadius: 24, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={labelStyle}>{t('people.ratings')}</span>
        {rating ? (
          <>
            <span style={{ fontSize: 32, lineHeight: '40px', fontWeight: 300, fontVariantNumeric: 'tabular-nums' }}>{rating.avg.toFixed(1)} / 5</span>
            {x.hr.quote ? <span style={{ fontSize: 16, lineHeight: '22px' }}>“{x.hr.quote}”</span> : null}
            <span style={{ fontSize: 'max(13px, var(--cp-body, 0px))', color: '#6A6967', lineHeight: 1.4 }}>{tn(t, 'people.ratingN', rating.n)}</span>
            <div style={{ display: 'flex', flexDirection: 'column', marginTop: 6 }}>
              {rating.surveys.map((r) => (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderTop: '1px solid #EFECEA', fontSize: 16 }}>
                  <span>{r.title}</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{r.avg.toFixed(1)} · {tn(t, 'people.ratingsShort', r.n)}</span>
                </div>
              ))}
            </div>
          </>
        ) : <span style={{ fontSize: 16, color: '#6A6967', lineHeight: 1.4 }}>{x.rateable ? t('people.noRatingsYet') : t('people.noRating')}</span>}
      </div>
      <Dialog open={!!del} onClose={() => setDel(null)} title={t('people.deleteNoteTitle')} maxWidth={480}
        footer={<><Button variant="secondary" onClick={() => setDel(null)}>{t('common.cancel')}</Button><Button variant="danger" onClick={async () => { if (!del) return; const r = await act('hrNote.delete', { noteId: del }, { ok: t('people.noteDeleted') }); if (r.ok) setDel(null); }}>{t('common.delete')}</Button></>}>
        <div style={{ fontSize: 16, lineHeight: '24px' }}>{t('people.deleteNoteText')}</div>
      </Dialog>
    </div>
  );
}

// ---------- attendance (staff time) ----------
function AttendanceTab({ staff: x }: { staff: Staff }) {
  const t = useT();
  const { fds, fmonth } = useFmt();
  const s = useClub();
  const act = useAct();
  const { today, now } = useNow();
  const [month, setMonth] = useState(ym(today));
  const [dlg, setDlg] = useState<{ date: string; row?: StaffTime } | null>(null);
  const cur = ym(today);
  const data = useMemo(() => staffTimeFor(s, x.id, month), [s, x.id, month]);
  const byDate = new Map(data.rows.map((r) => [r.date, r]));
  const last = month === cur ? today : `${month}-31`;
  const days: string[] = [];
  for (let d = Number(last.slice(8)); d >= 1; d--) {
    const date = `${month}-${String(d).padStart(2, '0')}`;
    if (date > today) continue;
    const wd = new Date(date + 'T00:00:00Z').getUTCDay();
    if (byDate.has(date) || (wd >= 1 && wd <= 5)) days.push(date);
  }
  const todayRow = byDate.get(today);
  const daysPaged = usePaged(days, 10, month);
  const clockIn = () => act('staffTime.upsert', { staffId: x.id, date: today, kind: 'worked', from: now }, { ok: t('people.clockedIn', { time: now }) });
  const clockOut = () => act('staffTime.upsert', { staffId: x.id, date: today, kind: 'worked', from: todayRow?.from, to: now }, { ok: t('people.clockedOut', { time: now }) });
  const tile = (label: string, value: string) => (
    <div style={{ padding: '14px 16px', borderRadius: 18, background: '#F4F0EE', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 16, lineHeight: '22px', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 30, lineHeight: '36px', fontWeight: 300, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );
  const KC: Record<string, { icon: string; fg: string; bg: string }> = { worked: { icon: 'check_circle', fg: '#3D6B4F', bg: '#E6EFE8' }, leave: { icon: 'beach_access', fg: '#7A5510', bg: '#F6ECD6' }, sick: { icon: 'sick', fg: '#7A5510', bg: '#F6ECD6' }, off: { icon: 'event_busy', fg: '#6A6967', bg: '#EFECEA' } };
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <IconButton icon="chevron_left" label={t('common.previous')} onClick={() => setMonth(addMonths(month, -1))} />
        <span style={{ fontSize: 20, minWidth: 140, textAlign: 'center', letterSpacing: '-0.3px' }}>{fmonth(month, true)}</span>
        <IconButton icon="chevron_right" label={t('common.next')} onClick={() => setMonth(addMonths(month, 1))} style={{ opacity: month >= cur ? 0.4 : 1 }} />
        <span style={{ flex: 1 }} />
        {month === cur && x.active ? (
          !todayRow || todayRow.kind !== 'worked' ? <Button size={44} icon="login" onClick={clockIn}>{t('people.clockIn')}</Button>
            : !todayRow.to ? <Button size={44} icon="logout" onClick={clockOut}>{t('people.clockOut')}</Button> : null
        ) : null}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10 }}>
        {tile(t('people.attWorked'), String(data.worked))}
        {tile(t('people.attHours'), hoursLabel(data.minutes))}
        {tile(t('people.attLeave'), String(data.leave))}
        {tile(t('people.attSick'), String(data.sick))}
      </div>
      <ListCard title={t('people.attTitle')} meta={t('people.attHint')}>
        {days.length ? daysPaged.rows.map((date) => {
          const r = byDate.get(date);
          const k = r ? KC[r.kind] : null;
          const mins = r ? minutesBetween(r.from, r.to) : 0;
          return (
            <Fragment key={date}>
              <button type="button" className="h-row" data-att={date} onClick={() => setDlg({ date, row: r })} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', minHeight: 56, border: 'none', borderTop: '1px solid #EFECEA', background: '#FFFFFF', textAlign: 'left', cursor: 'pointer', color: '#282828', fontFamily: 'Inter' }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 500 }}>{fds(date)}</span>
                {r && k ? (
                  <>
                    <span style={{ fontSize: FONT_BODY, color: '#6A6967', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{r.kind === 'worked' ? `${r.from || '—'} – ${r.to || t('people.stillIn')}${mins ? ` · ${hoursLabel(mins)}` : ''}` : ''}</span>
                    <span style={{ height: 28, padding: '0 10px 0 6px', borderRadius: 999, background: k.bg, color: k.fg, fontSize: 'max(13px, var(--cp-small, 0px))', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}><Icon name={k.icon} size={17} fill={1} />{t('people.tk_' + r.kind)}</span>
                  </>
                ) : <span style={{ fontSize: FONT_BODY, color: '#6A6967' }}>{t('people.noEntry')}</span>}
                <Icon name="edit" size={20} color="#75624B" />
              </button>
            </Fragment>
          );
        }) : <div style={{ padding: '12px 20px 18px', borderTop: '1px solid #EFECEA', fontSize: 16, color: '#6A6967' }}>{t('people.attNone')}</div>}
        <Pager page={daysPaged.page} pages={daysPaged.pages} onPage={daysPaged.setPage} label={t('people.pgDays')} />
      </ListCard>
      {dlg ? <TimeDialog staff={x} date={dlg.date} row={dlg.row} onClose={() => setDlg(null)} /> : null}
    </>
  );
}

function TimeDialog({ staff: x, date, row, onClose }: { staff: Staff; date: string; row?: StaffTime; onClose: () => void }) {
  const t = useT();
  const { fdl } = useFmt();
  const act = useAct();
  const [kind, setKind] = useState<StaffTime['kind']>(row?.kind || 'worked');
  const [from, setFrom] = useState(row?.from || '08:00');
  const [to, setTo] = useState(row?.to || '');
  const bad = kind === 'worked' && (!from || (!!to && to <= from));
  const save = async () => {
    const r = await act('staffTime.upsert', { staffId: x.id, date, kind, ...(kind === 'worked' ? { from, ...(to ? { to } : {}) } : {}) }, { ok: t('people.timeSaved') });
    if (r.ok) onClose();
  };
  const remove = async () => {
    const r = await act('staffTime.remove', { staffId: x.id, date }, { ok: t('people.timeRemoved') });
    if (r.ok) onClose();
  };
  return (
    <Dialog open onClose={onClose} eyebrow={x.name} title={fdl(date)} maxWidth={520}
      footer={<>{row ? <Button variant="secondary" onClick={remove}>{t('common.remove')}</Button> : null}<Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button disabled={bad} onClick={save}>{t('common.save')}</Button></>}>
      <div style={chipRow} role="radiogroup" aria-label={t('people.attTitle')}>
        {TIME_KINDS.map((k) => <Chip key={k} selected={kind === k} onClick={() => setKind(k)}>{t('people.tk_' + k)}</Chip>)}
      </div>
      {kind === 'worked' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10 }}>
          <TimeField label={t('people.clockInL')} value={from} onChange={setFrom} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
            <div style={{ width: '100%' }}><TimeField label={t('people.clockOutL')} value={to} onChange={setTo} min={from || undefined} error={to && to <= from ? t('people.err.timeOrder') : false} hint={to ? undefined : t('people.stillInHint')} /></div>
            {to ? <Button size={44} variant="ghost" onClick={() => setTo('')}>{t('people.stillIn')}</Button> : null}
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}

// ---------- add / edit dialog ----------
interface SForm {
  name: string; knownAs: string; title: string; role: StaffRole; phone: string; supervisor: boolean; rateable: boolean; appAccess: boolean;
  contract: StaffHr['contract']; start: string; end: string; signed: boolean; ktpLast4: string; ktpOnFile: boolean; salary: string; allowance: string; bank: Bank; account: string;
}
const RATEABLE: StaffRole[] = ['lobby', 'nurse', 'activity', 'driver'];
function formOf(x: Staff | undefined, today: string): SForm {
  return {
    name: x?.name ?? '', knownAs: x?.knownAs ?? '', title: x?.title ?? '', role: x?.role ?? 'lobby', phone: x ? fmtPhone(x.phone) : '', supervisor: x?.supervisor ?? false, rateable: x?.rateable ?? true, appAccess: x?.appAccess ?? false,
    contract: x?.hr.contract ?? 'pkwt', start: x?.hr.start ?? today, end: x?.hr.end ?? '', signed: x?.hr.signed ?? false, ktpLast4: x?.hr.ktpLast4 ?? '', ktpOnFile: x?.hr.ktpOnFile ?? false,
    salary: x ? fmtN(x.hr.salary) : '', allowance: x ? fmtN(x.hr.allowance) : '', bank: x?.hr.bank ?? 'BCA', account: x?.hr.account ?? '',
  };
}

function StaffDialog({ open, onClose, staff, onSaved }: { open: boolean; onClose: () => void; staff?: Staff; onSaved: (id?: string) => void }) {
  const t = useT();
  const act = useAct();
  const { today } = useNow();
  const { id: meId } = useMe();
  const [f, setF] = useState<SForm>(() => formOf(staff, today));
  const [busy, setBusy] = useState(false);
  useResetOn(open ? 'open' : null, () => setF(formOf(staff, today)));
  const set = (p: Partial<SForm>) => setF((x) => ({ ...x, ...p }));
  const phoneOk = e164(f.phone).replace(/\D/g, '').length >= 8;
  const errs = {
    name: !f.name.trim(), title: !f.title.trim(), phone: !phoneOk, ktp: f.ktpLast4 !== '' && !/^\d{4}$/.test(f.ktpLast4),
    end: f.contract === 'pkwt' && (!f.end || f.end < f.start), account: f.account !== '' && !/^\d{6,20}$/.test(f.account.replace(/[\s-]/g, '')),
  };
  const ok = !Object.values(errs).some(Boolean);
  const [touched, setTouched] = useState(false);
  const show = (k: keyof typeof errs) => touched && errs[k];
  const hr = {
    contract: f.contract, start: f.start, end: f.contract === 'pkwt' ? f.end : null, signed: f.signed, ktpLast4: f.ktpLast4, ktpOnFile: f.ktpOnFile, salary: parseN(f.salary), allowance: parseN(f.allowance), bank: f.bank, account: f.account.replace(/[\s-]/g, ''),
  };
  const save = async () => {
    setTouched(true);
    if (!ok || busy) return;
    setBusy(true);
    try {
      if (!staff) {
        const r = await act('staff.create', { name: f.name.trim(), knownAs: f.knownAs.trim() || undefined, role: f.role, title: f.title.trim(), phone: f.phone, supervisor: f.supervisor, rateable: f.rateable, appAccess: f.appAccess, hr }, { ok: t('people.added', { name: f.name.trim() }) });
        if (r.ok) onSaved(String(r.result.staffId));
      } else {
        const r = await act('staff.update', { staffId: staff.id, name: f.name.trim(), knownAs: f.knownAs.trim() || null, role: f.role, title: f.title.trim(), phone: f.phone, supervisor: f.supervisor, rateable: f.rateable, hr }, { ok: t('people.saved') });
        if (r.ok) onSaved(staff.id);
      }
    } finally { setBusy(false); }
  };
  const roleChange = (r: StaffRole) => set({ role: r, rateable: !staff ? RATEABLE.includes(r) : f.rateable });
  return (
    <Dialog open={open} onClose={onClose} eyebrow={staff ? t('people.editEyebrow') : t('people.addEyebrow')} title={staff ? staff.name : t('people.add')} maxWidth={640}
      footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button onClick={save} disabled={busy}>{staff ? t('common.saveChanges') : t('people.add')}</Button></>}>
      <SectionLabel>{t('people.secProfile')}</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 }}>
        <TextField label={t('common.name')} value={f.name} onChange={(v) => set({ name: v })} error={show('name') && t('err.invalid')} />
        <TextField label={t('people.fKnown')} value={f.knownAs} onChange={(v) => set({ knownAs: v })} hint={t('people.knownHint')} />
        <TextField label={t('people.fTitle')} value={f.title} onChange={(v) => set({ title: v })} error={show('title') && t('err.invalid')} />
        <TextField label={t('common.phone')} value={f.phone} onChange={(v) => set({ phone: v })} inputMode="tel" error={show('phone') && t('err.invalid')} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: FONT_BODY, fontWeight: 500, lineHeight: 1.4 }}>{t('people.fRole')}</span>
        <div style={chipRow} role="radiogroup" aria-label={t('people.fRole')}>
          {STAFF_ROLES.map((r) => <Chip key={r} selected={f.role === r} off={!!staff && staff.id === meId && r !== staff.role} onClick={() => roleChange(r)}>{t('roles.' + r)}</Chip>)}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 10 }}>
        <Toggle on={f.rateable} onClick={() => set({ rateable: !f.rateable })} label={t('people.fRated')} sub={t('people.ratedSub')} />
        <Toggle on={f.supervisor} onClick={() => set({ supervisor: !f.supervisor })} label={t('people.fSupervisor')} sub={t('people.supervisorSub')} />
        {!staff ? <Toggle on={f.appAccess} onClick={() => set({ appAccess: !f.appAccess })} label={t('people.toggleApp')} sub={f.role === 'housekeeping' || f.role === 'driver' ? t('people.toggleAppReq') : t('people.toggleAppSub')} /> : null}
      </div>
      <SectionLabel>{t('people.secContract')}</SectionLabel>
      <div style={chipRow} role="radiogroup" aria-label={t('people.fContract')}>
        {CONTRACTS.map((c) => <Chip key={c} selected={f.contract === c} onClick={() => set({ contract: c })}>{t('people.contract_' + c)}</Chip>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
        <DateField label={t('people.fStart')} value={f.start} onChange={(v) => set({ start: v })} />
        {f.contract === 'pkwt' ? <DateField label={t('people.fEnd')} value={f.end} min={f.start || undefined} onChange={(v) => set({ end: v })} error={show('end') && (f.end ? t('people.err.endBeforeStart') : t('people.err.endRequired'))} /> : null}
        <TextField label={t('people.ktpLast4')} value={f.ktpLast4} onChange={(v) => set({ ktpLast4: v.replace(/\D/g, '').slice(0, 4) })} inputMode="numeric" error={show('ktp') && t('err.invalid')} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 10 }}>
        <Toggle on={f.signed} onClick={() => set({ signed: !f.signed })} label={t('people.docContract')} sub={t('people.signedSub')} />
        <Toggle on={f.ktpOnFile} onClick={() => set({ ktpOnFile: !f.ktpOnFile })} label={t('people.fKtpFile')} sub={t('people.ktpSub')} />
      </div>
      <SectionLabel>{t('people.secPay')}</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 }}>
        <TextField label={t('people.fSalary')} prefix="Rp" value={f.salary} onChange={(v) => set({ salary: fmtN(v) })} inputMode="numeric" />
        <TextField label={t('people.fAllowance')} prefix="Rp" value={f.allowance} onChange={(v) => set({ allowance: fmtN(v) })} inputMode="numeric" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: FONT_BODY, fontWeight: 500, lineHeight: 1.4 }}>{t('people.fBank')}</span>
        <div style={chipRow} role="radiogroup" aria-label={t('people.fBank')}>
          {BANKS.map((b) => <Chip key={b} selected={f.bank === b} onClick={() => set({ bank: b })}>{b}</Chip>)}
        </div>
      </div>
      <TextField label={t('people.fAccount')} value={f.account} onChange={(v) => set({ account: v.replace(/[^\d\s-]/g, '') })} inputMode="numeric" error={show('account') && t('err.invalid')} />
    </Dialog>
  );
}
