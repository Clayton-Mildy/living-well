// Round 8 (the "CitraPremier Family App" prototype): the family app's frame. No top bar: each tab opens with its own big title.
// Phone: the floating tab bar whose current tab grows into an ink pill with its label (Today's picture carries the bell).
// Tablet and laptop (KC: "apply the design for desktop"): a slim white sidebar with the logo, the same five tabs as pills, and Notifications;
// the pages use the width (two columns on a laptop). Pushed pages (Billing, Contacts, a parent's profile, health history) keep their tab lit.
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Icon, Logo, PageSkeleton } from '../components/ui';
import { FAMILY_TAB_OF, NAVS } from '../app/nav';
import { familyBill } from '@cp/shared/rules/familyMe';
import { useT } from '../lib/i18n';
import { useMe } from '../lib/me';
import { useNow } from '../lib/clock';
import { useClub } from '../store/replica';
import { useUi } from '../store/ui';
import { readPref, writePref } from '../store/session';
import { useDevice } from '../hooks/useDevice';
import { NotificationPanel, UrgentToasts, useBell } from './Notifications';
import { DemoPill } from './DemoPanel';
import { Toast, useKeyFromPath } from './AppShell';

/** KC round 10: the family's text size ("Default" or "Larger"), kept per person. "Larger" lifts the page's zoom (global.css html[data-text="large"]). */
export const TEXT_PREF = 'fam.text';
export type TextSize = 'normal' | 'large';
export function useTextSize(): [TextSize, (v: TextSize) => void] {
  const { user } = useMe();
  const [size, setSizeState] = useState<TextSize>(() => (readPref<string>(user?.id, TEXT_PREF, 'normal') === 'large' ? 'large' : 'normal'));
  useEffect(() => { setSizeState(readPref<string>(user?.id, TEXT_PREF, 'normal') === 'large' ? 'large' : 'normal'); }, [user?.id]);
  useEffect(() => {
    if (size === 'large') document.documentElement.dataset.text = 'large'; else delete document.documentElement.dataset.text;
    return () => { delete document.documentElement.dataset.text; };
  }, [size]);
  const setSize = useCallback((v: TextSize) => { setSizeState(v); writePref(user?.id, TEXT_PREF, v); }, [user?.id]);
  return [size, setSize];
}

export function FamilyShell() {
  const { isPhone } = useDevice();
  useTextSize(); // applies the person's text size while the family app is on screen
  const key = useKeyFromPath();
  const { pathname } = useLocation();
  const bell = useUi((s) => s.bell);
  const setBell = useUi((s) => s.setBell);
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => { mainRef.current?.scrollTo({ top: 0 }); }, [pathname]);
  const tab = FAMILY_TAB_OF[key] || key; // a pushed page (Billing, Contacts, a profile, history) keeps its tab lit
  return (
    <div data-shell="family" style={{ position: 'fixed', inset: 0, background: '#FFFFFF', color: '#24201C', display: 'flex' }}>
      {!isPhone ? <FamSidebar current={tab} onBell={() => setBell(true)} /> : null}
      <main ref={mainRef} id="main" style={{ position: 'relative', flex: 1, minWidth: 0, overflowY: 'auto', scrollbarWidth: 'none' }}>
        <Suspense fallback={<PageSkeleton />}>
          <Outlet />
          {/* room to scroll the last rows clear of the floating tab bar (phone) or the Demo pill */}
          <div aria-hidden="true" style={{ height: isPhone ? 120 : 72 }} />
        </Suspense>
      </main>
      {isPhone ? <FamTabBar current={tab} /> : null}
      <NotificationPanel open={bell} onClose={() => setBell(false)} />
      <UrgentToasts />
      <Toast phone={isPhone} />
      <DemoPill phone={isPhone} />
    </div>
  );
}

/**
 * Tablet and laptop (the Family App prototype's desktop, KC round 8c/8d): a soft grey rounded sidebar card. The logo and the bell at the top, the
 * same five pages as the phone (Today, Photos, Calendar, Health, Me — Me carries what is due), and the signed-in contact at the foot. The current
 * page is a white tile with a faint shadow and an ink icon; the others have bronze icons and turn white on hover.
 */
function FamSidebar({ current, onBell }: { current: string; onBell: () => void }) {
  const t = useT();
  const navigate = useNavigate();
  const s = useClub();
  const { user } = useMe();
  const { today } = useNow();
  const { count } = useBell();
  const { isLaptop } = useDevice();
  if (!user || user.kind !== 'family') return null;
  const due = familyBill(s, user.id, user.memberIds, today).payable.length;
  const name = user.contact.name;
  const ini = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const item = (key: string, icon: string, label: string, badge?: string) => {
    const on = current === key;
    return (
      <button key={key} type="button" data-nav-key={key} onClick={() => navigate('/' + key)} aria-current={on ? 'page' : undefined} className={on ? undefined : 'cp-side-item'}
        style={{ height: 44, padding: '0 12px', border: 'none', borderRadius: 12, background: on ? '#FFFFFF' : 'transparent', boxShadow: on ? '0 1px 3px rgba(40,30,20,.1)' : 'none', color: '#24201C', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', fontFamily: 'Inter', fontSize: 15, fontWeight: on ? 600 : 500, textAlign: 'left', flex: 'none', transition: 'background-color .2s' }}>
        <Icon name={icon} size={21} fill={on ? 1 : 0} color={on ? '#2B231C' : '#75624B'} />
        <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
        {badge ? <span style={{ height: 20, padding: '0 7px', borderRadius: 999, background: '#9A3D24', color: '#FFFFFF', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>{badge}</span> : null}
      </button>
    );
  };
  return (
    <nav aria-label="Main" data-testid="fam-sidebar" style={{ width: isLaptop ? 236 : 216, flex: 'none', margin: '14px 0 14px 14px', padding: '20px 12px 14px', borderRadius: 24, background: '#F4F4F5', display: 'flex', flexDirection: 'column', gap: 20, boxSizing: 'border-box', minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '0 6px', flex: 'none' }}>
        <Logo height={isLaptop ? 30 : 26} />
        <button type="button" onClick={onBell} data-bell-anchor="" data-testid="fam-bell-row" aria-label={t('shell.bell', { n: count })} className="cp-press"
          style={{ position: 'relative', width: 38, height: 38, borderRadius: 999, border: 'none', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flex: 'none' }}>
          <Icon name="notifications" size={20} color="#24201C" />
          {count ? <span aria-hidden="true" style={{ position: 'absolute', top: 8, right: 9, width: 7, height: 7, borderRadius: 999, background: '#9A3D24' }} /> : null}
        </button>
      </div>
      {/* KC round 8d: the same five as the phone's tab bar (Billing and Contacts open from Me, which shows what is due) */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', scrollbarWidth: 'none', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAVS.family.map((n) => item(n.key, n.icon, t(n.short), n.key === 'me' && due ? t('fam.due', { n: due }) : undefined))}
      </div>
      <button type="button" onClick={() => navigate('/me')} data-testid="fam-account" className="cp-press"
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderRadius: 16, background: '#FFFFFF', border: 'none', cursor: 'pointer', fontFamily: 'Inter', textAlign: 'left', flex: 'none' }}>
        <span aria-hidden="true" style={{ width: 36, height: 36, borderRadius: 999, background: '#2B231C', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, flex: 'none' }}>{ini}</span>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#24201C', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
          <span style={{ fontSize: 12, color: '#6B6259' }}>{t('fam.familyRole')}</span>
        </span>
      </button>
    </nav>
  );
}

function FamTabBar({ current }: { current: string }) {
  const t = useT();
  const navigate = useNavigate();
  const { count } = useBell();
  return (
    <nav aria-label="Main" data-testid="fam-tabbar"
      style={{ position: 'fixed', left: 0, right: 0, bottom: 'calc(22px + env(safe-area-inset-bottom, 0px))', margin: '0 auto', width: 'calc(100% - 28px)', maxWidth: 440, zIndex: 30, height: 64, borderRadius: 32, background: 'rgba(255,255,255,.94)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', boxShadow: '0 1px 2px rgba(60,40,20,.06), 0 14px 34px rgba(60,40,20,.16)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px', boxSizing: 'border-box' }}>
      {NAVS.family.map((n) => {
        const on = current === n.key;
        // the bell lives on Today: elsewhere a small dot on Today's icon says something is new
        const dot = !on && n.key === 'today' && count > 0;
        return (
          // KC round 10 (the analysis): every tab carries its name — the current one as the ink pill with the name beside the icon, the others with a small name under it
          <button key={n.key} type="button" data-nav-key={n.key} onClick={() => navigate('/' + n.key)} aria-current={on ? 'page' : undefined} aria-label={dot ? `${t(n.label)}, ${t('shell.bell', { n: count })}` : t(n.label)}
            style={{ position: 'relative', height: 50, padding: `0 ${on ? 16 : 10}px`, border: 'none', borderRadius: 999, background: on ? '#2B231C' : 'transparent', color: on ? '#FFFFFF' : '#6B6259', display: 'flex', flexDirection: on ? 'row' : 'column', alignItems: 'center', justifyContent: 'center', gap: on ? 6 : 1, cursor: 'pointer', overflow: 'hidden', fontFamily: 'Inter', transition: 'background-color .32s ease, padding .32s cubic-bezier(.3,.7,.2,1)', flex: 'none', minWidth: on ? undefined : 52 }}>
            <Icon name={n.icon} size={on ? 24 : 22} fill={on ? 1 : 0} color={on ? '#FFFFFF' : '#6B6259'} />
            <span style={{ fontSize: on ? 14 : 11, fontWeight: on ? 600 : 500, lineHeight: on ? undefined : '13px', whiteSpace: 'nowrap', letterSpacing: on ? undefined : '0.1px' }}>{t(n.short)}</span>
            {dot ? <span aria-hidden="true" style={{ position: 'absolute', top: 11, right: 10, width: 7, height: 7, borderRadius: 999, background: '#9A3D24', boxShadow: '0 0 0 2px #FFFFFF' }} /> : null}
          </button>
        );
      })}
    </nav>
  );
}
