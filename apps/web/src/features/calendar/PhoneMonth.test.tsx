// Round 15 (10): the phone month marks a day the club is closed for a reason (a closure, a holiday) with the sand fill and its reason; a plain weekend stays plain.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildSeed } from '@cp/shared';
import { dayInfo } from '@cp/shared/rules/calendar';
import { useSession } from '../../store/session';
import { PhoneMonth } from './PhoneMonth';

let root: Root | null = null;
let host: HTMLElement | null = null;
beforeAll(() => { (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  host?.remove();
  root = null;
  host = null;
});

describe('PhoneMonth closed days', () => {
  it('fills the seeded closure (30 Oct) sand and names the reason; a plain weekend (31 Oct) has no fill', async () => {
    useSession.setState({ lang: 'en' });
    const s = buildSeed().citra;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => { root!.render(<PhoneMonth month="2026-10" onMonth={() => {}} today="2026-10-21" sel={null} onSelect={() => {}} info={(d) => dayInfo(s, d)} hours={{ open: '08:30', close: '16:30' }} legend={[]} />); });
    const closed = host.querySelector<HTMLButtonElement>('button[data-date="2026-10-30"]')!;
    expect(closed.dataset.closed).toBe('1');
    expect(closed.style.background).toContain('--sand');
    expect(closed.title).toContain('staff first-aid training');
    const weekend = host.querySelector<HTMLButtonElement>('button[data-date="2026-10-31"]')!;
    expect(weekend.dataset.closed).toBeUndefined();
    expect(weekend.style.background).not.toContain('--sand');
  });
});
