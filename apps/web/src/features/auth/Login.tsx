// Sign-in (Prototype v3 ShowLogin): username + password for staff and families, plus the one-tap demo accounts. Logo replaces the wordmark.
import { useState, type CSSProperties, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDevice } from '../../hooks/useDevice';
import { useT } from '../../lib/i18n';
import { api, ApiError } from '../../lib/api';
import { useSession, signInDemo, type PublicUser } from '../../store/session';
import { Icon, Logo } from '../../components/ui';
import { useDemoAccounts } from '../../shell/demoAccounts';
import { DEFAULT_PASSWORD, hasKey, initials } from '@cp/shared';
import { PasswordField } from './PasswordField';

const label: CSSProperties = { fontSize: 14, fontWeight: 600, lineHeight: 1.4 };

/** A member with her daughter (KC's photo); the two faces sit left of centre, so the crop keeps that side. */
const PHOTO = '/login-family.jpg';

export function Login() {
  const { isPhone, isWide } = useDevice();
  const t = useT();
  const navigate = useNavigate();
  const { lang, setLang, signIn } = useSession();
  const accounts = useDemoAccounts();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const finish = () => navigate('/today', { replace: true });
  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (busy) return;
    if (!username.trim() || !password) { setErr(t('login.errEmpty')); return; }
    setBusy(true);
    try {
      const r = await api<{ ok: boolean; user: PublicUser; token: string }>('/api/login', { body: { username: username.trim(), password } });
      signIn(r.user, r.token);
      finish();
    } catch (x) {
      setErr(x instanceof ApiError && hasKey(x.code) ? t(x.code) : t('err.network'));
    } finally { setBusy(false); }
  };
  const demo = async (id: string) => {
    try { if (await signInDemo(id)) finish(); } catch { setErr(t('err.network')); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', minHeight: 0, background: '#F5F5F3', containerType: 'inline-size', ...( { '--cp-body': isPhone ? '16px' : '0px', '--cp-small': isPhone ? '14px' : '0px' } as CSSProperties) }}>
      {isWide ? (
        <div style={{ flex: '1 1 55%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 24, padding: 44, background: '#FFFFFF', borderRight: '1px solid #E2DBD2' }}>
          <Logo height={56} />
          <div role="img" aria-label={t('login.photoAlt')} style={{ flex: 1, minHeight: 160, borderRadius: 16, background: `30% 35% / cover no-repeat url("${PHOTO}"), #E9E3DB` }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 620 }}>
            <div style={{ fontSize: 13, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600, color: '#3D6B4F' }}>{t('login.philosophy')}</div>
            <div style={{ fontSize: 38, lineHeight: '46px', fontWeight: 500, letterSpacing: '-0.8px', color: '#5E4E3B', textWrap: 'pretty' } as CSSProperties}>{t('login.tagline')}</div>
          </div>
        </div>
      ) : null}
      <div style={{ flex: '1 1 auto', maxWidth: isPhone ? undefined : 560, minWidth: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 24, padding: isPhone ? '16px 20px 32px' : 'clamp(20px, 6cqi, 48px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>{isPhone ? <Logo height={40} /> : null}</div>
          <div style={{ display: 'flex', padding: 3, borderRadius: 999, background: '#EDE5DA', flex: 'none' }} role="group" aria-label={t('shell.language')}>
            {(['en', 'id'] as const).map((l) => (
              <button key={l} type="button" onClick={() => setLang(l)} aria-pressed={lang === l} style={{ height: 40, minWidth: 48, padding: '0 12px', borderRadius: 12, border: 'none', background: lang === l ? '#FFFFFF' : 'transparent', boxShadow: lang === l ? '0 1px 3px rgba(40,30,20,.14)' : 'none', color: '#24201C', fontSize: 14, fontWeight: lang === l ? 600 : 500, cursor: 'pointer', fontFamily: 'Inter' }}>{l.toUpperCase()}</button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h1 style={{ margin: 0, fontSize: 36, lineHeight: '44px', fontWeight: 500, letterSpacing: '-0.8px', color: '#5E4E3B' }}>{t('login.welcome')}</h1>
        </div>
        <form onSubmit={(e) => void submit(e)} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={label}>{t('login.username')}</span>
            <input value={username} onChange={(e) => { setUsername(e.target.value); setErr(null); }} name="username" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoFocus={!isPhone} aria-invalid={!!err || undefined}
              style={{ height: 52, border: err ? '2px solid #9A3D24' : '1px solid #DDD1C2', borderRadius: 10, background: '#FFFFFF', padding: '0 14px', fontSize: 16, fontFamily: 'Inter', color: '#24201C', outline: 'none', minWidth: 0 }} />
          </label>
          <PasswordField size="login" label={t('login.password')} value={password} onChange={(v) => { setPassword(v); setErr(null); }} autoComplete="current-password" name="password" error={err || false} />
          <button type="submit" className="h-bronze" aria-disabled={busy || undefined} style={{ height: 52, borderRadius: 999, border: 'none', background: '#24201C', color: '#FFFFFF', fontSize: 16, fontWeight: 600, cursor: busy ? 'progress' : 'pointer', fontFamily: 'Inter', opacity: busy ? 0.7 : 1 }}>{t('login.signIn')}</button>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14, color: '#5E5852', lineHeight: 1.4 }}>
            <span>{t('login.forgot')}</span>
            <span>{t('login.demoHint', { pw: DEFAULT_PASSWORD })}</span>
          </div>
        </form>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600, color: '#3D6B4F', whiteSpace: 'nowrap' }}>{t('login.demoAccounts')}</span>
            <span style={{ flex: 1, height: 1, background: '#E2DBD2' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {accounts.map((d) => (
              <button key={d.id} type="button" onClick={() => void demo(d.id)} className="h-border h-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 14px', minHeight: 60, borderRadius: 12, border: '1px solid #E4DACD', background: '#FFFFFF', textAlign: 'left', cursor: 'pointer', color: '#24201C', fontFamily: 'Inter' }}>
                <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 999, background: '#EDE5DA', color: '#5E4E3B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 500, flex: 'none' }}>{initials(d.name)}</span>
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <span style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.35 }}>{d.name}</span>
                  <span style={{ fontSize: 13, color: '#5E5852', lineHeight: 1.35 }}>{d.role} · {d.lands}</span>
                </span>
                <Icon name="arrow_forward" size={22} color="#75624B" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
