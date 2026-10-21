// Toasts (design: dark pill, check icon, 4.5 s) with optional action (e.g. Undo).
import { create } from 'zustand';

export interface Toast { id: number; text: string; icon?: string; tone?: 'ok' | 'error' | 'urgent'; action?: { label: string; run: () => void } }
interface UiState { toast: Toast | null; pins: number; /** round 8: the family app opens the notifications from its Today header */ bell: boolean; setBell(open: boolean): void; say(text: string, opts?: Omit<Toast, 'id' | 'text'>): void; dismiss(): void; pin(delta: number): void }
let timer: ReturnType<typeof setTimeout> | undefined;
let seq = 0;
export const useUi = create<UiState>((set) => ({
  toast: null,
  pins: 0,
  bell: false,
  setBell(open) { set({ bell: open }); },
  pin(delta) { set((s) => ({ pins: Math.max(0, s.pins + delta) })); },
  say(text, opts = {}) {
    clearTimeout(timer);
    set({ toast: { id: ++seq, text, ...opts } });
    timer = setTimeout(() => set({ toast: null }), opts.action ? 7000 : 4500);
  },
  dismiss() { clearTimeout(timer); set({ toast: null }); },
}));
export const say = (text: string, opts?: Omit<Toast, 'id' | 'text'>) => useUi.getState().say(text, opts);
