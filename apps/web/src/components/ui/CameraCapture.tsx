// CameraCapture: a real camera (getUserMedia: localhost and HTTPS). Photo mode: shutter, retake, use photo.
// Video mode: record from the camera (with sound when the microphone is allowed) for up to 15 seconds with a visible timer, stop, preview, retake or use.
// With no camera, no permission, no MediaRecorder or no secure context it falls back to a file picker (images, or video/*), so the same flow always works.
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../../lib/i18n';
import { ApiError } from '../../lib/api';
import { downscaleImage, MAX_DIM, MAX_VIDEO_SEC, fitWithin, readVideoFile } from '../../lib/media';
import { FONT_BODY, Icon, IconButton, useOverlayA11y } from './index';

type Stage = 'starting' | 'live' | 'recording' | 'review' | 'fallback';
type Why = 'denied' | 'none' | null;
/** What came back with the blob: a photo is a JPEG no larger than 1600px; a video is WebM or MP4 (up to 15 s, 25 MB). */
export interface CaptureInfo { media: 'photo' | 'video'; durationSec?: number }
type Shot = { blob: Blob; url: string; media: 'photo' | 'video'; durationSec?: number };

/** The first video format this browser can record (WebM in Chrome and Firefox, MP4 in Safari). */
const recordMime = () => ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4;codecs=avc1,mp4a', 'video/mp4'].find((m) => { try { return MediaRecorder.isTypeSupported(m); } catch { return false; } });
const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec) % 60).padStart(2, '0')}`;

export function CameraCapture({ open, onClose, onCapture, facing = 'environment', allowUpload = true, mode = 'photo' }: {
  open: boolean;
  onClose: () => void;
  /** photo mode: a JPEG no larger than 1600px; video mode: a WebM or MP4 (see `info`). Pass the blob to uploadMedia(). */
  onCapture: (blob: Blob, info?: CaptureInfo) => void;
  facing?: 'user' | 'environment';
  /** also offer "Upload a photo" next to the shutter (always on when there is no camera) */
  allowUpload?: boolean;
  /** 'video': record up to 15 seconds instead of taking a photo */
  mode?: 'photo' | 'video';
}) {
  const t = useT();
  const { ref, trap } = useOverlayA11y(open, onClose);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>('starting');
  const [why, setWhy] = useState<Why>(null);
  const [side, setSide] = useState(facing);
  const [attempt, setAttempt] = useState(0);
  const [shot, setShot] = useState<Shot | null>(null);
  const [secs, setSecs] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const tick = useRef<ReturnType<typeof setInterval>>();
  const video_ = mode === 'video';
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [canFlip, setCanFlip] = useState(false);

  const stop = useCallback(() => { stream.current?.getTracks().forEach((x) => x.stop()); stream.current = null; }, []);
  /** Drop a recording in progress (closing, retaking, unmounting): nothing is kept. */
  const abort = useCallback(() => {
    clearInterval(tick.current);
    const r = recorder.current;
    recorder.current = null;
    if (r && r.state !== 'inactive') { r.ondataavailable = null; r.onstop = null; try { r.stop(); } catch { /* already stopped */ } }
  }, []);
  const setPhoto = useCallback((blob: Blob | null, media: 'photo' | 'video' = 'photo', durationSec?: number) => setShot((old) => { if (old) URL.revokeObjectURL(old.url); return blob ? { blob, url: URL.createObjectURL(blob), media, durationSec } : null; }), []);

  // closing resets everything, so the next open starts at the live camera
  useEffect(() => {
    if (open) return;
    abort(); setSecs(0);
    setPhoto(null); setErr(null); setBusy(false); setWhy(null); setSide(facing); setStage('starting');
  }, [open, facing, setPhoto, abort]);

  // run the camera while it is open and no photo is being reviewed
  useEffect(() => {
    if (!open) return;
    let dead = false;
    const md = typeof navigator === 'undefined' ? undefined : navigator.mediaDevices;
    if (!md?.getUserMedia || (video_ && typeof MediaRecorder === 'undefined')) { setWhy('none'); setStage('fallback'); return; }
    const size = video_ ? { width: { ideal: 1280 }, height: { ideal: 720 } } : { width: { ideal: 1920 }, height: { ideal: 1080 } };
    const get = (audio: boolean) => md.getUserMedia({ video: { facingMode: side, ...size }, audio });
    // a video has sound when the microphone is allowed; without it the clip is silent
    (video_ ? get(true).catch(() => get(false)) : get(false))
      .then(async (s) => {
        if (dead) { s.getTracks().forEach((x) => x.stop()); return; }
        stream.current = s;
        if (video.current) { video.current.srcObject = s; void video.current.play().catch(() => undefined); }
        setStage('live');
        try { setCanFlip((await md.enumerateDevices()).filter((d) => d.kind === 'videoinput').length > 1); } catch { /* keep the button hidden */ }
      })
      .catch((e: { name?: string }) => {
        if (dead) return;
        setWhy(e?.name === 'NotAllowedError' || e?.name === 'SecurityError' ? 'denied' : 'none');
        setStage('fallback');
      });
    return () => { dead = true; abort(); stop(); };
  }, [open, attempt, side, stop, abort, video_]);

  useEffect(() => () => { abort(); stop(); setShot((old) => { if (old) URL.revokeObjectURL(old.url); return null; }); }, [stop, abort]);

  if (!open) return null;

  const snap = () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const { w, h } = fitWithin(v.videoWidth, v.videoHeight, MAX_DIM);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d')?.drawImage(v, 0, 0, w, h);
    c.toBlob((b) => { if (!b) return; setPhoto(b); stop(); setStage('review'); }, 'image/jpeg', 0.85);
  };
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true); setErr(null);
    try {
      if (video_) { const v = await readVideoFile(f); setPhoto(v.blob, 'video', v.durationSec); }
      else setPhoto(await downscaleImage(f));
      stop(); setStage('review');
    }
    catch (e) { setErr(e instanceof ApiError && e.code.startsWith('ds.') ? t(e.code, e.params) : t(video_ ? 'ds.videoType' : 'common.mediaType')); }
    finally { setBusy(false); if (file.current) file.current.value = ''; }
  };
  const retake = () => { abort(); setPhoto(null); setErr(null); setSecs(0); setStage('starting'); setAttempt((a) => a + 1); };
  const use = () => { if (!shot) return; onCapture(shot.blob, { media: shot.media, ...(shot.durationSec ? { durationSec: shot.durationSec } : {}) }); onClose(); };

  /** Start recording from the live camera; it stops by itself at 15 seconds. */
  const record = () => {
    const s = stream.current;
    if (!s || stage !== 'live') return;
    setErr(null);
    const mime = recordMime();
    let rec: MediaRecorder;
    try { rec = new MediaRecorder(s, { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: 2_500_000 }); }
    catch { setErr(t('ds.recordFailed')); return; }
    const chunks: Blob[] = [];
    const t0 = performance.now();
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    rec.onerror = () => { abort(); setErr(t('ds.recordFailed')); setStage('live'); };
    rec.onstop = () => {
      clearInterval(tick.current);
      recorder.current = null;
      const type = (rec.mimeType || mime || 'video/webm').split(';')[0];
      const blob = new Blob(chunks, { type });
      const dur = Math.min(MAX_VIDEO_SEC, Math.max(1, Math.round((performance.now() - t0) / 1000)));
      if (!blob.size) { setErr(t('ds.recordFailed')); setStage('starting'); setAttempt((a) => a + 1); return; }
      setPhoto(blob, 'video', dur); stop(); setStage('review');
    };
    recorder.current = rec;
    setSecs(0);
    rec.start(500);
    setStage('recording');
    tick.current = setInterval(() => {
      const sec = (performance.now() - t0) / 1000;
      setSecs(Math.min(sec, MAX_VIDEO_SEC));
      if (sec >= MAX_VIDEO_SEC) { clearInterval(tick.current); if (rec.state !== 'inactive') rec.stop(); }
    }, 200);
  };
  const stopRecording = () => { clearInterval(tick.current); const r = recorder.current; if (r && r.state !== 'inactive') r.stop(); };

  const round = { width: 56, height: 56, borderRadius: 999, border: '1px solid rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.12)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, flex: 'none' } as const;
  const pill = (primary: boolean) => ({ height: 52, padding: '0 24px', borderRadius: 999, border: primary ? 'none' : '1px solid rgba(255,255,255,0.45)', background: primary ? '#FFFFFF' : 'transparent', color: primary ? '#282828' : '#FFFFFF', fontSize: 17, fontWeight: 500, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', fontFamily: 'Inter' }) as const;
  const picker = (
    <input ref={file} type="file" accept={video_ ? 'video/*' : 'image/jpeg,image/png,image/webp,image/*'} aria-hidden="true" className="sr-only" tabIndex={-1} onChange={(e) => void onFile(e.target.files?.[0])} />
  );
  const choose = (primary: boolean, label: string) => (
    <button type="button" onClick={() => file.current?.click()} disabled={busy} style={pill(primary)}><Icon name={video_ ? 'video_library' : 'photo_library'} size={22} />{label}</button>
  );

  return createPortal(
    <div ref={ref} role="dialog" aria-modal="true" aria-label={t('common.camera')} tabIndex={-1} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; } trap(e); }}
      style={{ position: 'fixed', inset: 0, zIndex: 80, background: '#1D1A16', color: '#FFFFFF', display: 'flex', flexDirection: 'column', outline: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', flex: 'none' }}>
        <span style={{ fontSize: 18, fontWeight: 500 }}>{t('common.camera')}</span>
        <IconButton icon="close" label={t('common.close')} onClick={onClose} bordered={false} color="#FFFFFF" />
      </div>
      <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {stage !== 'review' && stage !== 'fallback' ? (
          <video ref={video} playsInline muted autoPlay aria-label={t('common.camera')} style={{ width: '100%', height: '100%', objectFit: 'contain', transform: side === 'user' ? 'scaleX(-1)' : undefined, visibility: stage === 'live' || stage === 'recording' ? 'visible' : 'hidden' }} />
        ) : null}
        {stage === 'starting' ? <div role="status" style={{ position: 'absolute', fontSize: FONT_BODY, color: '#E8E1D8' }}>{t('common.cameraStarting')}</div> : null}
        {stage === 'recording' ? (
          <div role="timer" aria-label={t('ds.recordingTime', { s: Math.floor(secs), max: MAX_VIDEO_SEC })} style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', height: 36, padding: '0 14px', borderRadius: 999, background: 'rgba(0,0,0,0.55)', color: '#FFFFFF', fontSize: 17, fontWeight: 600, fontVariantNumeric: 'tabular-nums', display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
            <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 999, background: '#E5484D' }} />{clock(secs)} / {clock(MAX_VIDEO_SEC)}
          </div>
        ) : null}
        {stage === 'recording' ? <div aria-hidden="true" style={{ position: 'absolute', left: 0, bottom: 0, height: 5, width: `${(secs / MAX_VIDEO_SEC) * 100}%`, background: '#E5484D' }} /> : null}
        {stage === 'review' && shot ? (shot.media === 'video'
          ? <video src={shot.url} controls playsInline preload="metadata" aria-label={t('ds.videoPreview')} style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000000' }} />
          : <img src={shot.url} alt={t('common.photoPreview')} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />) : null}
        {stage === 'fallback' ? (
          <div style={{ maxWidth: 360, padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
            <Icon name={video_ ? (why === 'denied' ? 'videocam_off' : 'videocam') : why === 'denied' ? 'no_photography' : 'photo_camera'} size={48} color="#CAB8A2" />
            <div role="status" style={{ fontSize: 16, lineHeight: '24px' }}>{video_ ? (why === 'denied' ? t('ds.cameraDeniedVideo') : t('ds.cameraNoneVideo')) : why === 'denied' ? t('common.cameraDenied') : t('common.cameraNone')}</div>
            {choose(true, t(video_ ? 'ds.chooseVideo' : 'common.choosePhoto'))}
          </div>
        ) : null}
        {busy ? <div role="status" style={{ position: 'absolute', bottom: 16, fontSize: FONT_BODY, color: '#E8E1D8' }}>{t(video_ ? 'ds.processingVideo' : 'common.processing')}</div> : null}
        {err ? <div role="alert" style={{ position: 'absolute', bottom: 16, padding: '8px 14px', borderRadius: 12, background: '#F7E4DD', color: '#AF4B2F', fontSize: FONT_BODY }}>{err}</div> : null}
      </div>
      <div style={{ flex: 'none', padding: '16px 16px calc(20px + env(safe-area-inset-bottom, 0px))', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, minHeight: 104 }}>
        {stage === 'review' ? (
          <>
            <button type="button" onClick={retake} style={pill(false)}><Icon name="refresh" size={22} />{t('common.retake')}</button>
            <button type="button" onClick={use} style={pill(true)}><Icon name="check" size={22} />{t(shot?.media === 'video' ? 'ds.useVideo' : 'common.usePhoto')}</button>
          </>
        ) : stage === 'live' ? (
          <>
            {allowUpload ? <button type="button" aria-label={t(video_ ? 'ds.uploadVideoInstead' : 'common.uploadInstead')} title={t(video_ ? 'ds.uploadVideoInstead' : 'common.uploadInstead')} onClick={() => file.current?.click()} style={round}><Icon name={video_ ? 'video_library' : 'photo_library'} size={24} /></button> : <span style={{ width: 56 }} />}
            {video_ ? (
              <button type="button" aria-label={t('ds.recordVideo')} onClick={record} style={{ width: 76, height: 76, borderRadius: 999, border: '4px solid #FFFFFF', background: 'transparent', padding: 4, cursor: 'pointer', flex: 'none' }}>
                <span style={{ display: 'block', width: '100%', height: '100%', borderRadius: 999, background: '#E5484D' }} />
              </button>
            ) : (
              <button type="button" aria-label={t('common.takePhoto')} onClick={snap} style={{ width: 76, height: 76, borderRadius: 999, border: '4px solid #FFFFFF', background: 'transparent', padding: 4, cursor: 'pointer', flex: 'none' }}>
                <span style={{ display: 'block', width: '100%', height: '100%', borderRadius: 999, background: '#FFFFFF' }} />
              </button>
            )}
            {canFlip ? <button type="button" aria-label={t('common.switchCamera')} title={t('common.switchCamera')} onClick={() => setSide((s) => (s === 'user' ? 'environment' : 'user'))} style={round}><Icon name="cameraswitch" size={24} /></button> : <span style={{ width: 56 }} />}
          </>
        ) : stage === 'recording' ? (
          <button type="button" aria-label={t('ds.stopRecording')} onClick={stopRecording} style={{ width: 76, height: 76, borderRadius: 999, border: '4px solid #FFFFFF', background: 'transparent', padding: 4, cursor: 'pointer', flex: 'none' }}>
            <span style={{ display: 'block', width: '100%', height: '100%', borderRadius: 999, background: '#FFFFFF', position: 'relative' }}><span style={{ position: 'absolute', inset: '30%', borderRadius: 6, background: '#E5484D' }} /></span>
          </button>
        ) : null}
        {picker}
      </div>
    </div>,
    document.body,
  );
}
