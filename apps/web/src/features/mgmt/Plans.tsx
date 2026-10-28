// Plans and pricing (design ScrPlans), round 13 §11, five sections: Plans (Flex with its visits rule, Gold, then the plans management added in round 15 with Add plan / quick add / edit / retire), Extra charges (extra day, leave month, dementia care), One-off fees (registration, 2-day trial),
// Changes (takes effect from + tell the team, only while something is edited) and the next-invoice preview for a chosen member (with the unsaved prices). Save / Cancel stay pinned.
import { useMemo, useState, type ReactNode } from 'react';
import { approvedMembers, feeOf, fmtN, memberName, membershipStatus, parseN, planLabel, planPriceInfo, priceOn, rp, type Plan, type PlanDef } from '@cp/shared';
import { invoicePreview, type PriceDraft } from '@cp/shared/rules/mgmt';
import { Button, DateField, Group, Icon, IconButton, PageHead, Segmented, Select, Sheet, TextField, Toggle, FONT_BODY } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { useT, useFmt, useLang } from '../../lib/i18n';
import { useMe } from '../../lib/me';
import { useNow } from '../../lib/clock';
import { useAct } from '../../lib/act';
import { useClub } from '../../store/replica';
import { say } from '../../store/ui';
import { Page, SwitchRow, HPAD, heroCard, labelStyle, tn, Pill } from './common';

type PriceKey = 'flex' | 'gold' | 'extra' | 'registration' | 'trial' | 'leave' | 'dementia';
const PRICE_KEYS: PriceKey[] = ['flex', 'gold', 'extra', 'registration', 'trial', 'leave', 'dementia'];
type Draft = Record<PriceKey, string> & { quota: string; from: string; plans: Record<string, string> }; // plans: the catalogue plans' prices as typed ('' = no price)

export function Plans() {
  const t = useT();
  const { isPhone } = useDevice();
  const { fmonth, fds } = useFmt();
  const s = useClub();
  const { today } = useNow();
  const act = useAct();
  const lang = useLang();
  const { role } = useMe();
  const canEdit = role === 'mgmt'; // the catalogue is management's
  const price = priceOn(s, today);
  const custom = s.club.settings.plans ?? [];
  const [sheet, setSheet] = useState<{ plan?: PlanDef } | null>(null);
  const saved: Draft = { flex: fmtN(price.flex), gold: fmtN(price.gold), extra: fmtN(price.extra), registration: fmtN(feeOf(price, 'registration')), trial: fmtN(feeOf(price, 'trial')), leave: fmtN(feeOf(price, 'leave')), dementia: fmtN(feeOf(price, 'dementia')), quota: String(s.club.settings.flexQuota), from: today, plans: Object.fromEntries(custom.map((p) => [p.id, price.plans?.[p.id] ? fmtN(price.plans[p.id]) : ''])) };
  const [draft, setDraft] = useState<Draft | null>(null);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [who, setWho] = useState('');
  const [notify, setNotify] = useState(true); // tell the team about new prices (on by default)
  const d = draft ?? saved;
  const set = (p: Partial<Draft>) => setDraft({ ...d, ...p });

  const prices = { flex: parseN(d.flex), gold: parseN(d.gold), extra: parseN(d.extra), registration: parseN(d.registration), trial: parseN(d.trial), leave: parseN(d.leave), dementia: parseN(d.dementia) };
  const current: Record<PriceKey, number> = { flex: price.flex, gold: price.gold, extra: price.extra, registration: feeOf(price, 'registration'), trial: feeOf(price, 'trial'), leave: feeOf(price, 'leave'), dementia: feeOf(price, 'dementia') };
  // custom plans: typed price per plan (a plan added while editing falls back to its saved one); 0 = no price
  const planVal = (id: string) => d.plans[id] ?? saved.plans[id] ?? '';
  const planNums = Object.fromEntries(custom.map((p) => [p.id, parseN(planVal(p.id))]));
  const planNow = (id: string) => price.plans?.[id] ?? 0;
  // a plan whose only price starts later shows that price and its date where the price field is empty (round 15 fix wave)
  const upcomingText = (id: string) => { const u = planPriceInfo(s, id as Plan, today); return u.from ? t('plans.fromPrice', { date: fds(u.from), price: rp(u.price) }) : undefined; };
  const plansChanged = custom.some((p) => planNums[p.id] !== planNow(p.id));
  const planErr = (id: string) => (planVal(id) === '' ? planNow(id) > 0 : planNums[id] < 1);
  const quota = d.quota === '' ? NaN : Number(d.quota);
  const quotaShown = Number.isFinite(quota) ? quota : s.club.settings.flexQuota; // what the cards say while it is being typed
  const priceChanged = PRICE_KEYS.some((k) => prices[k] !== current[k]) || plansChanged;
  const rulesChanged = quota !== s.club.settings.flexQuota;
  const dirty = priceChanged || rulesChanged;
  const err = {
    flex: prices.flex < 1, gold: prices.gold < 1, extra: prices.extra < 1, registration: prices.registration < 1, trial: prices.trial < 1, leave: prices.leave < 1, dementia: prices.dementia < 1,
    quota: !Number.isInteger(quota) || quota < 1 || quota > 23,
    from: priceChanged && (!d.from || d.from < today),
  };
  const valid = !Object.values(err).some(Boolean) && !custom.some((p) => planErr(p.id));
  const show = (k: keyof typeof err | string) => touched && (k in err ? err[k as keyof typeof err] : planErr(k));

  const members = approvedMembers(s).filter((m) => membershipStatus(m, today) !== 'ended');
  const memberId = members.find((m) => m.id === who)?.id ?? members.find((m) => m.id === 'm1')?.id ?? members[0]?.id ?? '';
  // the preview shows what was typed (prices and the visits rule), whether or not it is saved yet; an invalid number falls back to the saved one
  const previewDraft: PriceDraft | null = priceChanged || rulesChanged
    ? {
        flex: prices.flex > 0 ? prices.flex : price.flex, gold: prices.gold > 0 ? prices.gold : price.gold, extra: prices.extra > 0 ? prices.extra : price.extra,
        registration: prices.registration > 0 ? prices.registration : current.registration, trial: prices.trial > 0 ? prices.trial : current.trial, leave: prices.leave > 0 ? prices.leave : current.leave, dementia: prices.dementia > 0 ? prices.dementia : current.dementia,
        ...(custom.length ? { plans: Object.fromEntries(custom.map((p) => [p.id, planNums[p.id] > 0 ? planNums[p.id] : planNow(p.id)])) } : {}),
        from: priceChanged && d.from >= today ? d.from : today, ...(rulesChanged && !err.quota ? { flexQuota: quota } : {}),
      }
    : null;
  const preview = useMemo(
    () => (memberId ? invoicePreview(s, memberId, previewDraft, today) : null),
    [s, memberId, previewDraft?.flex, previewDraft?.gold, previewDraft?.extra, previewDraft?.registration, previewDraft?.trial, previewDraft?.leave, previewDraft?.dementia, previewDraft?.from, previewDraft?.flexQuota, JSON.stringify(previewDraft?.plans), !!previewDraft, today], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const save = async () => {
    setTouched(true);
    if (!valid || !dirty || busy) return;
    setBusy(true);
    try {
      if (priceChanged) {
        const plans = Object.fromEntries(custom.filter((p) => planNums[p.id] >= 1).map((p) => [p.id, planNums[p.id]]));
        const r = await act('prices.set', { ...prices, ...(custom.length ? { plans } : {}), from: d.from, notify }, { silent: true });
        if (!r.ok) return;
      }
      if (rulesChanged) {
        const r = await act('club.updateSettings', { flexQuota: quota }, { silent: true });
        if (!r.ok) return;
      }
      setDraft(null);
      setTouched(false);
      setNotify(true);
      say(t('mgmt.plansSaved'));
    } finally { setBusy(false); }
  };
  const cancel = () => { setDraft(null); setTouched(false); setNotify(true); };

  const factRows = (rows: [string, string][]) => (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderTop: '0.5px solid var(--hairline, #E2E2E6)', fontSize: 15, lineHeight: 1.4 }}>
          <span style={{ color: '#6B6259' }}>{k}</span>
          <span style={{ textAlign: 'right' }}>{v}</span>
        </div>
      ))}
    </div>
  );
  const sampleBadge = (k: PriceKey) => (k === 'flex' || k === 'gold' || k === 'extra') && price.sample[k] ? (
    <span style={{ height: 24, padding: '0 10px 0 6px', borderRadius: 8, background: '#F6ECD6', color: '#7A5510', fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
      <Icon name="edit_note" size={16} fill={1} />{t('mgmt.samplePrice')}
    </span>
  ) : null;
  const priceField = (k: string, name: string, unit: string) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4 }}>{unit}</span>
      <span className={`cp-input-wrap cp-fill${show(k) ? ' cp-err' : ''}`} style={{ display: 'flex', alignItems: 'center', height: 52, borderRadius: 12, background: 'var(--fill, #F4F4F5)', boxShadow: show(k) ? 'inset 0 0 0 2px #9A3D24' : undefined, overflow: 'hidden' }}>
        <span style={{ padding: '0 14px', height: '100%', display: 'flex', alignItems: 'center', background: 'var(--press, #EEEEF0)', fontSize: 15 }}>Rp</span>
        <input value={k in d ? d[k as PriceKey] : planVal(k)} onChange={(e) => (k in d ? set({ [k]: fmtN(e.target.value) }) : set({ plans: { ...d.plans, [k]: fmtN(e.target.value) } }))} placeholder={k in d ? undefined : upcomingText(k) ?? t('plans.noPrice')} inputMode="numeric" aria-label={t('mgmt.priceAria', { name })} aria-invalid={show(k) || undefined}
          style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', height: '100%', padding: '0 14px', fontSize: 18, fontVariantNumeric: 'tabular-nums', fontFamily: 'Inter', color: '#24201C', background: 'transparent' }} />
      </span>
      {show(k) ? <span role="alert" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: FONT_BODY, color: '#9A3D24', lineHeight: 1.4 }}><Icon name="error" size={18} fill={1} />{t('mgmt.err.priceInvalid')}</span> : null}
    </label>
  );
  // one price: name + sample badge, the price field, an optional extra field (the Flex visits rule), then its facts
  const priceBlock = (k: string, name: string, unit: string, facts: [string, string][], extra?: ReactNode, head?: ReactNode) => (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        {isPhone
          ? <span style={{ fontSize: 17, lineHeight: '24px', fontWeight: 600, color: '#24201C' }}>{name}</span>
          : <span style={{ fontSize: 22, lineHeight: '30px', fontWeight: 400, letterSpacing: '-0.3px', color: '#2B231C' }}>{name}</span>}
        {head ?? sampleBadge(k as PriceKey)}
      </div>
      {priceField(k, name, unit)}
      {extra}
      {factRows(facts)}
    </>
  );
  // a section: phone = one grouped list (prices separated by a hairline, no grey inside grey); wide = eyebrow over grey cards
  const section = (label: string, blocks: ReactNode[], cols?: string) => isPhone ? (
    <Group title={label} label={label} gap={16}>
      {blocks.map((b, i) => <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: i ? 16 : 0, borderTop: i ? '0.5px solid var(--hairline, #E2E2E6)' : undefined }}>{b}</div>)}
    </Group>
  ) : (
    <section aria-label={label} style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
      <h2 style={{ ...labelStyle, margin: 0 }}>{label}</h2>
      <div style={{ display: 'grid', gridTemplateColumns: cols ?? '1fr', gap: 16, alignItems: 'start' }}>
        {blocks.map((b, i) => <div key={i} className="cp-card-pad cp-grey" style={{ ...heroCard, padding: `20px ${HPAD}`, display: 'flex', flexDirection: 'column', gap: 12 }}>{b}</div>)}
      </div>
    </section>
  );

  // a catalogue plan: name (+ Retired), Edit, its price (saved with the others from a chosen date), type and days, and the Active switch (off = retired: it leaves the pickers, its members keep it)
  const setActive = async (p: PlanDef) => {
    const r = await act('club.setPlan', { id: p.id, name: p.name, ...(p.nameId ? { nameId: p.nameId } : {}), kind: p.kind, ...(p.kind === 'days' ? { quota: p.quota } : {}), active: !p.active }, { silent: true });
    if (r.ok) say(t(p.active ? 'plans.retiredToast' : 'plans.activeToast', { name: planLabel(s, p.id, lang) }));
  };
  const planBlock = (p: PlanDef) => {
    const name = planLabel(s, p.id, lang);
    const head = (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flex: 'none' }}>
        {!p.active ? <Pill label={t('plans.retired')} fg="#5E5852" bg="var(--press, #EEEEF0)" /> : null}
        {canEdit ? <IconButton icon="edit" label={t('plans.editAria', { name })} bordered={false} onClick={() => setSheet({ plan: p })} /> : null}
      </span>
    );
    const active = canEdit ? (isPhone ? <SwitchRow on={p.active} onClick={() => setActive(p)} label={t('plans.active')} /> : <Toggle on={p.active} onClick={() => setActive(p)} label={t('plans.active')} />) : null;
    return priceBlock(p.id, name, t('plans.price'), [
      [t('plans.type'), t(`plans.kind.${p.kind}`)],
      ...(p.kind === 'days' ? [[t('plans.quota'), tn(t, 'plans.quotaV', p.quota ?? 0)] as [string, string]] : []),
      ...(canEdit ? [] : [[t('plans.active'), t(p.active ? 'common.yes' : 'common.no')] as [string, string]]),
    ], active, head);
  };
  const addBlock = canEdit ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Button size={48} variant="secondary" icon="add" onClick={() => setSheet({})}>{t('plans.add')}</Button>
    </div>
  ) : null;

  const previewBody = members.length ? (
    <>
      <Select label={t('mgmt.plPreviewFor')} value={memberId} onChange={setWho} options={members.map((m) => ({ value: m.id, label: memberName(m) }))} searchable={members.length > 8} />
      {preview ? (
        <>
          <div style={{ fontSize: 20, lineHeight: '28px', fontWeight: 400, letterSpacing: '-0.3px', color: '#2B231C' }}>{t('mgmt.plPreviewTitle', { name: memberName(preview.member), day: Number(preview.issueDate.slice(8)), month: fmonth(preview.period) })}</div>
          {previewDraft ? <span style={{ fontSize: FONT_BODY, color: '#7A5510', lineHeight: 1.4 }}>{t('mgmt.plUnsaved')}</span> : null}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {preview.lines.map((l) => (
              <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderTop: '0.5px solid var(--hairline, #E2E2E6)', fontSize: 15, lineHeight: 1.4 }}>
                <span>{t(l.label, { ...(l.params || {}), month: l.params?.month ? fmonth(String(l.params.month)) : '' })}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{rp(l.amount)}</span>
              </div>
            ))}
            {!preview.lines.length ? <div style={{ padding: '10px 0', borderTop: '0.5px solid var(--hairline, #E2E2E6)', fontSize: 16, color: '#5E5852' }}>{t('mgmt.plNothing')}</div> : null}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '12px 0 0', borderTop: '2px solid #24201C', fontSize: 18, fontWeight: 600 }}>
              <span>{t('mgmt.plTotal')}</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }} data-testid="plan-preview-total">{rp(preview.total)}</span>
            </div>
          </div>
          {preview.others.length ? (
            <div style={{ fontSize: FONT_BODY, lineHeight: '20px', color: '#5E5852' }}>
              {t('mgmt.plOthers', { others: preview.others.map((o) => `${memberName(o.member)} ${rp(o.total)}`).join(', '), payer: preview.payer?.firstName || '' })}
            </div>
          ) : null}
        </>
      ) : null}
    </>
  ) : <div style={{ fontSize: 15, color: '#6B6259', lineHeight: 1.4 }}>{t('mgmt.plNoMembers')}</div>;
  const rulesBody = <TextField label={t('mgmt.plQuotaL')} value={d.quota} inputMode="numeric" maxLength={2} onChange={(v) => set({ quota: v.replace(/\D/g, '') })} error={show('quota') && t('mgmt.err.quotaInvalid')} />;

  // price edits need a date and the notify choice; a visits-only edit just applies from the next invoice (no date, no notify)
  const changesBody = priceChanged ? (
    <>
      <DateField label={t('mgmt.plFrom')} value={d.from} min={today} onChange={(v) => set({ from: v })} error={show('from') && t('mgmt.err.pricePast')} hint={t('mgmt.plFromHint')} />
      {isPhone ? <SwitchRow on={notify} onClick={() => setNotify(!notify)} label={t('mgmt.notifyTeam')} /> : <Toggle on={notify} onClick={() => setNotify(!notify)} label={t('mgmt.notifyTeam')} />}
    </>
  ) : factRows([[t('mgmt.plFrom'), t('mgmt.plNextInvoice')]]);

  return (
    <Page gap={20}>
      <PageHead eyebrow={t('mgmt.plEyebrow')} title={t('nav.plans')} size={40} />

      {section(t('mgmt.plSecPlans'), [
        priceBlock('flex', t('mgmt.plan_flex'), t('mgmt.perMonth'), [[t('mgmt.plQuota'), tn(t, 'mgmt.plQuotaV', quotaShown)], [t('mgmt.plUnused'), t('mgmt.plNoRoll')]], rulesBody),
        priceBlock('gold', t('mgmt.plan_gold'), t('mgmt.perMonth'), [[t('mgmt.plQuota'), t('mgmt.plUnlimited')], [t('mgmt.plExtra'), t('common.none')]]),
        ...custom.map(planBlock),
        ...(addBlock ? [addBlock] : []),
      ], 'repeat(auto-fit,minmax(min(100%,300px),1fr))')}

      <div style={{ display: 'grid', gridTemplateColumns: isPhone ? '1fr' : 'repeat(auto-fit,minmax(min(100%,300px),1fr))', gap: isPhone ? 18 : 16, alignItems: 'start' }}>
        {section(t('mgmt.plSecExtra'), [
          priceBlock('extra', t('mgmt.plExtra'), t('mgmt.perDay'), [[t('mgmt.plBilled'), t('mgmt.plNextInvoice')], [t('mgmt.plCounted'), t('mgmt.plCheckIns')]]),
          priceBlock('leave', t('mgmt.plan_leave'), t('mgmt.perMonth'), [[t('mgmt.plLeaveBilled'), t('mgmt.plLeaveBilledV')], [t('mgmt.plLeaveAsk'), t('mgmt.plLeaveAskV')]]),
          priceBlock('dementia', t('mgmt.plDementia'), t('mgmt.perMonth'), []),
        ])}
        {/* KC round 6: the brochure's other fees */}
        {section(t('mgmt.plSecOnce'), [
          priceBlock('registration', t('mgmt.plan_registration'), t('mgmt.perOnce'), [[t('mgmt.plRegWhen'), t('mgmt.plRegWhenV')], [t('mgmt.plRegAgain'), t('mgmt.plRegAgainV')]]),
          priceBlock('trial', t('mgmt.plan_trial'), t('mgmt.perTrial'), [[t('mgmt.plTrialDays'), t('mgmt.plTrialDaysV')], [t('mgmt.plTrialCollect'), t('mgmt.plTrialCollectV')]]),
        ])}
      </div>

      {dirty ? (isPhone ? (
        <Group title={t('mgmt.plSecChanges')} label={t('mgmt.plSecChanges')} gap={10}>{changesBody}</Group>
      ) : (
        <section aria-label={t('mgmt.plSecChanges')} style={{ maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h2 style={{ ...labelStyle, margin: 0 }}>{t('mgmt.plSecChanges')}</h2>
          {changesBody}
        </section>
      )) : null}

      {isPhone ? (
        <Group title={t('mgmt.plPreview')} label={t('mgmt.plPreview')} gap={10}>{previewBody}</Group>
      ) : (
        <section aria-label={t('mgmt.plPreview')} className="cp-grey" style={{ ...heroCard, padding: `20px ${HPAD}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h2 style={{ ...labelStyle, margin: 0 }}>{t('mgmt.plPreview')}</h2>
          {previewBody}
        </section>
      )}

      {sheet ? <PlanSheet key={sheet.plan?.id ?? 'new'} plan={sheet.plan} onClose={() => setSheet(null)} /> : null}

      {dirty ? (
        <div style={{ position: 'sticky', bottom: 'var(--cp-tabbar, 0px)', zIndex: 4, margin: '0 -4px', padding: '12px 4px 14px', background: 'linear-gradient(to top, #FFFFFF 72%, rgba(255,255,255,0))', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Button size={56} onClick={save} disabled={busy} style={{ flex: '1 1 200px' }}>{t('common.saveChanges')}</Button>
          <Button size={56} variant="secondary" onClick={cancel} style={{ flex: '0 1 160px' }}>{t('common.cancel')}</Button>
        </div>
      ) : null}
    </Page>
  );
}

/** Add or edit a catalogue plan. Adding offers Quick add from Flex or Gold (kind, days and the current price) and saves the price from a chosen date; editing changes name, type, days and Active (prices are edited in the plan's card). */
function PlanSheet({ plan, onClose }: { plan?: PlanDef; onClose: () => void }) {
  const t = useT();
  const s = useClub();
  const act = useAct();
  const { today } = useNow();
  const price = priceOn(s, today);
  const [f, setF] = useState({ name: plan?.name ?? '', nameId: plan?.nameId ?? '', kind: (plan?.kind ?? 'days') as PlanDef['kind'], quota: plan?.quota ? String(plan.quota) : '', price: '', from: today, active: plan?.active ?? true });
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<string | null>(null); // the plan was added but its price did not save: Save then only retries the price (never adds the plan twice)
  const [priceFailed, setPriceFailed] = useState(false);
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const quota = f.quota === '' ? NaN : Number(f.quota);
  const priceN = parseN(f.price);
  const err = { name: !f.name.trim(), quota: f.kind === 'days' && (!Number.isInteger(quota) || quota < 1 || quota > 23), price: !plan && priceN < 1, from: !plan && (!f.from || f.from < today) };
  const quick = (from: 'flex' | 'gold') => set(from === 'flex' ? { kind: 'days', quota: String(s.club.settings.flexQuota), price: fmtN(price.flex) } : { kind: 'unlimited', quota: '', price: fmtN(price.gold) });
  const save = async () => {
    setTouched(true);
    if (Object.values(err).some(Boolean) || busy) return;
    setBusy(true);
    try {
      let id = plan?.id ?? created ?? '';
      if (!created) {
        const r = await act('club.setPlan', { ...(plan ? { id: plan.id } : {}), name: f.name.trim(), ...(f.nameId.trim() ? { nameId: f.nameId.trim() } : {}), kind: f.kind, ...(f.kind === 'days' ? { quota } : {}), active: f.active }, { silent: true });
        if (!r.ok) return;
        id = plan?.id ?? String(r.result.planId ?? '');
      }
      if (!plan && id) {
        setCreated(id);
        const cur = priceOn(s, f.from);
        const r = await act('prices.set', { flex: cur.flex, gold: cur.gold, extra: cur.extra, plans: { [id]: priceN }, from: f.from }, { silent: true });
        if (!r.ok) { setPriceFailed(true); return; } // the plan exists without a price: keep the sheet open and say so
      }
      say(t(plan ? 'plans.savedToast' : 'plans.addedToast', { name: f.name.trim() }));
      onClose();
    } finally { setBusy(false); }
  };
  const quickBtn = (k: 'flex' | 'gold') => (
    <Button size={48} variant="secondary" onClick={() => quick(k)} style={{ flex: '1 1 150px' }}>{t(k === 'flex' ? 'plans.startFlex' : 'plans.startGold')}</Button>
  );
  return (
    <Sheet open onClose={onClose} title={plan ? t('plans.edit') : t('plans.add')}
      footer={<Button size={56} onClick={save} disabled={busy} full>{t('common.save')}</Button>}>
      {!plan ? (
        <div role="group" aria-label={t('plans.quickAdd')} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{quickBtn('flex')}{quickBtn('gold')}</div>
      ) : null}
      <TextField label={t('plans.name')} value={f.name} maxLength={60} onChange={(v) => set({ name: v })} error={touched && err.name && t('plans.err.name')} />
      <TextField label={t('plans.nameId')} value={f.nameId} maxLength={60} onChange={(v) => set({ nameId: v })} />
      <Segmented label={t('plans.type')} cols={2} value={f.kind} onChange={(v) => set({ kind: v })} items={[{ value: 'days', label: t('plans.kind.days') }, { value: 'unlimited', label: t('plans.kind.unlimited') }]} />
      {priceFailed ? <div role="alert" style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: FONT_BODY, color: '#9A3D24', lineHeight: 1.4 }}><Icon name="error" size={18} fill={1} />{t('plans.err.priceSave')}</div> : null}
      {f.kind === 'days' ? <TextField label={t('plans.quota')} value={f.quota} inputMode="numeric" maxLength={2} onChange={(v) => set({ quota: v.replace(/\D/g, '') })} error={touched && err.quota && t('plans.err.quota')} /> : null}
      {!plan ? (
        <>
          <TextField label={t('plans.price')} prefix="Rp" value={f.price} inputMode="numeric" onChange={(v) => set({ price: fmtN(v) })} error={touched && err.price && t('plans.err.price')} />
          <DateField label={t('plans.from')} value={f.from} min={today} onChange={(v) => set({ from: v })} error={touched && err.from && t('mgmt.err.pricePast')} />
        </>
      ) : <Toggle on={f.active} onClick={() => set({ active: !f.active })} label={t('plans.active')} sub={t('plans.keepNote')} />}
    </Sheet>
  );
}
