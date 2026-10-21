// KC round 10: saving pictures to the gallery — the share sheet with files on a phone, a download per file elsewhere.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { savePhotos } from './saveMedia';

const photo = (id: string, time = '10:00') => ({ id, mediaId: 'demo:' + id, date: '2026-10-19', time, media: 'photo' as const });
const okFetch = () => vi.fn(async () => ({ ok: true, status: 200, blob: async () => new Blob(['x'], { type: 'image/jpeg' }) }));

describe('savePhotos', () => {
  const nav = navigator as unknown as { share?: unknown; canShare?: unknown };
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); delete nav.share; delete nav.canShare; });

  it('on a phone with the share sheet: shares the files at once (cancelling is not a failure)', async () => {
    vi.stubGlobal('fetch', okFetch());
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('coarse') }));
    const share = vi.fn(async () => undefined);
    nav.share = share; nav.canShare = () => true;
    const r = await savePhotos([photo('a'), photo('b', '10:01')]);
    expect(r).toEqual({ how: 'share', n: 2, cancelled: false });
    const files = (share.mock.calls[0] as unknown as [{ files: File[] }])[0].files;
    expect(files.map((f) => f.name)).toEqual(['citrapremier-2026-10-19-1000.jpg', 'citrapremier-2026-10-19-1001-2.jpg']);
    nav.share = vi.fn(async () => { throw Object.assign(new Error('x'), { name: 'AbortError' }); });
    expect((await savePhotos([photo('a')])).cancelled).toBe(true);
  });

  it('elsewhere: one download per file, and a failed fetch throws', async () => {
    vi.stubGlobal('fetch', okFetch());
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:x', revokeObjectURL: () => undefined });
    const clicks = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const r = await savePhotos([photo('a'), photo('b'), { ...photo('c'), mediaId: undefined }]);
    expect(r).toEqual({ how: 'download', n: 2, cancelled: false });
    expect(clicks).toHaveBeenCalledTimes(2);
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, blob: async () => new Blob() })));
    await expect(savePhotos([photo('a')])).rejects.toThrow();
  });
});
