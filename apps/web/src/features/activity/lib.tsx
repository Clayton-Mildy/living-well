// Small shared pieces for the activity screens: avatar, status badge, photo tile, labels that follow the language.
import { type CSSProperties, type ReactNode } from 'react';
import { BADGE, initials, memberName, type BadgeKey, type ClubState, type Lang, type Member, type Photo } from '@cp/shared';
import { activityName, photoActivity, fmtDuration } from '@cp/shared/rules/activity';
import { Icon, PhotoImg, TONES, FONT_BODY } from '../../components/ui';
import type { TFn } from '../../lib/i18n';
import { memberPhoto, photoFill } from '../../lib/media';

/** Member avatar as in the design's rows (initials on the member's tone). */
export function Av({ m, size = 40, fs, style }: { m: Pick<Member, 'title' | 'firstName' | 'lastName' | 'photoTone' | 'photoMediaId'>; size?: number; fs?: number | string; style?: CSSProperties }) {
  const [bg, fg] = TONES[(m.photoTone || 0) % 5];
  const photo = memberPhoto(m);
  return (
    <span aria-hidden="true" style={{ width: size, height: size, borderRadius: 999, background: photoFill(photo, bg), color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: fs ?? FONT_BODY, fontWeight: 500, flex: 'none', whiteSpace: 'nowrap', ...style }}>
      {photo ? null : initials(memberName(m))}
    </span>
  );
}

/** The design's 28px row badge (icon + label; colours from the shared BADGE table). */
export function Badge({ kind, label, bg, fg, icon, style }: { kind?: BadgeKey; label: ReactNode; bg?: string; fg?: string; icon?: string; style?: CSSProperties }) {
  const b = kind ? BADGE[kind] : undefined;
  return (
    <span style={{ height: 28, padding: '0 10px 0 6px', borderRadius: 999, background: bg ?? b?.[2], color: fg ?? b?.[1], fontSize: 'max(13px, var(--cp-small, 0px))', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, flex: 'none', whiteSpace: 'nowrap', ...style }}>
      <Icon name={icon ?? b![0]} size={18} fill={1} />
      {label}
    </span>
  );
}

/** Photo tile: the picture (the real image when there is one), time pill, play badge and duration for videos, and a marker for hidden photos or photos waiting for approval. */
export function PhotoTile({ p, onClick, aria, hiddenLabel, pendingLabel, size }: { p: Photo; onClick: () => void; aria: string; hiddenLabel?: string; pendingLabel?: string; size?: number }) {
  const marker = p.visibility === 'hidden' && hiddenLabel ? { text: hiddenLabel, icon: 'visibility_off', bg: '#282828', fg: '#FFFFFF' } : p.visibility === 'pending' && pendingLabel ? { text: pendingLabel, icon: 'hourglass_top', bg: '#F6ECD6', fg: '#7A5510' } : null;
  return (
    <button type="button" onClick={onClick} aria-label={aria} data-photo-id={p.id} className="dh30" style={{ aspectRatio: '1', width: size, borderRadius: 14, border: 'none', background: '#E8E1D8', position: 'relative', cursor: 'pointer', padding: 0, overflow: 'hidden', flex: size ? 'none' : undefined }}>
      <span aria-hidden="true" style={{ position: 'absolute', inset: 0 }}><PhotoImg photo={p} /></span>
      <span style={{ position: 'absolute', left: 6, bottom: 6, height: 24, padding: '0 8px', borderRadius: 999, background: '#FFFFFF', color: '#282828', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', fontVariantNumeric: 'tabular-nums' }}>{p.time}</span>
      {p.media === 'video' ? (
        <>
          <span aria-hidden="true" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 44, height: 44, borderRadius: 999, background: 'rgba(40,40,40,0.55)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="play_arrow" size={28} fill={1} /></span>
          {p.durationSec || !p.mediaId ? <span style={{ position: 'absolute', right: 6, bottom: 6, height: 24, padding: '0 8px', borderRadius: 999, background: '#282828', color: '#FFFFFF', fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center' }}>{fmtDuration(p.durationSec)}</span> : null}
        </>
      ) : null}
      {marker ? (
        <span style={{ position: 'absolute', left: 6, top: 6, height: 24, padding: '0 8px 0 5px', borderRadius: 999, background: marker.bg, color: marker.fg, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3, maxWidth: 'calc(100% - 12px)', whiteSpace: 'nowrap', overflow: 'hidden' }}>
          <Icon name={marker.icon} size={15} fill={1} />
          {marker.text}
        </span>
      ) : null}
    </button>
  );
}

/** Caption of a photo: the catalog activity in the current language, or the door-camera / lunch / general labels. */
export function photoCaption(s: Pick<ClubState, 'activities'>, p: Pick<Photo, 'activity' | 'kind'>, t: TFn, lang: Lang): string {
  return activityLabel(s, photoActivity(p), t, lang);
}
export function activityLabel(s: Pick<ClubState, 'activities'>, key: string, t: TFn, lang: Lang): string {
  const k = key.trim();
  const low = k.toLowerCase();
  if (low === 'arrival') return t('activity.arrivalPhoto');
  if (low === 'lunch') return t('activity.lunchPhoto');
  if (low === 'club activities') return t('activity.generalAct');
  const a = s.activities[k] ?? Object.values(s.activities).find((x) => x.name.toLowerCase() === low);
  return a ? activityName(a, lang) : k;
}
/** A moderation reason as shown to staff: a preset key, or free text ("other:…"). */
export function reasonText(reason: string | undefined, t: TFn): string {
  if (!reason) return '';
  if (reason.startsWith('other:')) return reason.slice(6).trim() || t('activity.reason.other');
  return PHOTO_REASONS.includes(reason as never) ? t('activity.reason.' + reason) : reason;
}
export const PHOTO_REASONS = ['blurry', 'wrongPerson', 'privacy', 'notFlattering', 'duplicate'] as const;

/** "{n} members in the club": one / other keys, since t() has no plurals. */
export const plural = (t: TFn, key: string, n: number, vars: Record<string, string | number> = {}) => t(`${key}_${n === 1 ? 'one' : 'other'}`, { n, ...vars });

/** The cognitive summary line of a member, with how the last logged days went. */
export function cogLine(t: TFn, c: { base: string; isDefault: boolean; quiet: number; unsettled: number; days: number }): string {
  const base = c.isDefault ? t('activity.cogAlert') : c.base;
  if (!c.days) return base;
  const bits = [c.quiet ? t('activity.quietOn', { n: c.quiet }) : '', c.unsettled ? t('activity.unsettledOn', { n: c.unsettled }) : ''].filter(Boolean);
  return base + ' · ' + (bits.length ? bits.join(', ') + ' ' + t('activity.ofLastDays', { n: c.days }) : t('activity.settledLastDays', { n: c.days }));
}
