// The proof of a payment recorded by hand (the transfer slip or the signed receipt): a small thumbnail that opens it.
// A photo opens in the viewer (ImageLightbox); a PDF opens in a new tab. A payment from before round 18 has no `proofKind`:
// the server is asked once (HEAD /api/media/:id, the content type) and the answer is remembered for the session.
import { useEffect, useState } from 'react';
import { ImageLightbox, PhotoImg } from '../../components/ui';
import { useT } from '../../lib/i18n';
import { mediaUrl } from '../../lib/media';

type Kind = 'image' | 'pdf';
const kinds = new Map<string, Promise<Kind>>();
const known = new Map<string, Kind>();
/** For tests. */
export const clearProofKinds = () => { kinds.clear(); known.clear(); };

/** What the file is, asked of the server once per file (a failed or unclear answer counts as a photo). */
function kindOf(id: string): Promise<Kind> {
  let p = kinds.get(id);
  if (!p) {
    p = fetch(mediaUrl(id), { method: 'HEAD' })
      .then((r): Kind => ((r.headers.get('content-type') ?? '').toLowerCase().startsWith('application/pdf') ? 'pdf' : 'image'))
      .catch((): Kind => 'image')
      .then((k) => { known.set(id, k); return k; });
    kinds.set(id, p);
  }
  return p;
}

const SIZE = 38;
export function ProofOpen({ mediaId, kind }: { mediaId: string; kind?: Kind }) {
  const t = useT();
  const [asked, setAsked] = useState<Kind | undefined>(() => known.get(mediaId));
  const [viewer, setViewer] = useState(false);
  const k = kind ?? asked;
  useEffect(() => {
    if (kind || known.has(mediaId)) { setAsked(known.get(mediaId)); return; }
    let live = true;
    void kindOf(mediaId).then((v) => { if (live) setAsked(v); });
    return () => { live = false; };
  }, [mediaId, kind]);
  const go = async () => {
    const what = k ?? (await kindOf(mediaId));
    if (what === 'pdf') window.open(mediaUrl(mediaId), '_blank');
    else setViewer(true);
  };
  return (
    <>
      <button type="button" data-testid="proof-open" data-kind={k} aria-label={t('finance.pay.proof')} title={t('finance.pay.proof')} className="cp-press cp-fill" onClick={(e) => { e.stopPropagation(); void go(); }}
        style={{ width: SIZE, height: SIZE, padding: 0, borderRadius: 8, border: '0.5px solid var(--hairline, #E2E2E6)', background: 'var(--fill, #F4F4F5)', overflow: 'hidden', flex: 'none', cursor: k === 'pdf' ? 'pointer' : 'zoom-in', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#24201C', fontFamily: 'Inter', fontSize: 12, fontWeight: 600, letterSpacing: 0.3 }}>
        {k === 'image' ? <PhotoImg photo={{ mediaId, tone: 0 }} size={SIZE} /> : k === 'pdf' ? 'PDF' : null}
      </button>
      {viewer ? <ImageLightbox src={mediaUrl(mediaId)} alt={t('finance.pay.proof')} onClose={() => setViewer(false)} /> : null}
    </>
  );
}
