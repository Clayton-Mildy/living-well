// Members list (design ScrMembers): search (names, family names, phone numbers), six filter chips with counts, one compact row per member
// (avatar, name, status, plan chip) so many members fit at a glance, paged. "Add member" (the floating pin on phones).
// Pending new members are listed as "Pending approval". The details (age, mobility, allergies, medicines) live on the profile.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { flexMonth, memberName, initials, ym } from '@cp/shared';
import { FILTERS, MEMBER_FILTERS, MEMBER_SORTS, filterCounts, matchesQuery, memberRows, sortMemberRows, type MemberFilter, type MemberRow, type MemberSort } from '@cp/shared/rules/members';
import { FilterChips, Icon, PageHead, Pager, Pin, Select, TONES, photoBg, usePaged } from '../../components/ui';
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
  const [sort, setSort] = useState<MemberSort>('name');
  const [adding, setAdding] = useState(false);
  const rows = useMemo(() => memberRows(s, today), [s, today]);
  const counts = useMemo(() => filterCounts(rows), [rows]);
  const visible = useMemo(() => sortMemberRows(rows.filter(FILTERS[f]).filter((r) => matchesQuery(s, r.m, q)), sort), [rows, f, q, s, sort]);
  const paged = usePaged(visible, PAGE_SIZE, `${f}|${q}|${sort}`);
  const canAdd = role === 'lobby' || role === 'mgmt';
  const pendingN = rows.filter((r) => r.pending).length;
  const clinical = role !== 'finance';
  const open = (r: MemberRow) => navigate(`/members/${r.m.id}`);

  const planText = (r: MemberRow) => {
    if (r.plan === 'gold') return { text: t('members.planGold'), tip: t('members.planGoldTip') };
    const fm = flexMonth(s, r.m, ym(today), today);
    const quota = fm.quota ?? 0;
    const n = Math.min(fm.used, quota);
    return { text: t('members.planFlex', { n, q: quota }), tip: t('members.planFlexTip', { n, q: quota }) };
  };
  /** Quiet subscription dates: "Since 12 Mar 2025" and "Renews 31 Oct" / "Ends 31 Oct" / "Ended 30 Sep" (the year only when it is not this one). */
  const subDates = (r: MemberRow) => {
    const out: string[] = [];
    if (r.subStart) out.push(t('members.since', { d: fmt.fd(r.subStart, { day: 'numeric', month: 'short', year: 'numeric' }) }));
    if (r.subEnd) {
      const e = r.subEnd;
      out.push(t(e.kind === 'renews' ? 'members.renews' : e.kind === 'ends' ? 'members.endsOn' : 'members.endedOn', { d: fmt.fd(e.on, e.on.slice(0, 4) === today.slice(0, 4) ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' }) }));
    }
    return out;
  };
  const sortEl = (
    <Select ariaLabel={t('members.sortLabel')} value={sort} onChange={setSort} options={MEMBER_SORTS.map((k) => ({ value: k, label: t(`members.sort.${k}`) }))} />
  );
  /** Dot + short text markers: a health reading that needs a look (nurse, teachers, front desk, management) and an overdue invoice. The full detail is on the profile. */
  const marks = (r: MemberRow) => {
    const out: { label: string; short: string; dot: string; fg: string }[] = [];
    if (clinical && r.hs && r.lr) out.push(r.hs === 'alert' ? { label: `${t('status.alert')} · BP ${r.lr.sys}/${r.lr.dia}`, short: `BP ${r.lr.sys}/${r.lr.dia}`, dot: '#9A3D24', fg: '#9A3D24' } : { label: `${t('status.watch')} · BP ${r.lr.sys}/${r.lr.dia}`, short: `BP ${r.lr.sys}/${r.lr.dia}`, dot: '#7A5510', fg: '#7A5510' });
    if (r.od) out.push({ label: t('members.paymentOverdue'), short: t('members.paymentOverdue'), dot: '#9A3D24', fg: '#9A3D24' });
    return out;
  };
  const markEls = (r: MemberRow) => marks(r).map((a, j) => (
    <span key={j} role="img" aria-label={a.label} title={a.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 500, color: a.fg, whiteSpace: 'nowrap', flex: 'none' }}>
      <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 999, background: a.dot }} />
      <span aria-hidden="true">{a.short}</span>
    </span>
  ));

  return (
    <>
      <div style={{ padding: padFor(device), display: 'flex', flexDirection: 'column', gap: isPhone ? 14 : 24 }}>
        <PageHead size={40} eyebrow={`${t('members.eyebrow', { n: counts.active })}${pendingN ? ' · ' + t('members.eyebrowPending', { n: pendingN }) : ''}${isPhone ? '' : ' · ' + fmt.fdl(today)}`} title={t('nav.members')}
          right={canAdd && !isPhone ? (
            <button type="button" className="dh33" onClick={() => setAdding(true)} style={{ marginLeft: 'auto', height: 48, padding: '0 22px 0 18px', borderRadius: 12, border: 'none', background: '#24201C', color: '#FFFFFF', fontSize: 15, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Inter' }}>
              <Icon name="person_add" size={21} />
              {t('members.add')}
            </button>
          ) : undefined} />
        {isPhone ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <FilterChips label={t('members.filter')} value={f} onChange={setF} style={{ flex: '1 1 0', minWidth: 0 }} options={MEMBER_FILTERS.map((k) => ({ value: k, label: t('members.f.' + k), count: counts[k] }))} />
            <div style={{ flex: '1 1 0', minWidth: 0 }}>{sortEl}</div>
          </div>
        ) : (
          <FilterChips label={t('members.filter')} value={f} onChange={setF} options={MEMBER_FILTERS.map((k) => ({ value: k, label: t('members.f.' + k), count: counts[k] }))} />
        )}
        <div style={{ background: '#FFFFFF', border: '1px solid #EFE7DC', borderRadius: isPhone ? 24 : 28, boxShadow: 'var(--card-shadow)', padding: '8px clamp(18px, 3vw, 36px) 12px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px 20px', flexWrap: 'wrap', padding: '14px 0 6px' }}>
            {isPhone ? null : <div style={{ flex: '0 1 220px', minWidth: 0, marginRight: 'auto' }}>{sortEl}</div>}
            <label style={{ flex: isPhone ? '1 1 100%' : '0 1 340px', minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, height: 44, borderBottom: '1px solid #DDD1C2' }}>
              <Icon name="search" size={20} color="#75624B" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('members.searchPh')} aria-label={t('members.searchLabel')} style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', height: '100%', fontSize: 16, fontFamily: 'Inter', color: '#24201C', background: 'transparent' }} />
            </label>
          </div>
          {paged.rows.map((r, i) => {
            const tone = TONES[r.m.photoTone % 5];
            const st = STATUS_STYLE[r.st.key];
            const pc = planText(r);
            const mk = markEls(r);
            const sd = subDates(r);
            return (
              <button key={r.m.id} type="button" className="dh34 cp-bleed" onClick={() => open(r)} data-member={r.m.id}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: isPhone ? 12 : 16, padding: isPhone ? '10px 0' : '14px 0', minHeight: 72, border: 'none', borderTop: i ? '1px solid #F0EAE1' : 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', color: '#24201C', fontFamily: 'Inter' }}>
                <span aria-hidden="true" style={{ width: 46, height: 46, borderRadius: 999, background: photoFill(memberPhoto(r.m), photoBg(r.m.photoTone)), color: tone[1], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 500, flex: 'none', boxShadow: 'inset 0 0 0 2px #FFFFFF, 0 0 0 1px #E4DACD' }}>{r.m.photoMediaId ? null : initials(memberName(r.m))}</span>
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <span style={{ fontSize: 17, lineHeight: '24px', fontWeight: 500, ...(isPhone ? { overflowWrap: 'anywhere' } : { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }) }}>{memberName(r.m)}</span>
                  <span style={{ display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: 14, color: '#6B6259', lineHeight: '20px' }}>
                    <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 999, background: st.dot, flex: 'none', marginTop: 7 }} />
                    <span style={{ minWidth: 0 }}>
                      {rowStatusText(t, r.st, r.lastVisit, fmt.fds)}
                      {' · '}<span title={pc.tip}>{pc.text}</span>
                    </span>
                  </span>
                  {isPhone && (sd.length || mk.length) ? (
                    <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0 14px', fontSize: 13, lineHeight: '19px', color: '#7A7168' }}>
                      {sd.length ? <span data-sub-dates="">{sd.join(' · ')}</span> : null}
                      {mk}
                    </span>
                  ) : null}
                </span>
                {isPhone ? null : mk}
                {isPhone || !sd.length ? null : (
                  <span data-sub-dates="" style={{ flex: 'none', minWidth: 132, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontSize: 13, lineHeight: '19px', color: '#7A7168', whiteSpace: 'nowrap' }}>
                    {sd.map((x) => <span key={x}>{x}</span>)}
                  </span>
                )}
                <Icon name="chevron_right" size={22} color="#75624B" style={{ flex: 'none' }} />
              </button>
            );
          })}
          {!visible.length ? (
            <div style={{ padding: '44px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
              <div style={{ width: 60, height: 60, borderRadius: 999, background: '#F3EEE8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="person_search" size={28} color="#8A755B" /></div>
              <div style={{ fontSize: 20, letterSpacing: '-0.3px' }}>{t('members.noMatch')}</div>
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
