// Photos, short videos and PDFs (the paper registration form) from the camera or an upload: validate, store (base64 in the server-only `media` table) and read back.
import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from './db/client';
import { media } from './db/schema';

/** Images: 5 MB (the client shrinks photos to 1600px first). Videos: 25 MB (a 15 s phone clip). PDFs: 10 MB (a scanned registration form). */
export const MAX_MEDIA_BYTES = 5 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
export const MAX_PDF_BYTES = 10 * 1024 * 1024;
export const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const VIDEO_MIME = ['video/webm', 'video/mp4'] as const;
export const PDF_MIME = ['application/pdf'] as const;
export const MEDIA_MIME = [...IMAGE_MIME, ...VIDEO_MIME, ...PDF_MIME] as const;
export type MediaMime = (typeof MEDIA_MIME)[number];
export const isVideoMime = (m: string) => (VIDEO_MIME as readonly string[]).includes(m);
export const isPdfMime = (m: string) => m === 'application/pdf';
const limitFor = (mime: string) => (isVideoMime(mime) ? MAX_VIDEO_BYTES : isPdfMime(mime) ? MAX_PDF_BYTES : MAX_MEDIA_BYTES);

/** What the bytes really are (the first bytes of a JPEG, PNG or WebP), whatever the caller claims. */
export function sniffImage(b: Uint8Array): MediaMime | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return 'image/png';
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  return null;
}

/** What the bytes really are for a video: WebM / Matroska (EBML header 1A 45 DF A3), or an MP4 / QuickTime file (an `ftyp` box at byte 4). */
export function sniffVideo(b: Uint8Array): 'video/webm' | 'video/mp4' | null {
  if (b.length >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return 'video/webm';
  if (b.length >= 12 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return 'video/mp4';
  return null;
}
/** A PDF starts with `%PDF-` (some writers put up to 1 KB of junk before it, which readers accept). */
export function sniffPdf(b: Uint8Array): 'application/pdf' | null {
  const end = Math.min(b.length - 4, 1024);
  for (let i = 0; i < end; i++) if (b[i] === 0x25 && b[i + 1] === 0x50 && b[i + 2] === 0x44 && b[i + 3] === 0x46 && b[i + 4] === 0x2d) return 'application/pdf';
  return null;
}
/** What the bytes really are, image, video or PDF. */
export const sniffMedia = (b: Uint8Array): MediaMime | null => sniffImage(b) ?? sniffVideo(b) ?? sniffPdf(b);

export type MediaCheck = { ok: true; mime: MediaMime; bytes: Buffer } | { ok: false; status: 413 | 415 | 400; code: string };
/** Check an upload `{ mime, data }` (data = base64, or a data: URL): an allowed type, really that image, video or PDF, and within its limit (images 5 MB, videos 25 MB, PDFs 10 MB). */
export function checkUpload(body: { mime?: unknown; data?: unknown }): MediaCheck {
  const mime = typeof body.mime === 'string' ? body.mime.toLowerCase() : '';
  if (typeof body.data !== 'string' || !body.data) return { ok: false, status: 400, code: 'common.mediaFailed' };
  const video = mime.startsWith('video/');
  const badType = video ? 'ds.videoType' : isPdfMime(mime) ? 'common.docType' : 'common.mediaType';
  const tooBig = video ? 'ds.videoTooBig' : isPdfMime(mime) ? 'common.docTooBig' : 'common.mediaTooBig';
  if (!(MEDIA_MIME as readonly string[]).includes(mime)) return { ok: false, status: 415, code: badType };
  const max = limitFor(mime);
  const b64 = body.data.replace(/^data:[^,]*,/, '');
  // refuse before decoding: 5 MB of bytes is 6.99 million base64 characters
  if (b64.length > Math.ceil((max * 4) / 3) + 4) return { ok: false, status: 413, code: tooBig };
  const bytes = Buffer.from(b64, 'base64');
  if (!bytes.length) return { ok: false, status: 400, code: 'common.mediaFailed' };
  if (bytes.length > max) return { ok: false, status: 413, code: tooBig };
  if (sniffMedia(bytes) !== mime) return { ok: false, status: 415, code: badType };
  return { ok: true, mime: mime as MediaMime, bytes };
}

/** A long random id: the link to a photo is the key to it, so it must not be guessable. */
export const newMediaId = () => 'md_' + randomBytes(18).toString('base64url');

export async function saveMedia(clubId: string, userId: string, mime: MediaMime, bytes: Buffer): Promise<string> {
  const id = newMediaId();
  await db.insert(media).values({ id, clubId, mime, data: bytes.toString('base64'), bytes: bytes.length, createdBy: userId });
  return id;
}

export async function loadMedia(id: string): Promise<{ mime: string; bytes: Buffer } | null> {
  if (!/^md_[A-Za-z0-9_-]{20,40}$/.test(id)) return null;
  const [row] = await db.select({ mime: media.mime, data: media.data }).from(media).where(eq(media.id, id)).limit(1);
  return row ? { mime: row.mime, bytes: Buffer.from(row.data, 'base64') } : null;
}

/** A `Range: bytes=a-b` header against a body of `size` bytes: the inclusive range to send, `null` for no (or an unsupported multi-part) range header, `'bad'` when it lies outside the body. */
export function byteRange(header: string | undefined, size: number): { start: number; end: number } | 'bad' | null {
  const m = /^bytes=(\d*)-(\d*)$/.exec((header || '').trim());
  if (!m || (!m[1] && !m[2])) return null;
  let start: number, end: number;
  if (!m[1]) { const n = Number(m[2]); if (!n) return 'bad'; start = Math.max(0, size - n); end = size - 1; } // the last n bytes
  else { start = Number(m[1]); end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1; }
  return start >= size || start > end ? 'bad' : { start, end };
}
