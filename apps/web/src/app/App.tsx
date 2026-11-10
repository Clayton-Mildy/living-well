// Router: public routes (login, design system) + signed-in app with role-guarded nav keys.
import { Suspense, useEffect, type ReactNode } from 'react';
import { createBrowserRouter, Navigate, RouterProvider, useParams } from 'react-router-dom';
import { RouteError } from './RouteError';
import { useSession } from '../store/session';
import { useReplica } from '../store/replica';
import { useMe } from '../lib/me';
import { AppShell } from '../shell/AppShell';
import { Splash } from '../shell/Splash';
import { Login } from '../features/auth/Login';
import { RatePage } from '../features/rate/RatePage';
import { PageSkeleton, EmptyState, Button } from '../components/ui';
import { SCREENS, MemberProfileScreen, DesignSystemScreen, PublicFormScreen } from './screens';
import { screenFor } from './nav';
import { useClub } from '../store/replica';
import { useT } from '../lib/i18n';
import { routerRef } from './routerRef';
import { LegacyKeyRedirect } from './LegacyKeyRedirect';

function DataGate({ children }: { children: ReactNode }) {
  const user = useSession((s) => s.user);
  const club = useSession((s) => s.club);
  const signOut = useSession((s) => s.signOut);
  const { status, load } = useReplica();
  const t = useT();
  useEffect(() => { if (user) void load(club, user.id); }, [user?.id, club]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!user) return <Navigate to="/login" replace />;
  // the Living Well look (10 Nov): the family app opens on the gold splash (KC's option 3) while its data loads; it stays mounted in the same place below
  const splash = user.kind === 'family' ? <Splash ready={status === 'ready'} /> : null;
  if (status === 'error') return <>{splash}<div style={{ padding: 40 }}><EmptyState icon="cloud_off" title={t('err.network')} action={<div style={{ display: 'flex', gap: 8 }}><Button onClick={() => load(club, user.id)}>{t('common.retry')}</Button><Button variant="secondary" onClick={signOut}>{t('shell.signOut')}</Button></div>} /></div></>;
  if (status !== 'ready') return <>{splash}<PageSkeleton /></>;
  return <>{splash}{children}</>;
}
function NavScreen() {
  const { key = 'today' } = useParams();
  const { navRole } = useMe();
  const club = useClub();
  if (!navRole) return <PageSkeleton />;
  const id = screenFor(club, navRole, key); // round 16: routes resolve with the signed-in role (Owner: Roles screen; a granted screen beyond the menu), not the granted screen's roleAs
  if (!id) return <Navigate to="/today" replace />;
  const C = SCREENS[id];
  return <C />;
}
function ProfileRoute() {
  const { navRole } = useMe();
  const { id } = useParams();
  const club = useClub();
  if (!navRole) return <PageSkeleton />;
  if (navRole === 'family') return <Navigate to={`/profile?member=${encodeURIComponent(id || '')}`} replace />; // round 8: the family's own profile page
  if (!screenFor(club, navRole, 'members')) return <Navigate to="/today" replace />;
  return <MemberProfileScreen />;
}
function LoginRoute() {
  const user = useSession((s) => s.user);
  return user ? <Navigate to="/today" replace /> : <Login />;
}
const router = createBrowserRouter([
  { path: '/login', element: <LoginRoute />, errorElement: <RouteError /> },
  // KC round 7: a renter rates their event through a link from WhatsApp, no sign-in
  { path: '/rate/:token', element: <RatePage />, errorElement: <RouteError /> },
  { path: '/form/:token', element: <Suspense fallback={<PageSkeleton />}><PublicFormScreen /></Suspense>, errorElement: <RouteError /> }, // KC round 10: the family's online registration
  { path: '/design-system', element: <Suspense fallback={<PageSkeleton />}><DesignSystemScreen /></Suspense>, errorElement: <RouteError /> },
  {
    path: '/',
    element: <DataGate><AppShell /></DataGate>,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <Navigate to="/today" replace /> },
      { path: 'members/:id/:tab?', element: <ProfileRoute /> },
      { path: 'directory', element: <LegacyKeyRedirect from="directory" /> }, // round 19: Directory is Contacts now
      { path: ':key', element: <NavScreen /> },
      { path: '*', element: <Navigate to="/today" replace /> },
    ],
  },
]);
routerRef.navigate = (to: string) => { void router.navigate(to); };
export function App() {
  return <RouterProvider router={router} />;
}
