# Round 14 Phase 4 (E: super search) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One search for the staff app. It finds screens, actions, people and records in English or Indonesian, shows only what the signed-in role can open, and opens the result in one tap.

**Architecture:**
- The ranking is a pure module (`apps/web/src/lib/search.ts`).
- Screens and actions declare their labels and EN/ID keywords in one registry (`apps/web/src/app/searchRegistry.ts`). The same file builds the people and record candidates from the synced client state and gates every entry by the role's nav keys (`allowedKeys`).
- A `SuperSearch` overlay in the shell opens from three places: a top-bar icon on phones, a field at the top of the sidebar on tablets and laptops, and ⌘K / Ctrl-K.
- A few target screens learn one URL parameter each, so an action or record result lands on the right sheet.
- There is no server change.

**Tech Stack:** TypeScript, React 18, React Router, vitest, Playwright; pnpm monorepo (`@cp/shared` for types and i18n).

**Spec:** `docs/superpowers/specs/2026-10-23-round14-ops-team-design.md` §Phase 4 — E, plus its Conventions and Testing sections. KC put phase 3 (D) and D4 (the DOKU provider) after this phase on 27 Oct.

## Global Constraints

- "Opens from a search icon in the top bar on phones (full screen) and a search field at the top of the sidebar on laptops, plus ⌘K / Ctrl-K."
- Results come in four groups, in this order: **Screens**, **Actions**, **People**, **Records**.
- "Ranking: exact and prefix matches first, then word matches, then a small typo tolerance."
- "Recent searches are kept on the device (`localStorage`, wrapped in try/catch)."
- "Only what the signed-in role can open is shown."
- "Every screen and action declares its keywords in one registry, `apps/web/src/app/searchRegistry.ts`, so a new feature becomes searchable with one entry."
- "Searching runs on the synced client state; no server search."
- Staff only: the family app gets no search (spec, Out of scope).
- The UI is dense and phone-first: 44 px touch targets, ink, grey and white with the warm staff skin, and no pastel tints.
- Every new string exists in EN and ID. Add a new namespace `search` (`i18n/en/search.ts`, `i18n/id/search.ts`), registered in both `index.ts` files the way `purchasing` is. The ID file is typed `Same<typeof EN>`.
- Minimal tests: typecheck, unit tests for the ranking and the index, and one e2e pass of the phase story on a phone viewport (`scripts/e2e-all.sh`).

## Rulings made while writing this plan (KC to confirm in review)

- **R1 Keywords in both languages:** every entry's English and Indonesian keywords are always searched, whatever the UI language. Someone using the app in English can type "tagihan".
- **R2 Send for signing:** this action is left out. The signing flow is phase 3, so its registry entry arrives with phase 3.
- **R3 Actions:** each action opens the screen that holds it.
  - Add member → `/members?do=add` (opens the stepped Add member flow).
  - Record payment → `/payments` (its form sits on the page).
  - Request leave → `/tasks` (the Mine view holds My leave).
  - New celebration → `/celebrations` (the request form).
  - Submit receipt → `/requests?do=receipt` for section staff, `/receipts?do=snap` for finance and management.
- **R4 Records:** each record opens the screen that holds it, deep-linked where the screen can take it.

  | Record | Opens |
  |---|---|
  | invoice | `/billing?inv=<id>` (the invoice sheet) |
  | lead | `/enquiries?e=<id>` (exists) |
  | supplier | `/directory?q=<name>` |
  | dish | the role's Menu screen |
  | activity | `/calendar` |
  | guest host | `/guests` |
  | member | `/members/<id>` |
  | family contact | `/members/<memberId>/family` (their parent's profile) |
  | staff | `/hr?staff=<id>` (management only, exists) |

  *Cost if wrong:* a deep link per screen later.
- **R5 Results per group:** each group shows at most 6 results.
- **R6 Recent searches:** a query is remembered when one of its results is opened. The newest 8 are kept, without duplicates. They show only while the field is empty, and tapping one runs it again.
- **R7 Phone push screens:** the phone search icon lives in the logo header, which a pushed member profile hides. ⌘K still works there on a keyboard.

## Review Focus

1. **Messy typing:** `"  oma  LINA "`, `"Oma Líña"` and `"INV 2609-020"` find the same thing as the clean form. Normalise case, diacritics, punctuation and spaces on both sides. *Tests: Task 1.*
2. **No leaks across roles:** a role never sees a result it can't open. Kitchen searching an invoice number finds nothing. Lobby searching "Spending" finds no screen. Nurse finds no Add member. *Tests: Task 2.*
3. **Storage blocked** (private mode or blocked site data, so `localStorage` throws): search still works and just keeps no recents. *Test: Task 4.*
4. **Open and close:** opening a result closes the overlay and navigates. Esc, the close button and ⌘K while open all close it. The input is focused on open. *Test: Task 4.*
5. **Garbage input:** a 200-character query, or one of only symbols, returns no results without throwing and shows "Nothing found". *Tests: Task 1 and Task 4.*

---

### Task 1: Normalising and ranking

**Files:**
- Create: `apps/web/src/lib/search.ts`
- Test: `apps/web/src/lib/search.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type SearchGroup = 'screens' | 'actions' | 'people' | 'records';
  export const SEARCH_GROUPS: SearchGroup[]; // ['screens', 'actions', 'people', 'records']
  export interface SearchItem { id: string; group: SearchGroup; label: string; sub?: string; icon: string; to: string; terms: string[] }
  export interface SearchHit extends SearchItem { score: number }
  export function normalize(text: string): string;
  export function scoreTerm(q: string, term: string): number;
  export function scoreItem(q: string, item: SearchItem): number;
  export function rank(items: SearchItem[], query: string, perGroup?: number): { group: SearchGroup; hits: SearchHit[] }[];
  ```
  - **`normalize`:** lower-case, NFD with combining marks removed, every run of characters that is not a letter or digit becomes one space, then trim.
  - **`scoreTerm`:** both arguments are already normalised.
    - 100: the term equals the query.
    - 80: the term starts with the query.
    - 60: some word of the term starts with the query.
    - 40: the query has several words, and each one is a prefix of a different word of the term.
    - 20 (typo): every query word is either a prefix of a term word, or has 4+ letters and is within Levenshtein distance 1 of a term word or of that word's prefix of the same length.
    - 0 otherwise.
  - **`scoreItem`:** the best `scoreTerm` over `[label, sub, ...terms]`, each normalised.
  - **`rank`:** normalises the query and returns `[]` when it is empty. It drops items scoring 0, sorts each group by score (high first) and then label (A–Z, `localeCompare`), keeps `perGroup` (default 6) per group, and returns the groups in `SEARCH_GROUPS` order without empty ones.

- [ ] **Step 1: Write the failing tests.**
  - `normalize`:
    - `'  Oma  LÍNA '` → `'oma lina'`
    - `'INV-2609-020'` → `'inv 2609 020'`
    - `'***'` → `''`
  - `scoreTerm` for each band:
    - `('tagihan','tagihan')` = 100
    - `('tag','tagihan')` = 80
    - `('lina','oma lina')` = 60
    - `('2609 020','inv 2609 020')` = 40
    - `('tagihqn','tagihan')` = 20 (one wrong letter)
    - `('tagiahn','tagihan')` = 0 (a swap is distance 2)
    - `('tg','tagihan')` = 0
  - `rank`:
    - Over a fixture of six items in all four groups, the query `'bil'` puts the Billing screen first in Screens.
    - `rank(items, '')` → `[]`.
    - `rank(items, 'x'.repeat(200))` → `[]`.
    - `rank(items, '%%%')` → `[]`.
    - Groups come back in `SEARCH_GROUPS` order, and with 8 matching people and `perGroup` 6, People has 6 hits.
- [ ] **Step 2: Run `pnpm vitest run apps/web/src/lib/search.test.ts`.** Expected: FAIL (the module is missing).
- [ ] **Step 3: Implement** `apps/web/src/lib/search.ts`, with a small iterative Levenshtein that stops early above 1.
- [ ] **Step 4: Run the test and the typecheck.** Expected: PASS.
- [ ] **Step 5: Commit** with the message `round 14 e: search normalising and ranking`.

### Task 2: The registry and the role-gated index

**Files:**
- Create: `apps/web/src/app/searchRegistry.ts`
- Create: `packages/shared/src/i18n/en/search.ts` and `packages/shared/src/i18n/id/search.ts`, and register both.
- Test: `apps/web/src/app/searchRegistry.test.ts`

**Interfaces:**
- Consumes: `SearchItem` (Task 1); `NAVS` and `allowedKeys(role)` from `app/nav.ts`; `displayName`, `memberName`, `live` and the other `@cp/shared` helpers for the people labels.
- Produces:
  ```ts
  export interface ScreenEntry { key: string; label: string /* i18n key */; icon: string; keywords: { en: string[]; id: string[] } }
  export interface ActionEntry { id: string; label: string /* i18n key */; icon: string; roles: Role[]; to: (role: Role) => string; keywords: { en: string[]; id: string[] } }
  export const SCREEN_ENTRIES: ScreenEntry[];
  export const ACTION_ENTRIES: ActionEntry[];
  export function buildSearchIndex(s: ClubState, role: Role, t: (k: string, p?: Record<string, string | number>) => string): SearchItem[];
  ```
- **What `buildSearchIndex` includes:**
  - **Screen entries:** only those whose `key` is in `allowedKeys(role)`. The label is the role's own nav label for that key (`NAVS[role]`) when present, so "today" reads Arrivals, Menu or Billing per role; otherwise it is the entry's label. `to` is `'/' + key`.
  - **Action entries:** only for roles listed in `roles`.
  - **People and records:** only when the role can open the target key from R4. members and family contacts need `members`. staff needs `hr`. guest hosts need `guests`. invoices need `billing`. leads need `enquiries`. dishes need `menu`, or `today` for kitchen. activities need `calendar`. suppliers need `directory`.
  - Every item's `terms` are both languages' keywords (R1), plus:
    - a member's full name and nickname;
    - a family contact's relation to its parent's display name;
    - an invoice's number, its member's name and its period;
    - a lead's senior name and contact name.
  - Item ids are `screen:<key>`, `action:<id>`, `member:<id>`, `contact:<id>`, `staff:<id>`, `host:<id>`, `invoice:<id>`, `lead:<id>`, `dish:<id>`, `activity:<id>` and `supplier:<id>`.
  - **Subs:**
    - member: plan or status
    - contact: "Family of {name}"
    - invoice: "{member} · {period} · Rp …"
    - lead: the stage
    - dish: the course
    - supplier: the category
  - Only live rows count (no `deletedAt`). Voided invoices and inactive activities are skipped.

  Screen keywords (exact values; labels come from `nav.*`):

  | key | EN keywords | ID keywords |
  |---|---|---|
  | today | today, home, arrivals, check in | hari ini, beranda, kedatangan, absen |
  | members | members, seniors, oma, opa, profile | anggota, lansia, profil |
  | reviews | approvals, review, pending | persetujuan, setujui |
  | tasks | tasks, duties, to do, leave | tugas, cuti |
  | report | daily report | laporan harian |
  | monthReport | month report, monthly | laporan bulanan |
  | enquiries | enquiries, leads, prospects, trial | prospek, calon, uji coba |
  | renewals | next month, renewals, unpaid, overdue | bulan depan, perpanjang, belum bayar, tunggakan |
  | hchecks | health checks, blood pressure, vitals | cek kesehatan, tensi, tekanan darah |
  | readings | readings, trends | hasil cek, tren |
  | log | daily log, mood, notes | catatan harian, suasana hati |
  | camera | camera, photos, pictures | kamera, foto |
  | photos | photo library, gallery | galeri foto |
  | menu | menu, dishes, food, allergy | makanan, hidangan, alergi |
  | lunch | lunch round, who ate | makan siang |
  | feedback | feedback, complaints | masukan, keluhan |
  | stock | stock, supplies, inventory | stok, persediaan |
  | billing | billing, invoice, bills | tagihan, invoice, faktur, bayar |
  | payments | payments, transfer, virtual account | pembayaran, bayar, transfer |
  | budget | budget | anggaran |
  | receipts | receipts, nota, purchases | nota, kuitansi, belanja |
  | spending | spending, expenses, purchases | pengeluaran, belanja, biaya |
  | calendar | calendar, schedule, programme, activities | kalender, jadwal, kegiatan |
  | guests | guest hosts, teachers, performers | pengisi acara, tamu |
  | insights | insights, statistics | statistik, wawasan |
  | broadcast | broadcast, announcement, message | pengumuman, siaran |
  | venue | venue, bookings, rental | sewa tempat, pemesanan |
  | hr | people, staff, team, hr | karyawan, staf, tim |
  | directory | directory, suppliers, doctors | direktori, pemasok, dokter |
  | contacts | contacts, phone numbers | kontak, nomor telepon |
  | surveys | surveys | survei |
  | plans | plans, pricing, prices | paket, harga |
  | requests | requests, stock request, budget request | permintaan |
  | drafts | drafts | draf |

  Actions (exact values; `search.act.*` strings in the copy table):

  | id | roles | to | EN keywords | ID keywords |
  |---|---|---|---|---|
  | addMember | lobby, mgmt | `/members?do=add` | add member, register, new member, join | tambah anggota, daftar, pendaftaran |
  | recordPayment | finance, mgmt | `/payments` | record payment, paid, transfer, cash | catat pembayaran, bayar, lunas, tunai |
  | requestLeave | lobby, nurse, activity, kitchen, finance, mgmt | `/tasks` | leave, day off, holiday | cuti, izin, libur |
  | newCelebration | lobby, activity, mgmt | `/celebrations` | birthday, celebration, party | ulang tahun, perayaan, pesta |
  | submitReceipt | lobby, nurse, activity, kitchen, finance, mgmt | finance and mgmt → `/receipts?do=snap`, others → `/requests?do=receipt` | receipt, nota, purchase, snap | nota, kuitansi, belanja, foto nota |

- [ ] **Step 1: Write the failing tests** on `buildSeed(...)` at the e2e date, with a stub `t` that returns the key:
  - **Gating:**
    - For `kitchen`, no item has group `people` with id `member:*`, none is `invoice:*`, and searching `'INV'` gives no Records.
    - For `lobby`, there is no `screen:spending`, and `action:addMember` is present.
    - For `nurse`, there is no `action:addMember`.
    - For `finance`, `invoice:*` items exist and `action:submitReceipt` goes to `/receipts?do=snap`.
    - For `lobby`, `action:submitReceipt` goes to `/requests?do=receipt`.
  - **Labels:** for `kitchen`, `screen:today`'s label is the kitchen's nav label key (`nav.menu`).
  - **Results:**
    - `rank(buildSearchIndex(s, 'finance', t), 'tagihan')` puts `screen:billing` first in Screens (R1).
    - For `mgmt`, searching Oma Lina's nickname puts `member:m1` first in People.
    - Searching one invoice's exact number puts that invoice first in Records.
  - **Registry completeness:** every key in any staff `NAVS` list has a `SCREEN_ENTRIES` entry. A new nav item without a registry entry fails this test.
- [ ] **Step 2: Run `pnpm vitest run apps/web/src/app/searchRegistry.test.ts`.** Expected: FAIL.
- [ ] **Step 3: Implement** the registry, `buildSearchIndex` and the `search` i18n namespace (the copy table at the end of this plan).
- [ ] **Step 4: Run the tests and the typecheck.** Expected: PASS.
- [ ] **Step 5: Commit** with the message `round 14 e: search registry and the role-gated index`.

### Task 3: Deep links on the target screens

**Files:**
- Modify:
  - `apps/web/src/features/members/MembersList.tsx`: `?do=add` opens Add member, only when `canAdd`.
  - `apps/web/src/features/requests/Requests.tsx`: `?do=receipt` opens the receipt panel.
  - `apps/web/src/features/finance/Receipts.tsx`: `?do=snap` opens the snap panel.
  - `apps/web/src/features/finance/Billing.tsx`: `?inv=<id>` opens that invoice's sheet.
  - `apps/web/src/features/finance/Directory.tsx`: `?q=<text>` pre-fills the search.
- Test: create `apps/web/src/app/deepLinks.test.tsx`.

**Interfaces:**
- Consumes: the `to` paths from Task 2's tables.
- Produces: nothing new for later tasks.
- **Behaviour:**
  - Each parameter is read once on mount and then removed from the URL with `replace: true`, the way `Enquiries.tsx` handles `e`, so Back doesn't reopen the sheet.
  - An unknown invoice id, or `do=add` for a role that can't add, does nothing.

- [ ] **Step 1: Write the failing tests:**
  - Mounting MembersList for `lobby` at `/members?do=add` shows the Add member flow, and the URL loses `do`.
  - The same for `nurse` shows no flow.
  - Billing for `finance` at `/billing?inv=<a seeded invoice id>` shows that invoice's number in the open sheet.
  - `?inv=nope` opens nothing.
  - Receipts at `/receipts?do=snap` shows the capture's photo button.
  - Requests at `/requests?do=receipt` shows the capture.
  - Directory at `/directory?q=Bersih` lists Bersih Prima and not Sayur Segar Kemang.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the tests and the typecheck.** Expected: PASS.
- [ ] **Step 5: Commit** with the message `round 14 e: deep links for search results (add member, snap, invoice, directory)`.

### Task 4: The search overlay and its three entry points

**Files:**
- Create: `apps/web/src/shell/SuperSearch.tsx`
- Modify: `apps/web/src/shell/AppShell.tsx`:
  - the phone logo header (~:66): a 44 px search icon button before the bell;
  - the `Sidebar` (~:128): a field-like button under the wordmark reading the placeholder, plus "⌘K" (or "Ctrl K" on non-Mac);
  - a `keydown` listener for ⌘K / Ctrl-K that toggles the overlay (staff only, `preventDefault`).
- Test: create `apps/web/src/shell/SuperSearch.test.tsx`.

**Interfaces:**
- Consumes: `rank`, `SEARCH_GROUPS` (Task 1); `buildSearchIndex` (Task 2); `useClub`, `useMe`, `useT`, `useNavigate`, `useDevice`.
- Produces: `export function SuperSearch({ open, onClose }: { open: boolean; onClose: () => void })`.
- **Behaviour:**
  - **Layout:** on phones a full-screen layer (a top row with the input and a Close button, results below). On tablet and laptop a centred panel, 640 px wide, near the top, over a dimmed page.
  - **Open:** the input is focused.
  - **Index:** built with `useMemo` on the club state and the role.
  - **Results:** grouped, each group under its translated heading. A row shows its icon, label and sub, is 48 px tall, and is a button.
  - **Laptop keys:** ↑/↓ move a highlighted row and Enter opens it.
  - **Opening a result:** store the query in recents, close, then `navigate(item.to)`.
  - **Empty field:** shows "Recent searches" with the stored queries and a "Clear" button. With nothing stored, it shows a one-line hint.
  - **No match:** "Nothing found for "{q}"".
  - **Recents:** in `localStorage` key `cp.search.recent` (a JSON string array). Every read and write is wrapped in try/catch, and a failure means no recents.

- [ ] **Step 1: Write the failing tests** (mount as other shell tests do; mock `useNavigate`):
  - Open → the input has focus.
  - Type `tagihan` as finance → a Screens group with Billing. Tap it → navigate called with `/billing`, `onClose` called, and `cp.search.recent` holds `["tagihan"]`.
  - Re-open → "Recent searches" lists "tagihan", and tapping it fills the input.
  - "Clear" empties the list.
  - With `localStorage.getItem` and `setItem` made to throw, typing and opening still work, and no recents show.
  - Esc calls `onClose`.
  - `'%%%'` → "Nothing found".
  - In AppShell at phone size, the search icon opens the overlay. On laptop size, the sidebar field opens it and a `keydown` of `k` with `metaKey` opens it, then closes it again.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the tests, the typecheck and lint. Then check in the browser** on the dev server at phone width (lobby `s1` and finance `s10`):
  - The icon opens the overlay.
  - "tagihan" finds Billing for finance and nothing for lobby.
  - "oma" lists members.
  - An action opens its sheet.
  - Also check one laptop-width ⌘K open.
- [ ] **Step 5: Commit** with the message `round 14 e: super search overlay (phone icon, sidebar field, Cmd/Ctrl-K)`.

### Task 5: Phase story e2e and close-out

**Files:**
- Create: `e2e/round14search.spec.ts`

- [ ] **Step 1: Write the e2e story** (phone project, CP_SEED_SMALL at 2026-10-21):
  - Finance (`s10`): tap the search icon, type `tagihan`, open Billing (URL `/billing`).
  - Search a seeded invoice's number and open it: the invoice sheet shows that number.
  - Lobby (`s1`): search `tambah anggota` and open the action: the Add member flow is open.
  - Search `Spending`: no Screens group.
  - Kitchen (`s3`): search an invoice number: "Nothing found".
- [ ] **Step 2: Run the story alone, then the whole phone suite once:**
  - `E2E_NAME=e5 E2E_PORT=8891 scripts/e2e-all.sh 1 phone round14search`
  - `E2E_NAME=e5 E2E_PORT=8891 scripts/e2e-all.sh 4 phone`

  Expected: all pass.
- [ ] **Step 3: Run `pnpm -s typecheck && pnpm -s lint && pnpm -s test`.** Expected: clean, all pass.
- [ ] **Step 4: Commit** with the message `round 14 e: search phase story e2e`.

---

## Copy (EN / ID), namespace `search`

| key | EN | ID |
|---|---|---|
| open | Search | Cari |
| placeholder | Search screens, people, invoices… | Cari menu, orang, tagihan… |
| close | Close search | Tutup pencarian |
| g.screens / g.actions / g.people / g.records | Screens / Actions / People / Records | Menu / Tindakan / Orang / Data |
| recent | Recent searches | Pencarian terakhir |
| clear | Clear | Hapus |
| hint | Type a name, an invoice number or a screen | Ketik nama, nomor tagihan atau menu |
| none | Nothing found for "{q}" | Tidak ditemukan untuk "{q}" |
| act.addMember | Add member | Tambah anggota |
| act.recordPayment | Record payment | Catat pembayaran |
| act.requestLeave | Request leave | Ajukan cuti |
| act.newCelebration | New celebration | Perayaan baru |
| act.submitReceipt | Submit receipt | Kirim nota |
| familyOf | Family of {name} | Keluarga {name} |
