// Snap a receipt (design Receipts "snap panel"): simulated camera, supplier from the directory or free text, amount, section.
import { useState } from 'react';
import { fmtN, live, parseN } from '@cp/shared';
import { useT, useLang } from '../../lib/i18n';
import { useAct } from '../../lib/act';
import { useNow } from '../../lib/clock';
import { useMe } from '../../lib/me';
import { useClub } from '../../store/replica';
import { Icon, Note, FONT_BODY, FONT_SMALL } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { ChoiceChip, PillButton, bronzeInput } from '../kitchen/parts';
import { PGroup, Segmented, phoneField } from '../finance/parts';
import { defaultSectionId, receiptAddInput, sectionName, sectionsOf } from './finance';

const PAPER = 'linear-gradient(160deg, #FBF8F4 0%, #EFE7DD 55%, #DCCFC0 100%)';
const label: React.CSSProperties = { fontSize: FONT_BODY, fontWeight: 500, lineHeight: 1.4 };

export function ReceiptSnap({ onDone }: { onDone: () => void }) {
  const t = useT();
  const lang = useLang();
  const s = useClub();
  const act = useAct();
  const { today } = useNow();
  const { role } = useMe();
  const { isPhone } = useDevice();
  const [snapped, setSnapped] = useState(false);
  const [supplier, setSupplier] = useState('');
  const [amt, setAmt] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const secs = sectionsOf(s);
  const sectionId = picked && s.budgetSections[picked] ? picked : defaultSectionId(s, role);
  const suppliers = live(s.directory).filter((x) => x.kind === 'supplier');
  const directoryId = suppliers.find((x) => x.name === supplier.trim())?.id;
  const fileName = `nota_${today.slice(8, 10)}${today.slice(5, 7)}.jpg`;
  const amount = parseN(amt);
  const ok = snapped && !!supplier.trim() && amount > 0 && !!sectionId;
  const send = async () => {
    if (!ok || busy || !sectionId) return;
    setBusy(true);
    const r = await act('receipt.add', receiptAddInput({ supplier, directoryId, amount, sectionId, fileName, date: today }), { ok: t('requests.snap.sent', { section: sectionName(s, sectionId, lang) }) });
    setBusy(false);
    if (r.ok) onDone();
  };
  // round 6, phone: a flat group; the photo is a slim row (a thumb with the file name and Retake), the fields are grey and stacked, the sections an iOS segmented control
  if (isPhone) {
    const opts = secs.map((c) => ({ value: c.id, label: sectionName(s, c.id, lang) }));
    return (
      <PGroup gap={12}>
        {!snapped ? (
          <button type="button" onClick={() => setSnapped(true)} data-testid="snap-photo" className="cp-press" style={{ height: 64, borderRadius: 12, border: 'none', background: '#2E2924', color: '#F3EEE8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, cursor: 'pointer', fontFamily: 'Inter' }}>
            <Icon name="receipt_long" size={28} color="#CAB8A2" />
            <span style={{ fontSize: 16, lineHeight: 1.4 }}>{t('requests.snap.tap')}</span>
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div role="img" aria-label={t('requests.snap.photoAlt')} style={{ width: 84, flex: 'none', aspectRatio: '3/4', borderRadius: 10, background: PAPER, border: '1px solid #E4DACD' }} />
            <span style={{ height: 28, padding: '0 10px 0 6px', borderRadius: 8, background: '#F3EEE8', fontSize: FONT_SMALL, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
              <Icon name="check_circle" size={17} color="#3D6B4F" />{fileName}
            </span>
          </div>
        )}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={label}>{t('requests.snap.supplier')}</span>
          <input value={supplier} onChange={(e) => setSupplier(e.target.value)} maxLength={80} style={phoneField} />
        </label>
        {suppliers.length ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }} role="group" aria-label={t('requests.snap.suppliers')}>
            {suppliers.map((q) => (
              <button key={q.id} type="button" onClick={() => setSupplier(q.name)} className="h-cream cp-press" style={{ height: 36, padding: '0 12px', borderRadius: 999, border: '1px solid #DCD3C8', background: q.name === supplier.trim() ? '#F3EEE8' : '#FFFFFF', color: '#24201C', fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Inter' }}>{q.name}</button>
            ))}
          </div>
        ) : null}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={label}>{t('requests.snap.amount')}</span>
          <input value={amt} onChange={(e) => setAmt(fmtN(e.target.value))} inputMode="numeric" style={phoneField} />
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={label}>{t('requests.snap.section')}</span>
          {secs.length <= 4 ? <Segmented label={t('requests.snap.section')} options={opts} value={sectionId} onChange={setPicked} /> : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }} role="group" aria-label={t('requests.snap.section')}>
              {secs.map((c) => <ChoiceChip key={c.id} label={sectionName(s, c.id, lang)} selected={sectionId === c.id} onClick={() => setPicked(c.id)} />)}
            </div>
          )}
        </div>
        {!secs.length ? <Note tone="ochre" icon="info">{t('requests.budget.noSections')}</Note> : null}
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={onDone} className="h-cream cp-press" style={{ height: 48, padding: '0 20px', borderRadius: 999, border: '1px solid #DCD3C8', background: '#FFFFFF', color: '#24201C', fontSize: 16, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Inter' }}>{t('common.cancel')}</button>
          <PillButton height={48} on={ok && !busy} onClick={send} grow>{t('requests.snap.send')}</PillButton>
        </div>
      </PGroup>
    );
  }
  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #EFE7DC', borderRadius: 20, boxShadow: '0 1px 2px rgba(60,40,20,.04), 0 18px 40px rgba(60,40,20,.07)', padding: '22px clamp(18px, 3vw, 32px)', display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start', animation: 'cpUp .2s ease-out' }}>
      {!snapped ? (
        <button type="button" onClick={() => setSnapped(true)} data-testid="snap-photo" style={{ flex: '0 0 220px', aspectRatio: '3/4', borderRadius: 14, border: 'none', background: '#2E2924', color: '#F3EEE8', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: 'pointer', fontFamily: 'Inter' }}>
          <Icon name="receipt_long" size={40} color="#CAB8A2" />
          <span style={{ fontSize: 16, lineHeight: 1.4 }}>{t('requests.snap.tap')}</span>
        </button>
      ) : (
        <div role="img" aria-label={t('requests.snap.photoAlt')} style={{ flex: '0 0 220px', aspectRatio: '3/4', borderRadius: 14, background: PAPER, border: '1px solid #E4DACD', position: 'relative' }}>
          <span style={{ position: 'absolute', left: 10, bottom: 10, height: 28, padding: '0 10px 0 6px', borderRadius: 8, background: '#FFFFFF', fontSize: FONT_SMALL, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
            <Icon name="check_circle" size={17} color="#3D6B4F" />{fileName}
          </span>
        </div>
      )}
      <div style={{ flex: '1 1 300px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={label}>{t('requests.snap.supplier')}</span>
          <input value={supplier} onChange={(e) => setSupplier(e.target.value)} maxLength={80} style={bronzeInput} />
        </label>
        {suppliers.length ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }} role="group" aria-label={t('requests.snap.suppliers')}>
            {suppliers.map((q) => (
              <button key={q.id} type="button" onClick={() => setSupplier(q.name)} className="h-cream" style={{ height: 44, padding: '0 12px', borderRadius: 12, border: '1px solid #DCD3C8', background: q.name === supplier.trim() ? '#F3EEE8' : '#FFFFFF', color: '#24201C', fontSize: FONT_BODY, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Inter' }}>{q.name}</button>
            ))}
          </div>
        ) : null}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={label}>{t('requests.snap.amount')}</span>
          <input value={amt} onChange={(e) => setAmt(fmtN(e.target.value))} inputMode="numeric" style={bronzeInput} />
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={label}>{t('requests.snap.section')}</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }} role="group" aria-label={t('requests.snap.section')}>
            {secs.map((c) => <ChoiceChip key={c.id} label={sectionName(s, c.id, lang)} selected={sectionId === c.id} onClick={() => setPicked(c.id)} />)}
          </div>
        </div>
        {!secs.length ? <Note tone="ochre" icon="info">{t('requests.budget.noSections')}</Note> : null}
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={onDone} className="h-cream" style={{ height: 48, padding: '0 18px', borderRadius: 12, border: '1px solid #DCD3C8', background: '#FFFFFF', color: '#24201C', fontSize: 16, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Inter' }}>{t('common.cancel')}</button>
          <PillButton on={ok && !busy} onClick={send} grow>{t('requests.snap.send')}</PillButton>
        </div>
      </div>
    </div>
  );
}
