// Photos and short videos from the camera or a file: shrink photos on the device, upload to the API, show by id.
import { demoMediaPath } from '@cp/shared/seed/demoMedia';
import { api, ApiError } from './api';

export const MAX_DIM = 1600;
/** The server refuses anything above this (5 MB); a 1600px JPEG is far smaller. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Videos are sent as they were recorded: up to 25 MB and 15 seconds (the server checks the size and the file signature). */
export const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
export const MAX_VIDEO_SEC = 15;
/** A PDF (a scanned paper form) is sent as it is: up to 10 MB. */
export const MAX_PDF_BYTES = 10 * 1024 * 1024;

/** The URL of an uploaded photo (a long random id, so the link itself is the key). A demo picture (`md_demo_<name>`, KC round 7: the seed's free Unsplash scenes)
 *  is a static file of the web app, `/demo/<name>.jpg`, never fetched from the media table. */
export const mediaUrl = (id: string) => demoMediaPath(id) ?? `/api/media/${encodeURIComponent(id)}`;
/** A member's profile picture URL, if they have one. */
export const memberPhoto = (m?: { photoMediaId?: string } | null) => (m?.photoMediaId ? mediaUrl(m.photoMediaId) : undefined);
/** An activity's picture (KC round 6), or undefined: the icon tile stands in. */
export const activityPhoto = memberPhoto;
/** Background of a round avatar: the photo when there is one, over the tone colour. */
export const photoFill = (url: string | undefined, bg: string) => (url ? `center / cover no-repeat url("${url}"), ${bg}` : bg);

/** Size after fitting inside max × max (never enlarges). */
export function fitWithin(w: number, h: number, max = MAX_DIM): { w: number; h: number } {
  const s = Math.min(1, max / Math.max(w, h, 1));
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
}

async function decode(src: Blob): Promise<{ draw: (c: CanvasRenderingContext2D, w: number, h: number) => void; w: number; h: number; close: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(src, { imageOrientation: 'from-image' });
      return { draw: (c, w, h) => c.drawImage(bmp, 0, 0, w, h), w: bmp.width, h: bmp.height, close: () => bmp.close() };
    } catch { /* fall through to <img> */ }
  }
  const url = URL.createObjectURL(src);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => bad(new Error('decode')); i.src = url; });
    return { draw: (c, w, h) => c.drawImage(img, 0, 0, w, h), w: img.naturalWidth, h: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new ApiError(415, 'common.mediaType');
  }
}

/** Re-encode any image as a JPEG no larger than max × max (EXIF rotation applied, transparency flattened onto white). */
export async function downscaleImage(src: Blob, max = MAX_DIM, quality = 0.85): Promise<Blob> {
  const img = await decode(src);
  try {
    const { w, h } = fitWithin(img.w, img.h, max);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new ApiError(415, 'common.mediaType');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);
    img.draw(ctx, w, h);
    return await new Promise<Blob>((ok, bad) => canvas.toBlob((b) => (b ? ok(b) : bad(new ApiError(415, 'common.mediaType'))), 'image/jpeg', quality));
  } finally {
    img.close();
  }
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((ok, bad) => {
    const r = new FileReader();
    r.onload = () => { const url = String(r.result); ok(url.slice(url.indexOf(';base64,') + 8)); }; // the media type may carry commas (codecs=vp9,opus)
    r.onerror = () => bad(new ApiError(0, 'common.mediaFailed'));
    r.readAsDataURL(blob);
  });
}

export const isVideoBlob = (b: Blob) => b.type.startsWith('video/');
/** WebM or MP4 for a recorded or chosen video (a QuickTime .mov from an iPhone is an MP4 family file); null for anything else. */
export function videoMime(type: string, name = ''): 'video/webm' | 'video/mp4' | null {
  const t = type.toLowerCase().split(';')[0].trim();
  if (t === 'video/webm') return 'video/webm';
  if (t === 'video/mp4' || t === 'video/quicktime' || t === 'video/x-m4v') return 'video/mp4';
  if (!t || t === 'application/octet-stream') return /\.webm$/i.test(name) ? 'video/webm' : /\.(mp4|m4v|mov)$/i.test(name) ? 'video/mp4' : null;
  return null;
}

/** The length of a video in whole seconds, or null when the browser cannot read it. */
export function videoDuration(blob: Blob): Promise<number | null> {
  return new Promise((ok) => {
    const url = URL.createObjectURL(blob);
    const v = document.createElement('video');
    const done = (n: number | null) => { clearTimeout(timer); v.removeAttribute('src'); v.load(); URL.revokeObjectURL(url); ok(n); };
    const timer = setTimeout(() => done(null), 4000);
    v.preload = 'metadata';
    v.onloadedmetadata = () => done(Number.isFinite(v.duration) && v.duration > 0 ? v.duration : null);
    v.onerror = () => done(null);
    v.src = url;
  });
}

/** A video chosen from the device: WebM or MP4, up to 25 MB, and up to 15 seconds when the browser can tell. Rejects with an ApiError whose `code` is an i18n key. */
export async function readVideoFile(f: File): Promise<{ blob: Blob; durationSec?: number }> {
  const mime = videoMime(f.type, f.name);
  if (!mime) throw new ApiError(415, 'ds.videoType');
  if (f.size > MAX_VIDEO_BYTES) throw new ApiError(413, 'ds.videoTooBig');
  const blob = new Blob([f], { type: mime });
  const d = await videoDuration(blob);
  if (d !== null && d > MAX_VIDEO_SEC + 0.5) throw new ApiError(413, 'ds.videoTooLong', { n: MAX_VIDEO_SEC });
  return { blob, ...(d !== null ? { durationSec: Math.max(1, Math.round(d)) } : {}) };
}

/**
 * Upload a photo or a video; resolves with the `mediaId` to store on the record (then `mediaUrl(id)` or `<PhotoImg>` shows it).
 * A photo is first shrunk to a 1600px JPEG; a video is sent as it is. Rejects with an ApiError whose `code` is an i18n key.
 */
export async function uploadMedia(blob: Blob): Promise<string> {
  if (isVideoBlob(blob)) {
    const mime = videoMime(blob.type);
    if (!mime) throw new ApiError(415, 'ds.videoType');
    if (blob.size > MAX_VIDEO_BYTES) throw new ApiError(413, 'ds.videoTooBig');
    const { id } = await api<{ id: string }>('/api/media', { body: { mime, data: await toBase64(blob) } });
    return id;
  }
  const jpeg = await downscaleImage(blob);
  if (jpeg.size > MAX_UPLOAD_BYTES) throw new ApiError(413, 'common.mediaTooBig');
  const { id } = await api<{ id: string }>('/api/media', { body: { mime: 'image/jpeg', data: await toBase64(jpeg) } });
  return id;
}

/** Is this file (or blob) a PDF? Looks at the type, then at the name when the browser gave no type. */
export const isPdfFile = (b: Blob, name = '') => { const t = b.type.toLowerCase(); return t === 'application/pdf' || ((!t || t === 'application/octet-stream') && /\.pdf$/i.test(name)); };
/** Is a stored document file name a PDF? (Documents keep the file name, so the viewer knows whether to open the file in a new tab.) */
export const isPdfName = (name?: string) => !!name && /\.pdf$/i.test(name);

/**
 * Upload a document: a photo from the camera or a file (shrunk to a JPEG like any photo), or a PDF as it is (up to 10 MB).
 * Resolves with the `mediaId` and the file name to store on the document. Rejects with an ApiError whose `code` is an i18n key.
 */
export async function uploadDocument(blob: Blob, name = ''): Promise<{ mediaId: string; fileName: string }> {
  if (isPdfFile(blob, name)) {
    if (blob.size > MAX_PDF_BYTES) throw new ApiError(413, 'common.docTooBig');
    const { id } = await api<{ id: string }>('/api/media', { body: { mime: 'application/pdf', data: await toBase64(blob) } });
    return { mediaId: id, fileName: name || 'document.pdf' };
  }
  const mediaId = await uploadMedia(blob);
  const base = (name || 'photo').replace(/\.[A-Za-z0-9]{1,5}$/, '');
  return { mediaId, fileName: `${base}.jpg` };
}
