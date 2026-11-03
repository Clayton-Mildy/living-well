// Terms editor (round 17, KC): English and Indonesian as plain text ("# " heading, "- " bullet), Publish with a confirm ("Families will be asked to agree again").
// A full screen on a phone, a sheet on tablet and desktop. Closing after a change asks first.
import { useState } from 'react';
import { TERMS_MAX } from '@cp/shared/actions/terms';
import { currentTerms } from '@cp/shared/rules/terms';
import { Button, PhoneScreen, Segmented, Sheet, TextField } from '../../components/ui';
import { ConfirmDialog } from '../kitchen/parts';
import { useDevice } from '../../hooks/useDevice';
import { useAct } from '../../lib/act';
import { useT } from '../../lib/i18n';
import { useClub } from '../../store/replica';

type Tab = 'en' | 'id';

export function TermsEditor({ onClose }: { onClose: () => void }) {
  const t = useT();
  const { isPhone } = useDevice();
  const s = useClub();
  const act = useAct();
  const cur = currentTerms(s);
  const start = { en: cur?.en ?? '', id: cur?.id ?? '' };
  const [text, setText] = useState<Record<Tab, string>>(start);
  const [tab, setTab] = useState<Tab>('en');
  const [bad, setBad] = useState<Record<Tab, boolean>>({ en: false, id: false });
  const [confirming, setConfirming] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [busy, setBusy] = useState(false);
  const next = (cur?.version ?? 0) + 1;
  const dirty = text.en !== start.en || text.id !== start.id;

  const close = () => { if (dirty) setDiscarding(true); else onClose(); };
  const publish = () => {
    const badEn = !text.en.trim() || text.en.trim().length > TERMS_MAX;
    const badId = text.id.trim().length > TERMS_MAX;
    setBad({ en: badEn, id: badId });
    if (badEn || badId) { setTab(badEn ? 'en' : 'id'); return; }
    setConfirming(true);
  };
  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await act('terms.publish', { en: text.en, id: text.id }, { ok: t('terms.published', { v: next }) });
      setConfirming(false);
      if (r.ok) { onClose(); return; }
      const f = r.params?.field;
      if (f === 'en' || f === 'id') { setBad((b) => ({ ...b, [f]: true })); setTab(f); }
    } finally { setBusy(false); }
  };

  const dot = (on: boolean) => (on ? <span role="img" aria-label={t('terms.badTab')} style={{ width: 7, height: 7, borderRadius: 999, background: '#9A3D24', flex: 'none' }} /> : null);
  const hint = (
    <>
      {t('terms.hintFormat')}
      <br />
      {t('terms.hintPlaceholders')}
      {tab === 'id' ? <><br />{t('terms.idHint')}</> : null}
    </>
  );
  const fields = (
    <>
      <Segmented<Tab> label={t('terms.textLang')} value={tab} onChange={setTab}
        items={[{ value: 'en', label: <>{t('terms.tabEn')}{dot(bad.en)}</> }, { value: 'id', label: <>{t('terms.tabId')}{dot(bad.id)}</> }]} />
      <TextField multiline rows={isPhone ? 16 : 20} name={`terms-${tab}`} label={`${t('terms.title')} · ${tab.toUpperCase()}`} value={text[tab]}
        onChange={(v) => { setText((x) => ({ ...x, [tab]: v })); if (bad[tab]) setBad((b) => ({ ...b, [tab]: false })); }}
        error={bad[tab] && (tab === 'en' ? t('terms.badEn') : t('terms.badId'))} hint={hint} />
    </>
  );
  const publishBtn = <Button size={48} full={isPhone} disabled={busy} onClick={publish}>{t('terms.publish')}</Button>;
  const asks = (
    <>
      <ConfirmDialog open={confirming} onClose={() => setConfirming(false)} title={t('terms.publishAsk', { v: next })} body={t('terms.publishBody')}
        confirmLabel={t('terms.publish')} cancelLabel={t('common.cancel')} danger={false} onConfirm={confirm} />
      <ConfirmDialog open={discarding} onClose={() => setDiscarding(false)} title={t('terms.discardAsk')} body={t('terms.discardBody')}
        confirmLabel={t('terms.discard')} cancelLabel={t('common.cancel')} onConfirm={onClose} />
    </>
  );

  if (isPhone) {
    return (
      <>
        <PhoneScreen open onClose={close} label={t('terms.editTitle')} back={t('terms.title')} footer={publishBtn}>
          <h2 className="cp-serif" style={{ margin: 0, fontSize: 28, lineHeight: '34px', fontWeight: 500, color: '#24201C' }}>{t('terms.editTitle')}</h2>
          {fields}
        </PhoneScreen>
        {asks}
      </>
    );
  }
  return (
    <>
      <Sheet open onClose={close} title={t('terms.editTitle')} maxWidth={760} footer={<div style={{ display: 'flex', justifyContent: 'flex-end' }}>{publishBtn}</div>}>
        {fields}
      </Sheet>
      {asks}
    </>
  );
}
