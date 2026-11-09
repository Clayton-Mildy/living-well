// Round 21: the location picker. Search runs on Enter or the Search button only (the free search service forbids type-ahead); a hit or a
// dropped pin fills the area; the address still saves when search is down.
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GeoPoint } from '@cp/shared';
import { useSession } from '../../store/session';

const searchPlaces = vi.fn();
const reversePlace = vi.fn();
vi.mock('../../lib/geo', async (orig) => ({ ...(await orig<typeof import('../../lib/geo')>()), searchPlaces: (q: string) => searchPlaces(q), reversePlace: (a: number, b: number) => reversePlace(a, b) }));
// the map is Leaflet in the app; here a button stands for dropping the pin
vi.mock('./MapView', () => ({
  MapView: ({ onPin }: { onPin?: (p: { lat: number; lng: number }) => void }) => <button type="button" data-testid="drop-pin" onClick={() => onPin?.({ lat: -6.1325, lng: 106.7205 })}>map</button>,
}));
const { LocationPicker } = await import('./LocationPicker');

const CLUB: GeoPoint = { lat: -6.136, lng: 106.731 };
let root: Root | null = null;
let host: HTMLElement | null = null;
let last: { address: string; location?: GeoPoint } | null = null;
beforeAll(() => { (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
beforeEach(() => { searchPlaces.mockReset(); reversePlace.mockReset(); last = null; });
afterEach(async () => { await act(async () => { root?.unmount(); }); host?.remove(); root = null; host = null; });

function Harness({ start }: { start?: GeoPoint }) {
  const [v, setV] = useState<{ address: string; location?: GeoPoint }>({ address: '', location: start });
  return <LocationPicker address={v.address} location={v.location} club={CLUB} areaSuggestions={{ kelurahan: ['Kalideres'], kecamatan: ['Kalideres'] }} onChange={(x) => { last = x; setV(x); }} />;
}
async function show(start?: GeoPoint) {
  useSession.setState({ lang: 'en' });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<Harness start={start} />); });
}
const input = (name: string) => [...host!.querySelectorAll('label')].find((l) => l.querySelector('span')?.textContent === name)!.querySelector('input')!;
async function type(el: HTMLInputElement, text: string) {
  await act(async () => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    set.call(el, text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
const enter = async (el: HTMLElement) => { await act(async () => { el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); }); };
const click = async (el: Element) => { await act(async () => { (el as HTMLElement).click(); }); };

describe('LocationPicker', () => {
  it('typing does not search; Enter does, and picking a hit sets the pin and the area', async () => {
    searchPlaces.mockResolvedValue([{ label: 'Citra Garden 2, Kalideres, Jakarta Barat', lat: -6.136, lng: 106.789, kelurahan: 'Kalideres', kecamatan: 'Kalideres', city: 'Jakarta Barat' }]);
    await show();
    await type(input('Address'), 'citra');
    expect(searchPlaces).not.toHaveBeenCalled();
    await enter(input('Address'));
    expect(searchPlaces).toHaveBeenCalledWith('citra');
    const hit = [...host!.querySelectorAll('[data-testid="geo-hit"]')];
    expect(hit).toHaveLength(1);
    await click(hit[0]);
    expect(last).toMatchObject({ address: 'citra', location: { lat: -6.136, lng: 106.789, kelurahan: 'Kalideres', kecamatan: 'Kalideres' } });
    expect(host!.textContent).toContain('6.4 km from the club');
  });
  it('dropping the pin fills the empty area fields from the reverse lookup', async () => {
    reversePlace.mockResolvedValue({ label: 'x', lat: -6.1325, lng: 106.7205, kelurahan: 'Pegadungan', kecamatan: 'Kalideres' });
    await show();
    await click(host!.querySelector('[data-testid="drop-pin"]')!);
    expect(reversePlace).toHaveBeenCalledWith(-6.1325, 106.7205);
    expect(last?.location).toMatchObject({ lat: -6.1325, lng: 106.7205, kelurahan: 'Pegadungan', kecamatan: 'Kalideres' });
  });
  it('the kelurahan can be typed over', async () => {
    await show({ lat: -6.13, lng: 106.72, kelurahan: 'Kalideres', kecamatan: 'Kalideres' });
    await type(input('Kelurahan'), 'Semanan');
    expect(last?.location).toMatchObject({ kelurahan: 'Semanan', kecamatan: 'Kalideres' });
  });
  it('search down: says so, and the typed address still reaches the form', async () => {
    searchPlaces.mockRejectedValue(Object.assign(new Error('x'), { code: 'geo.err.unavailable' }));
    await show();
    await type(input('Address'), 'Jl. Peta Selatan 4');
    await click(host!.querySelector('button[aria-label="Search"]')!);
    expect(host!.textContent).toContain("Search isn't available. Tap the map to drop the pin instead.");
    expect(last).toMatchObject({ address: 'Jl. Peta Selatan 4' });
  });
});
