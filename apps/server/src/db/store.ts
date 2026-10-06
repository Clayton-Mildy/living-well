// Load / persist club states. Rows are stored one per entity with typed key columns for inspection and indexing.
import { and, eq, inArray, sql as dsql } from 'drizzle-orm';
import { COLLECTIONS, emptyClub, touchedRows, type ClubState, type CollectionName, type Patch } from '@cp/shared';
import { db } from './client';
import { tables, clubs as clubsTable, meta, auditLog } from './schema';
import { prepareCredentials, replaceCredentials } from './credentials';

type AnyRow = Record<string, unknown> & { id: string };
const keyCols = (r: AnyRow) => {
  const review = r.review as { status?: string } | undefined;
  return {
    memberId: (r.memberId as string) ?? null,
    familyId: (r.familyId as string) ?? null,
    date: ((r.date ?? r.issueDate ?? r.effectiveFrom ?? r.sentOn ?? r.mealDate) as string) ?? null,
    status: ((r.status ?? r.stage ?? review?.status) as string) ?? null,
    kind: ((r.kind ?? r.role ?? r.topic ?? r.type) as string) ?? null,
  };
};

export async function loadAll(): Promise<Record<string, ClubState>> {
  const out: Record<string, ClubState> = {};
  const clubRows = await db.select().from(clubsTable);
  for (const c of clubRows) {
    const s = emptyClub(c.id, c.data as ClubState['club']);
    s.rev = c.rev;
    out[c.id] = s;
  }
  for (const coll of COLLECTIONS) {
    const rows = await db.select({ clubId: tables[coll].clubId, id: tables[coll].id, data: tables[coll].data }).from(tables[coll]);
    for (const r of rows) {
      const s = out[r.clubId];
      if (s) (s[coll] as Record<string, unknown>)[r.id] = r.data;
    }
  }
  return out;
}

const CHUNK = 500;
export async function writeClub(tx: typeof db, s: ClubState) {
  await tx.insert(clubsTable).values({ id: s.clubId, rev: s.rev, data: s.club }).onConflictDoUpdate({ target: clubsTable.id, set: { rev: s.rev, data: s.club, updatedAt: dsql`now()` } });
  for (const coll of COLLECTIONS) {
    const rows = Object.values(s[coll] as unknown as Record<string, AnyRow>);
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK).map((r) => ({ clubId: s.clubId, id: r.id, ...keyCols(r), data: r }));
      if (chunk.length) await tx.insert(tables[coll]).values(chunk);
    }
  }
}

/** Replace everything with the given club states (used by setup and demo reset). Sign-in credentials go back to the seed too (default password). */
export async function replaceAll(states: Record<string, ClubState>) {
  const creds = await prepareCredentials(states);
  await db.transaction(async (tx) => {
    for (const coll of COLLECTIONS) await tx.delete(tables[coll]);
    await tx.delete(clubsTable);
    await tx.delete(auditLog);
    for (const s of Object.values(states)) await writeClub(tx as unknown as typeof db, s);
    await replaceCredentials(tx, creds);
  });
}

/** Persist the rows a mutation touched (upsert or delete), bump the club rev, append to the audit log. */
export async function persistMutation(s: ClubState, patches: Patch[], audit: { at: string; actor: string; action: string; mutationId: string; memberId?: string; input: unknown }) {
  const { rows, club } = touchedRows(patches);
  await db.transaction(async (tx) => {
    for (const [coll, ids] of rows) {
      const t = tables[coll as CollectionName];
      const idList = [...ids];
      const present = idList.filter((id) => (s[coll as CollectionName] as Record<string, unknown>)[id]);
      const gone = idList.filter((id) => !present.includes(id));
      if (gone.length) await tx.delete(t).where(and(eq(t.clubId, s.clubId), inArray(t.id, gone)));
      for (const id of present) {
        const r = (s[coll as CollectionName] as unknown as Record<string, AnyRow>)[id];
        const vals = { clubId: s.clubId, id, ...keyCols(r), data: r };
        await tx.insert(t).values(vals).onConflictDoUpdate({ target: [t.clubId, t.id], set: { ...keyCols(r), data: r, updatedAt: dsql`now()` } });
      }
    }
    await tx.update(clubsTable).set({ rev: s.rev, ...(club ? { data: s.club } : {}), updatedAt: dsql`now()` }).where(eq(clubsTable.id, s.clubId));
    await tx.insert(auditLog).values({ clubId: s.clubId, rev: s.rev, at: audit.at, actor: audit.actor, action: audit.action, mutationId: audit.mutationId, memberId: audit.memberId ?? null, data: { input: audit.input, patches } });
  });
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const r = await db.select().from(meta).where(eq(meta.key, key));
  return r[0]?.value as T | undefined;
}
export async function setMeta(key: string, value: unknown) {
  await db.insert(meta).values({ key, value }).onConflictDoUpdate({ target: meta.key, set: { value } });
}
