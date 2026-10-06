// Router: public routes (login, membership form, design system) + signed-in app with role-guarded nav keys.
import { Suspense, useEffect, type ReactNode } from 'react';
import { createBrowserRouter, Navigate, RouterProvider, useParams } from 'react-router-dom';
import { RouteError } from './RouteError';
import { useSession } from '../store/session';
import { useReplica } from '../store/replica';
import { useMe } from '../lib/me';
import { AppShell } from '../shell/AppShell';
import { Login } from '../features/auth/Login';
import { PageSkeleton, EmptyState, Button } from '../components/ui';
import { SCREENS, MemberProfileScreen, MembershipFormScreen, DesignSystemScreen } from './screens';
import { screenFor } from './nav';
import { useT } from '../lib/i18n';
import { routerRef } from './routerRef';

function DataGate({ children }: { children: ReactNode }) {
  const user = useSession((s) => s.user);
  const club = useSession((s) => s.club);
  const signOut = useSession((s) => s.signOut);
  const { status, load } = useReplica();
  const t = useT();
  useEffect(() => { if (user) void load(club, user.id); }, [user?.id, club]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!user) return <Navigate to="/login" replace />;
  if (status === 'error') return <div style={{ padding: 40 }}><EmptyState icon="cloud_off" title={t('err.network')} action={<div style={{ display: 'flex', gap: 8 }}><Button onClick={() => load(club, user.id)}>{t('common.retry')}</Button><Button variant="secondary" onClick={signOut}>{t('shell.signOut')}</Button></div>} /></div>;
  if (status !== 'ready') return <PageSkeleton />;
  return <>{children}</>;
}
function NavScreen() {
  const { key = 'today' } = useParams();
  const { role } = useMe();
  if (!role) return <PageSkeleton />;
  const id = screenFor(role, key);
  if (!id) return <Navigate to="/today" replace />;
  const C = SCREENS[id];
  return <C />;
}
function ProfileRoute() {
  const { role } = useMe();
  if (!role) return <PageSkeleton />;
  if (role === 'family') return <Navigate to="/health" replace />;
  if (!screenFor(role, 'members')) return <Navigate to="/today" replace />;
  return <MemberProfileScreen />;
}
function LoginRoute() {
  const user = useSession((s) => s.user);
  return user ? <Navigate to="/today" replace /> : <Login />;
}
const router = createBrowserRouter([
  { path: '/login', element: <LoginRoute />, errorElement: <RouteError /> },
  { path: '/form/:token', element: <Suspense fallback={<PageSkeleton />}><MembershipFormScreen /></Suspense>, errorElement: <RouteError /> },
  { path: '/design-system', element: <Suspense fallback={<PageSkeleton />}><DesignSystemScreen /></Suspense>, errorElement: <RouteError /> },
  {
    path: '/',
    element: <DataGate><AppShell /></DataGate>,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <Navigate to="/today" replace /> },
      { path: 'members/:id/:tab?', element: <ProfileRoute /> },
      { path: ':key', element: <NavScreen /> },
      { path: '*', element: <Navigate to="/today" replace /> },
    ],
  },
]);
routerRef.navigate = (to: string) => { void router.navigate(to); };
export function App() {
  return <RouterProvider router={router} />;
}
