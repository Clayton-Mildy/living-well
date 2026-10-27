// Read a photographed receipt: the server's OCR (simulated until a real reader is configured) returns the supplier, lines and total.
import type { OcrResult } from '@cp/shared';
import { api } from './api';

/** Send an uploaded photo's `mediaId` to be read. Rejects with an ApiError whose `code` is an i18n key. Takes an AbortSignal so a closed capture screen stops waiting. */
export async function readReceipt(mediaId: string, signal?: AbortSignal): Promise<OcrResult> {
  return api<OcrResult>('/api/receipts/read', { body: { mediaId }, signal });
}
