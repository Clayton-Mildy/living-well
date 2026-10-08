// App frame (Prototype v3 shell): a floating white sidebar card on tablet/laptop; on phone a cream header and a floating pill nav.
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
  if (!user || !role) return <PageSkeleton />;

  const cssVars = { '--cp-body': isPhone ? '16px' : '0px', '--cp-small': isPhone ? '14px' : '0px' } as CSSProperties;
  const go = (k: string) => (k === 'more' ? setMore(true) : navigate('/' + k));
  const groups: [string | null, NavItem[]][] = NAVG[role] || [[null, NAVS[role as Role]]];
  // round 6: a member profile is a pushed screen on a phone; it brings its own top bar (‹ Members), so the logo header steps aside
  const pushed = isPhone && /^\/members\/[^/]+/.test(pathname);
  return (
    <div style={{ ...cssVars, position: 'fixed', inset: 0, display: 'flex', background: '#F5F5F3', color: '#24201C' }}>
      {!isPhone ? (
        <Sidebar width={device === 'tablet' ? 228 : 252} groups={groups} current={key} counts={counts} onGo={go} onAcct={() => setAcct(true)} onBell={() => setBell(true)} />
      ) : null}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {isPhone && !pushed ? (
          <div style={{ height: 56, flex: 'none', display: 'flex', alignItems: 'center', gap: 4, padding: '0 10px 0 18px', background: '#F5F5F3' }}>
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
            {/* room to scroll the last rows clear of the floating Demo pill */}
            <div aria-hidden="true" style={{ height: isPhone ? (pins ? 76 : 24) : 72 }} />
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
    </div>
  );
}

function NavButton({ n, current, count, onClick, h = 44 }: { n: NavItem; current: boolean; count?: number; onClick: () => void; h?: number }) {
  const t = useT();
  const ink = current ? '#1E1A16' : '#4A4038';
  return (
    <button type="button" className="dh57" data-nav-key={n.key} onClick={onClick} aria-current={current ? 'page' : undefined}
      style={{ height: h, padding: '0 12px', borderRadius: 8, border: 'none', background: current ? '#F5F5F3' : 'transparent', color: ink, fontSize: 15, fontWeight: current ? 600 : 400, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left', fontFamily: 'Inter', width: '100%', flex: 'none' }}>
      <Icon name={n.icon} size={21} color={current ? '#2B231C' : '#6B6259'} fill={current ? 1 : 0} />
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t(n.label)}</span>
      {count ? <span style={{ minWidth: 22, height: 22, padding: '0 7px', borderRadius: 8, color: '#6E5A43', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', fontVariantNumeric: 'tabular-nums' }}>{count > 99 ? '99+' : count}</span> : null}
    </button>
  );
}

function Sidebar({ width, groups, current, counts, onGo, onAcct, onBell }: { width: number; groups: [string | null, NavItem[]][]; current: string; counts: Record<string, number>; onGo: (k: string) => void; onAcct: () => void; onBell: () => void }) {
  const t = useT();
  const { user, role } = useMe();
  const { lang, setLang } = useSession();
  if (!user) return null;
  const name = user.kind === 'staff' ? user.staff.name : user.contact.name;
  const roleLabel = user.kind === 'staff' ? t('roles.' + user.staff.role) : `${t('roles.family')}`;
  return (
    <nav aria-label="Main" style={{ width, flex: 'none', display: 'flex', flexDirection: 'column', gap: 22, padding: '26px 14px 16px', margin: '14px 0 14px 14px', background: '#FFFFFF', border: '1px solid #ECE4D9', borderRadius: 20, boxShadow: '0 1px 2px rgba(60,40,20,.04), 0 12px 30px rgba(60,40,20,.06)', overflowY: 'auto', scrollbarWidth: 'none' }}>
      {/* KC round 6: the logo alone at full size; Notifications is a labelled row under it, and Contacts is a menu item.
          The sidebar still scrolls, but its scrollbar is hidden: it took ~15px and clipped the longer menu names. */}
      <div style={{ padding: '0 6px' }}><Logo height={40} /></div>
      <div style={{ margin: '-10px 0 -8px' }}><NotificationBell variant="row" onClick={onBell} /></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {groups.map(([g, items], gi) => (
          <div key={gi} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {g ? <div style={{ padding: '8px 12px 4px', fontSize: 11, letterSpacing: '1.4px', textTransform: 'uppercase', fontWeight: 600, color: '#5E5852', lineHeight: '16px' }}>{t(g)}</div> : null}
            {items.map((n) => <NavButton key={n.key} n={n} current={current === n.key} count={counts[n.key]} onClick={() => onGo(n.key)} h={role === 'mgmt' ? 40 : 44} />)}
          </div>
        ))}
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', padding: 3, borderRadius: 10, background: '#F3EEE8', alignSelf: 'flex-start' }} role="group" aria-label={t('shell.language')}>
        {(['en', 'id'] as const).map((l) => (
          <button key={l} type="button" onClick={() => setLang(l)} aria-pressed={lang === l} style={{ height: 32, minWidth: 44, padding: '0 10px', borderRadius: 8, border: 'none', background: lang === l ? '#FFFFFF' : 'transparent', boxShadow: lang === l ? '0 1px 3px rgba(40,30,20,0.14)' : 'none', color: '#24201C', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter' }}>{l.toUpperCase()}</button>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, background: '#F5F5F3', border: '1px solid #E2DBD2' }}>
        <button type="button" onClick={onAcct} aria-label={t('shell.account')} style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', textAlign: 'left', fontFamily: 'Inter', color: '#24201C' }}>
          <Avatar name={name} size={38} src={user.kind === 'staff' ? memberPhoto(user.staff) : undefined} />
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.35 }}>{name}</span>
            <span style={{ fontSize: 13, color: '#5E5852', lineHeight: 1.35, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{roleLabel}</span>
          </span>
        </button>
        <SignOutButton />
      </div>
    </nav>
  );
}

export function SignOutButton() {
  const t = useT();
  const signOut = useSession((s) => s.signOut);
  const navigate = useNavigate();
  return <IconButton icon="logout" label={t('shell.signOut')} bordered={false} size={34} onClick={() => { signOut(); navigate('/login'); }} />;
}

function BottomNav({ role, current, counts, onGo }: { role: Role; current: string; counts: Record<string, number>; onGo: (k: string) => void }) {
  const t = useT();
  const { items } = phoneNav(role);
  const inBar = new Set(items.map((x) => x.key));
  return (
    <div style={{ flex: 'none', padding: '6px 12px calc(14px + env(safe-area-inset-bottom, 0px))', background: 'transparent' }}>
    <nav aria-label="Main" style={{ display: 'flex', background: '#FFFFFF', border: '1px solid #ECE4D9', borderRadius: 20, boxShadow: '0 1px 2px rgba(60,40,20,.04), 0 12px 30px rgba(60,40,20,.08)', padding: 6 }}>
      {items.map((n) => {
        const cur = n.key === 'more' ? !inBar.has(current) : current === n.key;
        const c = n.key === 'more' ? Object.entries(counts).filter(([k]) => !inBar.has(k)).reduce((a, [, v]) => a + v, 0) : counts[n.key] || 0;
        return (
          <button key={n.key} type="button" className="cp-press" data-nav-key={n.key} onClick={() => onGo(n.key)} aria-current={cur ? 'page' : undefined} aria-label={c ? `${t(n.label)}, ${c}` : t(n.label)}
            style={{ flex: 1, minWidth: 0, height: 54, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', color: '#24201C', fontSize: 12, letterSpacing: '-0.1px', fontWeight: cur ? 600 : 400, fontFamily: 'Inter' }}>
            <span style={{ width: 54, height: 30, borderRadius: 10, background: cur ? '#F5F5F3' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <Icon name={n.icon} size={22} color={cur ? '#2B231C' : '#6B6259'} fill={cur ? 1 : 0} />
              {c ? <span style={{ position: 'absolute', top: -3, right: 7, minWidth: 17, height: 17, padding: '0 4px', borderRadius: 8, background: '#2B231C', color: '#FFFFFF', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 2px #FFFFFF' }}>{c > 99 ? '99+' : c}</span> : null}
            </span>
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{t(n.short)}</span>
          </button>
        );
      })}
    </nav>
    </div>
  );
}

function MoreList({ groups, current, counts, onGo }: { groups: [string | null, NavItem[]][]; current: string; counts: Record<string, number>; onGo: (k: string) => void }) {
  const t = useT();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {groups.map(([g, items], gi) => (
        <div key={gi} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {g ? <div style={{ padding: '8px 12px 2px', fontSize: 11, letterSpacing: '1.4px', textTransform: 'uppercase', fontWeight: 600, color: '#5E5852', lineHeight: '16px' }}>{t(g)}</div> : null}
          {items.map((n) => <NavButton key={n.key} n={n} current={current === n.key} count={counts[n.key]} onClick={() => onGo(n.key)} h={46} />)}
        </div>
      ))}
    </div>
  );
}

function Toast({ phone }: { phone: boolean }) {
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
