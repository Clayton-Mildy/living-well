// Super search (round 14 phase E): one overlay for every staff role. A full-screen layer on a phone, a centred 640 px panel on tablet and laptop.
// It searches the synced club state through the role-gated index (app/searchRegistry.ts) and ranks with lib/search.ts; nothing goes to the server.
import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Icon, useOverlayA11y } from '../components/ui';
import { useDevice } from '../hooks/useDevice';
import { useT, useLang } from '../lib/i18n';
import { useMe } from '../lib/me';
import { rank, type SearchHit } from '../lib/search';
import { buildSearchIndex } from '../app/searchRegistry';
import { useClub } from '../store/replica';

const KEY = 'cp.search.recent';
const MAX_RECENT = 8; // R6: the newest 8, without duplicates

// every read and write is guarded: a blocked store (private mode) simply means no recents
const readRecent = (): string[] => {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, MAX_RECENT) : [];
  } catch { return []; }
};
const writeRecent = (list: string[]) => {
  try { if (list.length) localStorage.setItem(KEY, JSON.stringify(list)); else localStorage.removeItem(KEY); } catch { /* no recents then */ }
};

export function SuperSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  return open ? <Overlay onClose={onClose} /> : null; // mounted only while open, so each opening starts with an empty field and fresh recents
}

function Overlay({ onClose }: { onClose: () => void }) {
  const t = useT();
  const lang = useLang();
  const navigate = useNavigate();
  const { isPhone } = useDevice();
  const { role } = useMe();
  const club = useClub();
  const { ref, trap } = useOverlayA11y(true, onClose);
  const [q, setQ] = useState('');
  const [recent, setRecent] = useState<string[]>(readRecent);
  const [at, setAt] = useState(0);
  const index = useMemo(() => (club && role && role !== 'family' ? buildSearchIndex(club, role, t, lang) : []), [club, role, t, lang]);
  const groups = useMemo(() => rank(index, q), [index, q]);
  const flat = useMemo(() => groups.flatMap((g) => g.hits), [groups]);
  const typed = q.trim() !== '';
  useEffect(() => { setAt(0); }, [q]);
  useEffect(() => { document.querySelector('[aria-selected="true"][data-testid="ss-row"]')?.scrollIntoView?.({ block: 'nearest' }); }, [at]);

  const open = (h: SearchHit) => {
    const next = [q.trim(), ...recent.filter((r) => r !== q.trim())].slice(0, MAX_RECENT); // R6: remembered when one of its results is opened
    writeRecent(next);
    onClose();
    navigate(h.to);
  };
  const keys = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!flat.length) return;
      e.preventDefault();
      setAt((a) => (a + (e.key === 'ArrowDown' ? 1 : flat.length - 1)) % flat.length);
    } else if (e.key === 'Enter' && flat[at]) { e.preventDefault(); open(flat[at]!); }
  };

  const field = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, height: 44, padding: '0 12px', borderRadius: 12, background: 'var(--fill, #F4F4F5)' }}>
      <Icon name="search" size={22} color="#6B6259" />
      <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={keys} placeholder={t('search.placeholder')} aria-label={t('search.open')} enterKeyHint="search"
        autoComplete="off" autoCorrect="off" spellCheck={false}
        style={{ flex: 1, minWidth: 0, height: 44, border: 'none', outline: 'none', background: 'transparent', fontSize: 16, fontFamily: 'Inter', color: '#24201C' }} />
    </div>
  );
  const closeBtn = (
    <button type="button" onClick={onClose} aria-label={t('search.close')} title={t('search.close')} className="h-cream"
      style={{ width: 44, height: 44, borderRadius: 999, border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flex: 'none', padding: 0, color: '#24201C' }}>
      <Icon name="close" size={22} />
    </button>
  );
  const small = (s: string) => <div style={{ padding: '14px 16px 6px', fontSize: 11, letterSpacing: '1.4px', textTransform: 'uppercase', fontWeight: 600, color: '#5E5852', lineHeight: '16px' }}>{s}</div>;
  let n = -1;
  const body = (
    <div role="listbox" aria-label={t('search.open')} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 6px 12px' }}>
      {typed ? (
        groups.length ? groups.map((g) => (
          <div key={g.group} data-testid="ss-group" role="group" aria-label={t('search.g.' + g.group)}>
            {small(t('search.g.' + g.group))}
            {g.hits.map((h) => {
              const i = ++n;
              const sel = i === at;
              return (
                <button key={h.id} type="button" role="option" aria-selected={sel} data-testid="ss-row" onClick={() => open(h)} onMouseMove={() => setAt(i)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 48, padding: '6px 10px', border: 'none', borderRadius: 12, background: sel && !isPhone ? '#F4F4F5' : 'transparent', cursor: 'pointer', textAlign: 'left', fontFamily: 'Inter', color: '#24201C', boxSizing: 'border-box' }}>
                  <Icon name={h.icon} size={22} color="var(--accent, #75624B)" />
                  <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 15, fontWeight: 500, lineHeight: '20px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.label}</span>
                    {h.sub ? <span style={{ fontSize: 13, lineHeight: '18px', color: '#5E5852', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.sub}</span> : null}
                  </span>
                </button>
              );
            })}
          </div>
        )) : <div style={{ padding: '28px 16px', fontSize: 15, color: '#5E5852', textAlign: 'center' }}>{t('search.none', { q: q.trim() })}</div>
      ) : recent.length ? (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 6 }}>
            {small(t('search.recent'))}
            <button type="button" onClick={() => { writeRecent([]); setRecent([]); }} className="h-cream"
              style={{ minHeight: 44, padding: '0 12px', border: 'none', borderRadius: 10, background: 'transparent', fontSize: 14, fontWeight: 600, color: '#24201C', cursor: 'pointer', fontFamily: 'Inter' }}>{t('search.clear')}</button>
          </div>
          {recent.map((r) => (
            <button key={r} type="button" onClick={() => setQ(r)} className="h-cream"
              style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 48, padding: '6px 10px', border: 'none', borderRadius: 12, background: 'transparent', cursor: 'pointer', textAlign: 'left', fontFamily: 'Inter', color: '#24201C', fontSize: 15, boxSizing: 'border-box' }}>
              <Icon name="history" size={22} color="#6B6259" />
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r}</span>
            </button>
          ))}
        </div>
      ) : <div style={{ padding: '28px 16px', fontSize: 15, color: '#5E5852', textAlign: 'center' }}>{t('search.hint')}</div>}
    </div>
  );

  return createPortal(
    isPhone ? (
      <div ref={ref} onKeyDown={trap} tabIndex={-1} role="dialog" aria-modal="true" aria-label={t('search.open')}
        style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', flexDirection: 'column', background: 'var(--page, #FFFFFF)', outline: 'none', paddingTop: 'env(safe-area-inset-top, 0px)', animation: 'cpFade .16s ease-out' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 10px 8px 12px', flex: 'none' }}>{field}{closeBtn}</div>
        {body}
      </div>
    ) : (
      <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '10vh 16px 16px', boxSizing: 'border-box' }}>
        <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(20,16,12,.32)', animation: 'cpFade .16s ease-out' }} />
        <div ref={ref} onKeyDown={trap} tabIndex={-1} role="dialog" aria-modal="true" aria-label={t('search.open')}
          style={{ position: 'relative', width: '100%', maxWidth: 640, maxHeight: '70vh', display: 'flex', flexDirection: 'column', background: '#FFFFFF', borderRadius: 20, boxShadow: '0 2px 6px rgba(40,30,20,.08), 0 24px 60px rgba(40,30,20,.22)', outline: 'none', animation: 'cpPop .2s cubic-bezier(.3,.7,.2,1)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '10px 10px 6px 12px', flex: 'none' }}>{field}{closeBtn}</div>
          {body}
        </div>
      </div>
    ),
    document.body,
  );
}
