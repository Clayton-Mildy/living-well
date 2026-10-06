// App frame (design ShowApp lines 622–2003): sidebar on tablet/laptop, header + bottom bar on phone, overlays, toast, demo pill.
import { Suspense, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import type { Role } from '@cp/shared';
import { useDevice } from '../hooks/useDevice';
import { useT } from '../lib/i18n';
import { useMe } from '../lib/me';
import { useSession } from '../store/session';
import { useClub } from '../store/replica';
import { useUi } from '../store/ui';
import { Avatar, CountDot, Icon, IconButton, Logo, PageSkeleton, Sheet, FONT_BODY } from '../components/ui';
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
  return (
    <div style={{ ...cssVars, position: 'fixed', inset: 0, display: 'flex', background: '#F6F5F5', color: '#282828' }}>
      {!isPhone ? (
        <Sidebar width={device === 'tablet' ? 224 : 248} groups={groups} current={key} counts={counts} onGo={go} onAcct={() => setAcct(true)} onBell={() => setBell(true)} family={role === 'family'} />
      ) : null}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {isPhone ? (
          <div style={{ height: 60, flex: 'none', display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px 0 16px', borderBottom: '1px solid #E8E1D8', background: '#F6F5F5' }}>
            <div style={{ flex: 1, minWidth: 0 }}><Logo height={36} /></div>
            {role === 'family' ? <IconButton icon="contacts" label={t('nav.contacts')} bordered={false} onClick={() => go('contacts')} /> : null}
            <NotificationBell onClick={() => setBell(true)} />
            <button type="button" onClick={() => setAcct(true)} aria-label={t('shell.account')} style={{ width: 44, height: 44, borderRadius: 999, border: 'none', background: 'transparent', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <Avatar name={user.kind === 'staff' ? user.staff.name : user.contact.name} size={38} />
            </button>
          </div>
        ) : null}
        <main ref={mainRef} id="main" style={{ flex: 1, minHeight: 0, overflowY: 'auto', position: 'relative' }}>
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
            {/* room to scroll the last rows clear of the floating Demo pill (Messages is full-height and pads itself) */}
            {key !== 'chat' ? <div aria-hidden="true" style={{ height: isPhone ? 48 : 72 }} /> : null}
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

function NavButton({ n, current, count, onClick, h = 48 }: { n: NavItem; current: boolean; count?: number; onClick: () => void; h?: number }) {
  const t = useT();
  return (
    <button type="button" className="dh57" data-nav-key={n.key} onClick={onClick} aria-current={current ? 'page' : undefined}
      style={{ height: h, padding: '0 14px', borderRadius: 999, border: 'none', background: current ? '#E8E1D8' : 'transparent', color: '#282828', fontSize: 16, fontWeight: current ? 600 : 400, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left', fontFamily: 'Inter', width: '100%' }}>
      <Icon name={n.icon} size={22} color={current ? '#75624B' : '#282828'} fill={current ? 1 : 0} />
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t(n.label)}</span>
      <CountDot n={count || 0} />
    </button>
  );
}

function Sidebar({ width, groups, current, counts, onGo, onAcct, onBell, family }: { width: number; groups: [string | null, NavItem[]][]; current: string; counts: Record<string, number>; onGo: (k: string) => void; onAcct: () => void; onBell: () => void; family: boolean }) {
  const t = useT();
  const { user, role } = useMe();
  const { lang, setLang } = useSession();
  const s = useClub();
  if (!user) return null;
  const name = user.kind === 'staff' ? user.staff.name : user.contact.name;
  const roleLabel = user.kind === 'staff' ? t('roles.' + user.staff.role) : `${t('roles.family')}`;
  return (
    <nav aria-label="Main" style={{ width, flex: 'none', display: 'flex', flexDirection: 'column', gap: 20, padding: '24px 14px 18px', background: '#F4F0EE', borderRight: '1px solid #DBD7D6', overflowY: 'auto' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 6px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
          <div style={{ flex: 1, minWidth: 0 }}><Logo height={44} /></div>
          {family ? <IconButton icon="contacts" label={t('nav.contacts')} bordered={false} onClick={() => onGo('contacts')} /> : null}
          <NotificationBell onClick={onBell} />
        </div>
        <div style={{ fontSize: 'max(13px, var(--cp-body, 0px))', lineHeight: '18px', color: '#6A6967' }}>{s?.club.fullName}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {groups.map(([g, items], gi) => (
          <div key={gi} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {g ? <div style={{ padding: '10px 14px 4px', fontSize: 12, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 500, color: '#6A6967', lineHeight: '18px' }}>{t(g)}</div> : null}
            {items.map((n) => <NavButton key={n.key} n={n} current={current === n.key} count={counts[n.key]} onClick={() => onGo(n.key)} h={role === 'mgmt' ? 44 : 48} />)}
          </div>
        ))}
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', padding: 3, borderRadius: 999, background: '#E8E1D8', alignSelf: 'flex-start' }} role="group" aria-label={t('shell.language')}>
        {(['en', 'id'] as const).map((l) => (
          <button key={l} type="button" onClick={() => setLang(l)} aria-pressed={lang === l} style={{ height: 44, minWidth: 52, padding: '0 12px', borderRadius: 999, border: 'none', background: lang === l ? '#FFFFFF' : 'transparent', color: '#282828', fontSize: FONT_BODY, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter' }}>{l.toUpperCase()}</button>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderRadius: 20, background: '#FFFFFF', border: '1px solid #DBD7D6' }}>
        <button type="button" onClick={onAcct} aria-label={t('shell.account')} style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', textAlign: 'left', fontFamily: 'Inter', color: '#282828' }}>
          <Avatar name={name} size={40} />
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: FONT_BODY, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.4 }}>{name}</span>
            <span style={{ fontSize: 'max(13px, var(--cp-body, 0px))', color: '#6A6967', lineHeight: 1.4 }}>{roleLabel}</span>
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
  return <IconButton icon="logout" label={t('shell.signOut')} bordered={false} onClick={() => { signOut(); navigate('/login'); }} />;
}

function BottomNav({ role, current, counts, onGo }: { role: Role; current: string; counts: Record<string, number>; onGo: (k: string) => void }) {
  const t = useT();
  const { items } = phoneNav(role);
  const inBar = new Set(items.map((x) => x.key));
  return (
    <nav aria-label="Main" style={{ flex: 'none', display: 'flex', background: '#FFFFFF', borderTop: '1px solid #DBD7D6', padding: '6px 4px calc(22px + env(safe-area-inset-bottom, 0px))' }}>
      {items.map((n) => {
        const cur = n.key === 'more' ? !inBar.has(current) : current === n.key;
        const c = n.key === 'more' ? Object.entries(counts).filter(([k]) => !inBar.has(k)).reduce((a, [, v]) => a + v, 0) : counts[n.key] || 0;
        return (
          <button key={n.key} type="button" data-nav-key={n.key} onClick={() => onGo(n.key)} aria-current={cur ? 'page' : undefined} aria-label={c ? `${t(n.label)}, ${c}` : t(n.label)}
            style={{ flex: 1, minWidth: 0, height: 58, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', color: '#282828', fontSize: 12, letterSpacing: '-0.1px', fontWeight: cur ? 600 : 400, fontFamily: 'Inter' }}>
            <span style={{ width: 56, height: 30, borderRadius: 999, background: cur ? '#E8E1D8' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <Icon name={n.icon} size={22} color={cur ? '#75624B' : '#282828'} fill={cur ? 1 : 0} />
              {c ? <span style={{ position: 'absolute', top: -4, right: 6, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, background: '#75624B', color: '#FFFFFF', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 2px #FFFFFF' }}>{c > 99 ? '99+' : c}</span> : null}
            </span>
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{t(n.short)}</span>
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
          {g ? <div style={{ padding: '10px 14px 4px', fontSize: 12, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 500, color: '#6A6967', lineHeight: '18px' }}>{t(g)}</div> : null}
          {items.map((n) => <NavButton key={n.key} n={n} current={current === n.key} count={counts[n.key]} onClick={() => onGo(n.key)} />)}
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
    <div role="status" aria-live="polite" key={toast.id} style={{ position: 'fixed', left: '50%', bottom, transform: 'translateX(-50%)', zIndex: 70, width: 'max-content', maxWidth: 'calc(100% - 32px)', padding: '14px 20px', borderRadius: 20, background: toast.tone === 'error' ? '#AF4B2F' : '#282828', color: '#FFFFFF', fontSize: 16, lineHeight: '22px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 12px 32px rgba(0,0,0,0.25)', animation: 'cpUp .22s ease-out' }}>
      <Icon name={icon} size={22} color={toast.tone === 'error' ? '#FFFFFF' : '#CAB8A2'} fill={1} />
      <span style={{ flex: 1 }}>{toast.text}</span>
      {toast.action ? (
        <button type="button" onClick={() => { toast.action!.run(); dismiss(); }} style={{ marginLeft: 6, height: 36, padding: '0 14px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.5)', background: 'transparent', color: '#FFFFFF', fontWeight: 600, fontSize: 15, cursor: 'pointer', fontFamily: 'Inter' }}>{toast.action.label}</button>
      ) : null}
    </div>
  );
}
