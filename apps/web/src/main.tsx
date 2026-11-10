import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/inter/300.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/epilogue/600.css';
import 'material-symbols/rounded.css';
import './styles/global.css';
import './styles/pseudo.css';
import './styles/lw-preview.css';
import { App } from './app/App';
import { reloadForNewVersion } from './app/RouteError';

// a new version was deployed while this tab was open: its code files are gone, so load the new version
window.addEventListener('vite:preloadError', (e) => { if (reloadForNewVersion()) e.preventDefault(); });
// Living Well preview skin (design review only, styles/lw-preview.css): ?skin=lw (fonts and warm neutrals), ?skin=linen (option A) or ?skin=sand
// (option B) turns it on in this browser, ?skin=off turns it off
try {
  const skin = new URLSearchParams(location.search).get('skin');
  if (skin === 'lw' || skin === 'linen' || skin === 'sand') localStorage.setItem('cp.previewSkin', skin);
  else if (skin === 'off') localStorage.removeItem('cp.previewSkin');
  const on = localStorage.getItem('cp.previewSkin');
  if (on === 'lw') document.documentElement.dataset.lw = '1';
  else if (on === 'linen' || on === 'sand') document.documentElement.dataset.lw = on;
} catch { /* no storage: the usual look */ }
// iOS Safari only applies :active (the phone's press feedback) when the page listens for touches
document.addEventListener('touchstart', () => {}, { passive: true });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
