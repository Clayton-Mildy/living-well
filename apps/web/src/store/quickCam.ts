// The quick camera's tray and its background queue (KC round 7, "shoot first, sort later"). It lives outside React so that shots keep uploading, and keep
// becoming drafts, after the camera screen is closed. A shot is shown in the tray at once; the shutter never waits for the network. Each shot is uploaded
// (a few at a time) and then saved with `photo.capture`, one call after another in the order they were taken.
import { create } from 'zustand';
import { translate } from '@cp/shared';
import { ApiError } from '../lib/api';
import { uploadMedia } from '../lib/media';
import { useReplica } from './replica';
import { useSession } from './session';
import { say } from './ui';

export interface QShot {
  key: string;
  url: string;
  media: 'photo' | 'video';
  durationSec?: number;
  burst?: string;
  state: 'uploading' | 'saved' | 'failed';
  blob: Blob;
  photoId?: string;
}
interface QuickCam {
  open: boolean;
  /** the tray: shots taken since the camera was opened (plus any still on their way from before) */
  shots: QShot[];
  /** how many shots were taken in this visit (the "N photos in Drafts" toast) */
  taken: number;
  openCam(): void;
  /** close the camera; returns how many shots were taken in the visit */
  closeCam(): number;
  add(blob: Blob, media: 'photo' | 'video', opts?: { durationSec?: number; burst?: string }): void;
  retry(key: string): void;
}

const UPLOADS_AT_ONCE = 3;
let seq = 0;
let active = 0;
const waiting: (() => void)[] = [];
let chain: Promise<unknown> = Promise.resolve();

async function upload(blob: Blob): Promise<string> {
  while (active >= UPLOADS_AT_ONCE) await new Promise<void>((ok) => waiting.push(ok));
  active++;
  try { return await uploadMedia(blob); } finally { active--; waiting.shift()?.(); }
}
const tr = (key: string, vars?: Record<string, string | number>) => translate(useSession.getState().lang, key, vars);

export const useQuickCam = create<QuickCam>((set, get) => {
  const patch = (key: string, p: Partial<QShot>) => set((st) => ({ shots: st.shots.map((x) => (x.key === key ? { ...x, ...p } : x)) }));
  const send = (key: string) => {
    const shot = get().shots.find((x) => x.key === key);
    if (!shot) return;
    patch(key, { state: 'uploading' });
    const up = upload(shot.blob); // starts at once; the saves below follow the order of the shots
    up.catch(() => undefined);
    chain = chain.then(async () => {
      try {
        const mediaId = await up;
        const r = await useReplica.getState().act('photo.capture', { media: shot.media, mediaId, ...(shot.durationSec ? { durationSec: shot.durationSec } : {}), ...(shot.burst ? { burst: shot.burst } : {}) });
        if (!r.ok) throw new ApiError(0, r.code, r.params);
        const photoId = String(r.result.photoId ?? '');
        markFresh(photoId);
        patch(key, { state: 'saved', photoId });
      } catch (e) {
        patch(key, { state: 'failed' });
        say(e instanceof ApiError ? tr(e.code, e.params) : tr('activity.uploadFailed'), { tone: 'error', icon: 'error' });
      }
    });
  };
  return {
    open: false,
    shots: [],
    taken: 0,
    openCam() {
      // what is already saved leaves the tray; what is still on its way stays until it is
      set((st) => {
        for (const x of st.shots) if (x.state === 'saved') URL.revokeObjectURL(x.url);
        return { open: true, taken: 0, shots: st.shots.filter((x) => x.state !== 'saved') };
      });
    },
    closeCam() {
      const n = get().taken;
      set({ open: false });
      return n;
    },
    add(blob, media, opts = {}) {
      const key = 'q' + ++seq;
      set((st) => ({ taken: st.taken + 1, shots: [...st.shots, { key, url: URL.createObjectURL(blob), media, blob, state: 'uploading', ...(opts.durationSec ? { durationSec: opts.durationSec } : {}), ...(opts.burst ? { burst: opts.burst } : {}) }] }));
      send(key);
    },
    retry(key) { send(key); },
  };
});

// ---------- "Linking…": the AI should feel like it is working ----------
// Drafts taken on this device shimmer for a moment the first time they are shown (the suggestion itself is already on the row; this is only the feel of it).
const LINKING_MS = 1500;
const fresh = new Set<string>();
const until = new Map<string, number>();
export const markFresh = (id: string) => { if (id) fresh.add(id); };
/** Milliseconds of "Linking…" left for a draft; the clock starts the first time it is asked (staggered by `index` so a batch is worked through one by one). */
export function linkingLeft(id: string, index = 0): number {
  if (!fresh.has(id)) return 0;
  let end = until.get(id);
  if (end === undefined) { end = Date.now() + LINKING_MS + Math.min(index, 6) * 110; until.set(id, end); }
  return Math.max(0, end - Date.now());
}
