// Round 13 §13: the profile / staff photo preview, the KTP preview and the profile-photo diff thumbnail open full size.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { useSession } from '../../store/session';
import { ProfilePhotoField } from './ProfilePhoto';
import { KtpField } from './PaperForm';
import { DiffList } from './profile/parts';
import { Avatar } from '../../components/ui';

let root: Root | null = null;
let host: HTMLElement | null = null;
beforeAll(() => { (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  host?.remove();
  root = null;
  host = null;
  document.body.innerHTML = '';
  await new Promise((r) => setTimeout(r, 60));
});
async function mount(el: React.ReactElement) {
  useSession.setState({ lang: 'en' });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(el); });
}
const lightbox = () => document.querySelector('[data-testid=image-lightbox-img]') as HTMLImageElement | null;
const click = async (el: Element | null) => { await act(async () => { (el as HTMLElement).click(); }); };

describe('every picture opens full size', () => {
  it('profile / staff photo: the preview opens, and the picture is not offered when there is none', async () => {
    await mount(<ProfilePhotoField name="Sari Dewi" value="m-sari" onChange={() => {}} />);
    await click(document.querySelector('[role=button][aria-label^="Open full size"]')); // a face: span role=button, so it also opens inside a row
    expect(lightbox()?.getAttribute('src')).toContain('m-sari');
    await click(document.querySelector('[data-testid=image-lightbox-close]'));
    expect(lightbox()).toBeNull();
  });
  it('profile photo with none set has nothing to open', async () => {
    await mount(<ProfilePhotoField name="Sari Dewi" value={null} onChange={() => {}} />);
    expect(document.querySelector('[aria-label^="Open full size"]')).toBeNull();
  });
  it('KTP preview opens; Remove stays its own button', async () => {
    let removed = false;
    await mount(<KtpField label="KTP" name="a" value={{ mediaId: 'ktp-1', fileName: 'ktp.jpg' }} onChange={(f) => { removed = f === null; }} />);
    await click(document.querySelector('button[aria-label="Open full size · KTP"]'));
    expect(lightbox()?.getAttribute('src')).toContain('ktp-1');
    await click(document.querySelector('[data-testid=image-lightbox-close]'));
    const rm = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'Remove')!;
    await click(rm);
    expect(removed).toBe(true);
    expect(lightbox()).toBeNull();
  });
  it('the old and new profile pictures in a review diff open', async () => {
    const t = ((k: string) => k) as never;
    await mount(<DiffList t={t} d={{ summary: [], rows: [{ label: 'Photo', from: 'Old', to: 'New', fromImg: '/media/old.jpg', toImg: '/media/new.jpg' }] } as never} />);
    const btns = document.querySelectorAll('button[aria-label^="common.openFull"]');
    expect(btns).toHaveLength(2);
    await click(btns[1]);
    expect(lightbox()?.getAttribute('src')).toBe('/media/new.jpg');
  });
  it('KC 28 Oct: a face inside a row button opens its picture, and the row does not react; without a picture the row gets the tap', async () => {
    let rowTaps = 0;
    await mount(<button type="button" data-testid="row" onClick={() => rowTaps++}><Avatar name="Mbak Sari" src="/media/sari.jpg" />Mbak Sari</button>);
    await click(document.querySelector('[data-testid=row] [role=button]'));
    expect(lightbox()?.getAttribute('src')).toBe('/media/sari.jpg');
    expect(rowTaps).toBe(0);
    await click(document.querySelector('[data-testid=image-lightbox-close]'));
    await click(document.querySelector('[data-testid=row]'));
    expect(rowTaps).toBe(1);
    await act(async () => { root!.render(<button type="button" data-testid="row2"><Avatar name="Mbak Sari" /></button>); });
    expect(document.querySelector('[data-testid=row2] [role=button]')).toBeNull();
  });
});
