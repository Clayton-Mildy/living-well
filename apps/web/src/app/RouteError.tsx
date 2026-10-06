// Route error screen. After a new version is deployed, an open tab may ask for a code file that no longer exists:
// reload once to pick up the new version instead of showing an error.
import { useEffect } from 'react';
import { useRouteError } from 'react-router-dom';
import { useT } from '../lib/i18n';

const STALE = /dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError/i;
const KEY = 'cp.reloadedAt';
/** Reload the page, at most once every 30 seconds (so a real outage can't loop). */
export function reloadForNewVersion() {
  try {
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last < 30_000) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch { /* storage blocked: still reload once */ }
  window.location.reload();
  return true;
}

export function RouteError() {
  const t = useT();
  const err = useRouteError() as { message?: string } | undefined;
  const stale = STALE.test(String(err?.message || err || ''));
  useEffect(() => { if (stale) reloadForNewVersion(); }, [stale]);
  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, textAlign: 'center', background: '#F6F5F5', fontFamily: 'Inter' }}>
      <div style={{ fontSize: 24, color: '#9A836C' }}>{stale ? t('common.updating') : t('common.somethingWrong')}</div>
      <button type="button" onClick={() => window.location.reload()} style={{ height: 44, padding: '0 20px', borderRadius: 999, border: 'none', background: '#75624B', color: '#FFFFFF', fontSize: 16, fontFamily: 'Inter', cursor: 'pointer' }}>{t('common.reload')}</button>
    </div>
  );
}
