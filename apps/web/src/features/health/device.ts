// LEPU PC-303 simulation (demo): the device is not real, so "Read PC-303" produces values here and the form submits them as ordinary input.
// Members with a `sim.script` replay it: Hendra's arrival is 164/98 and his re-check 152/92; Lina has a `demoHigh` set for the guided demo.
import type { Member, QueueKind } from '@cp/shared';

export type DeviceKind = 'bp' | 'vit' | 'glu';
export type Sim = Member['sim'];
/** How long the station waits before the demo device "sends" its values (the cuff takes a moment). */
export const DEVICE_MS: Record<DeviceKind, number> = { bp: 3000, vit: 1500, glu: 1500 };
/** Baseline for a trial guest (no record to take it from). */
export const GUEST_SIM: Sim = { sys: 132, dia: 80, pulse: 74, spo2: 97, glucose: 110, weight: 60, temp: 36.6, grip: 20 };
export interface SimOpts { type: QueueKind; demoHigh?: boolean; exact?: boolean; rand?: () => number }
export type SimValues = Partial<Record<'sys' | 'dia' | 'pulse' | 'spo2' | 'temp' | 'glu', string>>;

/**
 * Values the device "sends". Random around the member's baseline, unless a script covers this check
 * (`script[type]`, or `script.demoHigh` for the guided demo). `exact` skips the randomness (guided demo).
 */
export function simulate(kind: DeviceKind, sim: Sim, o: SimOpts): SimValues {
  const rand = o.rand ?? Math.random;
  const j = (v: number, spread: number) => (o.exact ? v : v + (rand() - 0.5) * 2 * spread);
  const script = sim.script?.[o.demoHigh ? 'demoHigh' : o.type];
  if (kind === 'bp') {
    return {
      sys: String(Math.round(script?.sys ?? j(sim.sys, 4))),
      dia: String(Math.round(script?.dia ?? j(sim.dia, 3))),
      pulse: String(Math.round(script?.pulse ?? j(sim.pulse, 4))),
    };
  }
  if (kind === 'vit') return { spo2: String(Math.min(99, Math.round(script?.spo2 ?? j(sim.spo2, 1)))), temp: (script?.temp ?? j(sim.temp, 0.2)).toFixed(1) };
  return { glu: String(Math.round(script?.glucose ?? j(sim.glucose, 8))) };
}
