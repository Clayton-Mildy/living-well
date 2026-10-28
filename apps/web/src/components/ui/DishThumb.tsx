// Round 15: a dish's (or a day's lunch) picture as a small rounded thumbnail; a tap opens it full size (unless `plain`). Nothing is drawn when there is no picture.
import { mediaUrl } from '../../lib/media';
import { ImageOpen } from './ImageLightbox';

export function DishThumb({ mediaId, label, size = 40, testId = 'dish-thumb', source, plain }: { mediaId?: string | null; /** the accessible name of the open button, and the image's alt */ label: string; size?: number; testId?: string; /** 'lunch' or 'dish', for the tests */ source?: string; /** inside a button already: no tap-to-open of its own */ plain?: boolean }) {
  if (!mediaId) return null;
  const src = mediaUrl(mediaId);
  return (
    <ImageOpen disabled={plain} src={src} alt={label} label={label} style={{ borderRadius: Math.round(size / 4), overflow: 'hidden', flex: 'none' }}>
      <img src={src} alt="" loading="lazy" decoding="async" data-testid={testId} data-media={mediaId} data-source={source}
        style={{ display: 'block', width: size, height: size, borderRadius: Math.round(size / 4), objectFit: 'cover', background: 'var(--fill, #F4F4F5)' }} />
    </ImageOpen>
  );
}
