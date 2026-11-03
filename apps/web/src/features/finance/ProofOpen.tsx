// The proof of a payment recorded by hand (the transfer slip or the signed receipt): a small thumbnail that opens it.
// A photo opens in the viewer (ImageLightbox); a PDF opens in a new tab. A payment from before round 18 has no `proofKind`:
// the server is asked (HEAD /api/media/:id, the content type) and a 2xx answer is remembered for the session. A failed answer (offline, 404, 500) is not
// remembered: the tile shows a file icon, and a tap asks again, then opens the file in a new tab if the server still does not say.
import { useEffect, useState } from 'react';
import { Icon, ImageLightbox, PhotoImg } from '../../components/ui';
import { useT } from '../../lib/i18n';
import { mediaUrl } from '../../lib/media';

type Kind = 'image' | 'pdf';
const kinds = new Map<string, Promise<Kind | undefined>>();
const known = new Map<string, Kind>();
/** For tests. */
export const clearProofKinds = () => { kinds.clear(); known.clear(); };

/** What the file is, asked of the server (once per file when it answers; undefined when it does not, so the next tap asks again). */
function kindOf(id: string): Promise<Kind | undefined> {
  let p = kinds.get(id);
  if (!p) {
    p = fetch(mediaUrl(id), { method: 'HEAD' })
      .then((r): Kind | undefined => (r.ok ? ((r.headers.get('content-type') ?? '').toLowerCase().startsWith('application/pdf') ? 'pdf' : 'image') : undefined))
      .catch((): undefined => undefined)
      .then((k) => { if (k) known.set(id, k); else kinds.delete(id); return k; });
    kinds.set(id, p);
  }
  return p;
}

const SIZE = 38;
export function ProofOpen({ mediaId, kind }: { mediaId: string; kind?: Kind }) {
  const t = useT();
  const [asked, setAsked] = useState<Kind | undefined>(() => known.get(mediaId));
  const [failed, setFailed] = useState(false); // the server did not answer: a file tile, asked again on tap
  const [viewer, setViewer] = useState(false);
  const k = kind ?? asked;
  useEffect(() => {
    if (kind || known.has(mediaId)) { setAsked(known.get(mediaId)); return; }
    let live = true;
    void kindOf(mediaId).then((v) => { if (live) { setAsked(v); setFailed(!v); } });
    return () => { live = false; };
  }, [mediaId, kind]);
  const go = async () => {
    const what = k ?? (await kindOf(mediaId));
    if (!kind && !asked && what) { setAsked(what); setFailed(false); }
    if (what !== 'image') window.open(mediaUrl(mediaId), '_blank'); // a PDF, or a file the server would not describe: the browser shows it
    else setViewer(true);
  };
  return (
    <>
      <button type="button" data-testid="proof-open" data-kind={k ?? (failed ? 'file' : undefined)} aria-label={t('finance.pay.proof')} title={t('finance.pay.proof')} className="cp-press cp-fill" onClick={(e) => { e.stopPropagation(); void go(); }}
        style={{ width: SIZE, height: SIZE, padding: 0, borderRadius: 8, border: '0.5px solid var(--hairline, #E2E2E6)', background: 'var(--fill, #F4F4F5)', overflow: 'hidden', flex: 'none', cursor: k === 'pdf' ? 'pointer' : 'zoom-in', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#24201C', fontFamily: 'Inter', fontSize: 12, fontWeight: 600, letterSpacing: 0.3 }}>
        {k === 'image' ? <PhotoImg photo={{ mediaId, tone: 0 }} size={SIZE} /> : k === 'pdf' ? 'PDF' : failed ? <Icon name="description" size={20} /> : null}
      </button>
      {viewer ? <ImageLightbox src={mediaUrl(mediaId)} alt={t('finance.pay.proof')} onClose={() => setViewer(false)} /> : null}
    </>
  );
}
