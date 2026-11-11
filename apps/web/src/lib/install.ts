// "Install as an app": captures Chrome's install prompt early, detects installed / iOS Safari, and exposes useInstall().
import { create } from 'zustand';

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

/** iPhone / iPad / iPod Safari-family browsers (iPadOS reports as a Mac with touch). Pure, for tests. */
export function isIosDevice(ua: string, platform: string, touchPoints: number): boolean {
  if (/iPhone|iPad|iPod/.test(ua)) return true;
  return (platform === 'MacIntel' || /Macintosh/.test(ua)) && touchPoints > 1;
}

/** Install-able on iOS only through Safari's Share sheet; Chrome/Firefox/Edge on iOS can add to home screen too but are rarer here, so we show steps for all. */
export function isIosBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return isIosDevice(navigator.userAgent, navigator.platform, navigator.maxTouchPoints || 0);
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
  } catch { /* ignore */ }
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** Whether to offer install. Pure, for tests. */
export function canOffer(installed: boolean, hasPrompt: boolean, ios: boolean): boolean {
  return !installed && (hasPrompt || ios);
}

let deferred: InstallPromptEvent | null = null;
const useStore = create<{ hasPrompt: boolean; installed: boolean }>(() => ({ hasPrompt: false, installed: isStandalone() }));

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    useStore.setState({ hasPrompt: true });
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    useStore.setState({ hasPrompt: false, installed: true });
  });
}

export function useInstall(): { show: boolean; ios: boolean; install: () => Promise<void> } {
  const { hasPrompt, installed } = useStore();
  const ios = isIosBrowser();
  const install = async () => {
    const ev = deferred;
    if (!ev) return;
    deferred = null; // a prompt event can be used once
    useStore.setState({ hasPrompt: false });
    try { await ev.prompt(); await ev.userChoice; } catch { /* ignore */ }
  };
  return { show: canOffer(installed, hasPrompt, ios), ios, install };
}
