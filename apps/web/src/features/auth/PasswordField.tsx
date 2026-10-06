// Password input with a show/hide toggle. Used by the sign-in page and the Account sheet (change password).
import { useId, useState, type CSSProperties, type ReactNode } from 'react';
import { Icon, FONT_BODY, FONT_SMALL } from '../../components/ui';
import { useT } from '../../lib/i18n';

const uppercase: CSSProperties = { fontSize: FONT_SMALL, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 500, lineHeight: '18px' };

export function PasswordField({ label, value, onChange, autoComplete, error, hint, onEnter, autoFocus, name, size = 'form' }: {
  label: string; value: string; onChange: (v: string) => void; autoComplete: 'current-password' | 'new-password'; error?: string | false; hint?: ReactNode;
  onEnter?: () => void; autoFocus?: boolean; name?: string;
  /** 'login' = the sign-in page look (56px, small caps label); 'form' = the same as the other form fields */
  size?: 'login' | 'form';
}) {
  const t = useT();
  const id = useId();
  const [shown, setShown] = useState(false);
  const login = size === 'login';
  const border = error ? '2px solid #AF4B2F' : '1px solid #8A755B';
  const msgId = `${id}-msg`;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: login ? 8 : 6, minWidth: 0 }}>
      <label htmlFor={id} style={login ? uppercase : { fontSize: FONT_BODY, fontWeight: 500, lineHeight: 1.4 }}>{label}</label>
      <span style={{ display: 'flex', alignItems: 'center', height: login ? 56 : 52, border, borderRadius: 16, background: '#FFFFFF', overflow: 'hidden' }}>
        <input id={id} name={name} type={shown ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} autoFocus={autoFocus}
          autoCapitalize="none" autoCorrect="off" spellCheck={false} aria-invalid={!!error || undefined} aria-describedby={error || hint ? msgId : undefined}
          onKeyDown={onEnter ? (e) => { if (e.key === 'Enter') { e.preventDefault(); onEnter(); } } : undefined}
          style={{ flex: 1, minWidth: 0, height: '100%', border: 'none', outline: 'none', padding: '0 4px 0 14px', fontSize: login ? 17 : 16, fontFamily: 'Inter', color: '#282828', background: 'transparent' }} />
        <button type="button" onClick={() => setShown(!shown)} aria-label={shown ? t('login.hidePassword') : t('login.showPassword')} title={shown ? t('login.hidePassword') : t('login.showPassword')} className="h-cream"
          style={{ width: 48, height: '100%', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', color: '#75624B', cursor: 'pointer', padding: 0 }}>
          <Icon name={shown ? 'visibility_off' : 'visibility'} size={22} />
        </button>
      </span>
      {error ? <span id={msgId} role="alert" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: FONT_BODY, color: '#AF4B2F', lineHeight: 1.4 }}><Icon name="error" size={18} fill={1} />{error}</span>
        : hint ? <span id={msgId} style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{hint}</span> : null}
    </div>
  );
}
