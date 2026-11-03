// Round 17 (Admin › Roles): while a screen holds unsaved changes, leaving it asks first.
// The app's router is a data router (createBrowserRouter), so useBlocker holds every route change: the sidebar, the tab bar, More, search,
// a notification or quick-task link, and the browser or phone back gesture (a POP is held and replayed on proceed). Closing or reloading the tab
// gets the browser's own "Leave site?".
import { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';

/** `blocked`: a route change waits; the screen shows its Discard confirm and calls `proceed` (Discard) or `stay` (Cancel). */
export function useLeaveGuard(dirty: boolean) {
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname);
  useEffect(() => {
    if (!dirty) return;
    const stop = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', stop);
    return () => window.removeEventListener('beforeunload', stop);
  }, [dirty]);
  return { blocked: blocker.state === 'blocked', proceed: () => blocker.proceed?.(), stay: () => blocker.reset?.() };
}
