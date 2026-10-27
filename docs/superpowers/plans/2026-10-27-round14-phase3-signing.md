# Round 14 Phase 3 (D: online signing and e-Meterai) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The membership application form can be signed without paper:
1. The front desk sends it.
2. The family reads it, draws a signature and confirms with a code.
3. Management countersigns in Approvals.
4. A simulated e-Meterai stamps it.

A physical meterai on paper stays available. Every step shows on the member's Documents list.

**Architecture:**
- **State:** the signing lives on the member's `membershipForm` document (`MemberDocument.signing`).
- **Actions:** shared immer actions (`signing.send`, `signing.sign`, `signing.physical`, `signing.stamp`) and a new `signing` approval type, whose Approve is the countersign.
- **Server:** stamping goes through a swappable `StampProvider` (`apps/server/src/providers/stampProvider.ts`). The server runs it in a sweep after each action and on the jobs tick, then applies the serial with a system-only action.
- **Web:**
  - The existing printable `ApplicationForm` gains a signed overlay: the signature, the countersign and the e-Meterai box.
  - A `SignaturePad` and a family `SignSheet` are new.
  - The staff Docs tab and the family profile's Documents section show the status trail.
- KC deferred D4 (the DOKU provider) on 27 Oct, so it is not in this plan.

**Tech Stack:** TypeScript, pnpm monorepo, immer actions, Hono, React 18, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-23-round14-ops-team-design.md` §Phase 3 — D (D1–D3; D4 deferred by KC), plus its Conventions and Testing sections.

## Global Constraints

- Signing statuses: `MemberDocument` gains `signing?: { status: 'draft' | 'sent' | 'signed' | 'countersigned' | 'stamped'; steps: { status, at, by }[]; meterai: 'e' | 'physical'; meteraiSerial?: string }`. Task 1 adds the fields the flow needs.
- "The front desk taps **Send for signing** (simulated WhatsApp link) or the family opens it from the family app, Me → Documents."
- "The family reads the filled form, draws a signature, and confirms with a simulated 6-digit OTP. Management then countersigns in Approvals."
- "Per document, the front desk chooses **e-Meterai** (default) or **Physical meterai**."
- "e-Meterai: server interface `apps/server/src/providers/stampProvider.ts`, `affix(documentId) → { serial, at }`; the simulated provider returns a serial; the signed PDF shows the e-Meterai box with the serial."
- "Physical: print, sign over a paper meterai, scan or photograph it with the existing paper-form scan; the document is marked 'Physical meterai' and goes straight to stamped."
- "The member profile Documents list shows each document's status (Draft → Sent → Signed by family → Countersigned → Stamped) and its timeline (who, when)."
- **Conventions:**
  - Role checks are server-side through `can`, with front desk = `lobby` and `mgmt`.
  - Front-desk uploads that families see go through the existing `docsConsent` review gate, which management passes straight through.
  - Every string is in EN and ID: add a new namespace `sign`, registered like `search`.
  - The UI is dense and phone-first: 44 px targets, ink, grey and white, no pastel tints.
- **Seed:** RNG-neutral (no draws needed), `CP_SEED_SMALL=1` keeps working, and the state stays under the 7,500,000-character cap at the real date and at 2026-12-30. Headroom is about 55,000 characters.
- **Tests:** typecheck, unit tests for the new rules and actions (spec: "signing status moves"), and one e2e pass of the phase story on a phone viewport.

## Rulings made while writing this plan (KC to confirm in review)

- **R1 Two routes:** Send for signing is the e-Meterai route. Physical meterai is the paper route: print, sign over the meterai, scan with `signing.physical`. So "the front desk chooses" means picking one of the two buttons on the membership form row.
- **R2 What the family signs:** a snapshot of the form data taken at Send (`signing.form`). Editing the member afterwards doesn't change it; Resend takes a new snapshot.
- **R3 Who signs:** only the form's signer (the primary billing contact) can sign. Other family users see the status only.
- **R4 The code:** the simulated OTP accepts any 6 digits, like the demo login. The sheet says where the code "was sent" (a masked phone number) and adds "Demo: any 6 digits".
- **R5 The WhatsApp link:** simulated. Send notifies the signer in the family app, with a link to their parent's profile and its sign sheet open. The toast says the WhatsApp link was sent (simulated).
- **R6 Rejecting a countersign:** this sends the form back to Draft with the reason. The front desk can then resend.
- **R7 The signed PDF:** it is the existing print view (Print → Save as PDF) with the signed overlay. The server makes no PDF.
- **R8 When stamping runs:** the server sweeps after each action and on the jobs tick. It stamps every countersigned e-Meterai form without a serial, and the system action refuses a second stamp, so a sweep that runs twice is harmless.

## Review Focus

1. **Stale links:** the family opens an old or second link after the form was re-sent, signed or stamped. The sheet shows the current state ("Already signed" or the newest form) and the server refuses a sign in the wrong status. *Tests: Task 1 and Task 6.*
2. **Incomplete signing:** an empty signature or a code that isn't 6 digits keeps Sign disabled, and the server refuses the same input. *Tests: Task 1 and Task 6.*
3. **Edits after Send:** the member is edited after Send. The signed view shows the snapshot that was sent, not the edited data. *Test: Task 4.*
4. **Slow or failing stamp provider:** the form stays Countersigned and is stamped on the next sweep, never twice. *Test: Task 3.*
5. **Wrong person:** a family user who isn't the signer, a nurse trying to send, or staff trying to stamp are each refused. *Tests: Task 1.*

---

### Task 1: The signing model, rules and actions

**Files:**
- Modify: `packages/shared/src/types.ts`: add `MemberDocument.signing?` and the types below. A type-only import of `ApplicationFormData` from `./rules/applicationForm` is fine.
- Create: `packages/shared/src/rules/signing.ts`
- Create: `packages/shared/src/actions/signing.ts`, registered in `actions/index.ts` like the other action files.
- Create: `packages/shared/src/i18n/en/sign.ts` and `id/sign.ts`, registered in both `index.ts` files. Add the whole copy table now.
- Test: `packages/shared/src/rules/signing.test.ts` and `packages/shared/src/actions/signing.test.ts`

**Interfaces:**
- Produces (types.ts):
  ```ts
  export type SignStatus = 'draft' | 'sent' | 'signed' | 'countersigned' | 'stamped';
  export interface SignStep { status: SignStatus; at: DT; by: Actor; note?: string }
  export interface Signing { status: SignStatus; steps: SignStep[]; meterai: 'e' | 'physical'; meteraiSerial?: string;
    form?: ApplicationFormData; signatureMediaId?: string; signerName?: string; countersignerName?: string; note?: string }
  ```
- Produces (rules/signing.ts):
  - `SIGN_STATUSES: SignStatus[]` (in the order above)
  - `formDoc(m: Member): MemberDocument | undefined` (the `membershipForm` document)
  - `signingOf(m: Member): Signing | undefined`
  - `signTrail(sig: Signing): { status: SignStatus; at?: DT; by?: Actor }[]`:
    - e-Meterai: all five statuses in order. Reached ones carry the latest step's `at`/`by`; later ones carry none.
    - physical: only the recorded steps.
  - `signerOf(s: ClubState, memberId: string): FamilyContact | undefined` (= `primaryContact`)
  - `canSign(s: ClubState, memberId: string, familyId: string): boolean`
  - `maskPhone(e164: string): string`, e.g. `'+62 ••• 4471'`
- Produces (actions, all on the member's `membershipForm` document, created with `docIdFor` when missing):
  - **`signing.send` `{ memberId }`**
    - `can`: front desk.
    - It fails `sign.err.noSigner` without a primary contact, and `sign.err.notNow` when the status is `signed`, `countersigned` or `stamped`.
    - It sets `signing = { status: 'sent', meterai: 'e', form: applicationDataOf(s, m.id, today), steps }`. A first send appends steps `draft` and `sent`; a resend appends `sent` only.
    - The document's status becomes `'requested'` unless it is already on file.
    - It notifies the signer (`sign.notif.toSign`) with the link `/profile?member=<id>&sign=1`.
    - It writes a feed line.
  - **`signing.sign` `{ memberId, signatureMediaId, otp }`**
    - `can`: a family user for whom `canSign` is true.
    - parse: `otp` must match `/^\d{6}$/`, and `mediaIdOf(signatureMediaId)` is required.
    - It fails `sign.err.notNow` unless the status is `sent`.
    - It sets `status: 'signed'`, `signatureMediaId` and `signerName`, and appends a `signed` step.
  - **`signing.physical` `{ memberId, mediaId, fileName? }`**
    - `can`: front desk.
    - `review: { policy: 'gate', section: 'docsConsent', op: 'update', target: … }`, the same as `members.setDocuments`.
    - It puts the scan on file (`status: 'onFile'`, `via: 'staff'`, `mediaId`, `on: today`) and sets `signing = { status: 'stamped', meterai: 'physical', steps: [...old, stamped] }`.
  - **`signing.stamp` `{ memberId, serial, at }`**
    - `can`: only `systemUser` (`u.id === 'system'`).
    - It fails `sign.err.notNow` unless the status is `countersigned` and the meterai is `e`.
    - It sets `stamped` and `meteraiSerial`, appends a step by `system`, and puts the document on file (`status: 'onFile'`, `on: date of at`, `via: 'form'`).
    - It notifies the signer (`sign.notif.stamped`).

- [ ] **Step 1: Write the failing tests:**
  - **`signTrail`:**
    - A `sent` signing gives 5 rows: draft and sent with `at`, the other three without.
    - A physical signing gives only its recorded steps.
  - `maskPhone('+6281210904471')` → `'+62 ••• 4471'`.
  - **`canSign`:** true for `f1` and `m1` (the seed's primary contact), false for a non-primary family contact of `m1`.
  - **`signing.send`:**
    - Sending as lobby `s1` for `m1` gives `sent`, steps `[draft, sent]`, and a `form.signer` equal to Maria's name.
    - Editing `m1`'s address afterwards leaves `signing.form.address` unchanged.
    - A resend appends one `sent` step.
    - A nurse is refused (`err.forbidden`).
  - **`signing.sign`:**
    - As `f1` with otp `'123456'` it gives `signed` with `signerName`.
    - Otp `'12345'` or a missing signature → refused (the parse error code).
    - Signing again → `sign.err.notNow`.
    - The non-primary contact is refused.
  - **`signing.stamp`:**
    - As `systemUser` on a `countersigned` form it gives `stamped`, the serial, and the document on file.
    - As `s9` (management) it is refused.
    - On a `stamped` form → `sign.err.notNow`.
  - **`signing.physical`:**
    - As management it goes straight to `stamped` with `meterai: 'physical'` and the scan's `mediaId`.
    - As lobby it creates a pending review (the document doesn't change until approved).
- [ ] **Step 2: Run `pnpm vitest run packages/shared/src/rules/signing.test.ts packages/shared/src/actions/signing.test.ts`.** Expected: FAIL.
- [ ] **Step 3: Implement.** Match the idiom of `actions/members.ts` and `actions/family.ts` (`editable`, `feed`, `docIdFor`, `ctx.notify`).
- [ ] **Step 4: Run the tests and `pnpm -s typecheck`.** Expected: PASS.
- [ ] **Step 5: Commit** with the message `round 14 d: signing model, rules and actions`.

### Task 2: Countersigning in Approvals

**Files:**
- Modify: `packages/shared/src/rules/approvals.ts`: add `'signing'` to `ApprovalType` and to `APPROVAL_TYPES` (after `'leave'`), and a `pendingSigning(s)` item builder in the items map.
- Modify: `packages/shared/src/actions/approvals.ts`: `APPROVE.signing` and `REJECT.signing`.
- Modify: `approvals.tab.signing` in the EN and ID `approvals` namespace.
- Test: extend `packages/shared/src/actions/approvals.test.ts` (or whatever file tests `APPROVE` and `REJECT` today).

**Interfaces:**
- Consumes: `Signing`, `signingOf` (Task 1).
- Produces:
  - **Items:** `ApprovalItem { id: <memberId>, type: 'signing', at: <signed step at>, by: <signer actor> }` for every member whose form is `signed`.
  - **Approve (the countersign):** `countersigned`, `countersignerName` (the approver's name), a `countersigned` step.
  - **Reject:** back to `draft` with `note`, a `draft` step with the note. It notifies the front desk (`sign.notif.returned`).
  - **Conflict:** approving a form that is no longer `signed` counts as a conflict, the way stale programme approvals do.

- [ ] **Step 1: Write the failing tests:**
  - A `signed` form for `m1` gives one `signing` item.
  - Approving it as `s9` makes it `countersigned` with `countersignerName` Ega.
  - Rejecting it with "Wrong plan" makes it `draft` with that note.
  - Approving a form that was re-sent meanwhile (status `sent`) reports a conflict and changes nothing.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the tests and the typecheck.** Expected: PASS.
- [ ] **Step 5: Commit** with the message `round 14 d: countersign in Approvals`.

### Task 3: The stamp provider and the server sweep

**Files:**
- Create: `apps/server/src/providers/stampProvider.ts`
- Modify: `apps/server/src/state.ts`: run `stampCountersigned(clubId)` after every `runAction` that isn't a system action, and in `runJobsNow`.
- Test: extend `apps/server/src/server.test.ts`.

**Interfaces:**
- Consumes: `signing.stamp` (Task 1), `systemUser`, `runActionRaw`/`runAction`.
- Produces:
  - `export interface StampProvider { affix(input: { documentId: string; memberId: string }): Promise<{ serial: string; at: string }> }`
  - `export function stampProvider(): StampProvider`: chosen by `CP_STAMP_PROVIDER` (only `'sim'`, the default; an unknown value throws at boot).
  - **The simulated provider:**
    - It waits `Number(process.env.CP_STAMP_DELAY_MS ?? 800)` ms.
    - It returns `serial` = 22 upper-case letters and digits, deterministic from `documentId` plus the time (a hash).
    - `at` is the server clock's now.
  - `export async function stampCountersigned(clubId: string): Promise<number>`:
    - It finds members whose form is `countersigned` with meterai `e` and no serial.
    - For each it calls `affix`, then runs `signing.stamp` as `systemUser`.
    - It catches and logs provider errors and leaves the form countersigned.
    - It returns how many it stamped.
    - It never runs twice at once for a club (a per-club in-flight promise).

- [ ] **Step 1: Write the failing server tests** (`CP_STAMP_DELAY_MS=0`):
  - After management approves a `signed` form through `/api/actions/approvals…`, waiting for the sweep leaves it `stamped` with a 22-character serial.
  - With a provider stubbed to throw once, the form stays `countersigned`. The next sweep stamps it.
  - Two sweeps started together stamp once (one `stamped` step).
  - Posting `signing.stamp` as staff returns 403.
- [ ] **Step 2: Run `pnpm vitest run apps/server/src/server.test.ts`.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the server tests and the typecheck.** Expected: PASS.
- [ ] **Step 5: Commit** with the message `round 14 d: e-Meterai stamp provider and the server sweep`.

### Task 4: Signature pad and the signed form view

**Files:**
- Create: `apps/web/src/components/ui/SignaturePad.tsx`, exported from the ui index.
- Modify: `apps/web/src/features/members/ApplicationForm.tsx`: an optional `signing?: Signing` prop on `ApplicationForm`, and `useApplicationForm().open(data, signing?)`.
- Test: `apps/web/src/components/ui/SignaturePad.test.tsx`; extend `apps/web/src/features/members/ApplicationForm.test.tsx`.

**Interfaces:**
- Consumes: `Signing` (Task 1), `mediaUrl`.
- Produces:
  - `export function SignaturePad({ onChange, label }: { onChange: (png: Blob | null) => void; label: string })`:
    - a canvas drawn with pointer events (mouse, touch, pen);
    - a 44 px "Clear" button;
    - `onChange(null)` while empty, and a PNG blob after each stroke ends;
    - full width, 180 px tall on phones.
  - **`ApplicationForm` with `signing`:**
    - It renders `signing.form` when present (R2), else `data`.
    - The signature image (`mediaUrl(signatureMediaId)`) goes above the signer name on pages 1, 3 and 4 (`data-field="signature"`).
    - On page 4: "Disetujui: {countersignerName} · {date}" once countersigned (`data-field="countersign"`).
    - For an e-Meterai with a serial, a bordered box reading "e-Meterai · 10000 · {serial}" next to the page-4 signer (`data-field="emeterai"`).
    - For a physical one, no box.
    - Positions are measured on the page images like the other fields (share of the 1654 × 2339 page).

- [ ] **Step 1: Write the failing tests:**
  - **SignaturePad:** a pointer stroke calls `onChange` with a Blob. Clear calls `onChange(null)`. jsdom has no canvas drawing, so stub `HTMLCanvasElement.prototype.getContext` and `toBlob` as other canvas tests in the repo do (see `CameraCapture`), or test the pointer bookkeeping.
  - **ApplicationForm with a stamped e-Meterai signing:** it shows `[data-field="signature"]` ×3, the countersign text with Ega's name, and the e-Meterai box with the serial.
  - With a physical signing, no e-Meterai box.
  - With `signing.form.address` differing from `data.address`, the page shows the snapshot's address.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the tests and the typecheck.** Expected: PASS.
- [ ] **Step 5: Commit** with the message `round 14 d: signature pad and the signed form view`.

### Task 5: Staff screens: send, physical meterai, status trail, Approvals

**Files:**
- Create: `apps/web/src/features/members/profile/SigningTrail.tsx`: the status badge plus the expandable timeline, shared by staff and family.
- Modify: `apps/web/src/features/members/profile/DocsTab.tsx`, on the `membershipForm` row:
  - the status badge and `SigningTrail`;
  - front desk buttons: **Send for signing** (or **Resend** while `sent`, hidden once `signed` or later), and **Physical meterai** (opens the print view, then an upload control whose file goes to `signing.physical`);
  - **View signed form** once there is a signature;
  - keep **Print**.
- Modify: `apps/web/src/features/members/Reviews.tsx`: the `signing` tab rows (member, signer, signed at, a **View** button opening the form with the signature). Approve reads "Countersign"; Reject asks for a reason, as other tabs do.
- Test: create `apps/web/src/features/members/profile/Signing.test.tsx`.

**Interfaces:**
- Consumes: Tasks 1, 2 and 4. `SigningTrail` takes `{ sig: Signing }`; the badge words are `sign.status.<status>`.
- Produces: `export function SigningTrail({ sig }: { sig: Signing })`, reused by Task 6.

- [ ] **Step 1: Write the failing tests:**
  - **Lobby on `m1`'s Docs tab:**
    - "Send for signing" calls `act('signing.send', { memberId: 'm1' })` with a toast mentioning WhatsApp.
    - With a `sent` signing the button reads "Resend" and the trail lists Draft and Sent with times.
  - A nurse sees no Send button.
  - "Physical meterai", given a chosen file, calls `act('signing.physical', …)` with its `mediaId`.
  - **Management in Approvals → Signing:** one row for a `signed` form built in the test (the roster's seeded one doesn't exist in the small world). Countersign calls the approval action. View opens `[data-testid="application-form"]` with `[data-field="signature"]`.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the tests, the typecheck and lint.** Expected: PASS.
- [ ] **Step 5: Commit** with the message `round 14 d: staff signing: send, physical meterai, status trail, countersign`.

### Task 6: Family screens: Me → Documents and the sign sheet

**Files:**
- Create: `apps/web/src/features/family/SignSheet.tsx`
- Modify:
  - `apps/web/src/features/family/FamilyMe.tsx`: a **Documents** row. It shows the number of forms waiting for this user's signature, and opens the first parent's profile at its Documents section with `sign=1` when one waits.
  - `apps/web/src/features/family/profile/sections.tsx`: in `DocsSection`, the membership form row shows `SigningTrail` and, for the signer while `sent`, **Read and sign**. `sign=1` in the URL opens the sheet once.
- Test: create `apps/web/src/features/family/SignSheet.test.tsx`.

**Interfaces:**
- Consumes: `signingOf`, `canSign`, `maskPhone` (Task 1); `SignaturePad`, `ApplicationForm` with a signing (Task 4); `SigningTrail` (Task 5); `uploadMedia`.
- Produces: `export function SignSheet({ memberId, open, onClose }: { memberId: string; open: boolean; onClose: () => void })`.
- **The three steps, full screen on phones:**
  1. **Read:** a "Read the form" button opens the form view (the snapshot), then an "I have read the form" check.
  2. **Sign:** the SignaturePad.
  3. **Confirm:** "We sent a code to {phone}" (masked) with "Demo: any 6 digits", a 6-digit numeric input, and **Sign**.

  On Sign: upload the PNG, then `act('signing.sign', { memberId, signatureMediaId, otp })`, then a done view ("Signed. The club will countersign it."). The sheet re-reads the live status: if the form is no longer `sent`, it shows "This form is already signed" (or the current status) instead of the steps.

- [ ] **Step 1: Write the failing tests** (as `f1` on the seed with `m1`'s form `sent`):
  - The Me Documents row shows 1.
  - Sign stays disabled until the read check, a stroke and 6 digits.
  - With all three, it uploads and calls `signing.sign` with the otp.
  - A non-primary family user sees no Read and sign.
  - With the form already `signed`, opening `sign=1` shows "already signed".
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the tests, the typecheck and lint.** Expected: PASS.
- [ ] **Step 5: Commit** with the message `round 14 d: family signs the form from Me, Documents`.

### Task 7: Seed, phase story e2e and close-out

**Files:**
- Create: `packages/shared/src/seed/r7/signing.ts`, called from `seedRound7` before `seedMoodMarks`.
- Create: `e2e/round14signing.spec.ts`
- Test: extend `packages/shared/src/seed/history.test.ts`.

**Interfaces:**
- Consumes: Tasks 1–6.
- **Seed (both worlds, no random draws):**
  - `m1` (Oma Lina): form `sent` by Caca at T-1 09:30, so Maria (`f1`) has a form to sign.
  - Roster only (`if (!s.members.m51)` as in `seedUnpaid`): one member's form `signed` by its primary contact at T-1 16:00, so management has a countersign waiting.
  - Each snapshot is built with `applicationDataOf` at its send date.

- [ ] **Step 1: Write the seed tests:**
  - At the demo date, `signingOf(m1).status === 'sent'`.
  - In the roster seed, one `signing` approval item exists.
  - Both size-cap tests still pass.
- [ ] **Step 2: Implement the seed.** Run `pnpm vitest run packages/shared/src/seed`. Expected: PASS.
- [ ] **Step 3: Write the e2e story** (phone project, CP_SEED_SMALL at 2026-10-21):
  - Maria (`f1`): Me → Documents (1) → Read and sign → read check → draw a stroke on the pad → code `123456` → Sign → "Signed".
  - Ega (`s9`): Approvals → Signing → View shows the signature → Countersign.
  - Back on `m1`'s Docs tab, wait for "Stamped" with an e-Meterai serial in the trail.
  - Caca (`s1`): on another member, Physical meterai → upload a file → the row shows "Physical meterai".
- [ ] **Step 4: Run the story alone, then the whole phone suite once:**
  - `E2E_NAME=d7 E2E_PORT=8895 scripts/e2e-all.sh 1 phone round14signing`
  - `E2E_NAME=d7 E2E_PORT=8895 scripts/e2e-all.sh 4 phone`

  Expected: all pass. Free disk space first if `ENOSPC` appears.
- [ ] **Step 5: Run `pnpm -s typecheck && pnpm -s lint && pnpm -s test`.** Expected: clean, all pass.
- [ ] **Step 6: Commit** with the message `round 14 d: signing seed and phase story e2e`.

---

## Copy (EN / ID), namespace `sign` unless noted

| key | EN | ID |
|---|---|---|
| send | Send for signing | Kirim untuk ditandatangani |
| resend | Resend | Kirim ulang |
| physical | Physical meterai | Meterai fisik |
| viewSigned | View signed form | Lihat formulir bertanda tangan |
| sentToast | WhatsApp link sent to {name} (simulated) | Tautan WhatsApp terkirim ke {name} (simulasi) |
| status.draft / status.sent / status.signed / status.countersigned / status.stamped | Draft / Sent / Signed by family / Countersigned / Stamped | Draf / Terkirim / Ditandatangani keluarga / Disetujui / Bermeterai |
| eMeterai | e-Meterai | e-Meterai |
| serial | Serial {s} | Nomor seri {s} |
| physicalDone | Physical meterai | Meterai fisik |
| docs | Documents | Dokumen |
| readSign | Read and sign | Baca dan tanda tangani |
| step.read / step.sign / step.confirm | Read / Sign / Confirm | Baca / Tanda tangan / Konfirmasi |
| readForm | Read the form | Baca formulir |
| haveRead | I have read the form | Saya sudah membaca formulir |
| drawHere | Sign here with your finger | Tanda tangani di sini dengan jari |
| clear | Clear | Hapus |
| codeSent | We sent a code to {phone} | Kode dikirim ke {phone} |
| codeDemo | Demo: any 6 digits | Demo: 6 angka apa saja |
| code | 6-digit code | Kode 6 angka |
| signBtn | Sign | Tanda tangani |
| done | Signed. The club will countersign it. | Sudah ditandatangani. Klub akan menyetujuinya. |
| already | This form is already signed | Formulir ini sudah ditandatangani |
| countersign | Countersign | Setujui |
| approvedBy | Disetujui: {name} · {d} | Disetujui: {name} · {d} |
| notif.toSign | Please sign {name}'s membership form | Mohon tanda tangani formulir keanggotaan {name} |
| notif.stamped | {name}'s membership form is signed and stamped | Formulir keanggotaan {name} sudah ditandatangani dan bermeterai |
| notif.returned | {name}'s form was sent back: {note} | Formulir {name} dikembalikan: {note} |
| err.noSigner | Add the billing contact first | Tambahkan kontak penagihan dulu |
| err.notNow | This form can't do that now | Formulir ini tidak bisa diproses sekarang |
| approvals.tab.signing (namespace `approvals`) | Signing | Tanda tangan |
