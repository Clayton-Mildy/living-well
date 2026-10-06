// CitraPremier API entry: boot (migrate, load), start jobs, listen.
import 'dotenv/config';
import { serve } from '@hono/node-server';
import { app } from './app';
import { boot, startJobs } from './state';
import { clockInfo } from './clock';

const port = Number(process.env.API_PORT || 8787);
await boot();
startJobs();
serve({ fetch: app.fetch, port, hostname: '0.0.0.0' }, () => console.log(`CitraPremier API on http://localhost:${port} · clock ${clockInfo().today} ${clockInfo().now}`));
