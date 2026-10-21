// KC round 10: the public registration page (/form/:token). A family opens the link the front desk sent on WhatsApp, no sign-in, on their phone.
// It is a PRE-FILL for the paper process, not a replacement: the same fields staff type in when joining (who is joining, the family contact, the plan they
// lean to, the application form's personal details, health and allergies, the care questions), reusing the member form's own field groups so the
// answers map 1:1 onto Join. Sending it stores the answers on the lead; the front desk prints the application form from them for signing at the club.
// English or Indonesian (the phone's language, with a switch). Language lives only in this tab: the session store is not persisted from here.
import { useCallback, useEffect, useLayoutEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { fmtPhone, rp, type KtpKind, type KtpUploads, type Lang, type OnlineRegistration, type Plan, type Relation, type Title } from '@cp/shared';
import { MAX_PDF_BYTES, MAX_UPLOAD_BYTES, downscaleImage, isPdfFile, toBase64 } from '../../lib/media';
import { ApiError } from '../../lib/api';
import type { PaperFile } from '../members/PaperForm';
import { validateRegistration } from '@cp/shared/rules/applicationForm';
import { Button, ChipGroup, DateField, Icon, Logo, Note } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { useFmt, useT } from '../../lib/i18n';
import { useSession } from '../../store/session';
import { AllergyFields, CarerFields, DementiaFields, HealthFields, PeSection, RegCareFields, RegPersonalFields, RelationChips, TextField, TitleName, carerOf, carerOk, joinDrugs, ktpFor, regDraftOf, regOfDraft, splitDrugs, useDraft, type AllergyDraft, type CarerDraft, type HealthDraft, type RegDraft } from '../members/dialogs/forms';

interface Info { state: 'sent' | 'opened' | 'submitted' | 'expired'; club: string; today: string; draft: OnlineRegistration; submittedAt: string | null; expiresAt: string; prices: { flex: number; gold: number; flexQuota: number } }
type View = { kind: 'loading' } | { kind: 'ready'; info: Info } | { kind: 'bad' } | { kind: 'network' } | { kind: 'expired' } | { kind: 'done'; date: string } | { kind: 'thanks'; name: string };
type FDraft = HealthDraft & AllergyDraft & CarerDraft & { title: Title; name: string; dob: string; address: string; cName: string; rel: Relation; phone: string; plan: Plan | ''; reg: RegDraft; ktp: KtpUploads };

const initialLang = (): Lang => (typeof navigator !== 'undefined' && /^(id|in)\b/i.test(navigator.language || '') ? 'id' : 'en');
const fromOnline = (o: OnlineRegistration): FDraft => ({
  title: o.title, name: o.name, dob: o.dob, address: o.address, cName: o.contact.name, rel: o.contact.relation, phone: o.contact.phone ? fmtPhone(o.contact.phone) : '', plan: o.plan ?? '',
  conditions: o.health.conditions, diabetic: o.health.diabetic, mobility: o.health.mobility ?? 'none', diet: o.health.diet, food: o.health.food, foodOther: o.health.foodOther, ...splitDrugs(o.health.drugs), reg: regDraftOf(o.registration),
  nanny: !!o.nanny, nannyName: o.nanny?.name ?? '', nannyNik: o.nanny?.nik ?? '', ktp: o.ktp ?? {},
});
const toOnline = (d: FDraft, lang: Lang): OnlineRegistration => ({
  title: d.title, name: d.name.trim(), dob: d.dob, address: d.address.trim(), contact: { name: d.cName.trim(), relation: d.rel, phone: d.phone.trim() }, ...(d.plan ? { plan: d.plan } : {}),
  health: { conditions: d.conditions, diabetic: d.diabetic, food: d.food, foodOther: d.foodOther.trim(), drugs: joinDrugs(d), mobility: d.mobility === 'none' ? null : d.mobility, diet: d.diet },
  ...(regOfDraft(d.reg, d.nanny) ? { registration: regOfDraft(d.reg, d.nanny) } : {}), nanny: carerOf(d), ...(ktpFor(d.ktp, d.reg.ids, d.nanny) ? { ktp: ktpFor(d.ktp, d.reg.ids, d.nanny) } : {}), lang,
});
/** The family's own upload route: the form token is the key (no sign-in). Images are shrunk like any photo; a PDF goes as it is. */
const publicUploader = (token: string) => async (blob: Blob, name: string): Promise<PaperFile> => {
  const pdf = isPdfFile(blob, name);
  if (pdf && blob.size > MAX_PDF_BYTES) throw new ApiError(413, 'common.docTooBig');
  const file = pdf ? blob : await downscaleImage(blob);
  if (!pdf && file.size > MAX_UPLOAD_BYTES) throw new ApiError(413, 'common.mediaTooBig');
  const res = await fetch(`/api/public/form/${encodeURIComponent(token)}/media`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mime: pdf ? 'application/pdf' : 'image/jpeg', data: await toBase64(file) }) });
  const data = (await res.json().catch(() => ({}))) as { id?: string; code?: string };
  if (!res.ok || !data.id) throw new ApiError(res.status, data.code || 'common.mediaFailed');
  return { mediaId: data.id, fileName: pdf ? (name || 'document.pdf') : `${(name || 'ktp').replace(/\.[A-Za-z0-9]{1,5}$/, '')}.jpg` };
};

/** The route element: sets this tab's language (without saving it), then shows the page. */
export function PublicForm() {
  const [lang, setLang] = useState<Lang>(initialLang);
  const [synced, setSynced] = useState(false);
  useLayoutEffect(() => { useSession.setState({ lang }); setSynced(true); }, [lang]);
  if (!synced) return null;
  return <FormInner lang={lang} setLang={setLang} />;
}

function FormInner({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  const t = useT();
  const { fds } = useFmt();
  const { isPhone } = useDevice();
  const { token = '' } = useParams();
  const [view, setView] = useState<View>({ kind: 'loading' });
  const [d, set] = useDraft<FDraft>(() => fromOnline({ title: 'Oma', name: '', dob: '', address: '', contact: { name: '', relation: 'daughter', phone: '' }, health: { conditions: [], diabetic: false, food: [], foodOther: '', drugs: [], mobility: null, diet: [] }, lang: 'en' }));
  const setReg = (p: Partial<RegDraft>) => set({ reg: { ...d.reg, ...p } });
  const setKtp = (kind: KtpKind, f: PaperFile | null) => set({ ktp: { ...d.ktp, [kind]: f ?? undefined } });
  const uploader = publicUploader(token);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setView({ kind: 'loading' });
    try {
      const res = await fetch(`/api/public/form/${encodeURIComponent(token)}`);
      if (res.status === 404) { setView({ kind: 'bad' }); return; }
      if (!res.ok) { setView({ kind: 'network' }); return; }
      const info = (await res.json()) as Info;
      if (info.state === 'submitted') { setView({ kind: 'done', date: info.submittedAt ? info.submittedAt.slice(0, 10) : info.today }); return; }
      if (info.state === 'expired') { setView({ kind: 'expired' }); return; }
      set(fromOnline(info.draft));
      setView({ kind: 'ready', info });
      if (info.state === 'sent') void fetch(`/api/public/form/${encodeURIComponent(token)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'open' }) }).catch(() => undefined);
    } catch { setView({ kind: 'network' }); }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const was = document.title;
    document.title = `${t('enq.pf_tab')} · CitraPremier`;
    return () => { document.title = was; };
  }, [t]);

  // what must be there before it can be sent: who is joining, who is asking and how to reach them; the application form's own checks (postcode, email…)
  const phoneOk = d.phone.replace(/\D/g, '').length >= 8;
  const regIssues = validateRegistration(regOfDraft(d.reg, d.nanny));
  const errFor = (...fields: string[]) => (tried ? (() => { const i = regIssues.find((x) => fields.includes(x.field)); return i ? t(i.code, i.params) : ''; })() : '');
  const problems = !d.name.trim() || !d.cName.trim() || !phoneOk || regIssues.length > 0 || !carerOk(d);
  const submit = async () => {
    setTried(true);
    if (problems || busy) return;
    setBusy(true); setErr('');
    try {
      const res = await fetch(`/api/public/form/${encodeURIComponent(token)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'submit', draft: toOnline(d, lang) }) });
      if (res.ok) { setView({ kind: 'thanks', name: d.cName.trim().split(' ')[0] }); window.scrollTo?.({ top: 0 }); return; }
      const data = (await res.json().catch(() => ({}))) as { code?: string; params?: Record<string, string | number> };
      if (data.code === 'enq.err.formExpired') { setView({ kind: 'expired' }); return; }
      if (data.code === 'enq.err.formDone') { setView({ kind: 'done', date: '' }); return; }
      setErr(data.code ? t(data.code, data.params) : t('err.invalid'));
    } catch { setErr(t('mgmt.rtNetText')); }
    setBusy(false);
  };

  const body = ((): ReactNode => {
    if (view.kind === 'loading') return <Loading />;
    if (view.kind === 'bad') return <Message icon="link_off" title={t('enq.pf_badTitle')} text={t('enq.pf_badText')} />;
    if (view.kind === 'expired') return <Message icon="lock_clock" title={t('enq.pf_expiredTitle')} text={t('enq.pf_expiredText')} />;
    if (view.kind === 'network') return <Message icon="cloud_off" title={t('mgmt.rtNetTitle')} text={t('mgmt.rtNetText')} action={<Button size={48} onClick={() => void load()}>{t('common.retry')}</Button>} />;
    if (view.kind === 'done') return <Message icon="task_alt" tone="sage" title={t('enq.pf_doneTitle')} text={view.date ? t('enq.pf_doneText', { date: fds(view.date) }) : t('enq.pf_doneText', { date: '' })} />;
    if (view.kind === 'thanks') return <Message icon="favorite" tone="sage" title={t('enq.pf_thanksTitle', { name: view.name })} text={t('enq.pf_thanksText')} />;
    const { prices } = view.info;
    return (
      <>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 500, color: 'var(--eyebrow, #6E5A43)' }}>{t('enq.pf_eyebrow')} · {view.info.club}</span>
          <h1 className="cp-serif" style={{ margin: 0, fontSize: isPhone ? 28 : 32, lineHeight: 1.15, fontWeight: 400, letterSpacing: '-0.6px', color: '#2B231C' }}>{d.title} {d.name || '…'}</h1>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: '#5E5852' }}>{t('enq.pf_intro')}</p>
        </div>
        <PeSection label={t('enq.pf_who')}>
          <TitleName d={d} set={set} t={t} errors={{ name: tried && !d.name.trim() ? t('err.invalid') : '' }} />
          <DateField label={t('profile.f.dob')} value={d.dob} onChange={(v) => set({ dob: v })} max={view.info.today} startAt={`${+view.info.today.slice(0, 4) - 80}${view.info.today.slice(4)}`} />
          <TextField label={t('profile.f.address')} value={d.address} onChange={(v) => set({ address: v })} placeholder={t('profile.addressPh')} />
        </PeSection>
        <PeSection label={t('enq.pf_contact')}>
          <TextField label={t('enq.fContactName')} value={d.cName} onChange={(v) => set({ cName: v })} error={tried && !d.cName.trim() ? t('err.invalid') : ''} name="contact" />
          <RelationChips value={d.rel} onChange={(v) => set({ rel: v })} t={t} />
          <TextField label={t('common.phone')} value={d.phone} onChange={(v) => set({ phone: v })} inputMode="tel" placeholder="+62" error={tried && !phoneOk ? t('err.invalid') : ''} name="phone" />
        </PeSection>
        <PeSection label={t('enq.pf_plan')}>
          <ChipGroup label={t('enq.plan')} value={d.plan || 'unsure'} onChange={(v) => set({ plan: v === 'unsure' ? '' : (v as Plan) })}
            options={[{ value: 'flex', label: `${t('mgmt.plan_flex')} · ${rp(prices.flex)}` }, { value: 'gold', label: `${t('mgmt.plan_gold')} · ${rp(prices.gold)}` }, { value: 'unsure', label: t('enq.pf_planUnsure') }]} />
          <div style={{ fontSize: 14, lineHeight: '21px', color: '#5E5852' }}>{d.plan === 'gold' ? t('profile.planNoteGold') : t('profile.planNoteFlex', { q: prices.flexQuota, p: '' }).replace(/\s*\(\s*\)|\s+·\s*$/g, '')}</div>
        </PeSection>
        <PeSection label={t('profile.sec.regPersonal')}>
          <RegPersonalFields d={d.reg} set={setReg} t={t} err={errFor} />
        </PeSection>
        <PeSection label={t('profile.sec.nanny')}>
          <CarerFields d={d} set={set} t={t} tried={tried} ktp={d.ktp} setKtp={setKtp} uploader={uploader} />
        </PeSection>
        <PeSection label={t('profile.sec.health')}>
          <HealthFields d={d} set={set} t={t} instead={<DementiaFields d={d.reg} set={setReg} t={t} />} />
          <AllergyFields d={d} set={set} t={t} />
        </PeSection>
        <PeSection label={t('profile.sec.regCare')}>
          <RegCareFields d={d.reg} set={setReg} t={t} err={errFor} dementia={false} idsLabel={t('profile.f.idsCustomer')} ktp={d.ktp} setKtp={setKtp} uploader={uploader} />
        </PeSection>
        <Note icon="draw">{t('enq.pf_paperNote')}</Note>
        {tried && problems ? <Note tone="rust" icon="error">{t('err.invalid')}</Note> : null}
        {err ? <Note tone="rust" icon="error">{err}</Note> : null}
        <Button full size={56} icon="send" disabled={busy} onClick={() => void submit()}>{busy ? t('enq.pf_sending') : t('enq.pf_submit')}</Button>
        <span style={{ fontSize: 13, lineHeight: '18px', color: '#8A8078', textAlign: 'center' }}>{t('enq.pf_privacy')}</span>
      </>
    );
  })();

  return (
    <div data-testid="public-form" style={{ position: 'fixed', inset: 0, overflowY: 'auto', background: '#FFFFFF', ...({ '--cp-body': isPhone ? '16px' : '0px', '--cp-small': isPhone ? '14px' : '0px' } as CSSProperties) }}>
      <div style={{ maxWidth: 600, margin: '0 auto', padding: isPhone ? '14px 16px 40px' : '28px 20px 56px', display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <Logo height={isPhone ? 40 : 48} />
          <div style={{ display: 'flex', gap: 2, padding: 2, borderRadius: 9, background: 'var(--track, #E8E8EB)', flex: 'none' }} role="group" aria-label={t('shell.language')}>
            {(['en', 'id'] as const).map((l) => (
              <button key={l} type="button" onClick={() => setLang(l)} aria-pressed={lang === l} style={{ height: 40, minWidth: 48, padding: '0 12px', borderRadius: 7, border: 'none', background: lang === l ? '#FFFFFF' : 'transparent', boxShadow: lang === l ? '0 1px 3px rgba(40,30,20,.14)' : 'none', color: '#24201C', fontSize: 14, fontWeight: lang === l ? 600 : 500, cursor: 'pointer', fontFamily: 'Inter' }}>{l.toUpperCase()}</button>
            ))}
          </div>
        </div>
        {body}
      </div>
    </div>
  );
}

function Loading() {
  const t = useT();
  return <div role="status" style={{ padding: '48px 0', textAlign: 'center', color: '#8A8078', fontSize: 15 }}>{t('common.loading')}</div>;
}
function Message({ icon, title, text, action, tone }: { icon: string; title: string; text: string; action?: ReactNode; tone?: 'sage' }) {
  return (
    <div data-testid="public-form-message" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '40px 16px', textAlign: 'center', borderRadius: 20, background: tone === 'sage' ? '#E3EFE6' : 'var(--fill, #F4F4F5)' }}>
      <Icon name={icon} size={40} weight={300} color={tone === 'sage' ? '#3D6B4F' : '#75624B'} />
      <span style={{ fontSize: 22, fontWeight: 500, lineHeight: 1.25, color: '#24201C' }}>{title}</span>
      <span style={{ fontSize: 15, lineHeight: 1.5, color: '#5E5852', maxWidth: 420 }}>{text}</span>
      {action}
    </div>
  );
}
