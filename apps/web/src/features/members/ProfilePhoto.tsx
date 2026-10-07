// A member's profile picture: take one with the camera or choose a file (CameraCapture does both), or remove it.
// Used in Add member and Edit details, and on its own when the avatar at the top of the profile is tapped.
import { useState } from 'react';
import { hasKey, memberName, type Member } from '@cp/shared';
import { Avatar, Button, CameraCapture, Sheet } from '../../components/ui';
import { ApiError } from '../../lib/api';
import { useAct } from '../../lib/act';
import { useT } from '../../lib/i18n';
import { mediaUrl, uploadMedia } from '../../lib/media';
import { say } from '../../store/ui';

/** Avatar preview with "Take or choose a photo" and "Remove photo". `value` is the media id. */
export function ProfilePhotoField({ name, tone, value, onChange, size = 72 }: { name: string; tone?: number; value: string | null; onChange: (id: string | null) => void; size?: number }) {
  const t = useT();
  const [camera, setCamera] = useState(false);
  const [busy, setBusy] = useState(false);
  const take = async (blob: Blob) => {
    setCamera(false);
    setBusy(true);
    try {
      onChange(await uploadMedia(blob));
    } catch (e) {
      say(e instanceof ApiError && hasKey(e.code) ? t(e.code) : t('profile.photoUploadFailed'), { tone: 'error', icon: 'error' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div data-testid="profile-photo" style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
      <Avatar name={name.trim() || '?'} tone={tone} size={size} src={value ? mediaUrl(value) : undefined} ring />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button variant="secondary" size={44} icon="photo_camera" disabled={busy} onClick={() => setCamera(true)}>{busy ? t('profile.photoUploading') : value ? t('profile.photoChange') : t('profile.photoAdd')}</Button>
        {value && !busy ? <Button variant="ghost" size={44} onClick={() => onChange(null)}>{t('profile.photoRemove')}</Button> : null}
      </div>
      {camera ? <CameraCapture open onClose={() => setCamera(false)} onCapture={(b) => void take(b)} facing="environment" allowUpload /> : null}
    </div>
  );
}

/** Tapping the avatar on the profile: change the picture right away (the front desk's change goes to management first, like other details). */
export function ProfilePhotoSheet({ m, open, onClose }: { m: Member; open: boolean; onClose: () => void }) {
  const t = useT();
  const act = useAct();
  const [busy, setBusy] = useState(false);
  const set = async (id: string | null) => {
    if (busy) return;
    setBusy(true);
    const r = await act('members.updateDetails', { memberId: m.id, patch: { photoMediaId: id } }, { ok: id ? t('profile.photoSet', { n: memberName(m) }) : t('profile.photoRemoved', { n: memberName(m) }), reviewText: t('profile.sentForReview') });
    setBusy(false);
    if (r.ok) onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title={t('profile.photoTitle')} maxWidth={480}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <ProfilePhotoField name={memberName(m)} tone={m.photoTone} value={m.photoMediaId ?? null} onChange={(id) => void set(id)} size={96} />
      </div>
    </Sheet>
  );
}
