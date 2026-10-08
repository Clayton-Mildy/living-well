// Account sheet (design: acct sheet), now on every device: your details, sign-in name and password, language, sign out.
import { useEffect, useState, type FormEvent } from 'react';
import { useResetOn } from '../lib/useResetOn';
import { fmtPhone, hasKey, MIN_PASSWORD } from '@cp/shared';
import { Avatar, Button, Icon, Segmented, Sheet, TextField, SectionLabel, Note, FONT_BODY } from '../components/ui';
import { PasswordField } from '../features/auth/PasswordField';
import { useT } from '../lib/i18n';
import { useMe } from '../lib/me';
import { useAct } from '../lib/act';
import { api, ApiError } from '../lib/api';
import { useSession } from '../store/session';
import { useClub } from '../store/replica';
import { SignOutButton } from './AppShell';
import { say } from '../store/ui';
import { memberPhoto } from '../lib/media';

type PwErrors = { current?: string; next?: string; confirm?: string };

export function AccountSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const { user } = useMe();
  const s = useClub();
  const { lang, setLang } = useSession();
  const act = useAct();
  const name0 = user ? (user.kind === 'staff' ? user.staff.name : user.contact.name) : '';
  const phone0 = user ? (user.kind === 'staff' ? user.staff.phone : user.contact.phone) : '';
  const stateUsername = user ? (user.kind === 'staff' ? user.staff.username : user.contact.username) : undefined;
  const [name, setName] = useState(name0);
  const [phone, setPhone] = useState(fmtPhone(phone0));
  const [fetched, setFetched] = useState<string | null>(null);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pwErr, setPwErr] = useState<PwErrors>({});
  const [pwBusy, setPwBusy] = useState(false);
  useResetOn(open ? 'open' : null, () => { setName(name0); setPhone(fmtPhone(phone0)); setCurrent(''); setNext(''); setConfirm(''); setPwErr({}); }); // not on live updates: that would wipe what is being typed
  // the username comes with the club state; ask the server only when the state does not have it yet (just assigned)
  useEffect(() => {
    if (open && user && !stateUsername) void api<{ username: string | null }>('/api/account').then((r) => setFetched(r.username)).catch(() => { /* shown as empty */ });
  }, [open, user?.id, stateUsername]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!user || !s) return null;
  const pending = Object.values(s.changeRequests).some((c) => c.status === 'pending' && c.submittedBy === `family:${user.id}` && c.target.type === 'familyContact');
  const roleLabel = user.kind === 'staff' ? t('roles.' + user.staff.role) : t('roles.family');
  const changed = name.trim() !== name0 || phone.replace(/\D/g, '') !== fmtPhone(phone0).replace(/\D/g, '');
  const save = async () => {
    const r = user.kind === 'staff'
      ? await act('account.updateStaff', { name: name.trim(), phone }, { ok: t('shell.profileSaved') })
      : await act('account.updateFamily', { familyId: user.id, name: name.trim() !== name0 ? name.trim() : undefined, phone: phone.replace(/\D/g, '') !== fmtPhone(phone0).replace(/\D/g, '') ? phone : undefined }, { reviewText: t('shell.profileSubmitted') });
    if (r.ok && r.reviewed !== 'gate' && user.kind === 'family') say(t('shell.profileSaved'));
  };

  const canChangePassword = !!current && !!next && !!confirm && !pwBusy;
  const changePassword = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!canChangePassword) return;
    if (next.length < MIN_PASSWORD) { setPwErr({ next: t('login.errShort', { n: MIN_PASSWORD }) }); return; }
    if (next === current) { setPwErr({ next: t('login.errSame') }); return; }
    if (next !== confirm) { setPwErr({ confirm: t('login.errMismatch') }); return; }
    setPwErr({});
    setPwBusy(true);
    try {
      await api('/api/account/password', { body: { current, next } });
      setCurrent(''); setNext(''); setConfirm('');
      say(t('login.passwordChanged'));
    } catch (x) {
      const msg = x instanceof ApiError && hasKey(x.code) ? t(x.code, x.params) : t('err.network');
      if (x instanceof ApiError && x.code === 'login.errCurrent') setPwErr({ current: msg });
      else if (x instanceof ApiError && x.status === 422) setPwErr({ next: msg });
      else say(msg, { tone: 'error', icon: 'error' });
    } finally { setPwBusy(false); }
  };
  const clearErr = (k: keyof PwErrors) => setPwErr((p) => (p[k] ? { ...p, [k]: undefined } : p));

  return (
    <Sheet open={open} onClose={onClose} title={t('shell.account')}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Avatar name={name0} size={52} src={user.kind === 'staff' ? memberPhoto(user.staff) : undefined} />
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 18, fontWeight: 500 }}>{name0}</span>
          <span style={{ fontSize: FONT_BODY, color: '#5E5852' }}>{roleLabel} · {s.club.name}</span>
        </div>
        <SignOutButton />
      </div>
      <SectionLabel>{t('shell.profile')}</SectionLabel>
      {pending ? <Note tone="ochre" icon="hourglass_top">{t('shell.profileSubmitted')}</Note> : null}
      <TextField label={t('shell.yourName')} value={name} onChange={setName} />
      <TextField label={t('shell.yourPhone')} value={phone} onChange={setPhone} inputMode="tel" />
      <div><Button disabled={!changed || !name.trim()} onClick={save}>{user.kind === 'family' ? t('common.submitReview') : t('common.saveChanges')}</Button></div>
      <SectionLabel>{t('login.signInSection')}</SectionLabel>
      <form onSubmit={(e) => void changePassword(e)} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
          <span style={{ fontSize: FONT_BODY, fontWeight: 500, lineHeight: 1.4 }}>{t('login.username')}</span>
          <span style={{ display: 'flex', alignItems: 'center', height: 52, border: '1px solid #EFE7DC', borderRadius: 10, background: '#F5F5F3', paddingRight: 14 }}>
            <input readOnly value={stateUsername || fetched || ''} name="username" autoComplete="username" aria-readonly="true" data-testid="account-username"
              style={{ flex: 1, minWidth: 0, height: '100%', border: 'none', outline: 'none', background: 'transparent', padding: '0 14px', fontSize: 16, fontFamily: 'Inter', color: '#24201C' }} />
            <Icon name="lock" size={20} color="#5E5852" />
          </span>
        </label>
        <PasswordField label={t('login.currentPassword')} value={current} onChange={(v) => { setCurrent(v); clearErr('current'); }} autoComplete="current-password" error={pwErr.current || false} />
        <PasswordField label={t('login.newPassword')} value={next} onChange={(v) => { setNext(v); clearErr('next'); }} autoComplete="new-password" error={pwErr.next || false} hint={t('login.passwordHint', { n: MIN_PASSWORD })} />
        <PasswordField label={t('login.confirmPassword')} value={confirm} onChange={(v) => { setConfirm(v); clearErr('confirm'); }} autoComplete="new-password" error={pwErr.confirm || false} onEnter={() => void changePassword()} />
        <div><Button type="submit" disabled={!canChangePassword}>{t('login.changePassword')}</Button></div>
      </form>
      <SectionLabel>{t('shell.language')}</SectionLabel>
      <Segmented label={t('shell.language')} value={lang} onChange={(l) => { setLang(l); if (user.kind === 'family') void act('account.updateFamily', { familyId: user.id, lang: l }, { silent: true }); }} items={[{ value: 'en', label: 'English' }, { value: 'id', label: 'Bahasa Indonesia' }]} />
    </Sheet>
  );
}
