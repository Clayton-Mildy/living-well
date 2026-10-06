// Members list (design ScrMembers): search (names, family names, phone numbers), six filter chips with counts, one compact row per member
// (avatar, name, status, plan chip) so many members fit at a glance, paged. "Add member" (the floating pin on phones).
// Pending new members are listed as "Pending approval". The details (age, mobility, allergies, medicines) live on the profile.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { flexMonth, memberName, initials, ym } from '@cp/shared';
import { FILTERS, MEMBER_FILTERS, filterCounts, matchesQuery, memberRows, type MemberFilter, type MemberRow } from '@cp/shared/rules/members';
import { FilterChips, Icon, PageHead, Pager, Pin, TONES, photoBg, usePaged, FONT_BODY } from '../../components/ui';
import { memberPhoto, photoFill } from '../../lib/media';
import { useDevice, padFor } from '../../hooks/useDevice';
import { useNow } from '../../lib/clock';
import { useFmt, useT } from '../../lib/i18n';
import { useMe } from '../../lib/me';
import { useClub } from '../../store/replica';
import { AddMemberDialog } from './dialogs/AddMemberDialog';
import { rowStatusText, STATUS_STYLE } from './lib';

const PAGE_SIZE = 10;

export function MembersList() {
  const s = useClub();
  const t = useT();
  const fmt = useFmt();
  const { today } = useNow();
  const { role } = useMe();
  const { device, isPhone } = useDevice();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [f, setF] = useState<MemberFilter>('active');
  const [adding, setAdding] = useState(false);
  const rows = useMemo(() => memberRows(s, today), [s, today]);
  const counts = useMemo(() => filterCounts(rows), [rows]);
  const visible = useMemo(() => rows.filter(FILTERS[f]).filter((r) => matchesQuery(s, r.m, q)), [rows, f, q, s]);
  const paged = usePaged(visible, PAGE_SIZE, `${f}|${q}`);
  const canAdd = role === 'lobby' || role === 'mgmt';
  const pendingN = rows.filter((r) => r.pending).length;
  const clinical = role !== 'finance';
  const open = (r: MemberRow) => navigate(`/members/${r.m.id}`);

  const planChip = (r: MemberRow) => {
    if (r.plan === 'gold') return { text: t('members.planGold'), tip: t('members.planGoldTip'), bg: '#282828', fg: '#FFFFFF', bd: 'none' };
    const fm = flexMonth(s, r.m, ym(today), today);
    const quota = fm.quota ?? 0;
    const n = Math.min(fm.used, quota);
    return { text: t('members.planFlex', { n, q: quota }), tip: t('members.planFlexTip', { n, q: quota }), bg: '#F4F0EE', fg: '#282828', bd: '1px solid #CAB8A2' };
  };
  const chip = (r: MemberRow) => {
    const pc = planChip(r);
    return <span title={pc.tip} style={{ height: 30, padding: '0 11px', borderRadius: 999, background: pc.bg, color: pc.fg, border: pc.bd, fontSize: FONT_BODY, fontWeight: 500, display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap', flex: 'none' }}>{pc.text}</span>;
  };
  /** Icon-only markers: a health reading that needs a look (nurse, teachers, front desk, management) and an overdue invoice. The full detail is on the profile. */
  const marks = (r: MemberRow) => {
    const out: { icon: string; label: string; bg: string; fg: string }[] = [];
    if (clinical && r.hs && r.lr) out.push(r.hs === 'alert' ? { icon: 'warning', label: `${t('status.alert')} · BP ${r.lr.sys}/${r.lr.dia}`, bg: '#AF4B2F', fg: '#FFFFFF' } : { icon: 'visibility', label: `${t('status.watch')} · BP ${r.lr.sys}/${r.lr.dia}`, bg: '#F6ECD6', fg: '#7A5510' });
    if (r.od) out.push({ icon: 'error', label: t('members.paymentOverdue'), bg: '#AF4B2F', fg: '#FFFFFF' });
    return out;
  };

  return (
    <>
      <div style={{ padding: padFor(device), display: 'flex', flexDirection: 'column', gap: isPhone ? 12 : 20 }}>
        <PageHead size={40} eyebrow={`${t('members.eyebrow', { n: counts.active })}${pendingN ? ' · ' + t('members.eyebrowPending', { n: pendingN }) : ''}${isPhone ? '' : ' · ' + fmt.fdl(today)}`} title={t('nav.members')}
          right={
            <>
              {canAdd && !isPhone ? (
                <button type="button" className="dh33" onClick={() => setAdding(true)} style={{ marginLeft: 'auto', height: 52, padding: '0 22px 0 18px', borderRadius: 999, border: 'none', background: '#75624B', color: '#FFFFFF', fontSize: 16, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Inter' }}>
                  <Icon name="person_add" size={22} />
                  {t('members.add')}
                </button>
              ) : null}
              <label style={{ flex: '0 1 380px', minWidth: 240, display: 'flex', alignItems: 'center', gap: 8, height: 'var(--cp-field-h, 52px)', padding: '0 14px', border: '1px solid #8A755B', borderRadius: 16, background: '#FFFFFF' }}>
                <Icon name="search" size={22} color="#75624B" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('members.searchPh')} aria-label={t('members.searchLabel')} style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', height: '100%', fontSize: 16, fontFamily: 'Inter', color: '#282828', background: 'transparent' }} />
              </label>
            </>
          } />
        <FilterChips label={t('members.filter')} value={f} onChange={setF} options={MEMBER_FILTERS.map((k) => ({ value: k, label: t('members.f.' + k), count: counts[k] }))} />
        <div style={{ background: '#FFFFFF', border: '1px solid #DBD7D6', borderRadius: 24, overflow: 'hidden' }}>
          {paged.rows.map((r, i) => {
            const st = STATUS_STYLE[r.st.key];
            const tone = TONES[r.m.photoTone % 5];
            const ms = marks(r);
            return (
              <button key={r.m.id} type="button" className="dh34" onClick={() => open(r)} data-member={r.m.id}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: isPhone ? 10 : 14, padding: isPhone ? '8px 12px 8px 14px' : '8px 20px', minHeight: 64, border: 'none', borderTop: i ? '1px solid #EFECEA' : 'none', background: '#FFFFFF', textAlign: 'left', cursor: 'pointer', color: '#282828', fontFamily: 'Inter' }}>
                <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 999, background: photoFill(memberPhoto(r.m), photoBg(r.m.photoTone)), color: tone[1], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 500, flex: 'none', boxShadow: 'inset 0 0 0 2px #FFFFFF, 0 0 0 1px #DBD7D6' }}>{r.m.photoMediaId ? null : initials(memberName(r.m))}</span>
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <span style={{ fontSize: 17, lineHeight: '24px', fontWeight: 500, ...(isPhone ? { overflowWrap: 'anywhere' } : { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }) }}>{memberName(r.m)}</span>
                  {/* on a phone the plan chip sits beside the status, so the name keeps the whole width */}
                  <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '2px 10px' }}>
                    <span style={{ display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.35 }}>
                      <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 999, background: st.dot, flex: 'none', marginTop: 6 }} />
                      <span style={{ minWidth: 0 }}>{rowStatusText(t, r.st, r.lastVisit, fmt.fds)}{r.endsOn && !r.ended ? ` · ${t('members.endingOn', { d: fmt.fds(r.endsOn) })}` : ''}</span>
                    </span>
                    {isPhone ? chip(r) : null}
                  </span>
                </span>
                {ms.map((a, j) => (
                  <span key={j} role="img" aria-label={a.label} title={a.label} style={{ width: 28, height: 28, borderRadius: 999, background: a.bg, color: a.fg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                    <Icon name={a.icon} size={18} fill={1} />
                  </span>
                ))}
                {isPhone ? null : chip(r)}
                <Icon name="chevron_right" size={22} color="#75624B" style={{ flex: 'none' }} />
              </button>
            );
          })}
          {!visible.length ? (
            <div style={{ padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, borderRadius: 999, background: '#F4F0EE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="person_search" size={30} color="#8A755B" /></div>
              <div style={{ fontSize: 20, letterSpacing: '-0.3px' }}>{t('members.noMatch')}</div>
              <div style={{ fontSize: 16, color: '#6A6967', lineHeight: 1.4 }}>{t('members.noMatchSub')}</div>
            </div>
          ) : null}
        </div>
        {paged.pages > 1 ? <Pager page={paged.page} pages={paged.pages} onPage={paged.setPage} label={t('members.pagerLabel')} /> : null}
      </div>
      {isPhone && canAdd ? <Pin icon="person_add" label={t('members.add')} onClick={() => setAdding(true)} /> : null}
      {adding ? <AddMemberDialog open onClose={() => setAdding(false)} /> : null}
    </>
  );
}
