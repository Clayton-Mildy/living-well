import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

export const DATABASE_URL = process.env.DATABASE_URL || 'postgres://localhost:5434/citrapremier';
export const sql = postgres(DATABASE_URL, { max: 5, onnotice: () => {} });
export const db = drizzle(sql, { schema });
export type DB = typeof db;
