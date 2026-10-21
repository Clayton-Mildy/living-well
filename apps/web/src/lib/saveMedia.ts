// KC round 10 ("make the images able to be saved to our galleries"): save one or many pictures (or clips) to the phone's gallery.
// On a phone or tablet the files go through the OS share sheet (navigator.share with files): on iOS that offers "Save Image" / "Save N Images" into Photos,
// on Android the gallery or Files. Where that is not there (a laptop, an older browser) each file is downloaded instead; Android puts downloads in the gallery too.
import type { Photo } from '@cp/shared';
import { mediaUrl } from './media';

export type SaveHow = 'share' | 'download';
export interface SaveOutcome { how: SaveHow; n: number; cancelled: boolean }
type Savable = Pick<Photo, 'id' | 'mediaId' | 'date' | 'time' | 'media'>;

const coarse = () => typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)')?.matches;
const extOf = (type: string, video: boolean) => (type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : type.includes('webm') ? 'webm' : video ? 'mp4' : 'jpg');
const nameOf = (p: Savable, type: string, k: number) => `citrapremier-${p.date}-${(p.time || '').replace(':', '')}${k ? '-' + (k + 1) : ''}.${extOf(type, p.media === 'video')}`;

async function fileOf(p: Savable, k: number): Promise<File> {
  const r = await fetch(mediaUrl(p.mediaId!));
  if (!r.ok) throw new Error('fetch ' + r.status);
  const b = await r.blob();
  const type = b.type || (p.media === 'video' ? 'video/mp4' : 'image/jpeg');
  return new File([b], nameOf(p, type, k), { type });
}

const sleep = (ms: number) => new Promise<void>((ok) => setTimeout(ok, ms));
function download(f: File) {
  const url = URL.createObjectURL(f);
  const a = document.createElement('a');
  a.href = url; a.download = f.name; a.rel = 'noopener'; a.style.display = 'none';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Save the pictures that have a file. Throws when a file could not be fetched; `cancelled` when the person closed the share sheet. */
export async function savePhotos(photos: Savable[]): Promise<SaveOutcome> {
  const list = photos.filter((p) => !!p.mediaId);
  const files = await Promise.all(list.map((p, k) => fileOf(p, k)));
  if (!files.length) return { how: 'download', n: 0, cancelled: false };
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (coarse() && typeof nav.share === 'function' && nav.canShare?.({ files })) {
    try { await nav.share({ files }); return { how: 'share', n: files.length, cancelled: false }; }
    catch (e) { if ((e as { name?: string })?.name === 'AbortError') return { how: 'share', n: 0, cancelled: true }; /* else fall through to downloads */ }
  }
  for (let k = 0; k < files.length; k++) { download(files[k]); if (k < files.length - 1) await sleep(350); } // a pause between files, so the browser does not swallow them
  return { how: 'download', n: files.length, cancelled: false };
}
