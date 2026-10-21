// The avatar of a member shows the first and last name's initials, whatever the title ("Tante" included).
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { memberName, type Member } from '@cp/shared';
import { Avatar } from './index';

let root: Root | null = null;
let host: HTMLElement | null = null;
beforeAll(() => { (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(async () => { await act(async () => { root?.unmount(); }); host?.remove(); root = null; host = null; });

describe('Avatar', () => {
  const m = { title: 'Tante', firstName: 'Lily', lastName: 'Tan' } as Member;
  const show = async (ui: React.ReactElement) => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => { root!.render(ui); });
    return host.textContent;
  };
  it('a member titled Tante reads LT, not TT', async () => {
    expect(await show(<Avatar name={memberName(m)} member={m} />)).toBe('LT');
  });
  it('a plain name (staff, contacts) still drops the usual titles', async () => {
    expect(await show(<Avatar name="Oma Lina Wijaya" />)).toBe('LW');
  });
});
