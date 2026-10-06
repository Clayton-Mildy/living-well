// Real viewport -> the design's device switch: phone < 768 ≤ tablet < 1280 ≤ laptop.
import { useEffect, useState } from 'react';

export type Device = 'phone' | 'tablet' | 'laptop';
const of = (w: number): Device => (w < 768 ? 'phone' : w < 1280 ? 'tablet' : 'laptop');
export function useDevice() {
  const [d, setD] = useState<Device>(() => of(typeof window === 'undefined' ? 1440 : window.innerWidth));
  useEffect(() => {
    const on = () => setD(of(window.innerWidth));
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return { device: d, isPhone: d === 'phone', isTablet: d === 'tablet', isLaptop: d === 'laptop', isWide: d !== 'phone' };
}
/** Page padding per device (design: phone 20/16/28, tablet 24/28/32, laptop 28/36/40). */
export const padFor = (d: Device) => (d === 'phone' ? '14px 16px 20px' : d === 'tablet' ? '24px 28px 32px' : '28px 36px 40px');
