// Documents: a PDF is uploaded as it is (up to 10 MB); a photo goes through the usual shrink. The viewer decides by the file name.
import { describe, expect, it, vi, beforeEach } from 'vitest';

const api = vi.fn();
vi.mock('./api', () => ({ api: (...a: unknown[]) => api(...a), ApiError: class ApiError extends Error { constructor(public status: number, public code: string) { super(code); } } }));

import { MAX_PDF_BYTES, isPdfFile, isPdfName, mediaUrl, uploadDocument } from './media';

beforeEach(() => { api.mockReset(); api.mockResolvedValue({ id: 'md_testdocument0000001' }); });

describe('documents', () => {
  it('knows a PDF by its type, or by its name when the browser gave no type', () => {
    expect(isPdfFile(new Blob(['x'], { type: 'application/pdf' }))).toBe(true);
    expect(isPdfFile(new Blob(['x'], { type: '' }), 'Form.PDF')).toBe(true);
    expect(isPdfFile(new Blob(['x'], { type: 'image/png' }), 'form.pdf')).toBe(false);
    expect(isPdfFile(new Blob(['x'], { type: 'image/jpeg' }), 'photo.jpg')).toBe(false);
    expect(isPdfName('membership-form.pdf')).toBe(true);
    expect(isPdfName('registration-form.jpg')).toBe(false);
    expect(isPdfName(undefined)).toBe(false);
  });
  it('uploads a PDF as application/pdf with its own name', async () => {
    const r = await uploadDocument(new Blob(['%PDF-1.4 test'], { type: 'application/pdf' }), 'signed.pdf');
    expect(r).toEqual({ mediaId: 'md_testdocument0000001', fileName: 'signed.pdf' });
    expect(api).toHaveBeenCalledWith('/api/media', { body: { mime: 'application/pdf', data: expect.any(String) } });
    expect(atob(api.mock.calls[0][1].body.data)).toBe('%PDF-1.4 test');
  });
  it('refuses a PDF above 10 MB before sending it', async () => {
    const big = new Blob([new Uint8Array(MAX_PDF_BYTES + 1)], { type: 'application/pdf' });
    await expect(uploadDocument(big, 'big.pdf')).rejects.toMatchObject({ code: 'common.docTooBig' });
    expect(api).not.toHaveBeenCalled();
  });
});

describe('demo pictures', () => {
  it('a seeded demo id (md_demo_<name>) is a static file of the web app; an uploaded id is read from the API', () => {
    expect(mediaUrl('md_demo_act-batik-1')).toBe('/demo/act-batik-1.jpg');
    expect(mediaUrl('md_demo_food-soto-2')).toBe('/demo/food-soto-2.jpg');
    expect(mediaUrl('md_Ab3dEf9hIj')).toBe('/api/media/md_Ab3dEf9hIj');
  });
});
