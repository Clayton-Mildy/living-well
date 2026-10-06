// Video in the kit: the media helpers (types, size, length, upload without the image downscale), PhotoImg for a real video, and CameraCapture's video mode
// (recording with a fake camera and recorder: timer, auto-stop at 15 s, preview; and the file fallback). jsdom, English.
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useReplica } from '../../store/replica';
import { useSession } from '../../store/session';
import { ApiError } from '../../lib/api';
import { MAX_VIDEO_BYTES, readVideoFile, uploadMedia, videoMime } from '../../lib/media';
import { CameraCapture, PhotoImg, type CaptureInfo } from './index';

let root: Root | null = null;
let host: HTMLElement | null = null;
beforeAll(() => { (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  host?.remove(); root = null; host = null;
  document.body.innerHTML = '';
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true });
});
async function show(ui: ReactElement) {
  useSession.setState({ lang: 'en' });
  useReplica.setState({ clock: { today: '2026-10-21', startMin: 598, realStart: Date.now(), offset: 0 } });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(ui); });
}
const q = <T extends Element = HTMLElement>(sel: string) => document.querySelector<T>(sel);
const click = async (el: Element | null) => { expect(el).toBeTruthy(); await act(async () => { (el as HTMLElement).click(); }); };
const WEBM = [0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3, 4];

/** jsdom has no URL.createObjectURL and does not load media: give a <video> a length when it gets a src. */
function stubMedia(duration: number | null) {
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:fake', revokeObjectURL: () => undefined }));
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
  Object.defineProperty(HTMLMediaElement.prototype, 'src', {
    configurable: true,
    get() { return this.getAttribute('src') ?? ''; },
    set(v: string) {
      this.setAttribute('src', v);
      setTimeout(() => {
        if (duration === null) { this.onerror?.(new Event('error')); return; }
        Object.defineProperty(this, 'duration', { value: duration, configurable: true });
        this.onloadedmetadata?.(new Event('loadedmetadata'));
      }, 0);
    },
  });
}

describe('videoMime', () => {
  it('maps what a browser reports to the two types the server takes', () => {
    expect(videoMime('video/webm')).toBe('video/webm');
    expect(videoMime('video/webm;codecs=vp9,opus')).toBe('video/webm');
    expect(videoMime('video/mp4')).toBe('video/mp4');
    expect(videoMime('video/quicktime')).toBe('video/mp4'); // an iPhone .mov is an MP4-family file
    expect(videoMime('', 'clip.MOV')).toBe('video/mp4'); // some browsers leave the type empty
    expect(videoMime('', 'clip.webm')).toBe('video/webm');
    expect(videoMime('video/ogg')).toBeNull();
    expect(videoMime('image/png')).toBeNull();
    expect(videoMime('', 'notes.txt')).toBeNull();
  });
});

describe('uploadMedia for a video', () => {
  const post = () => vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ id: 'md_test', url: '/api/media/md_test', bytes: 1 }), { status: 201, headers: { 'content-type': 'application/json' } }));
  it('sends a recorded clip as it is (no image downscale) with its real type', async () => {
    const fetchMock = post();
    vi.stubGlobal('fetch', fetchMock);
    const blob = new Blob([new Uint8Array(WEBM)], { type: 'video/webm;codecs=vp9,opus' });
    expect(await uploadMedia(blob)).toBe('md_test');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/media');
    const body = JSON.parse(String(init!.body));
    expect(body.mime).toBe('video/webm');
    expect(body.data).toBe(btoa(String.fromCharCode(...WEBM))); // the same bytes, not a re-encoded JPEG
  });
  it('refuses a type the server does not take, and a clip above 25 MB, before uploading', async () => {
    const fetchMock = post();
    vi.stubGlobal('fetch', fetchMock);
    await expect(uploadMedia(new Blob([new Uint8Array(4)], { type: 'video/ogg' }))).rejects.toMatchObject({ code: 'ds.videoType' });
    await expect(uploadMedia(new Blob([new Uint8Array(MAX_VIDEO_BYTES + 1)], { type: 'video/mp4' }))).rejects.toMatchObject({ code: 'ds.videoTooBig' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('readVideoFile (the file fallback)', () => {
  beforeEach(() => stubMedia(7.4));
  it('accepts a short video and reads its length', async () => {
    const r = await readVideoFile(new File([new Uint8Array(WEBM)], 'clip.webm', { type: 'video/webm' }));
    expect(r.blob.type).toBe('video/webm');
    expect(r.durationSec).toBe(7);
  });
  it('turns a QuickTime .mov into an MP4-family upload', async () => {
    const r = await readVideoFile(new File([new Uint8Array(8)], 'IMG_1.mov', { type: 'video/quicktime' }));
    expect(r.blob.type).toBe('video/mp4');
  });
  it('rejects a wrong type, a file above 25 MB, and a clip longer than 15 seconds', async () => {
    await expect(readVideoFile(new File(['hello'], 'a.txt', { type: 'text/plain' }))).rejects.toBeInstanceOf(ApiError);
    await expect(readVideoFile(new File([new Uint8Array(MAX_VIDEO_BYTES + 1)], 'big.mp4', { type: 'video/mp4' }))).rejects.toMatchObject({ code: 'ds.videoTooBig' });
    stubMedia(20);
    await expect(readVideoFile(new File([new Uint8Array(WEBM)], 'long.webm', { type: 'video/webm' }))).rejects.toMatchObject({ code: 'ds.videoTooLong', params: { n: 15 } });
  });
  it('still accepts a clip whose length the browser cannot read', async () => {
    stubMedia(null);
    const r = await readVideoFile(new File([new Uint8Array(WEBM)], 'x.mp4', { type: 'video/mp4' }));
    expect(r.durationSec).toBeUndefined();
  });
});

describe('PhotoImg for a video', () => {
  it('is a <video controls playsInline> for the player, and a muted still frame (no controls, no pointer events) for a tile', async () => {
    await show(<><div id="a"><PhotoImg photo={{ mediaId: 'md_v', tone: 1, media: 'video' }} controls alt="Clip" /></div><div id="b"><PhotoImg photo={{ mediaId: 'md_v', tone: 1, media: 'video' }} /></div></>);
    const player = q<HTMLVideoElement>('#a video')!;
    expect(player.hasAttribute('controls')).toBe(true);
    expect(player.hasAttribute('playsinline')).toBe(true);
    expect(player.getAttribute('src')).toBe('/api/media/md_v');
    expect(player.getAttribute('aria-label')).toBe('Clip');
    const tile = q<HTMLVideoElement>('#b video')!;
    expect(tile.hasAttribute('controls')).toBe(false);
    expect(tile.muted).toBe(true);
    expect(tile.style.pointerEvents).toBe('none');
    expect(tile.getAttribute('aria-hidden')).toBe('true');
  });
  it('keeps an <img> for a photo, and the placeholder for a video with no file yet', async () => {
    await show(<><div id="a"><PhotoImg photo={{ mediaId: 'md_p', tone: 1, media: 'photo' }} /></div><div id="b"><PhotoImg photo={{ tone: 2, media: 'video' }} controls /></div></>);
    expect(q('#a img')!.getAttribute('src')).toBe('/api/media/md_p');
    expect(q('#b video')).toBeNull();
    expect(q('#b img')).toBeNull();
  });
});

describe('CameraCapture video mode', () => {
  const onCapture = vi.fn<(blob: Blob, info?: CaptureInfo) => void>();
  const onClose = vi.fn();
  beforeEach(() => { onCapture.mockReset(); onClose.mockReset(); });

  it('without a camera, offers a video file and hands back the clip with its length', async () => {
    stubMedia(7.4);
    await show(<CameraCapture open onClose={onClose} onCapture={onCapture} mode="video" />);
    expect(document.body.textContent).toContain('No camera was found here. Choose a video instead.');
    const input = q<HTMLInputElement>('input[type="file"]')!;
    expect(input.accept).toBe('video/*');
    const file = new File([new Uint8Array(WEBM)], 'clip.webm', { type: 'video/webm' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })); await new Promise((r) => setTimeout(r, 10)); });
    expect(q('video[aria-label="Preview of the video"]')).toBeTruthy();
    await click([...document.querySelectorAll('button')].find((b) => b.textContent?.endsWith('Use video')) ?? null);
    expect(onCapture).toHaveBeenCalledTimes(1);
    expect(onCapture.mock.calls[0][0].type).toBe('video/webm');
    expect(onCapture.mock.calls[0][1]).toEqual({ media: 'video', durationSec: 7 });
    expect(onClose).toHaveBeenCalled();
  });
  it('shows why a chosen file is refused', async () => {
    stubMedia(7.4);
    await show(<CameraCapture open onClose={onClose} onCapture={onCapture} mode="video" />);
    const input = q<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, 'files', { value: [new File(['hi'], 'a.txt', { type: 'text/plain' })], configurable: true });
    await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })); await new Promise((r) => setTimeout(r, 10)); });
    expect(q('[role="alert"]')!.textContent).toBe('Please use a WebM or MP4 video.');
    expect(onCapture).not.toHaveBeenCalled();
  });

  it('records from the camera with a timer, stops by itself at 15 seconds, previews, and uses the clip', async () => {
    stubMedia(null);
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'performance'] });
    const tracks = [{ stop: vi.fn() }];
    const getUserMedia = vi.fn(async () => ({ getTracks: () => tracks }) as unknown as MediaStream);
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia, enumerateDevices: async () => [] }, configurable: true });
    const recorders: FakeRecorder[] = [];
    class FakeRecorder {
      static isTypeSupported = (m: string) => m === 'video/webm;codecs=vp9,opus';
      state = 'inactive'; mimeType = 'video/webm;codecs=vp9,opus';
      ondataavailable: ((e: { data: Blob }) => void) | null = null; onstop: (() => void) | null = null; onerror: (() => void) | null = null;
      constructor(public stream: MediaStream, public opts: MediaRecorderOptions) { recorders.push(this); }
      start() { this.state = 'recording'; }
      stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob([new Uint8Array(WEBM)]) }); this.onstop?.(); }
    }
    vi.stubGlobal('MediaRecorder', FakeRecorder);

    await show(<CameraCapture open onClose={onClose} onCapture={onCapture} mode="video" />);
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    expect(getUserMedia).toHaveBeenCalledWith(expect.objectContaining({ audio: true })); // with sound when the microphone is allowed
    const rec = [...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === 'Record video') ?? null;
    await click(rec);
    expect(recorders).toHaveLength(1);
    expect(recorders[0].opts.mimeType).toBe('video/webm;codecs=vp9,opus');
    expect(q('[role="timer"]')!.textContent).toContain('0:00 / 0:15');
    await act(async () => { await vi.advanceTimersByTimeAsync(6200); });
    expect(q('[role="timer"]')!.textContent).toContain('0:06 / 0:15');
    expect(q('button[aria-label="Stop recording"]')).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(9000); }); // past 15 s: it stops by itself
    expect(q('[role="timer"]')).toBeNull();
    expect(recorders[0].state).toBe('inactive');
    expect(q('video[aria-label="Preview of the video"]')).toBeTruthy();
    expect(tracks[0].stop).toHaveBeenCalled(); // the camera is released
    await click([...document.querySelectorAll('button')].find((b) => b.textContent?.endsWith('Use video')) ?? null);
    expect(onCapture.mock.calls[0][0].type).toBe('video/webm');
    expect(onCapture.mock.calls[0][1]).toEqual({ media: 'video', durationSec: 15 });
  });
  it('stopping early keeps the length recorded so far; closing while recording keeps nothing', async () => {
    stubMedia(null);
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'performance'] });
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: async () => ({ getTracks: () => [{ stop: () => undefined }] }) as unknown as MediaStream, enumerateDevices: async () => [] }, configurable: true });
    class FakeRecorder {
      static isTypeSupported = () => true;
      state = 'inactive'; mimeType = 'video/webm';
      ondataavailable: ((e: { data: Blob }) => void) | null = null; onstop: (() => void) | null = null;
      start() { this.state = 'recording'; }
      stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob([new Uint8Array(WEBM)]) }); this.onstop?.(); }
    }
    vi.stubGlobal('MediaRecorder', FakeRecorder);
    const ui = (open: boolean) => <CameraCapture open={open} onClose={onClose} onCapture={onCapture} mode="video" />;
    await show(ui(true));
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    await click(q('button[aria-label="Record video"]'));
    await act(async () => { await vi.advanceTimersByTimeAsync(3100); });
    await click(q('button[aria-label="Stop recording"]'));
    await click([...document.querySelectorAll('button')].find((b) => b.textContent?.endsWith('Use video')) ?? null);
    expect(onCapture.mock.calls[0][1]).toEqual({ media: 'video', durationSec: 3 });
    // record again, then close: no preview and nothing handed back
    onCapture.mockClear();
    await act(async () => { root!.render(ui(false)); });
    await act(async () => { root!.render(ui(true)); await vi.advanceTimersByTimeAsync(10); });
    await click(q('button[aria-label="Record video"]'));
    await act(async () => { root!.render(ui(false)); await vi.advanceTimersByTimeAsync(20000); });
    expect(onCapture).not.toHaveBeenCalled();
    expect(q('[role="dialog"]')).toBeNull();
  });
});
