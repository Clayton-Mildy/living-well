// PhotoImg: the real picture (or video) when the photo has a mediaId, otherwise the design's tone placeholder.
import { useEffect, useState, type CSSProperties } from 'react';
import type { Photo } from '@cp/shared';
import { mediaUrl } from '../../lib/media';
import { photoBg } from './index';

/**
 * Fills its parent (or a square of `size`). Put it inside the tile that already has the radius and overflow:hidden, or pass `radius`.
 * A real video (`media: 'video'` with a `mediaId`) renders a <video>: with `controls` it is the player (`<video controls playsInline>`, used by the viewer);
 * without, it is a muted still frame for a tile (no controls and no pointer events, so the tile's own button stays the tap target).
 */
export function PhotoImg({ photo, size, alt = '', radius, style, controls = false }: { photo: Pick<Photo, 'mediaId' | 'tone'> & { media?: Photo['media'] }; size?: number | string; alt?: string; radius?: number | string; style?: CSSProperties; controls?: boolean }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [photo.mediaId]);
  const box: CSSProperties = { display: 'block', width: size ?? '100%', height: size ?? '100%', borderRadius: radius, background: photoBg(photo.tone), objectFit: 'cover', ...style };
  if (photo.mediaId && !broken && photo.media === 'video') {
    return controls
      ? <video key={photo.mediaId} src={mediaUrl(photo.mediaId)} controls playsInline preload="metadata" aria-label={alt || undefined} onError={() => setBroken(true)} style={{ ...box, objectFit: 'contain', background: '#000000' }} />
      : <video key={photo.mediaId} src={`${mediaUrl(photo.mediaId)}#t=0.1`} muted playsInline preload="metadata" aria-hidden={true} tabIndex={-1} onError={() => setBroken(true)} style={{ ...box, pointerEvents: 'none' }} />;
  }
  if (photo.mediaId && !broken) return <img src={mediaUrl(photo.mediaId)} alt={alt} loading="lazy" decoding="async" onError={() => setBroken(true)} style={box} />;
  return <span role={alt ? 'img' : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true} style={box} />;
}
