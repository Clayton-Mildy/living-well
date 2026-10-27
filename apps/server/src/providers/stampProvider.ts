// e-Meterai behind a provider interface. Only the simulated stamp exists; a real one (a licensed e-Meterai provider such as Peruri)
// replaces it by CP_STAMP_PROVIDER, and nothing in the signing flow changes.
import { createHash } from 'node:crypto';
import { clockInfo } from '../clock';

export interface StampProvider {
  affix(input: { documentId: string; memberId: string }): Promise<{ serial: string; at: string }>;
}

/** 22 upper-case letters and digits, always the same for the same document and minute. */
export function simulatedSerial(documentId: string, at: string): string {
  const n = BigInt('0x' + createHash('sha256').update(`${documentId}|${at}`).digest('hex'));
  return n.toString(36).toUpperCase().padStart(22, '0').slice(-22);
}

/** Waits a believable moment (CP_STAMP_DELAY_MS, default 0.8 s), then answers with a serial and the server clock's now. */
export const simulatedStamp: StampProvider = {
  async affix({ documentId }) {
    const ms = Number(process.env.CP_STAMP_DELAY_MS ?? 800);
    if (ms > 0) await new Promise((ok) => setTimeout(ok, ms));
    const c = clockInfo();
    const at = `${c.today}T${c.now}`;
    return { serial: simulatedSerial(documentId, at), at };
  },
};

/** The configured provider. An unknown CP_STAMP_PROVIDER throws, so a typo stops the server at boot instead of failing at the first stamp. */
export function stampProvider(): StampProvider {
  const name = process.env.CP_STAMP_PROVIDER || 'sim';
  if (name === 'sim') return simulatedStamp;
  throw new Error(`Unknown CP_STAMP_PROVIDER "${name}" (only "sim" exists)`);
}
