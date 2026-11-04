// Round 19: a link to a retired menu key (/directory?q=Bersih) lands on the key that took its place, keeping the query.
import { Navigate, useLocation } from 'react-router-dom';
import { retiredKey } from './nav';

export function LegacyKeyRedirect({ from }: { from: string }) {
  const { search, hash } = useLocation();
  return <Navigate to={`/${retiredKey(from) ?? 'today'}${search}${hash}`} replace />;
}
