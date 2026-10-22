// Quick camera (KC round 7, "shoot first, sort later"): a floating camera button on every page for the activity team, the kitchen and management, and the full-screen
// camera it opens. Tap the shutter for one photo, hold it for a burst (about 3 a second); Photo / Video switch (video up to 60 s); a tray of what was just shot; a gallery
// button that takes several images at once; Done. A shot never waits for the network: it appears in the tray at once and is uploaded and saved as a DRAFT in the
// background (store/quickCam.ts). Drafts are sorted out later on the Drafts screen. Without a camera (or permission) the gallery button still works.
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as RPE } from 'react';
import { createPortal } from 'react-dom';
import { BURST_GAP_MS, draftsOf } from '@cp/shared/rules/photoAi';
import { Icon, ImageLightbox, useOverlayA11y, FONT_BODY } from '../components/ui';
import { recordMime, clock } from '../components/ui/CameraCapture';
import { useT } from '../lib/i18n';
import { useMe } from '../lib/me';
import { ApiError } from '../lib/api';
import { MAX_DIM, MAX_VIDEO_SEC, downscaleImage, fitWithin, readVideoFile } from '../lib/media';
import { routerRef } from '../app/routerRef';
import { useClub } from '../store/replica';
import { useQuickCam, type QShot } from '../store/quickCam';
import { say, useUi } from '../store/ui';

/** The roles that have the quick camera. */
export const QUICK_CAMERA_ROLES = ['activity', 'mgmt', 'kitchen'] as const;
const HOLD_MS = 380;
const BURST_EVERY_MS = 330;
const BURST_MAX = 30;

export function QuickCamera({ phone }: { phone: boolean }) {
  const { role, id } = useMe();
  if (!role || !id || !(QUICK_CAMERA_ROLES as readonly string[]).includes(role)) return null;
  return (
    <>
      <QuickCameraButton phone={phone} userId={id} />
      <QuickCameraScreen userId={id} role={role} />
    </>
  );
}

function QuickCameraButton({ phone, userId }: { phone: boolean; userId: string }) {
  const t = useT();
  const s = useClub();
  const pins = useUi((st) => st.pins);
  const openCam = useQuickCam((q) => q.openCam);
  const n = useMemo(() => draftsOf(s, userId).length, [s, userId]);
  const size = phone ? 48 : 52;
  // phone: bottom right above the floating tab bar and above a page's own Pin; laptop and tablet: stacked above the Demo pill
  const pos: CSSProperties = phone ? { right: 14, bottom: `calc(${pins ? 150 : 96}px + env(safe-area-inset-bottom, 0px))` } : { right: 24, bottom: 78 };
  return (
    <button type="button" data-testid="quick-camera" onClick={openCam} aria-label={n ? t('drafts.quickN', { n }) : t('drafts.quick')} title={t('drafts.quick')} className="h-bronze cp-press"
      style={{ position: 'fixed', ...pos, zIndex: 44, width: size, height: size, borderRadius: 999, border: 'none', padding: 0, background: '#24201C', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 6px rgba(40,30,20,0.22), 0 14px 32px rgba(40,30,20,0.38)' }}>
      <Icon name="photo_camera" size={phone ? 24 : 26} fill={1} />
      {n ? <span data-testid="quick-camera-badge" aria-hidden="true" style={{ position: 'absolute', top: -4, right: -4, minWidth: 20, height: 20, padding: '0 5px', borderRadius: 999, background: '#FFFFFF', color: '#24201C', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 2px #24201C', fontVariantNumeric: 'tabular-nums' }}>{n > 99 ? '99+' : n}</span> : null}
    </button>
  );
}

type Stage = 'starting' | 'live' | 'recording' | 'fallback';

function QuickCameraScreen({ userId, role }: { userId: string; role: string }) {
  const t = useT();
  const s = useClub();
  const open = useQuickCam((q) => q.open);
  const shots = useQuickCam((q) => q.shots);
  const taken = useQuickCam((q) => q.taken);
  const [mode, setMode] = useState<'photo' | 'video'>('photo');
  const [side, setSide] = useState<'user' | 'environment'>('environment');
  const [stage, setStage] = useState<Stage>('starting');
  const [why, setWhy] = useState<'denied' | 'none' | null>(null);
  const [canFlip, setCanFlip] = useState(false);
  const [secs, setSecs] = useState(0);
  const [flash, setFlash] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const trayEnd = useRef<HTMLDivElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const tick = useRef<ReturnType<typeof setInterval>>();
  const holdT = useRef<ReturnType<typeof setTimeout>>();
  const burstT = useRef<ReturnType<typeof setInterval>>();
  const bursting = useRef(false);
  const pressed = useRef(false);
  const closeAfterStop = useRef(false);
  const last = useRef({ at: 0, key: '' });
  const mine = useMemo(() => draftsOf(s, userId).length, [s, userId]);
  const videoMode = mode === 'video';

  const stopStream = () => { stream.current?.getTracks().forEach((x) => x.stop()); stream.current = null; };
  const abortRecording = () => {
    clearInterval(tick.current);
    const r = recorder.current;
    recorder.current = null;
    if (r && r.state !== 'inactive') { r.ondataavailable = null; r.onstop = null; try { r.stop(); } catch { /* already stopped */ } }
  };
  const stopBurst = () => { clearTimeout(holdT.current); clearInterval(burstT.current); bursting.current = false; pressed.current = false; };

  // the live camera while the screen is open (a video also asks for the microphone; without it the clip is silent)
  useEffect(() => {
    if (!open) return;
    let dead = false;
    setStage('starting'); setWhy(null); setErr(null);
    const md = typeof navigator === 'undefined' ? undefined : navigator.mediaDevices;
    if (!md?.getUserMedia || (videoMode && typeof MediaRecorder === 'undefined')) { setWhy('none'); setStage('fallback'); return; }
    const size = videoMode ? { width: { ideal: 1280 }, height: { ideal: 720 } } : { width: { ideal: 1920 }, height: { ideal: 1080 } };
    const get = (audio: boolean) => md.getUserMedia({ video: { facingMode: side, ...size }, audio });
    (videoMode ? get(true).catch(() => get(false)) : get(false))
      .then(async (st) => {
        if (dead) { st.getTracks().forEach((x) => x.stop()); return; }
        stream.current = st;
        if (video.current) { video.current.srcObject = st; void video.current.play().catch(() => undefined); }
        setStage('live');
        try { setCanFlip((await md.enumerateDevices()).filter((d) => d.kind === 'videoinput').length > 1); } catch { /* keep the button hidden */ }
      })
      .catch((e: { name?: string }) => {
        if (dead) return;
        setWhy(e?.name === 'NotAllowedError' || e?.name === 'SecurityError' ? 'denied' : 'none');
        setStage('fallback');
      });
    return () => { dead = true; stopBurst(); abortRecording(); stopStream(); };
  }, [open, side, videoMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // the newest shot is always in view
  useEffect(() => { trayEnd.current?.scrollIntoView({ inline: 'end', block: 'nearest' }); }, [shots.length]);

  const finish = () => {
    const n = useQuickCam.getState().closeCam();
    stopBurst(); abortRecording(); stopStream();
    if (n > 0) say(t(`drafts.inDrafts_${n === 1 ? 'one' : 'other'}`, { n }), { icon: 'photo_camera', action: { label: t('drafts.review'), run: () => routerRef.navigate(role === 'kitchen' ? '/drafts' : '/camera') } });
  };
  const done = () => {
    if (stage === 'recording') { closeAfterStop.current = true; stopRecording(); return; } // the clip is kept: the screen closes when the recorder has finished
    finish();
  };
  const toDrafts = () => { useQuickCam.getState().closeCam(); stopBurst(); abortRecording(); stopStream(); routerRef.navigate(role === 'kitchen' ? '/drafts' : '/camera'); };
  const { ref, trap } = useOverlayA11y(open, done);

  /** A key shared by the shots taken within BURST_GAP_MS of each other (a hold, or quick taps). */
  const burstKey = () => {
    const now = Date.now();
    if (!last.current.key || now - last.current.at > BURST_GAP_MS) last.current.key = 'b' + now.toString(36);
    last.current.at = now;
    return last.current.key;
  };
  const snap = (burst: string) => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const { w, h } = fitWithin(v.videoWidth, v.videoHeight, MAX_DIM);
    const c = (canvas.current ??= document.createElement('canvas'));
    c.width = w; c.height = h;
    c.getContext('2d')?.drawImage(v, 0, 0, w, h);
    c.toBlob((b) => { if (b) useQuickCam.getState().add(b, 'photo', { burst }); }, 'image/jpeg', 0.85);
    setFlash((n) => n + 1);
    try { navigator.vibrate?.(8); } catch { /* not everywhere */ }
  };
  const down = (e: RPE<HTMLButtonElement>) => {
    if (stage !== 'live' || videoMode) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not every pointer can be captured */ }
    stopBurst();
    pressed.current = true;
    holdT.current = setTimeout(() => {
      bursting.current = true;
      let n = 1;
      snap(burstKey());
      burstT.current = setInterval(() => { if (++n > BURST_MAX) { clearInterval(burstT.current); return; } snap(burstKey()); }, BURST_EVERY_MS);
    }, HOLD_MS);
  };
  const up = (take: boolean) => {
    const wasPressed = pressed.current, wasBursting = bursting.current;
    stopBurst();
    if (take && wasPressed && !wasBursting) snap(burstKey());
  };

  /** Video: start recording from the live camera; it stops by itself at 60 seconds. */
  const record = () => {
    const st = stream.current;
    if (!st || stage !== 'live') return;
    setErr(null);
    const mime = recordMime();
    let rec: MediaRecorder;
    try { rec = new MediaRecorder(st, { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: 2_500_000 }); } catch { setErr(t('ds.recordFailed')); return; }
    const chunks: Blob[] = [];
    const t0 = performance.now();
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    rec.onerror = () => { abortRecording(); setErr(t('ds.recordFailed')); setStage('live'); };
    rec.onstop = () => {
      clearInterval(tick.current);
      recorder.current = null;
      const type = (rec.mimeType || mime || 'video/webm').split(';')[0];
      const blob = new Blob(chunks, { type });
      const dur = Math.min(MAX_VIDEO_SEC, Math.max(1, Math.round((performance.now() - t0) / 1000)));
      if (blob.size) useQuickCam.getState().add(blob, 'video', { durationSec: dur }); else setErr(t('ds.recordFailed'));
      setStage('live'); setSecs(0);
      if (closeAfterStop.current) { closeAfterStop.current = false; finish(); }
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

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true); setErr(null);
    for (const f of Array.from(files)) {
      try {
        if (videoMode) { const v = await readVideoFile(f); useQuickCam.getState().add(v.blob, 'video', { durationSec: v.durationSec }); }
        else useQuickCam.getState().add(await downscaleImage(f), 'photo');
      } catch (e) { setErr(e instanceof ApiError && e.code.startsWith('ds.') ? t(e.code, e.params) : t(videoMode ? 'ds.videoType' : 'common.mediaType')); }
    }
    setBusy(false);
    if (file.current) file.current.value = '';
  };

  if (!open) return null;
  const round: CSSProperties = { width: 56, height: 56, borderRadius: 999, border: '1px solid rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.12)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, flex: 'none' };
  const pill = (on: boolean): CSSProperties => ({ height: 34, padding: '0 14px', borderRadius: 999, border: 'none', background: on ? '#FFFFFF' : 'transparent', color: on ? '#24201C' : '#FFFFFF', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter' });
  const recording = stage === 'recording';
  const shutterRing: CSSProperties = { width: 76, height: 76, borderRadius: 999, border: '4px solid #FFFFFF', background: 'transparent', padding: 4, cursor: 'pointer', flex: 'none', touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' };

  return createPortal(
    <div ref={ref} role="dialog" aria-modal="true" aria-label={t('drafts.quick')} data-testid="quick-camera-screen" tabIndex={-1} onKeyDown={trap}
      style={{ position: 'fixed', inset: 0, zIndex: 80, background: '#1D1A16', color: '#FFFFFF', display: 'flex', flexDirection: 'column', outline: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '10px 12px', flex: 'none' }}>
        <button type="button" onClick={toDrafts} data-testid="qc-drafts" style={{ height: 38, padding: '0 14px 0 10px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.12)', color: '#FFFFFF', fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontFamily: 'Inter', flex: 'none' }}>
          <Icon name="photo_library" size={19} />{mine ? t('drafts.draftsN', { n: mine }) : t('drafts.draftsLink')}
        </button>
        <div role="group" aria-label={t('drafts.modes')} style={{ display: 'flex', padding: 3, borderRadius: 999, background: 'rgba(255,255,255,0.14)' }}>
          <button type="button" aria-pressed={!videoMode} disabled={recording} onClick={() => setMode('photo')} style={pill(!videoMode)}>{t('drafts.photoMode')}</button>
          <button type="button" aria-pressed={videoMode} disabled={recording} onClick={() => setMode('video')} style={pill(videoMode)}>{t('drafts.videoMode')}</button>
        </div>
        <button type="button" onClick={done} data-testid="qc-done" style={{ height: 38, padding: '0 18px', borderRadius: 999, border: 'none', background: '#FFFFFF', color: '#24201C', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter', flex: 'none' }}>{t('drafts.doneBtn')}</button>
      </div>

      <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {stage !== 'fallback' ? (
          <video ref={video} playsInline muted autoPlay aria-label={t('common.camera')} style={{ width: '100%', height: '100%', objectFit: 'contain', transform: side === 'user' ? 'scaleX(-1)' : undefined, visibility: stage === 'live' || recording ? 'visible' : 'hidden' }} />
        ) : null}
        {stage === 'starting' ? <div role="status" style={{ position: 'absolute', fontSize: FONT_BODY, color: '#E8E1D8' }}>{t('common.cameraStarting')}</div> : null}
        {flash ? <div key={flash} aria-hidden="true" style={{ position: 'absolute', inset: 0, background: '#FFFFFF', opacity: 0, pointerEvents: 'none', animation: 'cpFlash .22s ease-out' }} /> : null}
        {recording ? (
          <div role="timer" aria-label={t('ds.recordingTime', { s: Math.floor(secs), max: MAX_VIDEO_SEC })} style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', height: 36, padding: '0 14px', borderRadius: 12, background: 'rgba(0,0,0,0.55)', color: '#FFFFFF', fontSize: 17, fontWeight: 600, fontVariantNumeric: 'tabular-nums', display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
            <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 999, background: '#E5484D' }} />{clock(secs)} / {clock(MAX_VIDEO_SEC)}
          </div>
        ) : null}
        {recording ? <div aria-hidden="true" style={{ position: 'absolute', left: 0, bottom: 0, height: 5, width: `${(secs / MAX_VIDEO_SEC) * 100}%`, background: '#E5484D' }} /> : null}
        {stage === 'fallback' ? (
          <div style={{ maxWidth: 340, padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
            <Icon name={why === 'denied' ? 'no_photography' : 'photo_camera'} size={48} color="#CAB8A2" />
            <div role="status" style={{ fontSize: 16, lineHeight: '24px' }}>{why === 'denied' ? t(videoMode ? 'ds.cameraDeniedVideo' : 'common.cameraDenied') : t('drafts.noCamera')}</div>
          </div>
        ) : null}
        {busy ? <div role="status" style={{ position: 'absolute', bottom: 12, fontSize: FONT_BODY, color: '#E8E1D8' }}>{t(videoMode ? 'ds.processingVideo' : 'common.processing')}</div> : null}
        {err ? <div role="alert" style={{ position: 'absolute', bottom: 12, padding: '8px 14px', borderRadius: 8, background: '#F9E3DB', color: '#9A3D24', fontSize: FONT_BODY, maxWidth: 'calc(100% - 24px)' }}>{err}</div> : null}
      </div>

      <div data-testid="qc-tray" role="list" aria-label={t('drafts.tray')} style={{ flex: 'none', height: 66, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', overflowX: 'auto', scrollbarWidth: 'none' }}>
        <span data-testid="qc-count" aria-label={t('drafts.taken', { n: taken })} style={{ flex: 'none', minWidth: 30, height: 30, padding: '0 8px', borderRadius: 999, background: taken ? '#FFFFFF' : 'rgba(255,255,255,0.14)', color: taken ? '#24201C' : '#CAB8A2', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontVariantNumeric: 'tabular-nums' }}>{taken}</span>
        {shots.length ? shots.map((x) => <Thumb key={x.key} shot={x} />) : <span style={{ fontSize: 13, color: '#CAB8A2' }}>{t(videoMode ? 'drafts.hintVideo' : 'drafts.hint')}</span>}
        <div ref={trayEnd} style={{ flex: 'none', width: 1, height: 1 }} />
      </div>

      <div style={{ flex: 'none', padding: '8px 16px calc(18px + env(safe-area-inset-bottom, 0px))', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 22, minHeight: 100 }}>
        <button type="button" aria-label={t('drafts.gallery')} title={t('drafts.gallery')} data-testid="qc-gallery" onClick={() => file.current?.click()} disabled={recording} style={round}><Icon name={videoMode ? 'video_library' : 'photo_library'} size={24} /></button>
        {videoMode ? (
          <button type="button" aria-label={recording ? t('ds.stopRecording') : t('ds.recordVideo')} onClick={recording ? stopRecording : record} disabled={stage !== 'live' && !recording} style={{ ...shutterRing, opacity: stage === 'live' || recording ? 1 : 0.4 }}>
            <span style={{ display: 'block', width: '100%', height: '100%', borderRadius: recording ? 14 : 999, background: '#E5484D', transform: recording ? 'scale(.55)' : 'none', transition: 'transform .15s, border-radius .15s' }} />
          </button>
        ) : (
          <button type="button" data-testid="qc-shutter" aria-label={t('drafts.shutter')} disabled={stage !== 'live'}
            onPointerDown={down} onPointerUp={() => up(true)} onPointerCancel={() => up(false)} onContextMenu={(e) => e.preventDefault()}
            onClick={(e) => { if (e.detail === 0 && stage === 'live') snap(burstKey()); }} // a keyboard or screen-reader press (a touch or mouse press is handled above)
            style={{ ...shutterRing, opacity: stage === 'live' ? 1 : 0.4 }}>
            <span style={{ display: 'block', width: '100%', height: '100%', borderRadius: 999, background: '#FFFFFF' }} />
          </button>
        )}
        {canFlip && !recording ? <button type="button" aria-label={t('common.switchCamera')} title={t('common.switchCamera')} onClick={() => setSide((v) => (v === 'user' ? 'environment' : 'user'))} style={round}><Icon name="cameraswitch" size={24} /></button> : <span style={{ width: 56, flex: 'none' }} />}
        <input ref={file} type="file" multiple accept={videoMode ? 'video/*' : 'image/jpeg,image/png,image/webp,image/*'} aria-hidden="true" className="sr-only" tabIndex={-1} onChange={(e) => void onFiles(e.target.files)} />
      </div>
    </div>,
    document.body,
  );
}

/** One shot in the tray: a thumbnail with a spinner while it is on its way, and a retry when the upload failed. */
function Thumb({ shot }: { shot: QShot }) {
  const t = useT();
  const retry = useQuickCam((q) => q.retry);
  const failed = shot.state === 'failed';
  const [full, setFull] = useState(false); // round 13: a tap on a shot opens it full size (a failed one still retries)
  return (
    <>
    <button type="button" role="listitem" data-shot={shot.key} data-state={shot.state} onClick={failed ? () => retry(shot.key) : () => setFull(true)} aria-label={failed ? t('drafts.retry') : shot.state === 'uploading' ? t('drafts.uploading') : t('drafts.saved1')}
      style={{ position: 'relative', flex: 'none', width: 50, height: 50, borderRadius: 10, overflow: 'hidden', border: failed ? '2px solid #E5484D' : '1px solid rgba(255,255,255,0.3)', padding: 0, background: '#2E2924', cursor: failed ? 'pointer' : 'zoom-in' }}>
      {shot.media === 'video'
        ? <video src={`${shot.url}#t=0.1`} muted playsInline preload="metadata" aria-hidden="true" tabIndex={-1} style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
        : <img src={shot.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
      {shot.state === 'uploading' ? <span aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'rgba(29,26,22,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="progress_activity" size={22} color="#FFFFFF" style={{ animation: 'cpSpin 0.9s linear infinite' }} /></span> : null}
      {failed ? <span aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'rgba(29,26,22,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="refresh" size={22} color="#FFFFFF" /></span> : null}
      {shot.media === 'video' ? <span aria-hidden="true" style={{ position: 'absolute', left: 3, bottom: 3, color: '#FFFFFF' }}><Icon name="videocam" size={14} fill={1} /></span> : null}
    </button>
    {full ? <ImageLightbox src={shot.url} kind={shot.media === 'video' ? 'video' : 'image'} alt={t('drafts.saved1')} onClose={() => setFull(false)} /> : null}
    </>
  );
}
