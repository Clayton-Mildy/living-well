// Round 21: Insights › Where from: a map (mocked here) and the table under it; Who (Members / Enquiries / Both) and View (Exact pins / Kelurahan / Kecamatan).
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { produce } from 'immer';
import { buildSeed, type GeoPoint } from '@cp/shared';
import { useReplica } from '../../store/replica';
import { useSession } from '../../store/session';

vi.mock('../../components/geo/MapView', () => ({
  MapView: ({ markers, circles }: { markers: { id: string }[]; circles?: { id: string; count: number }[] }) => <div data-testid="map" data-markers={markers.length} data-circles={(circles ?? []).map((c) => c.count).join(',')} />,
  circlePx: (n: number) => 10 + 8 * Math.sqrt(n),
}));
const { Insights } = await import('./index');

let root: Root | null = null;
let host: HTMLElement | null = null;
beforeAll(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
});
afterEach(async () => { await act(async () => { root?.unmount(); }); host?.remove(); root = null; host = null; document.body.innerHTML = ''; });

const T = '2026-10-21';
const KAL = (lat: number): GeoPoint => ({ lat, lng: 106.72, kelurahan: 'Kalideres', kecamatan: 'Kalideres' });
const CENG = (lat: number): GeoPoint => ({ lat, lng: 106.74, kelurahan: 'Cengkareng Barat', kecamatan: 'Cengkareng' });
function open() {
  const state = produce(buildSeed().citra, (d) => {
    for (const m of Object.values(d.members)) delete m.location;
    d.club.settings.location = { lat: -6.136, lng: 106.731 };
    d.members.m1.location = KAL(-6.130);
    d.members.m46.location = KAL(-6.131);
    d.members.m2.location = KAL(-6.132);
    d.members.m10.location = CENG(-6.150);
    for (const e of Object.values(d.enquiries)) delete e.location;
    d.enquiries.e1.createdAt = '2026-10-05T10:00';
    d.enquiries.e1.location = CENG(-6.151);
  });
  useSession.setState({ lang: 'en', club: 'citra', user: { kind: 'staff', id: 's9', name: 'Ega', role: 'mgmt', clubId: 'citra', clubs: ['citra'] } });
  useReplica.setState({ club: 'citra', userId: 's9', confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock: { today: T, startMin: 598, realStart: Date.now(), offset: 0 }, act: (async () => ({ ok: true, result: {} })) as never });
}
async function show() {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter initialEntries={['/insights?tab=where']}><Routes><Route path="/insights" element={<Insights />} /></Routes></MemoryRouter>); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); // the lazy map
}
const click = async (el: Element | null | undefined) => { expect(el, 'element to click').toBeTruthy(); await act(async () => { (el as HTMLElement).click(); }); };
const pick = async (comboLabel: string, option: string) => {
  await click(document.querySelector(`[role="combobox"][aria-label="${comboLabel}"]`));
  await click(Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).find((o) => o.getAttribute('aria-label') === option));
};
const areaRows = () => Array.from(document.querySelectorAll<HTMLElement>('[data-area]'));

describe('Insights › Where from', () => {
  it('opens on Both and Kecamatan: circles on the map and the table biggest first, members and leads apart', async () => {
    open();
    await show();
    expect(document.querySelector('[data-testid="map"]')?.getAttribute('data-circles')).toBe('3,2');
    const rows = areaRows();
    expect(rows.map((r) => r.getAttribute('data-area'))).toEqual(['Kalideres', 'Cengkareng']);
    expect(rows[0].textContent).toContain('3');
    expect(rows[1].querySelector('[data-col="enquiries"]')?.textContent).toBe('1');
    expect(document.body.textContent).toContain('Period applies to enquiries');
  });
  it('tapping an area lists its people', async () => {
    open();
    await show();
    await click(areaRows()[1]);
    const sheet = document.querySelector('[role="dialog"]')!;
    expect(sheet.querySelectorAll('[data-person]')).toHaveLength(2);
  });
  it('Exact pins shows one row per person with the km; Members only drops the enquiries', async () => {
    open();
    await show();
    await pick('View', 'Exact pins');
    expect(document.querySelectorAll('[data-person]')).toHaveLength(5);
    expect(document.querySelector('[data-testid="map"]')?.getAttribute('data-markers')).toBe('6'); // five people and the club
    expect(document.body.textContent).toContain('km');
    await pick('Who', 'Members');
    expect(document.querySelectorAll('[data-person]')).toHaveLength(4);
  });
  it('people with no pin are counted and listed', async () => {
    open();
    await show();
    const link = document.querySelector('[data-testid="where-missing"]')!;
    expect(link.textContent).toMatch(/^\d+ without a location$/);
    await click(link);
    expect(document.querySelector('[role="dialog"]')!.querySelectorAll('[data-person]').length).toBeGreaterThan(0);
  });
});
