// Step 1, the person: who joins (title, name, date of birth, address, the member's ID) and the form's personal answers. Add member can start
// from an open lead instead ("From a lead"): picking one turns the flow into that lead's Join.
import { useMemo, useState } from 'react';
import { fmtPhone, listName, live, sortBy, toHM, toMin, type ClubState, type Enquiry } from '@cp/shared';
import { genderOf } from '@cp/shared/rules/members';
import { seniorName } from '@cp/shared/rules/enquiries';
import { DateField, FONT_SMALL, HAIRLINE, Note } from '../../../components/ui';
import { useFmt } from '../../../lib/i18n';
import { SearchBar } from '../../mgmt/common';
import { ProfilePhotoField } from '../ProfilePhoto';
import { OptionalTime, RegPersonalFields, SelectField, TextField, TitleName } from '../dialogs/forms';
import { DupNote, OneId, Sec, setRegOf, type StepProps } from './parts';

const norm = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
/** Open leads (not joined, lost or archived) whose senior, contact or phone matches every word typed. */
export function matchLeads(s: ClubState, q: string): Enquiry[] {
  const words = norm(q).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return sortBy(live(s.enquiries).filter((e) => e.stage !== 'joined' && e.stage !== 'lost' && !e.archivedAt), (e) => seniorName(e)).filter((e) => {
    const hay = norm(`${seniorName(e)} ${e.contact.name}`);
    const digits = e.contact.phone.replace(/\D/g, '');
    return words.every((w) => hay.includes(w) || (/^\d{3,}$/.test(w.replace(/\D/g, '')) && digits.includes(w.replace(/\D/g, '').replace(/^0/, ''))));
  });
}

export function PersonStep({ p, onPickLead }: { p: StepProps; onPickLead: (id: string) => void }) {
  const { st, set, t, s, today, mode } = p;
  const { fds } = useFmt();
  const [q, setQ] = useState('');
  const leads = useMemo(() => (mode.kind === 'new' ? matchLeads(s, q).slice(0, 5) : []), [s, q, mode.kind]);
  const e = mode.kind === 'lead' ? s.enquiries[mode.id] : undefined;
  const online = e?.form?.submittedAt ? e.form.draft : undefined;
  const hours = { open: s.club.settings.open, last: toHM(toMin(s.club.settings.close) - 1) };
  const spouses = useMemo(() => sortBy(live(s.members).filter((m) => !m.review || m.review.status === 'approved'), (m) => m.firstName), [s.members]);
  const isNew = mode.kind === 'new';
  return (
    <>
      {isNew ? (
        <Sec p={p} label={t('reg.fromLead')}>
          <SearchBar value={q} onChange={setQ} label={t('reg.fromLead')} placeholder={t('reg.fromLeadPh')} />
          {q.trim() ? (
            leads.length ? (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {leads.map((x, i) => (
                  <button key={x.id} type="button" data-lead-pick={x.id} onClick={() => onPickLead(x.id)} className="h-fill"
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, padding: '10px 4px', minHeight: 48, border: 'none', borderTop: i ? HAIRLINE : undefined, background: 'transparent', textAlign: 'left', cursor: 'pointer', fontFamily: 'Inter', color: '#24201C' }}>
                    <span style={{ fontSize: 15, fontWeight: 500 }}>{seniorName(x)}</span>
                    <span style={{ fontSize: FONT_SMALL, color: '#6B6259' }}>{x.contact.name} · {fmtPhone(x.contact.phone)}</span>
                  </button>
                ))}
              </div>
            ) : <div style={{ fontSize: FONT_SMALL, color: '#6B6259' }}>{t('reg.noLeads')}</div>
          ) : null}
        </Sec>
      ) : null}
      {online && e?.form ? <Note tone="sage" icon="assignment_turned_in">{t('enq.formFilledBy', { name: e.form.filledBy || online.contact.name, date: fds(e.form.submittedAt!.slice(0, 10)) })}</Note> : null}
      <Sec p={p} label={t('profile.sec.details')}>
        {isNew ? <ProfilePhotoField name={st.name ? `${st.title} ${st.name}` : '?'} value={st.photo || null} onChange={(id) => set({ photo: id || '' })} /> : null}
        <TitleName d={st} set={(x) => set({ ...x, ...(x.title ? { gender: genderOf(x.title) } : {}) })} t={t} errors={{ name: p.err('name') }} />
        <DateField label={t('profile.f.dob')} value={st.dob} onChange={(v) => set({ dob: v })} max={today} startAt={`${+today.slice(0, 4) - 80}${today.slice(4)}`} error={p.err('dob')} />
        <TextField label={t('profile.f.address')} value={st.address} onChange={(v) => set({ address: v })} placeholder={t('profile.addressPh')} name="address" />
        <OneId p={p} who="member" />
        <DupNote p={p} nik={st.reg.ids.includes('member') ? st.reg.nik : ''} />
      </Sec>
      <Sec p={p} label={t('profile.sec.regPersonal')}>
        <RegPersonalFields d={st.reg} set={setRegOf(p)} t={t} err={p.err} />
        <DupNote p={p} phone={st.reg.mobile} />
        {isNew ? (
          <>
            <OptionalTime label={t('profile.f.usualOpt')} value={st.usual} onChange={(v) => set({ usual: v })} min={hours.open} max={hours.last} error={p.err('usualArrival')} t={t} />
            <SelectField label={t('profile.f.spouse')} value={st.spouseId} onChange={(v) => set({ spouseId: v })} placeholder={t('profile.noSpouse')} options={spouses.map((m) => ({ value: m.id, label: listName(m) }))} />
          </>
        ) : null}
      </Sec>
    </>
  );
}
