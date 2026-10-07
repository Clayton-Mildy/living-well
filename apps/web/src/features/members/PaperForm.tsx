// Registration is on paper: the signed form is photographed (CameraCapture) or chosen as an image or a PDF, uploaded to /api/media,
// and kept as the member's document. This file has the picker (used by Add member, joining a lead and the Docs tab) and the viewer.
import { useRef, useState, type ReactNode } from 'react';
import { hasKey, type MemberDocument } from '@cp/shared';
import { Button, CameraCapture, Dialog, Icon, Note } from '../../components/ui';
import { ApiError } from '../../lib/api';
import { useT } from '../../lib/i18n';
import { isPdfName, mediaUrl, uploadDocument } from '../../lib/media';
import { say } from '../../store/ui';

/** What an upload gives back: store both on the document. */
export interface PaperFile { mediaId: string; fileName: string }

/** Take a photo or choose a file, upload it, and hand over the media id. Render `node` once next to the buttons. */
export function useDocPicker(onFile: (f: PaperFile) => void | Promise<unknown>, photoName = 'registration-form') {
  const t = useT();
  const [camera, setCamera] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const send = async (blob: Blob, name: string) => {
    setBusy(true);
    try {
      await onFile(await uploadDocument(blob, name));
    } catch (e) {
      say(e instanceof ApiError && hasKey(e.code) ? t(e.code) : t('profile.paperFailed'), { tone: 'error', icon: 'error' });
    } finally {
      setBusy(false);
    }
  };
  const node: ReactNode = (
    <>
      <input ref={input} type="file" accept="image/*,application/pdf" hidden data-testid="doc-file" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void send(f, f.name); }} />
      {camera ? <CameraCapture open onClose={() => setCamera(false)} onCapture={(b) => { setCamera(false); void send(b, photoName); }} facing="environment" allowUpload /> : null}
    </>
  );
  return { busy, takePhoto: () => setCamera(true), chooseFile: () => input.current?.click(), node };
}

/** The required "signed registration form" field of Add member and of joining a lead. */
export function PaperFormField({ value, onChange, error }: { value: PaperFile | null; onChange: (f: PaperFile | null) => void; error?: string }) {
  const t = useT();
  const pick = useDocPicker((f) => onChange(f));
  return (
    <div data-testid="paper-form" role="group" aria-label={t('profile.paperTitle')} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {value ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, lineHeight: '22px', color: '#3D6B4F', fontWeight: 500, minWidth: 0 }}>
          <Icon name="check_circle" size={20} fill={1} />
          <span style={{ overflowWrap: 'anywhere' }}>{t('profile.paperAttached', { f: value.fileName })}</span>
        </div>
      ) : null}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <Button variant="secondary" size={44} icon="photo_camera" disabled={pick.busy} onClick={pick.takePhoto}>{pick.busy ? t('profile.paperUploading') : t('profile.paperPhoto')}</Button>
        <Button variant="secondary" size={44} icon="upload_file" disabled={pick.busy} onClick={pick.chooseFile}>{t('profile.paperFile')}</Button>
        {value && !pick.busy ? <Button variant="ghost" size={44} onClick={() => onChange(null)}>{t('profile.paperRemove')}</Button> : null}
      </div>
      {error ? <Note tone="rust" icon="error">{error}</Note> : null}
      {pick.node}
    </div>
  );
}

/** View a document: a PDF opens in a new tab, an image opens in a viewer. A document without an upload is a paper copy kept at the club. */
export function DocView({ doc, title, children }: { doc: MemberDocument; title: string; children: (open: () => void) => ReactNode }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  if (!doc.mediaId) return null;
  const url = mediaUrl(doc.mediaId);
  const go = () => { if (isPdfName(doc.fileName)) window.open(url, '_blank', 'noopener'); else setOpen(true); };
  return (
    <>
      {children(go)}
      <Dialog open={open} onClose={() => setOpen(false)} title={title} eyebrow={doc.fileName} maxWidth={760}
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>{t('common.close')}</Button><Button icon="open_in_new" onClick={() => window.open(url, '_blank', 'noopener')}>{t('profile.paperOpenNew')}</Button></>}>
        <img src={url} alt={title} data-testid="doc-image" style={{ display: 'block', width: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: 10, background: '#F3EEE8' }} />
      </Dialog>
    </>
  );
}
