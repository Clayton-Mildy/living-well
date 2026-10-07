// Postgres schema: one table per collection with typed key columns + JSONB data; plus clubs, meta, audit_log.
import { pgTable, text, jsonb, timestamp, primaryKey, index, bigserial, integer } from 'drizzle-orm/pg-core';
import { COLLECTIONS, type CollectionName } from '@cp/shared';

export const snake = (s: string) => s.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());

function entityTable(name: string) {
  return pgTable(
    snake(name),
    {
      clubId: text('club_id').notNull(),
      id: text('id').notNull(),
      memberId: text('member_id'),
      familyId: text('family_id'),
      date: text('date'),
      status: text('status'),
      kind: text('kind'),
      data: jsonb('data').notNull(),
      updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    },
    (t) => [primaryKey({ columns: [t.clubId, t.id] }), index(`${snake(name)}_member_idx`).on(t.clubId, t.memberId), index(`${snake(name)}_date_idx`).on(t.clubId, t.date), index(`${snake(name)}_status_idx`).on(t.clubId, t.status)],
  );
}
export type EntityTable = ReturnType<typeof entityTable>;
export const tables = Object.fromEntries(COLLECTIONS.map((c) => [c, entityTable(c)])) as Record<CollectionName, EntityTable>;

// named exports so drizzle-kit picks every table up
export const prices = tables.prices, members = tables.members, memberNotes = tables.memberNotes, planChangeRequests = tables.planChangeRequests, familyContacts = tables.familyContacts,
  familyLinks = tables.familyLinks, attendance = tables.attendance, guestVisits = tables.guestVisits, readings = tables.readings,
  dailyLogs = tables.dailyLogs, photos = tables.photos, threads = tables.threads, messages = tables.messages, feedback = tables.feedback, enquiries = tables.enquiries,
  calendarEvents = tables.calendarEvents, venueBookings = tables.venueBookings, rooms = tables.rooms, activities = tables.activities, scheduleVersions = tables.scheduleVersions, dishes = tables.dishes,
  menuVersions = tables.menuVersions, dayMenus = tables.dayMenus, stockRequests = tables.stockRequests, budgetSections = tables.budgetSections, budgetRequests = tables.budgetRequests,
  budgetAdjustments = tables.budgetAdjustments, receipts = tables.receipts, vendorInvoices = tables.vendorInvoices, invoices = tables.invoices, payments = tables.payments, refunds = tables.refunds,
  pendingCharges = tables.pendingCharges, invoiceRuns = tables.invoiceRuns, directory = tables.directory, staff = tables.staff, hrNotes = tables.hrNotes, staffTime = tables.staffTime,
  surveys = tables.surveys, surveyResponses = tables.surveyResponses, broadcasts = tables.broadcasts, changeRequests = tables.changeRequests, notifications = tables.notifications, activity = tables.activity;

export const clubs = pgTable('clubs', {
  id: text('id').primaryKey(),
  rev: integer('rev').notNull().default(0),
  data: jsonb('data').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
export const meta = pgTable('meta', { key: text('key').primaryKey(), value: jsonb('value').notNull() });
export const auditLog = pgTable(
  'audit_log',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    clubId: text('club_id').notNull(),
    rev: integer('rev').notNull(),
    at: text('at').notNull(),
    actor: text('actor').notNull(),
    action: text('action').notNull(),
    mutationId: text('mutation_id').notNull(),
    memberId: text('member_id'),
    data: jsonb('data').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('audit_club_rev_idx').on(t.clubId, t.rev), index('audit_member_idx').on(t.clubId, t.memberId)],
);

// Server-only tables (never part of club state or snapshots).
/** Real images from the camera or uploads, served by GET /api/media/:id. Base64 keeps the demo free of file storage. */
export const media = pgTable('media', {
  id: text('id').primaryKey(),
  clubId: text('club_id').notNull(),
  mime: text('mime').notNull(),
  data: text('data').notNull(),
  bytes: integer('bytes').notNull(),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
/** Sign-in credentials: username (fixed) and a scrypt password hash, per staff member or family contact. */
export const credentials = pgTable('credentials', {
  userId: text('user_id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
