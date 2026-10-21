// Round 8: the two sheets of the Me tab, in the family look: "Your details" (name and phone, sent to the club for approval) and "Password".
import { useEffect, useId, useState, type ReactNode } from 'react';
import { fmtPhone, hasKey, MIN_PASSWORD } from '@cp/shared';
import { Icon } from '../../components/ui';
import { api, ApiError } from '../../lib/api';
import { useAct } from '../../lib/act';
import { say } from '../../store/ui';
import { F, FamSheet } from './kit';
import { useFamilyCtx } from './useFamily';

/** A grey labelled input (the sheets' field): label above, 16px text, a soft rust ring on an error. */
export function Field({ label, value, onChange, inputMode, readOnly, error, hint, name, autoComplete, lock, onEnter, secret, autoFocus }: {
  label: string; value: string; onChange?: (v: string) => void; inputMode?: 'text' | 'tel'; readOnly?: boolean; error?: string | false; hint?: ReactNode; name?: string;
  autoComplete?: string; lock?: boolean; onEnter?: () => void; secret?: boolean; autoFocus?: boolean;
}) {
  const id = useId();
  const [shown, setShown] = useState(false);
  const msg = `${id}-msg`;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <label htmlFor={id} style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.4, color: F.soft }}>{label}</label>
      <span style={{ display: 'flex', alignItems: 'center', height: 50, borderRadius: 14, background: readOnly ? F.press : F.fill, boxShadow: error ? `inset 0 0 0 1.5px ${F.rust}` : 'none', overflow: 'hidden' }}>
        <input id={id} name={name} value={value} readOnly={readOnly} onChange={onChange ? (e) => onChange(e.target.value) : undefined} type={secret && !shown ? 'password' : 'text'} inputMode={inputMode}
          autoComplete={autoComplete} autoFocus={autoFocus} autoCapitalize="none" autoCorrect="off" spellCheck={false} aria-invalid={!!error || undefined} aria-describedby={error || hint ? msg : undefined}
          onKeyDown={onEnter ? (e) => { if (e.key === 'Enter') { e.preventDefault(); onEnter(); } } : undefined}
          style={{ flex: 1, minWidth: 0, height: '100%', border: 'none', outline: 'none', background: 'transparent', padding: '0 14px', fontSize: 16, fontFamily: 'Inter, system-ui, sans-serif', color: readOnly ? F.muted : F.text }} />
        {lock ? <Icon name="lock" size={20} color={F.muted} style={{ marginRight: 14 }} /> : null}
        {secret ? (
          <button type="button" onClick={() => setShown(!shown)} aria-label={shown ? 'Hide' : 'Show'} style={{ width: 48, height: '100%', border: 'none', background: 'transparent', color: F.bronze, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={shown ? 'visibility_off' : 'visibility'} size={22} />
          </button>
        ) : null}
      </span>
      {error ? <span id={msg} role="alert" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: F.rust, lineHeight: 1.4 }}><Icon name="error" size={18} fill={1} />{error}</span>
        : hint ? <span id={msg} style={{ fontSize: 13, color: F.muted, lineHeight: 1.4 }}>{hint}</span> : null}
    </div>
  );
}

/** "Your details": the signed-in contact's name and phone. A change goes to the club's Approvals; the current details stay until then. */
export function DetailsSheet({ onClose }: { onClose: () => void }) {
  const { s, t, user } = useFamilyCtx();
  const act = useAct();
  const name0 = user?.contact.name ?? '';
  const phone0 = fmtPhone(user?.contact.phone ?? '');
  const [name, setName] = useState(name0);
  const [phone, setPhone] = useState(phone0);
  const [busy, setBusy] = useState(false);
  if (!user) return null;
  const pending = Object.values(s.changeRequests).some((c) => c.status === 'pending' && c.submittedBy === `family:${user.id}` && c.target.type === 'familyContact');
  const nameChanged = name.trim() !== name0;
  const phoneChanged = phone.replace(/\D/g, '') !== phone0.replace(/\D/g, '');
  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await act('account.updateFamily', { familyId: user.id, name: nameChanged ? name.trim() : undefined, phone: phoneChanged ? phone : undefined }, { reviewText: t('shell.profileSubmitted') });
      if (r.ok) { if (r.reviewed !== 'gate') say(t('shell.profileSaved')); onClose(); }
    } finally { setBusy(false); }
  };
  return (
    <FamSheet open onClose={onClose} title={t('fme.detailsTitle')} testId="details-sheet" action={{ label: t('fam.send'), onClick: () => void save(), disabled: busy || !(nameChanged || phoneChanged) || !name.trim() }}>
      {pending ? (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', borderRadius: 12, background: F.ochreBg, color: F.ochre, fontSize: 14, lineHeight: '20px' }} data-testid="details-pending">
          <Icon name="hourglass_top" size={18} color={F.ochre} style={{ marginTop: 1 }} />{t('shell.profileSubmitted')}
        </div>
      ) : null}
      <Field label={t('shell.yourName')} value={name} onChange={setName} autoComplete="name" />
      <Field label={t('shell.yourPhone')} value={phone} onChange={setPhone} inputMode="tel" autoComplete="tel" />
    </FamSheet>
  );
}

type PwErrors = { current?: string; next?: string; confirm?: string };
/** "Password": the sign-in name (fixed) and the change-password form, with the same checks and server errors as the staff Account sheet. */
export function PasswordSheet({ onClose }: { onClose: () => void }) {
  const { t, user } = useFamilyCtx();
  const stateUsername = user?.contact.username;
  const [fetched, setFetched] = useState<string | null>(null);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState<PwErrors>({});
  const [busy, setBusy] = useState(false);
  // the username comes with the club state; ask the server only when the state does not have it yet (just assigned)
  useEffect(() => {
    if (user && !stateUsername) void api<{ username: string | null }>('/api/account').then((r) => setFetched(r.username)).catch(() => { /* shown as empty */ });
  }, [user?.id, stateUsername]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!user) return null;
  const ready = !!current && !!next && !!confirm && !busy;
  const clear = (k: keyof PwErrors) => setErr((p) => (p[k] ? { ...p, [k]: undefined } : p));
  const save = async () => {
    if (!ready) return;
    if (next.length < MIN_PASSWORD) { setErr({ next: t('login.errShort', { n: MIN_PASSWORD }) }); return; }
    if (next === current) { setErr({ next: t('login.errSame') }); return; }
    if (next !== confirm) { setErr({ confirm: t('login.errMismatch') }); return; }
    setErr({});
    setBusy(true);
    try {
      await api('/api/account/password', { body: { current, next } });
      say(t('login.passwordChanged'));
      onClose();
    } catch (x) {
      const msg = x instanceof ApiError && hasKey(x.code) ? t(x.code, x.params) : t('err.network');
      if (x instanceof ApiError && x.code === 'login.errCurrent') setErr({ current: msg });
      else if (x instanceof ApiError && x.status === 422) setErr({ next: msg });
      else say(msg, { tone: 'error', icon: 'error' });
    } finally { setBusy(false); }
  };
  return (
    <FamSheet open onClose={onClose} title={t('fme.password')} testId="password-sheet" action={{ label: t('fam.save'), onClick: () => void save(), disabled: !ready }}>
      <Field label={t('login.username')} value={stateUsername || fetched || ''} readOnly lock name="username" autoComplete="username" />
      <Field label={t('login.currentPassword')} value={current} onChange={(v) => { setCurrent(v); clear('current'); }} secret autoComplete="current-password" error={err.current || false} />
      <Field label={t('login.newPassword')} value={next} onChange={(v) => { setNext(v); clear('next'); }} secret autoComplete="new-password" error={err.next || false} hint={t('login.passwordHint', { n: MIN_PASSWORD })} />
      <Field label={t('login.confirmPassword')} value={confirm} onChange={(v) => { setConfirm(v); clear('confirm'); }} secret autoComplete="new-password" error={err.confirm || false} onEnter={() => void save()} />
    </FamSheet>
  );
}
