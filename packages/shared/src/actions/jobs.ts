// Scheduled work run by the server every 15 s as the system user (scheduled broadcasts, invoice run, simulated syncs…).
// Feature modules register job functions with registerJob(); 'jobs.tick' runs them all inside one mutation.
import type { Draft } from 'immer';
import type { ClubState } from '../types';
import { defineAction, type Ctx } from './framework';

type Job = (d: Draft<ClubState>, ctx: Ctx) => void;
const JOBS: Record<string, Job> = {};
export const registerJob = (name: string, fn: Job) => { JOBS[name] = fn; };
export const jobsActions = [
  defineAction<Record<string, never>>({
    name: 'jobs.tick',
    can: (u) => u.id === 'system',
    run(d, _i, ctx) {
      for (const fn of Object.values(JOBS)) fn(d, ctx);
    },
  }),
];
