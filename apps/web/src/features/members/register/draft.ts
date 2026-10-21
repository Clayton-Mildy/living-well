// KC round 12: the registration in progress is kept on this device (one per lead, one for a new member), so closing the flow loses nothing.
// Uploaded files are kept as their media ids. Storage can be blocked (private mode): every access is wrapped, and a broken draft reads as none.
import { blankState, type RegMode, type RegState } from './steps';

export const draftKey = (mode: RegMode) => `cp.reg.${mode.kind === 'lead' ? mode.id : 'new'}`;

export function loadDraft(mode: RegMode): RegState | null {
  try {
    const raw = localStorage.getItem(draftKey(mode));
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<RegState> | null;
    if (!v || typeof v !== 'object' || typeof v.name !== 'string' || !v.reg || typeof v.reg !== 'object') return null;
    const b = blankState();
    return { ...b, ...v, health: { ...b.health, ...v.health }, carer: { ...b.carer, ...v.carer }, reg: { ...b.reg, ...v.reg } };
  } catch {
    return null;
  }
}
export function saveDraft(mode: RegMode, st: RegState): void {
  try { localStorage.setItem(draftKey(mode), JSON.stringify(st)); } catch { /* storage blocked or full: the flow still works */ }
}
export function clearDraft(mode: RegMode): void {
  try { localStorage.removeItem(draftKey(mode)); } catch { /* storage blocked */ }
}
