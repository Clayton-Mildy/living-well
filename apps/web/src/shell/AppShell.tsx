// App frame (Prototype v3 shell; round 9, App v4 colours): the dark espresso sidebar on tablet/laptop; on phone a cream header and a floating pill nav.
// Overlays, toast and the demo pill sit on top.
import { Suspense, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import type { Role } from '@cp/shared';
import { useDevice } from '../hooks/useDevice';
import { useT } from '../lib/i18n';
import { useMe } from '../lib/me';
import { useSession } from '../store/session';
import { useUi } from '../store/ui';
import { memberPhoto } from '../lib/media';
import { Avatar, Icon, IconButton, Logo, PageSkeleton, Sheet } from '../components/ui';
import { NAVG, NAVS, phoneNav, type NavItem } from '../app/nav';
import { useNavCounts } from './badges';
import { AccountSheet } from './AccountSheet';
import { NotificationBell, NotificationPanel } from './Notifications';
import { DemoPill } from './DemoPanel';
import { QuickCamera, QUICK_CAMERA_ROLES } from './QuickCamera';
import { QuickTasks, QUICK_TASK_ROLES } from './QuickTasks';
import { FamilyShell } from './FamilyShell';

export function useKeyFromPath() {
  const { pathname } = useLocation();
  const seg = pathname.split('/').filter(Boolean)[0] || 'today';
  return seg === 'members' ? 'members' : seg;
}

export function AppShell() {
  const { device, isPhone } = useDevice();
  const { user, role } = useMe();
  const t = useT();
  const navigate = useNavigate();
  const key = useKeyFromPath();
  const counts = useNavCounts();
  const pins = useUi((s) => s.pins); // a phone Pin floats over the page bottom: leave room for it
  const [acct, setAcct] = useState(false);
  const [bell, setBell] = useState(false);
  const [more, setMore] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  useEffect(() => { mainRef.current?.scrollTo({ top: 0 }); }, [pathname]);
  // round 9 (KC: App v4's management colours for every staff role): the warm skin lives on <html>, so sheets and dialogs in portals get it too
  const staff = !!role && role !== 'family';
  useEffect(() => {
    if (!staff) return;
    document.documentElement.dataset.skin = 'warm';
    return () => { delete document.documentElement.dataset.skin; };
  }, [staff]);
  if (!user || !role) return <PageSkeleton />;
  if (role === 'family') return <FamilyShell />; // round 8: the family app has its own frame (Family App prototype)

  // --cp-tabbar: how far a page's sticky foot (a Save bar) sits up so the floating tab bar (64px tall, 14px up) never covers it
  const cssVars = { '--cp-body': isPhone ? '16px' : '0px', '--cp-small': isPhone ? '14px' : '0px', '--cp-tabbar': isPhone ? 'calc(86px + env(safe-area-inset-bottom, 0px))' : '0px' } as CSSProperties;
  const go = (k: string) => (k === 'more' ? setMore(true) : navigate('/' + k));
  const groups: [string | null, NavItem[]][] = NAVG[role] || [[null, NAVS[role as Role]]];
  // round 6: a member profile is a pushed screen on a phone; it brings its own top bar (‹ Members), so the logo header steps aside
  const pushed = isPhone && /^\/members\/[^/]+/.test(pathname);
  const quick = (QUICK_CAMERA_ROLES as readonly string[]).includes(role) || QUICK_TASK_ROLES.includes(role); // the quick camera / tasks buttons float over the page's last rows: leave room to scroll them clear of them
  return (
    // round 9: the warm cream page (App v4); cards on it are warm white (global.css)
    <div style={{ ...cssVars, position: 'fixed', inset: 0, display: 'flex', background: 'var(--page, #FFFFFF)', color: '#24201C' }}>
      {!isPhone ? (
        <Sidebar width={device === 'tablet' ? 228 : 252} groups={groups} current={key} counts={counts} onGo={go} onAcct={() => setAcct(true)} onBell={() => setBell(true)} />
      ) : null}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {isPhone && !pushed ? (
          <div style={{ height: 56, flex: 'none', display: 'flex', alignItems: 'center', gap: 4, padding: '0 10px 0 18px', background: 'var(--page, #FFFFFF)' }}>
            <div style={{ flex: 1, minWidth: 0 }}><Logo height={30} /></div>
            <NotificationBell onClick={() => setBell(true)} />
            <button type="button" onClick={() => setAcct(true)} aria-label={t('shell.account')} style={{ width: 44, height: 44, borderRadius: 999, border: 'none', background: 'transparent', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <Avatar name={user.kind === 'staff' ? user.staff.name : user.contact.name} size={36} src={user.kind === 'staff' ? memberPhoto(user.staff) : undefined} />
            </button>
          </div>
        ) : null}
        <main ref={mainRef} id="main" style={{ flex: 1, minHeight: 0, overflowY: 'auto', position: 'relative' }}>
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
            {/* room to scroll the last rows clear of the floating Demo pill; on a phone also of the floating tab bar (84px: it floats over the page like the family app's) */}
            <div aria-hidden="true" style={{ height: isPhone ? `calc(${84 + (pins ? (quick ? 124 : 76) : quick ? 68 : 24)}px + env(safe-area-inset-bottom, 0px))` : quick ? 136 : 72 }} />
          </Suspense>
        </main>
        {isPhone ? <BottomNav role={role} current={key} counts={counts} onGo={go} /> : null}
      </div>
      <AccountSheet open={acct} onClose={() => setAcct(false)} />
      <NotificationPanel open={bell} onClose={() => setBell(false)} />
      <Sheet open={more} onClose={() => setMore(false)} title={t('nav.allModules')}>
        <MoreList groups={groups} current={key} counts={counts} onGo={(k) => { setMore(false); navigate('/' + k); }} />
      </Sheet>
      <Toast phone={isPhone} />
      <DemoPill phone={isPhone} />
      <QuickCamera phone={isPhone} />
      <QuickTasks phone={isPhone} />
    </div>
  );
}

/** A menu item. `surface` (round 8c, the prototype's sidebar): on the grey sidebar the current page is a white tile with a faint shadow; in the
 *  white "All modules" sheet it is a grey tile. Icons are bronze until current (ink, filled); a count is a small rust pill.
 *  `dark` (round 9, App v4): on the espresso sidebar the current page is a lighter brown tile with a gold filled icon; counts are gold numbers. */
function NavButton({ n, current, count, onClick, h = 44, surface = 'grey' }: { n: NavItem; current: boolean; count?: number; onClick: () => void; h?: number; surface?: 'grey' | 'white' | 'dark' }) {
  const t = useT();
  if (surface === 'dark') {
    return (
      <button type="button" className={current ? undefined : 'cp-side-dark'} data-nav-key={n.key} onClick={onClick} aria-current={current ? 'page' : undefined}
        style={{ height: h, padding: '0 12px', borderRadius: 12, border: 'none', background: current ? '#352B22' : 'transparent', color: current ? '#FFFFFF' : '#CFC3B4', fontSize: 15, fontWeight: current ? 600 : 400, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left', fontFamily: 'Inter', width: '100%', flex: 'none', transition: 'background-color .2s' }}>
        <Icon name={n.icon} size={21} color={current ? '#D2B98F' : '#9C8E7E'} fill={current ? 1 : 0} />
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t(n.label)}</span>
        {count ? <span style={{ minWidth: 22, height: 22, padding: '0 6px', color: '#D2B98F', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', fontVariantNumeric: 'tabular-nums', boxSizing: 'border-box' }}>{count > 99 ? '99+' : count}</span> : null}
      </button>
    );
  }
  const on = surface === 'grey' ? '#FFFFFF' : 'var(--fill, #F4F4F5)';
  return (
    <button type="button" className={current ? undefined : surface === 'grey' ? 'cp-side-item' : 'cp-fam-press'} data-nav-key={n.key} onClick={onClick} aria-current={current ? 'page' : undefined}
      style={{ height: h, padding: '0 12px', borderRadius: 12, border: 'none', background: current ? on : 'transparent', boxShadow: current && surface === 'grey' ? '0 1px 3px rgba(40,30,20,.1)' : 'none', color: '#24201C', fontSize: 15, fontWeight: current ? 600 : 500, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left', fontFamily: 'Inter', width: '100%', flex: 'none', transition: 'background-color .2s' }}>
      <Icon name={n.icon} size={21} color={current ? '#2B231C' : 'var(--accent, #75624B)'} fill={current ? 1 : 0} />
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t(n.label)}</span>
      {count ? <span style={{ minWidth: 20, height: 20, padding: '0 7px', borderRadius: 999, background: '#9A3D24', color: '#FFFFFF', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', fontVariantNumeric: 'tabular-nums', boxSizing: 'border-box' }}>{count > 99 ? '99+' : count}</span> : null}
    </button>
  );
}

/**
 * Tablet and laptop (KC round 9: App v4's colours on the round 8c floating card): the dark espresso sidebar, a rounded card inset from the edges. The CITRAPREMIER wordmark and the bell at the top; the menu
 * groups scroll in the middle (the current page a lighter brown tile with a gold icon); the language switch and the signed-in person stay
 * pinned at the foot.
 */
function Sidebar({ width, groups, current, counts, onGo, onAcct, onBell }: { width: number; groups: [string | null, NavItem[]][]; current: string; counts: Record<string, number>; onGo: (k: string) => void; onAcct: () => void; onBell: () => void }) {
  const t = useT();
  const { user, role } = useMe();
  const { lang, setLang } = useSession();
  if (!user) return null;
  const name = user.kind === 'staff' ? user.staff.name : user.contact.name;
  const roleLabel = user.kind === 'staff' ? t('roles.' + user.staff.role) : `${t('roles.family')}`;
  const narrow = width < 240;
  return (
    <nav aria-label="Main" data-testid="staff-sidebar" style={{ width, flex: 'none', display: 'flex', flexDirection: 'column', gap: 18, padding: '22px 12px 14px', margin: '14px 0 14px 14px', borderRadius: 24, background: '#221B15', color: '#EDE4D8', minHeight: 0, boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '0 6px', flex: 'none' }}>
        <span role="img" aria-label="CitraPremier, Premium Seniors Club" style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, overflow: 'hidden' }}>
          <span aria-hidden="true" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: narrow ? 16 : 19, fontWeight: 600, letterSpacing: narrow ? '1.8px' : '2.6px', color: '#D2B98F', lineHeight: 1, whiteSpace: 'nowrap' }}>CITRAPREMIER</span>
          <span aria-hidden="true" style={{ fontSize: narrow ? 8 : 9, letterSpacing: narrow ? '1.3px' : '2.2px', color: '#9C8E7E', lineHeight: 1.2, whiteSpace: 'nowrap' }}>PREMIUM SENIORS CLUB</span>
        </span>
        <NotificationBell variant="side" onClick={onBell} />
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', scrollbarWidth: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {groups.map(([g, items], gi) => (
          <div key={gi} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {g ? <div style={{ padding: '12px 12px 4px', fontSize: 10, letterSpacing: '1.8px', textTransform: 'uppercase', fontWeight: 600, color: '#9C8E7E', lineHeight: '14px' }}>{t(g)}</div> : null}
            {items.map((n) => <NavButton key={n.key} n={n} current={current === n.key} count={counts[n.key]} onClick={() => onGo(n.key)} h={role === 'mgmt' ? 40 : 44} surface="dark" />)}
          </div>
        ))}
      </div>
      <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, padding: 2, borderRadius: 9, background: '#2E251D' }} role="group" aria-label={t('shell.language')}>
          {(['en', 'id'] as const).map((l) => (
            <button key={l} type="button" onClick={() => setLang(l)} aria-pressed={lang === l} style={{ height: 30, borderRadius: 7, border: 'none', background: lang === l ? '#4A3D31' : 'transparent', color: lang === l ? '#FFFFFF' : '#9C8E7E', fontSize: 13, fontWeight: lang === l ? 600 : 500, cursor: 'pointer', fontFamily: 'Inter' }}>{l === 'en' ? 'English' : 'Indonesia'}</button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 10, borderRadius: 16, border: '1px solid #3A3027' }}>
          <button type="button" onClick={onAcct} aria-label={t('shell.account')} style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', textAlign: 'left', fontFamily: 'Inter', color: '#EDE4D8' }}>
            <Avatar name={name} size={36} src={user.kind === 'staff' ? memberPhoto(user.staff) : undefined} />
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.35 }}>{name}</span>
              <span style={{ fontSize: 12, color: '#9C8E7E', lineHeight: 1.35, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{roleLabel}</span>
            </span>
          </button>
          <SignOutButton dark />
        </div>
      </div>
    </nav>
  );
}

export function SignOutButton({ dark }: { dark?: boolean }) {
  const t = useT();
  const signOut = useSession((s) => s.signOut);
  const navigate = useNavigate();
  const out = () => { signOut(); navigate('/login'); };
  if (dark) {
    return (
      <button type="button" onClick={out} aria-label={t('shell.signOut')} title={t('shell.signOut')} className="cp-side-dark"
        style={{ width: 34, height: 34, borderRadius: 999, border: 'none', background: 'transparent', color: '#EDE4D8', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flex: 'none', padding: 0 }}>
        <Icon name="logout" size={20} />
      </button>
    );
  }
  return <IconButton icon="logout" label={t('shell.signOut')} bordered={false} size={34} onClick={out} />;
}

/** Round 8 (KC: "the navbar in all roles"): the family app's pill tab bar on every staff phone. The current tab grows into an ink pill with its
 *  label; the others are icons (their names are the buttons' labels). A count shows as a small rust badge on the icon; More opens All modules. */
function BottomNav({ role, current, counts, onGo }: { role: Role; current: string; counts: Record<string, number>; onGo: (k: string) => void }) {
  const t = useT();
  const { items } = phoneNav(role);
  const inBar = new Set(items.map((x) => x.key));
  return (
    <nav aria-label="Main" data-testid="staff-tabbar" style={{ position: 'fixed', left: 0, right: 0, bottom: 'calc(14px + env(safe-area-inset-bottom, 0px))', margin: '0 auto', width: 'calc(100% - 28px)', zIndex: 30, height: 64, borderRadius: 32, background: 'rgba(255,255,255,.96)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', boxShadow: '0 1px 2px rgba(60,40,20,.06), 0 14px 34px rgba(60,40,20,.14)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px', boxSizing: 'border-box' }}>
      {items.map((n) => {
        const cur = n.key === 'more' ? !inBar.has(current) : current === n.key;
        const c = n.key === 'more' ? Object.entries(counts).filter(([k]) => !inBar.has(k)).reduce((a, [, v]) => a + v, 0) : counts[n.key] || 0;
        return (
          <button key={n.key} type="button" data-nav-key={n.key} onClick={() => onGo(n.key)} aria-current={cur ? 'page' : undefined} aria-label={c ? `${t(n.label)}, ${c}` : t(n.label)}
            style={{ position: 'relative', height: 48, minWidth: 48, padding: `0 ${cur ? 16 : 12}px`, border: 'none', borderRadius: 999, background: cur ? '#2B231C' : 'transparent', color: cur ? '#FFFFFF' : '#6B6259', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: cur ? 6 : 0, cursor: 'pointer', overflow: 'hidden', fontFamily: 'Inter', flex: 'none', transition: 'background-color .32s ease, padding .32s cubic-bezier(.3,.7,.2,1), gap .32s' }}>
            <span style={{ position: 'relative', display: 'flex' }}>
              <Icon name={n.icon} size={24} fill={cur ? 1 : 0} color={cur ? '#FFFFFF' : '#6B6259'} />
              {/* inactive: a small rust badge on the icon; the current tab shows its count after the label instead (it would cover the label) */}
              {c && !cur ? <span aria-hidden="true" style={{ position: 'absolute', top: -5, right: -8, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 8, background: '#9A3D24', color: '#FFFFFF', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 2px #FFFFFF', boxSizing: 'border-box' }}>{c > 99 ? '99+' : c}</span> : null}
            </span>
            <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', maxWidth: cur ? 150 : 0, opacity: cur ? 1 : 0, overflow: 'hidden', transition: 'max-width .34s cubic-bezier(.3,.7,.2,1), opacity .22s ease', display: 'flex', alignItems: 'center', gap: 6 }}>
              {t(n.short)}
              {c && cur ? <span aria-hidden="true" style={{ minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9, background: 'rgba(255,255,255,.18)', color: '#E3D9CC', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}>{c > 99 ? '99+' : c}</span> : null}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

function MoreList({ groups, current, counts, onGo }: { groups: [string | null, NavItem[]][]; current: string; counts: Record<string, number>; onGo: (k: string) => void }) {
  const t = useT();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {groups.map(([g, items], gi) => (
        <div key={gi} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {g ? <div style={{ padding: '8px 12px 2px', fontSize: 11, letterSpacing: '1.4px', textTransform: 'uppercase', fontWeight: 600, color: '#5E5852', lineHeight: '16px' }}>{t(g)}</div> : null}
          {items.map((n) => <NavButton key={n.key} n={n} current={current === n.key} count={counts[n.key]} onClick={() => onGo(n.key)} h={46} surface="white" />)}
        </div>
      ))}
    </div>
  );
}

export function Toast({ phone }: { phone: boolean }) {
  const toast = useUi((s) => s.toast);
  const pins = useUi((s) => s.pins);
  const dismiss = useUi((s) => s.dismiss);
  if (!toast) return null;
  const bottom = phone ? (pins ? 150 : 104) : 28;
  const icon = toast.icon || (toast.tone === 'error' ? 'error' : 'check_circle');
  return (
    <div role="status" aria-live="polite" key={toast.id} style={{ position: 'fixed', left: '50%', bottom, transform: 'translateX(-50%)', zIndex: 70, width: 'max-content', maxWidth: 'calc(100% - 32px)', padding: '13px 18px', borderRadius: 14, background: toast.tone === 'error' ? '#9A3D24' : '#24201C', color: '#FFFFFF', fontSize: 15, lineHeight: '22px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 12px 32px rgba(0,0,0,0.25)', animation: 'cpUp .22s ease-out' }}>
      <Icon name={icon} size={22} color={toast.tone === 'error' ? '#FFFFFF' : '#CAB8A2'} fill={1} />
      <span style={{ flex: 1 }}>{toast.text}</span>
      {toast.action ? (
        <button type="button" onClick={() => { toast.action!.run(); dismiss(); }} style={{ marginLeft: 6, height: 36, padding: '0 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.5)', background: 'transparent', color: '#FFFFFF', fontWeight: 600, fontSize: 15, cursor: 'pointer', fontFamily: 'Inter' }}>{toast.action.label}</button>
      ) : null}
    </div>
  );
}
