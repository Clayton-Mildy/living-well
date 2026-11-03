// Final review minor 3: a payment waiting in Approvals opens its proof through ProofOpen, so a PDF opens in a new tab (it used to read "PDF" and open nothing).
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildSeed, type ClubState } from '@cp/shared';
import { useSession } from '../../store/session';
import { useFmt, useT } from '../../lib/i18n';
import { itemView } from './approvalView';
import { DiffList } from './profile/parts';

let root: Root | null = null;
let host: HTMLElement | null = null;
beforeAll(() => { (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(async () => { await act(async () => { root?.unmount(); }); host?.remove(); root = host = null; vi.restoreAllMocks(); });

function withPayment(kind?: 'pdf' | 'image'): ClubState {
  const s = structuredClone(buildSeed().citra);
  const p = Object.values(s.payments)[0];
  s.payments[p.id] = { ...p, proofMediaId: 'md_proof1', ...(kind ? { proofKind: kind } : {}) };
  return s;
}
function Row({ s, id }: { s: ClubState; id: string }) {
  const t = useT(), fmt = useFmt();
  return <DiffList d={itemView(s, { id, sub: 'payment' }, t, fmt).detail} t={t} />;
}
async function show(s: ClubState) {
  useSession.setState({ lang: 'en' } as never);
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<Row s={s} id={Object.values(s.payments)[0].id} />); });
}

describe('Approvals › payment proof', () => {
  it('a PDF proof is a tile that opens the file in a new tab', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    await show(withPayment('pdf'));
    const tile = host!.querySelector<HTMLButtonElement>('[data-testid="proof-open"]')!;
    expect(tile.getAttribute('data-kind')).toBe('pdf');
    expect(tile.textContent).toBe('PDF');
    await act(async () => { tile.click(); });
    expect(open).toHaveBeenCalledWith('/api/media/md_proof1', '_blank');
  });
  it('a photo proof is a thumbnail tile', async () => {
    await show(withPayment('image'));
    expect(host!.querySelector('[data-testid="proof-open"]')!.getAttribute('data-kind')).toBe('image');
  });
});
