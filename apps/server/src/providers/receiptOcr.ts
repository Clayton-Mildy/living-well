// Receipt reader behind a provider interface. Only the simulated reader exists; a real one (a vision model or a document-AI service)
// replaces it by CP_OCR_PROVIDER, and nothing in the screens changes.
import type { ISODate, OcrResult } from '@cp/shared';
import { simulatedReceipt } from '@cp/shared/rules/purchasing';

export interface ReceiptOcr {
  extract(input: { mediaId: string; mime: string; bytes: Buffer; today: ISODate }): Promise<OcrResult>;
}

/** Waits a believable moment (CP_OCR_DELAY_MS, default 1.5 s), then answers with the receipt the photo's id always maps to. */
export const simulatedOcr: ReceiptOcr = {
  async extract({ mediaId, today }) {
    const ms = Number(process.env.CP_OCR_DELAY_MS ?? 1500);
    if (ms > 0) await new Promise((ok) => setTimeout(ok, ms));
    return simulatedReceipt(mediaId, today);
  },
};

/** The configured reader. An unknown CP_OCR_PROVIDER throws, so a typo stops the server at boot instead of failing at the first receipt. */
export function receiptOcr(): ReceiptOcr {
  const name = process.env.CP_OCR_PROVIDER || 'sim';
  if (name === 'sim') return simulatedOcr;
  throw new Error(`Unknown CP_OCR_PROVIDER "${name}" (only "sim" exists)`);
}
