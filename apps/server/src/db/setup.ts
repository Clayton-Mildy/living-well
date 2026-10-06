// pnpm db:setup  -> create database if needed, run migrations, seed when empty.
// pnpm db:reset  -> same, but always re-seed (and reset the demo clock).
import 'dotenv/config';
import postgres from 'postgres';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { buildSeed } from '@cp/shared';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const url = new URL(process.env.DATABASE_URL || 'postgres://localhost:5434/citrapremier');
const dbName = url.pathname.slice(1);

export async function ensureDatabase(target = url) {
  const admin = new URL(target.toString());
  admin.pathname = '/postgres';
  const sql = postgres(admin.toString(), { max: 1, onnotice: () => {} });
  const name = target.pathname.slice(1);
  const exists = await sql`select 1 from pg_database where datname = ${name}`;
  if (!exists.length) {
    await sql.unsafe(`create database "${name}"`);
    console.log(`Created database ${name}`);
  }
  await sql.end();
}

export async function runMigrations() {
  const { db } = await import('./client');
  // MIGRATIONS_DIR: set by the bundled review copy (scripts/review.sh), whose import.meta.url is the bundle
  const folder = process.env.MIGRATIONS_DIR || join(dirname(fileURLToPath(import.meta.url)), '../../drizzle');
  await migrate(db, { migrationsFolder: folder });
}

async function main() {
  const reset = process.argv.includes('--reset');
  await ensureDatabase();
  await runMigrations();
  const { db, sql } = await import('./client');
  const { clubs } = await import('./schema');
  const { replaceAll } = await import('./store');
  const { resetClock, demoDate, demoNowMin } = await import('../clock');
  const have = await db.select({ id: clubs.id }).from(clubs);
  if (reset || !have.length) {
    await replaceAll(buildSeed(demoDate(), demoNowMin()));
    await resetClock();
    console.log(`Seeded ${dbName}: 5 members at CitraPremier, Adina empty. Demo day ${demoDate()}, from now.`);
  } else console.log(`${dbName} already has data (use pnpm db:reset to re-seed).`);
  await sql.end();
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url && !process.env.CP_BUNDLE) main().catch((e) => { console.error(e); process.exit(1); });
