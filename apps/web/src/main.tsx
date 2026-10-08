import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/inter/300.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/600.css';
import 'material-symbols/rounded.css';
import './styles/global.css';
import './styles/pseudo.css';
import { App } from './app/App';
import { reloadForNewVersion } from './app/RouteError';

// a new version was deployed while this tab was open: its code files are gone, so load the new version
window.addEventListener('vite:preloadError', (e) => { if (reloadForNewVersion()) e.preventDefault(); });
// iOS Safari only applies :active (the phone's press feedback) when the page listens for touches
document.addEventListener('touchstart', () => {}, { passive: true });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
