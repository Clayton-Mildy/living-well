// Plans and pricing (design ScrPlans): Flex, Gold and extra-day prices plus the club rule (Flex visits per month, counted from check-ins),
// edited with Save / Cancel and validation; next-invoice preview for a chosen member (with the unsaved prices).
import { useMemo, useState } from 'react';
import { approvedMembers, fmtN, memberName, membershipStatus, parseN, priceOn, rp } from '@cp/shared';
import { invoicePreview, type PriceDraft } from '@cp/shared/rules/mgmt';
import { Button, DateField, Icon, PageHead, Select, TextField, Toggle, FONT_BODY } from '../../components/ui';
import { useT, useFmt } from '../../lib/i18n';
import { useNow } from '../../lib/clock';
import { useAct } from '../../lib/act';
import { useClub } from '../../store/replica';
import { say } from '../../store/ui';
import { Page, HPAD, heroCard, labelStyle, splitRow, tn } from './common';

type Draft = { flex: string; gold: string; extra: string; quota: string; from: string };

export function Plans() {
  const t = useT();
  const { fmonth } = useFmt();
  const s = useClub();
  const { today } = useNow();
  const act = useAct();
  const price = priceOn(s, today);
  const saved: Draft = { flex: fmtN(price.flex), gold: fmtN(price.gold), extra: fmtN(price.extra), quota: String(s.club.settings.flexQuota), from: today };
  const [draft, setDraft] = useState<Draft | null>(null);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [who, setWho] = useState('');
  const [notify, setNotify] = useState(true); // tell the team about new prices (on by default)
  const d = draft ?? saved;
  const set = (p: Partial<Draft>) => setDraft({ ...d, ...p });

  const prices = { flex: parseN(d.flex), gold: parseN(d.gold), extra: parseN(d.extra) };
  const quota = d.quota === '' ? NaN : Number(d.quota);
  const quotaShown = Number.isFinite(quota) ? quota : s.club.settings.flexQuota; // what the cards say while it is being typed
  const priceChanged = prices.flex !== price.flex || prices.gold !== price.gold || prices.extra !== price.extra;
  const rulesChanged = quota !== s.club.settings.flexQuota;
  const dirty = priceChanged || rulesChanged;
  const err = {
    flex: prices.flex < 1, gold: prices.gold < 1, extra: prices.extra < 1,
    quota: !Number.isInteger(quota) || quota < 1 || quota > 23,
    from: priceChanged && (!d.from || d.from < today),
  };
  const valid = !Object.values(err).some(Boolean);
  const show = (k: keyof typeof err) => touched && err[k];

  const members = approvedMembers(s).filter((m) => membershipStatus(m, today) !== 'ended');
  const memberId = members.find((m) => m.id === who)?.id ?? members.find((m) => m.id === 'm1')?.id ?? members[0]?.id ?? '';
  // the preview shows what was typed (prices and the visits rule), whether or not it is saved yet; an invalid number falls back to the saved one
  const previewDraft: PriceDraft | null = priceChanged || rulesChanged
    ? {
        flex: prices.flex > 0 ? prices.flex : price.flex, gold: prices.gold > 0 ? prices.gold : price.gold, extra: prices.extra > 0 ? prices.extra : price.extra,
        from: priceChanged && d.from >= today ? d.from : today, ...(rulesChanged && !err.quota ? { flexQuota: quota } : {}),
      }
    : null;
  const preview = useMemo(
    () => (memberId ? invoicePreview(s, memberId, previewDraft, today) : null),
    [s, memberId, previewDraft?.flex, previewDraft?.gold, previewDraft?.extra, previewDraft?.from, previewDraft?.flexQuota, !!previewDraft, today], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const save = async () => {
    setTouched(true);
    if (!valid || !dirty || busy) return;
    setBusy(true);
    try {
      if (priceChanged) {
        const r = await act('prices.set', { ...prices, from: d.from, notify }, { silent: true });
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
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderTop: '1px solid #F0EAE1', fontSize: 15, lineHeight: 1.4 }}>
          <span style={{ color: '#6B6259' }}>{k}</span>
          <span style={{ textAlign: 'right' }}>{v}</span>
        </div>
      ))}
    </div>
  );
  const priceCard = (k: 'flex' | 'gold' | 'extra', name: string, unit: string, facts: [string, string][]) => (
    <div key={k} className="cp-card-pad" style={{ ...heroCard, padding: `20px ${HPAD}`, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 22, lineHeight: '30px', fontWeight: 400, letterSpacing: '-0.3px', color: '#2B231C' }}>{name}</span>
        {price.sample[k] ? (
          <span style={{ height: 24, padding: '0 10px 0 6px', borderRadius: 8, background: '#F6ECD6', color: '#7A5510', fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
            <Icon name="edit_note" size={16} fill={1} />{t('mgmt.samplePrice')}
          </span>
        ) : null}
      </div>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4 }}>{unit}</span>
        <span style={{ display: 'flex', alignItems: 'center', height: 52, border: show(k) ? '2px solid #9A3D24' : '1px solid #DDD1C2', borderRadius: 10, background: '#FFFFFF', overflow: 'hidden' }}>
          <span style={{ padding: '0 14px', height: '100%', display: 'flex', alignItems: 'center', background: '#F5F5F3', borderRight: '1px solid #DCD3C8', fontSize: 15 }}>Rp</span>
          <input value={d[k]} onChange={(e) => set({ [k]: fmtN(e.target.value) })} inputMode="numeric" aria-label={t('mgmt.priceAria', { name })} aria-invalid={show(k) || undefined}
            style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', height: '100%', padding: '0 14px', fontSize: 18, fontVariantNumeric: 'tabular-nums', fontFamily: 'Inter', color: '#24201C', background: 'transparent' }} />
        </span>
        {show(k) ? <span role="alert" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: FONT_BODY, color: '#9A3D24', lineHeight: 1.4 }}><Icon name="error" size={18} fill={1} />{t('mgmt.err.priceInvalid')}</span> : null}
      </label>
      {factRows(facts)}
    </div>
  );

  return (
    <Page gap={20}>
      <PageHead eyebrow={t('mgmt.plEyebrow')} title={t('nav.plans')} size={40} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))', gap: 16, alignItems: 'start' }}>
        {priceCard('flex', t('mgmt.plan_flex'), t('mgmt.perMonth'), [
          [t('mgmt.plQuota'), tn(t, 'mgmt.plQuotaV', quotaShown)], [t('mgmt.plUnused'), t('mgmt.plNoRoll')],
        ])}
        {priceCard('gold', t('mgmt.plan_gold'), t('mgmt.perMonth'), [[t('mgmt.plQuota'), t('mgmt.plUnlimited')], [t('mgmt.plExtra'), t('common.none')]])}
        {priceCard('extra', t('mgmt.plExtra'), t('mgmt.perDay'), [[t('mgmt.plBilled'), t('mgmt.plNextInvoice')], [t('mgmt.plCounted'), t('mgmt.plCheckIns')]])}
      </div>

      {priceChanged ? (
        <div style={{ maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <DateField label={t('mgmt.plFrom')} value={d.from} min={today} onChange={(v) => set({ from: v })} error={show('from') && t('mgmt.err.pricePast')} hint={t('mgmt.plFromHint')} />
          <Toggle on={notify} onClick={() => setNotify(!notify)} label={t('mgmt.notifyTeam')} />
        </div>
      ) : null}

      <div style={{ ...splitRow, gap: 'clamp(16px, 2.4vw, 32px)' }}>
        <div className="cp-card-pad" style={{ ...heroCard, flex: '0 1 320px', width: '100%', padding: `20px ${HPAD}`, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span style={{ fontSize: 20, lineHeight: '28px', fontWeight: 400, letterSpacing: '-0.3px', color: '#2B231C' }}>{t('mgmt.plRules')}</span>
          <TextField label={t('mgmt.plQuotaL')} value={d.quota} inputMode="numeric" maxLength={2} onChange={(v) => set({ quota: v.replace(/\D/g, '') })} error={show('quota') && t('mgmt.err.quotaInvalid')} />
        </div>
      <div style={{ ...heroCard, flex: '1 1 420px', minWidth: 0, padding: `20px ${HPAD}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={labelStyle}>{t('mgmt.plPreview')}</div>
        {members.length ? (
          <>
            <Select label={t('mgmt.plPreviewFor')} value={memberId} onChange={setWho} options={members.map((m) => ({ value: m.id, label: memberName(m) }))} searchable={members.length > 8} />
            {preview ? (
              <>
                <div style={{ fontSize: 20, lineHeight: '28px', fontWeight: 400, letterSpacing: '-0.3px', color: '#2B231C' }}>{t('mgmt.plPreviewTitle', { name: memberName(preview.member), day: Number(preview.issueDate.slice(8)), month: fmonth(preview.period) })}</div>
                {previewDraft ? <span style={{ fontSize: FONT_BODY, color: '#7A5510', lineHeight: 1.4 }}>{t('mgmt.plUnsaved')}</span> : null}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {preview.lines.map((l) => (
                    <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderTop: '1px solid #F0EAE1', fontSize: 15, lineHeight: 1.4 }}>
                      <span>{t(l.label, { ...(l.params || {}), month: l.params?.month ? fmonth(String(l.params.month)) : '' })}</span>
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{rp(l.amount)}</span>
                    </div>
                  ))}
                  {!preview.lines.length ? <div style={{ padding: '10px 0', borderTop: '1px solid #F0EAE1', fontSize: 16, color: '#5E5852' }}>{t('mgmt.plNothing')}</div> : null}
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
        ) : <div style={{ fontSize: 15, color: '#6B6259', lineHeight: 1.4 }}>{t('mgmt.plNoMembers')}</div>}
      </div>
      </div>

      {dirty ? (
        <div style={{ position: 'sticky', bottom: 0, zIndex: 4, margin: '0 -4px', padding: '12px 4px 14px', background: 'linear-gradient(to top, #F5F5F3 72%, rgba(246,245,245,0))', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Button size={56} onClick={save} disabled={busy} style={{ flex: '1 1 200px' }}>{t('common.saveChanges')}</Button>
          <Button size={56} variant="secondary" onClick={cancel} style={{ flex: '0 1 160px' }}>{t('common.cancel')}</Button>
        </div>
      ) : null}
    </Page>
  );
}
