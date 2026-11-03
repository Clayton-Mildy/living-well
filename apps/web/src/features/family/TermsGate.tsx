// Round 17 (KC): the family's terms page. After sign-in a contact who has not agreed to the current version sees this full-screen page instead of the app:
// the first time with a short welcome (their parent's picture), after a newer version titled "Terms updated". Agree is disabled until the text has been
// scrolled to its end (enabled at once when it fits without scrolling). Sign out is the only other way out. The server refuses every other action until they agree.
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { displayName, type Member } from '@cp/shared';
import { currentTerms, termsText } from '@cp/shared/rules/terms';
import { Avatar, Logo } from '../../components/ui';
import { useAct } from '../../lib/act';
import { memberPhoto } from '../../lib/media';
import { useSession } from '../../store/session';
import { TermsView } from '../terms/TermsView';
import { F } from './kit';
import { useFamilyCtx } from './useFamily';

/** Reaching the end: within 8px of the bottom, or nothing to scroll. */
export const atEnd = (el: HTMLElement) => el.scrollHeight <= el.clientHeight || el.scrollTop + el.clientHeight >= el.scrollHeight - 8;

export function TermsGate({ kind }: { kind: 'first' | 'updated' }) {
  const { s, t, user } = useFamilyCtx();
  const lang = useSession((x) => x.lang);
  const signOut = useSession((x) => x.signOut);
  const navigate = useNavigate();
  const act = useAct();
  const box = useRef<HTMLDivElement>(null);
  const [reached, setReached] = useState(false);
  const [busy, setBusy] = useState(false);
  const cur = currentTerms(s);
  const body = termsText(s, lang);
  // checked on mount and whenever the text changes, on resize, and on scroll
  const check = useCallback(() => { const el = box.current; if (el && atEnd(el)) setReached(true); }, []);
  useLayoutEffect(() => {
    const el = box.current;
    setReached(!!el && atEnd(el));
    if (!el) return;
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(check);
    ro?.observe(el);
    window.addEventListener('resize', check);
    return () => { ro?.disconnect(); window.removeEventListener('resize', check); };
  }, [body, check]);
  if (!user || !cur) return null;
  const parents = user.memberIds.map((id) => s.members[id]).filter(Boolean) as Member[];
  const agree = async () => {
    setBusy(true);
    const r = await act('terms.agree', { version: cur.version }, { silent: true });
    if (!r.ok) setBusy(false);
  };
  const out = () => { signOut(); navigate('/login'); };
  const hint = t('terms.scrollHint');
  return (
    <div data-shell="family" data-testid="terms-gate" data-kind={kind} style={{ position: 'fixed', inset: 0, zIndex: 40, background: '#FFFFFF', color: F.text, display: 'flex', justifyContent: 'center', overflow: 'hidden' }}>
      <div style={{ width: '100%', maxWidth: 600, height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 14, padding: 'calc(16px + env(safe-area-inset-top, 0px)) 16px calc(14px + env(safe-area-inset-bottom, 0px))' }}>
        <Logo height={30} />
        {kind === 'first' ? (
          <div data-testid="terms-welcome" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ display: 'flex', flex: 'none' }}>
              {parents.slice(0, 3).map((m, i) => <span key={m.id} style={{ marginLeft: i ? -14 : 0, display: 'flex', borderRadius: 999, boxShadow: '0 0 0 3px #FFFFFF' }}><Avatar name={displayName(m)} member={m} size={58} src={memberPhoto(m)} open={false} /></span>)}
            </span>
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <h1 style={{ margin: 0, fontSize: 24, lineHeight: 1.2, fontWeight: 500, overflowWrap: 'anywhere' }}>{t('terms.welcome', { name: user.contact.firstName })}</h1>
              <span style={{ fontSize: 15, lineHeight: 1.35, color: F.muted, overflowWrap: 'anywhere' }}>{t('terms.welcomeSub', { parent: parents.map((m) => displayName(m)).join(' & ') })}</span>
            </span>
          </div>
        ) : (
          <h1 style={{ margin: 0, fontSize: 26, lineHeight: 1.2, fontWeight: 500 }}>{t('terms.updatedTitle')}</h1>
        )}
        <div style={{ fontSize: 12, letterSpacing: '1.4px', textTransform: 'uppercase', fontWeight: 500, color: F.eyebrow, flex: 'none' }}>{t('terms.title')}</div>
        <div ref={box} onScroll={check} data-testid="terms-scroll" tabIndex={0} role="region" aria-label={t('terms.title')}
          style={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', background: F.fill, borderRadius: 18, padding: '16px 16px 20px', boxSizing: 'border-box', outline: 'none' }}>
          <TermsView text={body} />
        </div>
        <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div id="terms-hint" role="status" style={{ minHeight: 18, fontSize: 13, textAlign: 'center', color: F.muted }}>{reached ? '' : hint}</div>
          <button type="button" data-testid="terms-agree" disabled={!reached || busy} aria-describedby={reached ? undefined : 'terms-hint'} onClick={() => void agree()}
            style={{ height: 52, borderRadius: 16, border: 'none', background: reached && !busy ? F.ink : '#CFC8BF', color: '#FFFFFF', fontSize: 16, fontWeight: 600, fontFamily: 'Inter, system-ui, sans-serif', cursor: reached && !busy ? 'pointer' : 'default', transition: 'background-color .2s' }}>
            {t('terms.agree')}
          </button>
          <button type="button" data-testid="terms-signout" onClick={out}
            style={{ minHeight: 44, border: 'none', background: 'transparent', color: F.bronze, fontSize: 15, fontWeight: 500, fontFamily: 'Inter, system-ui, sans-serif', cursor: 'pointer' }}>
            {t('shell.signOut')}
          </button>
        </div>
      </div>
    </div>
  );
}
