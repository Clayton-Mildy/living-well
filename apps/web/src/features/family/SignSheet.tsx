// Round 14 (D): the family signs the membership form. A full-screen sheet on a phone, three steps on one page: Read (the form as it was sent, then "I have read
// the form"), Sign (draw it), Confirm (a simulated 6-digit code: any six digits, said so on screen). Sign uploads the drawing and calls signing.sign. The sheet
// reads the live status: once the form is no longer Sent (signed here, or by someone else) it says so instead of showing the steps.
import { useState, type CSSProperties, type ReactNode } from 'react';
import { displayName, hasKey } from '@cp/shared';
import { applicationDataOf } from '@cp/shared/rules/applicationForm';
import { canSign, maskPhone, signerOf, signingOf } from '@cp/shared/rules/signing';
import { Icon, SignaturePad } from '../../components/ui';
import { useAct } from '../../lib/act';
import { ApiError } from '../../lib/api';
import { uploadMedia } from '../../lib/media';
import { say } from '../../store/ui';
import { useApplicationForm } from '../members/ApplicationForm';
import { F, FamSheet } from './kit';
import { useFamilyCtx, useStableFn } from './useFamily';

const FONT = 'Inter, system-ui, sans-serif';

export function SignSheet({ memberId, open, onClose }: { memberId: string; open: boolean; onClose: () => void }) {
  return open ? <SignInner memberId={memberId} onClose={onClose} /> : null;
}

/** A numbered step: a ring (a tick once done), its name, then what to do. */
function Step({ n, done, name, children }: { n: number; done: boolean; name: string; children: ReactNode }) {
  return (
    <section data-step={n} data-done={done} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {done
          ? <Icon name="check_circle" size={24} fill={1} color={F.sage} />
          : <span aria-hidden="true" style={{ width: 24, height: 24, borderRadius: 999, background: F.fill, color: F.text, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{n}</span>}
        <span style={{ fontSize: 13, letterSpacing: '.4px', textTransform: 'uppercase', fontWeight: 600, color: F.muted }}>{name}</span>
      </div>
      {children}
    </section>
  );
}

function SignInner({ memberId, onClose }: { memberId: string; onClose: () => void }) {
  const { s, t, now, user } = useFamilyCtx();
  const act = useAct();
  const close = useStableFn(onClose);
  const printer = useApplicationForm();
  const [seen, setSeen] = useState(false); // the form view was opened
  const [read, setRead] = useState(false);
  const [png, setPng] = useState<Blob | null>(null);
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const m = s.members[memberId];
  if (!m || !user) return null;
  const sig = signingOf(m);
  const signer = signerOf(s, memberId);
  const waiting = sig?.status === 'sent' && canSign(s, memberId, user.id);
  const ready = read && !!png && /^\d{6}$/.test(otp);

  const sign = async () => {
    if (!ready || busy || !png) return;
    setBusy(true);
    try {
      const signatureMediaId = await uploadMedia(png);
      const r = await act('signing.sign', { memberId, signatureMediaId, otp });
      if (r.ok) setDone(true);
    } catch (e) {
      say(e instanceof ApiError && hasKey(e.code) ? t(e.code) : t('common.mediaFailed'), { tone: 'error', icon: 'error' });
    } finally {
      setBusy(false);
    }
  };

  let body: ReactNode;
  if (done) {
    body = (
      <div data-testid="sign-done" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '40px 0', textAlign: 'center' }}>
        <Icon name="check_circle" size={48} fill={1} color={F.sage} />
        <span style={{ fontSize: 18, fontWeight: 500, color: F.text }}>{t('sign.done')}</span>
      </div>
    );
  } else if (!waiting) {
    body = (
      <div data-testid="sign-already" style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '24px 0' }}>
        <span style={{ fontSize: 17, fontWeight: 500, color: F.text }}>{sig && sig.status !== 'draft' ? t('sign.already') : t('sign.err.notNow')}</span>
        {sig ? <span style={{ fontSize: 14, color: F.muted }}>{t('sign.status.' + sig.status)}</span> : null}
      </div>
    );
  } else {
    const field: CSSProperties = { height: 48, boxSizing: 'border-box', width: '100%', border: 'none', borderRadius: 14, background: F.fill, padding: '0 14px', fontSize: 20, letterSpacing: 6, fontFamily: FONT, color: F.text, outline: 'none' };
    body = (
      <>
        <Step n={1} done={read} name={t('sign.step.read')}>
          <button type="button" data-testid="sign-view" className="cp-fam-press" onClick={() => { printer.open(sig!.form ?? applicationDataOf(s, memberId, now.today), sig); setSeen(true); }}
            style={{ height: 48, border: 'none', borderRadius: 999, background: F.fill, color: F.ink, fontSize: 16, fontWeight: 500, cursor: 'pointer', fontFamily: FONT, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Icon name="description" size={20} />{t('sign.readForm')}
          </button>
          <button type="button" role="checkbox" aria-checked={read} disabled={!seen} data-testid="sign-read" onClick={() => setRead(!read)}
            style={{ minHeight: 44, display: 'flex', alignItems: 'center', gap: 10, border: 'none', background: 'transparent', padding: 0, textAlign: 'left', fontSize: 16, fontFamily: FONT, color: seen ? F.text : F.muted, cursor: seen ? 'pointer' : 'default' }}>
            <Icon name={read ? 'check_box' : 'check_box_outline_blank'} size={26} fill={read ? 1 : 0} color={read ? F.ink : '#B8B0A6'} />{t('sign.haveRead')}
          </button>
        </Step>
        <Step n={2} done={!!png} name={t('sign.step.sign')}>
          <SignaturePad onChange={setPng} label={t('sign.drawHere')} />
        </Step>
        <Step n={3} done={/^\d{6}$/.test(otp)} name={t('sign.step.confirm')}>
          <span style={{ fontSize: 14, lineHeight: '20px', color: F.muted }}>
            {t('sign.codeSent', { phone: signer ? maskPhone(signer.phone) : '' })}<br />{t('sign.codeDemo')}
          </span>
          <input data-testid="sign-code" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} aria-label={t('sign.code')} placeholder="••••••" style={field} />
        </Step>
        <button type="button" data-testid="sign-go" disabled={!ready || busy} onClick={sign} className="cp-fam-press"
          style={{ height: 48, border: 'none', borderRadius: 999, background: F.ink, color: '#FFFFFF', fontSize: 16, fontWeight: 600, cursor: ready && !busy ? 'pointer' : 'default', opacity: ready && !busy ? 1 : 0.4, fontFamily: FONT }}>{t('sign.signBtn')}</button>
      </>
    );
  }

  return (
    <FamSheet open onClose={close} title={t('sign.readSign')} testId="sign-sheet" full>
      <span style={{ fontSize: 20, lineHeight: 1.3, fontWeight: 500, color: F.text }}>{displayName(m)}</span>
      {body}
      {printer.node}
    </FamSheet>
  );
}
