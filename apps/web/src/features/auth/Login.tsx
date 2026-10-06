// Sign-in (design ShowLogin layout): username + password for staff and families, plus the one-tap demo accounts. Logo replaces the wordmark.
import { useState, type CSSProperties, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDevice } from '../../hooks/useDevice';
import { useT } from '../../lib/i18n';
import { api, ApiError } from '../../lib/api';
import { useSession, signInDemo, type PublicUser } from '../../store/session';
import { Avatar, Icon, Logo, FONT_BODY, FONT_SMALL } from '../../components/ui';
import { useDemoAccounts } from '../../shell/demoAccounts';
import { DEFAULT_PASSWORD, hasKey } from '@cp/shared';
import { PasswordField } from './PasswordField';

const label: CSSProperties = { fontSize: FONT_SMALL, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 500, lineHeight: '18px' };

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
    <div style={{ position: 'fixed', inset: 0, display: 'flex', minHeight: 0, background: '#F6F5F5', ...( { '--cp-body': isPhone ? '16px' : '0px', '--cp-small': isPhone ? '14px' : '0px' } as CSSProperties) }}>
      {isWide ? (
        <div style={{ flex: '1 1 55%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 24, padding: 48, background: '#F4F0EE', borderRight: '1px solid #DBD7D6' }}>
          <Logo height={66} />
          <div role="img" aria-label={t('login.photoAlt')} style={{ flex: 1, minHeight: 160, borderRadius: 28, background: `30% 35% / cover no-repeat url("${PHOTO}"), #E8E1D8` }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 620 }}>
            <div style={{ ...label, color: '#282828' }}>{t('login.philosophy')}</div>
            <div style={{ fontSize: 40, lineHeight: '48px', letterSpacing: '-0.5px', color: '#75624B', textWrap: 'pretty' } as CSSProperties}>{t('login.tagline')}</div>
          </div>
          <div style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{t('login.footer')}</div>
        </div>
      ) : null}
      <div style={{ flex: isPhone ? '1 1 auto' : '0 0 520px', minWidth: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 28, padding: isPhone ? '16px 20px 32px' : 48 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>{isPhone ? <Logo height={47} /> : null}</div>
          <div style={{ display: 'flex', padding: 3, borderRadius: 999, background: '#E8E1D8', flex: 'none' }} role="group" aria-label={t('shell.language')}>
            {(['en', 'id'] as const).map((l) => (
              <button key={l} type="button" onClick={() => setLang(l)} aria-pressed={lang === l} style={{ height: 44, minWidth: 52, padding: '0 12px', borderRadius: 999, border: 'none', background: lang === l ? '#FFFFFF' : 'transparent', color: '#282828', fontSize: FONT_BODY, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter' }}>{l.toUpperCase()}</button>
            ))}
          </div>
        </div>
        {!isWide && !isPhone ? <div role="img" aria-label={t('login.photoAlt')} style={{ height: 220, flex: 'none', borderRadius: 24, background: `30% 35% / cover no-repeat url("${PHOTO}"), #E8E1D8` }} /> : null}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h1 style={{ margin: 0, fontSize: 40, lineHeight: '48px', fontWeight: 400, letterSpacing: '-0.5px', color: '#9A836C' }}>{t('login.welcome')}</h1>
          <p style={{ margin: 0, fontSize: 16, lineHeight: '24px', textWrap: 'pretty' } as CSSProperties}>{t('login.loginSub')}</p>
        </div>
        <form onSubmit={(e) => void submit(e)} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={label}>{t('login.username')}</span>
            <input value={username} onChange={(e) => { setUsername(e.target.value); setErr(null); }} name="username" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoFocus={!isPhone} aria-invalid={!!err || undefined}
              style={{ height: 56, border: err ? '2px solid #AF4B2F' : '1px solid #8A755B', borderRadius: 16, background: '#FFFFFF', padding: '0 14px', fontSize: 17, fontFamily: 'Inter', color: '#282828', outline: 'none', minWidth: 0 }} />
          </label>
          <PasswordField size="login" label={t('login.password')} value={password} onChange={(v) => { setPassword(v); setErr(null); }} autoComplete="current-password" name="password" error={err || false} />
          <button type="submit" className="dh7" aria-disabled={busy || undefined} style={{ height: 56, borderRadius: 999, border: 'none', background: '#75624B', color: '#FFFFFF', fontSize: 17, fontWeight: 500, cursor: busy ? 'progress' : 'pointer', fontFamily: 'Inter', opacity: busy ? 0.7 : 1 }}>{t('login.signIn')}</button>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>
            <span>{t('login.forgot')}</span>
            <span>{t('login.demoHint', { pw: DEFAULT_PASSWORD })}</span>
          </div>
        </form>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ ...label, color: '#6A6967', whiteSpace: 'nowrap' }}>{t('login.demoAccounts')}</div>
            <div style={{ flex: 1, height: 1, background: '#DBD7D6' }} />
          </div>
          <div style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4, marginTop: -4 }}>{t('login.demoAccountsSub')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {accounts.map((d) => (
              <button key={d.id} type="button" onClick={() => void demo(d.id)} className="h-border h-row" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px', minHeight: 64, borderRadius: 20, border: '1px solid #DBD7D6', background: '#FFFFFF', textAlign: 'left', cursor: 'pointer', color: '#282828', fontFamily: 'Inter' }}>
                <Avatar name={d.name} size={44} />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{d.name}</span>
                  <span style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{d.role} · {d.lands}</span>
                </div>
                <Icon name="arrow_forward" size={22} color="#75624B" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
