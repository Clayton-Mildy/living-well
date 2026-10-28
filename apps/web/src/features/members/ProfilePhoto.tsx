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

/** A carer's round picture (the initials when there is none); a tap opens it full size, inside a list row too (KC 28 Oct). */
export function NannyAvatar({ nanny, size }: { nanny: NonNullable<Member['nanny']>; size: number }) {
  return <Avatar name={nanny.name} size={size} src={nanny.photoMediaId ? mediaUrl(nanny.photoMediaId) : undefined} />;
}

/** round 15 follow-up: the carer on a list row, right after the member's name on the name line: "(face) Nanny · Mbak Sari" in the muted 12 px style. Plain, because the whole row is already a button.
 * It shrinks (and truncates) long before the member's name does. */
/** The member's nanny on a row's name line. `phone`: the chip sits at the right of the line and drops to its own line (still on the right) when the name is long, so neither is cut to "N…". */
export function NannyLine({ nanny, phone }: { nanny: NonNullable<Member['nanny']>; phone?: boolean }) {
  const t = useT();
  return (
    <span data-testid="row-nanny" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flex: phone ? '0 1 auto' : '0 100 auto', marginLeft: phone ? 'auto' : undefined, maxWidth: '100%', minWidth: 0, fontSize: 12, lineHeight: '18px', fontWeight: 400, color: '#6B6259' }}>
      <span style={{ display: 'inline-flex', flex: 'none' }}><NannyAvatar nanny={nanny} size={22} /></span>
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t('lobby.nannyLine', { n: nanny.name })}</span>
    </span>
  );
}

/** Avatar preview with "Take or choose a photo" and "Remove photo". `value` is the media id. */
export function ProfilePhotoField({ name, tone, value, onChange, size = 72, upload = uploadMedia }: { name: string; tone?: number; value: string | null; onChange: (id: string | null) => void; size?: number; /** where the picture goes (the family's form has its own route) */ upload?: (blob: Blob) => Promise<string> }) {
  const t = useT();
  const [camera, setCamera] = useState(false);
  const [busy, setBusy] = useState(false);
  const take = async (blob: Blob) => {
    setCamera(false);
    setBusy(true);
    try {
      onChange(await upload(blob));
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

/** KC 28 Oct: the carer's picture, from the carer card (front desk and management); it is part of the member's details, so the front desk's change goes to management first. */
export function NannyPhotoSheet({ m, open, onClose }: { m: Member; open: boolean; onClose: () => void }) {
  const t = useT();
  const act = useAct();
  const [busy, setBusy] = useState(false);
  if (!m.nanny) return null;
  const nanny = m.nanny;
  const set = async (id: string | null) => {
    if (busy) return;
    setBusy(true);
    const { photoMediaId: _old, ...rest } = nanny;
    const r = await act('members.updateDetails', { memberId: m.id, patch: { nanny: { ...rest, ...(id ? { photoMediaId: id } : {}) } } },
      { ok: id ? t('profile.nannyPhotoSet', { n: nanny.name }) : t('profile.nannyPhotoRemoved', { n: nanny.name }), reviewText: t('profile.sentForReview') });
    setBusy(false);
    if (r.ok) onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title={t('profile.nannyPhotoTitle')} maxWidth={480}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <ProfilePhotoField name={nanny.name} value={nanny.photoMediaId ?? null} onChange={(id) => void set(id)} size={96} />
      </div>
    </Sheet>
  );
}
