// CitraPremier shared data model. One ClubState per clubhouse; every row carries clubId.
// Times are club wall-clock strings: ISODate 'YYYY-MM-DD', HM 'HH:mm', DT 'YYYY-MM-DDTHH:mm'.

export type ISODate = string;
export type HM = string;
export type DT = string;
export type YM = string; // 'YYYY-MM'

export type Actor = `staff:${string}` | `family:${string}` | 'system' | 'doorCamera';
export type Health = 'normal' | 'watch' | 'alert';
export type Weekday = 1 | 2 | 3 | 4 | 5;
export type Lang = 'en' | 'id';
export type Title = 'Oma' | 'Opa' | 'Ibu' | 'Bapak';
export type Relation = 'daughter' | 'son' | 'daughterInLaw' | 'sonInLaw' | 'granddaughter' | 'grandson' | 'grandchild' | 'spouse' | 'sibling' | 'other';
export type FoodAllergen = 'shellfish' | 'seafood' | 'fish' | 'peanuts' | 'eggs' | 'dairy' | 'gluten';
export type DishAllergen = 'fish' | 'shellfish' | 'peanuts' | 'treeNuts' | 'eggs' | 'dairy' | 'gluten' | 'soy';
export type DrugAllergy = 'penicillin' | 'sulfa' | 'aspirin' | 'ibuprofen' | `other:${string}`;
export type Mobility = 'walkingStick' | 'walker' | 'wheelchair';
export type Diet = 'softFood' | 'lowSalt' | 'vegetarian' | 'sugarFree';
export type EndReason = 'movedAway' | 'careNeeds' | 'careHome' | 'passedAway' | 'familyDecision';
export type LostReason = 'price' | 'distance' | 'notReady' | 'otherPlace' | 'health' | 'other';
export type QuickNote = 'rested' | 'medsTaken' | 'dizzy' | 'headache' | 'rightArm';
export type StaffRole = 'lobby' | 'nurse' | 'activity' | 'kitchen' | 'finance' | 'mgmt' | 'housekeeping' | 'driver';
export type Bank = 'BCA' | 'Mandiri' | 'BNI' | 'BRI' | 'Permata';
export type Xero = 'synced' | 'pending' | 'awaitingPayment' | 'draft' | 'notSent';
export type SectionId = string; // 'fnb' | 'activities' | 'operations' | custom
export type Plan = 'flex' | 'gold';
export type QueueKind = 'arrival' | 'departure' | 'recheck' | 'monthly' | 'spot';
export type ThreadTopic = 'lobby' | 'nurse' | 'care' | 'kitchen' | 'billing';

export interface Row {
  id: string;
  clubId: string;
  createdAt: DT;
  createdBy: Actor;
  deletedAt?: DT;
}

export interface ReviewMark {
  status: 'pending' | 'approved' | 'rejected';
  crId: string;
}

/**
 * Management approval of what non-management staff enter (daily logs and family notes, health readings, the kitchen menu).
 * A row without the mark is approved (management's own entries, and everything from before). Families see only approved content:
 * while an edit of an approved entry waits, `prev` holds what they keep seeing (see rules/approvals.ts, project.ts).
 */
export interface Approval {
  status: 'pending' | 'approved' | 'rejected';
  /** who entered or last changed it */
  by: Actor;
  at: DT;
  /** the last approved content, kept while an edit waits (and after the edit was rejected); absent for a brand-new entry */
  prev?: Record<string, unknown>;
  /** what a rejected edit proposed (the row itself is back to `prev`), for the history */
  proposed?: Record<string, unknown>;
  decidedBy?: Actor;
  decidedAt?: DT;
  /** the reason of a rejection */
  reason?: string;
  /** a monthly reading saved together with another reading: it is decided with that one and not listed on its own */
  companionOf?: string;
  /** family notices that go out once management approves */
  defer?: { tell?: boolean; share?: boolean; overall?: Health; recheckAt?: HM; companionId?: string; notify?: boolean };
}

export interface ClubSettings {
  open: HM; // 08:30
  close: HM; // 16:30
  departureFrom: HM; // departure checks auto-queue from here
  recheckMin: number; // 15
  flexQuota: number; // 10 visits / month
  issueDay: number; // 15
  dueDay: number; // 27
  finalDueDays: number; // 14
  emergencyPhone: string;
  hoursLabel: string; // 'Mon–Fri 08:30–16:30'
  broadcastTemplates: { id: string; key: 'update' | 'closure' | 'event' | 'custom'; title: string; text: string }[];
  /** When a reading counts as Watch or Alert (missing = the defaults in rules/health.ts) */
  limits?: HealthLimits;
}

/** One Watch / Alert pair; null = not used. */
export interface Limit { watch: number | null; alert: number | null }
export type LimitKey = 'sysHigh' | 'diaHigh' | 'sysLow' | 'pulseHigh' | 'pulseLow' | 'spo2Low' | 'tempHigh' | 'tempLow' | 'gluHigh' | 'gluLow' | 'weightChange';
export type HealthLimits = Record<LimitKey, Limit>;

export interface Club extends Row {
  name: string;
  fullName: string;
  status: 'open' | 'opening';
  note?: string;
  settings: ClubSettings;
}

export interface PriceVersion extends Row {
  from: ISODate;
  flex: number;
  gold: number;
  extra: number;
  sample: { flex: boolean; gold: boolean; extra: boolean };
  by?: Actor;
}

export interface Membership {
  start: ISODate;
  lastDay?: ISODate;
  endReason?: EndReason;
  endNote?: string;
  endedBy?: Actor;
  endedAt?: DT;
}

export interface PlanEntry {
  from: ISODate;
  plan: Plan;
  by: Actor;
  requestId?: string;
}

export type MedTiming = 'morningHome' | 'lunchClub' | 'eveningHome' | 'asPrescribed';

export interface Medicine {
  id: string;
  name: string;
  dose: string;
  timing: MedTiming;
  note?: string;
}

export interface Vitals {
  sys: number;
  dia: number;
  pulse: number;
  spo2: number;
  glucose: number;
  weight: number;
  temp: number;
  grip: number;
}

export interface Consent {
  kind: 'data' | 'face';
  granted: boolean;
  by: Actor;
  byName: string;
  at: DT;
  via: 'form' | 'staff' | 'paper';
}

export type DocType = 'ktp' | 'nannyKtp' | 'membershipForm' | 'healthInfo' | 'other';

export interface MemberDocument {
  id: string;
  type: DocType;
  status: 'onFile' | 'requested' | 'pendingReview';
  fileName?: string;
  on?: ISODate;
  via?: 'form' | 'staff' | 'family';
  by?: Actor;
  /** The uploaded photo or PDF (POST /api/media). Without one, a document on file is a paper copy kept at the club. */
  mediaId?: string;
}

export interface Member extends Row {
  review?: ReviewMark;
  title: Title;
  firstName: string;
  lastName: string;
  gender: 'f' | 'm';
  dob: ISODate | null;
  ageYears: number | null; // seed only, when dob unknown
  address: string | null;
  photoTone: number;
  /** the profile picture (GET /api/media/:id); without it the tone placeholder with initials shows */
  photoMediaId?: string;
  memberships: Membership[]; // last = current
  plans: PlanEntry[]; // effective-dated
  usualArrival: HM; // informational only: members drop in on any open day
  nanny: { name: string; phone?: string } | null;
  spouseId: string | null;
  health: {
    conditions: string[];
    diabetic: boolean;
    food: FoodAllergen[];
    foodOther?: string;
    drugs: DrugAllergy[];
    mobility: Mobility | null;
    diet: Diet[];
    meds: Medicine[];
    cognitive: { summary: string; reviewedBy?: string; reviewedOn?: ISODate };
  };
  care: { instructions: string; by: Actor; at: DT }; // staff-only
  consents: Consent[];
  documents: MemberDocument[];
  face: { enrolled: boolean; at?: DT };
  billing: { va: string };
  sim: Vitals & { script?: Record<string, Partial<Vitals>> }; // PC-303 simulation baseline
}

export interface MemberNote extends Row {
  memberId: string;
  visibility: 'staff' | 'family';
  text: string;
  on: ISODate;
  pinned?: boolean;
  editedAt?: DT;
  editedBy?: Actor;
  approval?: Approval;
}

export interface PlanChangeRequest extends Row {
  memberId: string;
  to: Plan;
  from: ISODate;
  status: 'pending' | 'applied' | 'declined';
  decidedBy?: Actor;
  decidedAt?: DT;
}

export interface FamilyContact extends Row {
  review?: ReviewMark;
  /** sign-in name, fixed once set (the password lives server-side only, never in club state) */
  username?: string;
  name: string;
  firstName: string;
  phone: string; // E.164, e.g. +6281210904471
  lang?: Lang;
  activatedAt?: DT;
}

export interface FamilyLink extends Row {
  review?: ReviewMark;
  familyId: string;
  memberId: string;
  relation: Relation;
  primary: boolean;
  appAccess: boolean;
  healthAlerts: boolean;
}

export interface Stamp {
  at: HM;
  by: Actor;
}

export interface AttendanceEdit {
  at: DT;
  by: Actor;
  what: 'checkIn' | 'checkOut' | 'undoCheckIn' | 'undoCheckOut' | 'departureAsked' | 'queueAdd' | 'dismiss';
  note?: string;
}

export interface Attendance extends Row {
  // id `${date}:${memberId}`
  memberId: string;
  date: ISODate;
  checkIn?: Stamp & { method: 'face' | 'manual' };
  checkOut?: Stamp & { method: 'face' | 'manual' };
  departureAsked?: Stamp;
  recheckDueAt?: HM;
  monthlyDeferred?: boolean;
  queueAdds: (Stamp & { kind: QueueKind; note?: string })[];
  dismissed: (Stamp & { kind: QueueKind; reason: string })[];
  edits: AttendanceEdit[];
}

export interface GuestVisit extends Row {
  enquiryId: string;
  kind: 'trial' | 'visit';
  date: ISODate;
  /** Visits have a time. A trial is a day pass (lunch and the health check are always included), so it has none. */
  time?: HM;
  name: string;
  escortName: string;
  lunch: boolean;
  healthCheck: boolean;
  food: FoodAllergen[] | null; // null = unknown
  drugs: DrugAllergy[];
  mobility: Mobility | null;
  diet: Diet[];
  status: 'booked' | 'cancelled' | 'noShow';
  checkIn?: Stamp;
  checkOut?: Stamp;
  recheckDueAt?: HM; // health station: re-check requested after a flagged reading
  healthDismissed?: { at: DT; by: string; reason: string }; // nurse removed the guest from the health queue
}

export interface Reading extends Row {
  memberId: string | null;
  guestId?: string;
  date: ISODate;
  time: HM;
  kind: 'arrival' | 'departure' | 'recheck' | 'spot' | 'monthly';
  sys?: number;
  dia?: number;
  pulse?: number;
  spo2?: number;
  temp?: number;
  glucose?: number;
  weight?: number;
  grip?: number;
  status: Health;
  takenBy: string; // staff id
  source: 'device' | 'keypad' | 'mixed';
  noteKeys: QuickNote[];
  note?: string;
  shared: boolean;
  familyTold?: { at: DT; by: string; familyIds: string[] };
  edits: { at: DT; by: string; fields: string[]; reason?: string; note?: string; from?: Record<string, number | null> }[];
  voided?: { at: DT; by: string; reason: 'wrongPerson' | 'deviceError' | 'duplicate' | 'other'; note?: string };
  approval?: Approval;
}

export interface DailyLog extends Row {
  memberId: string;
  date: ISODate;
  mood: 'cheerful' | 'calm' | 'quiet' | 'agitated';
  lunch: 'all' | 'most' | 'half' | 'little';
  joined: 'yes' | 'satOut';
  communicative: 'normal' | 'withdrawn';
  content: 'normal' | 'low';
  note: string; // family-visible
  staffNote?: string;
  status: 'draft' | 'saved';
  by: string; // staff id
  edits: { at: DT; by: string }[];
  approval?: Approval;
}

export interface Photo extends Row {
  date: ISODate;
  time: HM;
  kind: 'solo' | 'group' | 'arrival' | 'lunch';
  media: 'photo' | 'video';
  durationSec?: number;
  activity?: string;
  memberIds: string[];
  tone: number;
  takenBy: string;
  /** 'pending': taken by non-management staff, waiting for management approval before families see it */
  visibility: 'pending' | 'visible' | 'hidden' | 'removed';
  moderated?: { at: DT; by: string; reason: string };
  approved?: { at: DT; by: string };
  /** a real image from the camera or an upload (GET /api/media/:id); without it the design's tone placeholder shows */
  mediaId?: string;
}

export interface Thread extends Row {
  memberId: string;
  familyId: string;
  topic: ThreadTopic;
  feedbackId?: string;
  lastSeq: number;
  staffReadSeq: number;
  familyReadSeq: number;
}

export interface Message extends Row {
  threadId: string;
  seq: number;
  from: Actor;
  at: DT;
  text: string;
  kind: 'text' | 'healthAlert' | 'system' | 'autoAck';
  ref?: { type: 'dailyLog' | 'reading' | 'photo' | 'invoice' | 'feedback'; id: string };
  editedAt?: DT;
}

export interface Feedback extends Row {
  memberId: string;
  familyId: string | null; // null = logged by staff
  mealDate: ISODate;
  dish: string;
  text: string;
  status: 'open' | 'answered' | 'closed';
  threadId?: string;
  source: 'family' | 'staff';
}

export interface Enquiry extends Row {
  senior: { title: Title; name: string };
  contact: { name: string; relation: Relation; phone: string };
  source: 'referral' | 'instagram' | 'website' | 'walkIn' | 'other';
  stage: 'new' | 'visit' | 'trial' | 'joined' | 'lost';
  next?: { kind: 'callBack' | 'sendPrices' | 'visit' | 'trial' | 'followUp' | 'starts' | 'custom'; date?: ISODate; time?: HM; text?: string };
  notes?: string;
  lost?: { reason: LostReason; note?: string; prevStage?: Enquiry['stage'] };
  memberId?: string;
  archivedAt?: DT;
  /** Set while a gated conversion is pending (enquiry.convert): where the lead goes back to if management rejects. */
  prevStage?: Enquiry['stage'];
  prevNext?: Enquiry['next'];
}

export interface CalendarEvent extends Row {
  date: ISODate;
  endDate?: ISODate;
  kind: 'closed' | 'holiday' | 'outing';
  title: string;
  titleId?: string; // Indonesian title when known
  holidayKey?: string;
  from?: HM;
  to?: HM;
  cancelledAt?: DT;
}

export interface VenueBooking extends Row {
  org: string;
  contactName: string;
  phone: string;
  guests: number;
  roomId: string;
  date: ISODate;
  from: HM;
  to: HM;
  status: 'confirmed' | 'cancelled';
  price?: number;
  deposit?: number;
  invoiceRef?: string;
  review?: { stars: number; text: string };
  reviewAskedAt?: DT;
}

export interface Room extends Row {
  name: string;
  nameId?: string;
  venue: boolean;
}

export interface Activity extends Row {
  name: string;
  nameId?: string;
  icon: string;
  roomId: string;
  active: boolean;
}

export type Slot = '10:30' | '13:30';
export interface ScheduleCell {
  activityId: string;
  staffId: string;
  roomId: string;
}

export interface ScheduleVersion extends Row {
  effectiveFrom: ISODate;
  status: 'draft' | 'pending' | 'published' | 'rejected';
  days: Record<Weekday, Record<Slot, ScheduleCell | null>>;
  submittedBy?: Actor;
  publishedBy?: Actor;
  publishedAt?: DT;
  rejectNote?: string;
}

export interface Dish extends Row {
  name: string;
  course: 'lunch' | 'soft' | 'tea';
  allergens: DishAllergen[];
  tags: ('soft' | 'lowSalt' | 'sugarFree' | 'vegetarian')[];
  reviewedBy?: string;
  reviewedAt?: DT;
}

export interface MenuDay {
  lunch: string[];
  soft: string[];
  tea: string[];
}

export interface MenuVersion extends Row {
  effectiveFrom: ISODate;
  status: 'draft' | 'published';
  days: Record<Weekday, MenuDay>;
  publishedBy?: Actor;
  approval?: Approval;
}

export interface AllergyPlan {
  person: `member:${string}` | `guest:${string}`;
  dishId: string;
  alternative: string;
  by: string;
  at: DT;
}

export interface DayMenu extends Row {
  // id = date
  date: ISODate;
  lunch?: string[];
  soft?: string[];
  tea?: string[];
  /** lunch photos, oldest first (families see the approved ones) */
  photoIds?: string[];
  /** @deprecated single lunch photo: use photoIds */
  photoId?: string;
  allergyPlans: AllergyPlan[];
  /** approval of the lunch / soft / tea override (families keep seeing `prev` until it is approved) */
  approval?: Approval;
}

export interface StockRequest extends Row {
  item: string;
  qty: number;
  unit: string;
  area: 'kitchen' | 'health' | 'activities' | 'housekeeping' | 'transport';
  sectionId: SectionId;
  status: 'requested' | 'approved' | 'received' | 'rejected' | 'cancelled';
  requestedBy: string;
  decidedBy?: Actor;
  decidedAt?: DT;
  receivedBy?: Actor;
  note?: string;
}

export interface BudgetSection extends Row {
  name: string;
  nameId?: string;
  limits: { fromWeek: ISODate; weekly: number }[];
}

export interface BudgetRequest extends Row {
  sectionId: SectionId;
  item: string;
  amount: number;
  weekStart: ISODate;
  requestedBy: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  decidedBy?: Actor;
  decidedAt?: DT;
  note?: string;
}

export interface BudgetAdjustment extends Row {
  sectionId: SectionId;
  weekStart: ISODate;
  amount: number;
  note: string;
}

export interface Receipt extends Row {
  date: ISODate;
  supplier: string;
  directoryId?: string;
  amount: number;
  sectionId: SectionId;
  budgetRequestId?: string;
  fileName: string;
  /** the photo of the nota, taken with CameraCapture (GET /api/media/:id) */
  mediaId?: string;
  by: string;
  status: 'submitted' | 'approved' | 'rejected';
  xero: Xero;
  voidedAt?: DT;
  // finance review (appended by the finance area)
  decidedBy?: Actor;
  decidedAt?: DT;
  note?: string;
}

export interface VendorInvoice extends Row {
  supplier: string;
  directoryId?: string;
  number: string;
  amount: number;
  due: ISODate;
  sectionId: SectionId;
  status: 'toApprove' | 'approved' | 'paid' | 'rejected';
  xero: Xero;
  // finance review and payment (appended by the finance area)
  decidedBy?: Actor;
  decidedAt?: DT;
  note?: string;
  paidOn?: ISODate;
  paidBy?: Actor;
}

export interface InvoiceLine {
  id: string;
  kind: 'plan' | 'extraDay' | 'adjustment' | 'credit' | 'venue';
  label: string; // i18n key
  params?: Record<string, string | number>;
  qty: number;
  unit: number;
  amount: number;
  refMonth?: YM;
  dates?: ISODate[];
}

export interface Invoice extends Row {
  number: string;
  memberId: string;
  payerFamilyId: string;
  kind: 'monthly' | 'final' | 'manual';
  period?: YM;
  issueDate: ISODate;
  dueDate: ISODate;
  releasedEarly?: boolean;
  lines: InvoiceLine[];
  va: string;
  voided?: { at: DT; by: Actor; reason: string };
  xero: Xero;
  reminders: { at: DT; by: Actor }[];
  callNotes: { at: DT; by: Actor; text: string }[];
}

export interface Payment extends Row {
  memberId: string;
  method: 'dokuVa' | 'bankTransferSgd' | 'revolut' | 'cash' | 'other';
  amount: number;
  foreign?: { ccy: 'SGD' | 'EUR'; amount: number };
  ref?: string;
  bank?: Bank;
  receivedOn: ISODate;
  receivedAt?: HM;
  allocations: { invoiceId: string; amount: number }[];
  xero: Xero;
  by: Actor;
}

export interface Refund extends Row {
  paymentId: string;
  invoiceId: string;
  amount: number;
  creditNote: boolean;
  reason: string;
  xero: Xero;
}

export interface PendingCharge extends Row {
  memberId: string;
  amount: number;
  label: string;
  invoiceId?: string;
}

export interface InvoiceRun extends Row {
  period: YM;
  issueDate: ISODate;
  invoiceIds: string[];
  skipped: { memberId: string; reason: string }[];
  // appended by the finance area: released before the usual issue day / issued by the scheduled job
  early?: boolean;
  auto?: boolean;
}

export interface DirectoryContact extends Row {
  kind: 'doctor' | 'service' | 'supplier';
  name: string;
  what: string;
  whatId?: string;
  phone: string;
  public: boolean;
}

export interface StaffHr {
  contract: 'pkwtt' | 'pkwt';
  start: ISODate;
  end: ISODate | null;
  signed: boolean;
  ktpLast4: string;
  ktpOnFile: boolean;
  salary: number;
  allowance: number;
  bank: Bank;
  account: string;
  quote?: string;
}

export interface Staff extends Row {
  /** sign-in name, fixed once set (the password lives server-side only, never in club state) */
  username?: string;
  name: string;
  knownAs?: string;
  role: StaffRole;
  title: string;
  phone: string;
  supervisor: boolean;
  rateable: boolean;
  appAccess: boolean;
  active: boolean;
  extraClubIds: string[];
  hr: StaffHr;
}

export interface HrNote extends Row {
  staffId: string;
  kind: 'warning' | 'note' | 'praise';
  on: ISODate;
  text: string;
}

export interface StaffTime extends Row {
  staffId: string;
  date: ISODate;
  kind: 'worked' | 'leave' | 'sick' | 'off';
  from?: HM;
  to?: HM;
}

/** Kinds of question management can write: 1 to 5 stars, yes or no, one option out of several, free text. */
export type SurveyQuestionKind = 'rating' | 'yesno' | 'choice' | 'text';
/** An answer to a custom question: stars (number), yes or no (boolean), the chosen option or the text (string). */
export type SurveyAnswer = number | boolean | string;
/** A question management wrote for one survey. The text is free text in one language. Answers are kept in SurveyResponse.answers under `id`. */
export interface SurveyCustomQuestion {
  id: string;
  kind: SurveyQuestionKind;
  text: string;
  /** choice only: the options families pick from (2 to 8) */
  options?: string[];
  required: boolean;
}

export interface Survey extends Row {
  title: string;
  /** The preset questions that are switched on. Any of them can be off, as long as the survey asks something (a preset or a custom question). */
  questions: ('overall' | 'team' | 'recommend' | 'comment')[];
  /** Questions management wrote, in the order families see them. Missing on older surveys = none. Only a draft can change them. */
  custom?: SurveyCustomQuestion[];
  teamStaffIds: string[];
  recipients: string[]; // family ids
  /** Who the survey is for, chosen while it is a draft: every family with app access, the families of chosen members, or chosen contacts. Missing = every family with app access. */
  audience?: { mode: 'all' | 'members' | 'contacts'; memberIds?: string[]; contactIds?: string[] };
  sentOn: ISODate;
  status: 'draft' | 'live' | 'closed';
  closedOn?: ISODate;
}

export interface SurveyResponse extends Row {
  surveyId: string;
  familyId: string;
  /** 1 to 5, or 0 when the survey did not ask for it */
  overall: number;
  team: Record<string, number>;
  recommend: boolean | null;
  comment: string;
  /** Answers to the survey's custom questions, by question id. Missing on older responses. */
  answers?: Record<string, SurveyAnswer>;
  on: ISODate;
}

export interface Broadcast extends Row {
  template: 'update' | 'closure' | 'event' | 'custom';
  message: string;
  audiences: ('families' | 'enquiries' | 'staff')[];
  recipients: number;
  sendAt: DT;
  status: 'scheduled' | 'sent' | 'cancelled';
  sentAt?: DT;
}

export type ReviewSection = 'newMember' | 'conversion' | 'details' | 'plan' | 'docsConsent' | 'family' | 'allergies' | 'medicines' | 'care';

export interface ChangeRequest extends Row {
  kind: 'approval' | 'postReview';
  op: 'create' | 'update' | 'delete';
  action: string;
  input: unknown;
  section: ReviewSection;
  target: { type: 'member' | 'familyContact' | 'familyLink' | 'enquiry' | 'document'; id: string; memberId?: string };
  changes: { field: string; from: unknown; to: unknown }[];
  createdRows?: { coll: string; id: string }[];
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn' | 'superseded' | 'acknowledged' | 'reverted';
  submittedBy: Actor;
  reviewedBy?: Actor;
  reviewedAt?: DT;
  note?: string;
}

export type NotificationSeverity = 'info' | 'attention' | 'urgent';

export interface Notification extends Row {
  // recipients: explicit user ids and/or roles ('family' notifications always target user ids)
  toUsers: string[];
  toRoles: StaffRole[];
  kind: string; // i18n key under notif.*
  params: Record<string, string | number>;
  severity: NotificationSeverity;
  action: boolean; // "Needs action" vs "Updates"
  link: string; // route to open
  ref?: { type: string; id: string };
  memberId?: string;
  readBy: string[];
  resolvedAt?: DT;
}

export interface ActivityEntry {
  // lightweight audit (no patches); full audit_log lives in Postgres
  id: string;
  clubId: string;
  at: DT;
  actor: Actor;
  action: string;
  memberId?: string;
  icon: string;
  key: string; // i18n key under feed.*
  params: Record<string, string | number>;
}

export interface ClubState {
  clubId: string;
  rev: number;
  club: Club;
  prices: Record<string, PriceVersion>;
  members: Record<string, Member>;
  memberNotes: Record<string, MemberNote>;
  planChangeRequests: Record<string, PlanChangeRequest>;
  familyContacts: Record<string, FamilyContact>;
  familyLinks: Record<string, FamilyLink>;
  attendance: Record<string, Attendance>;
  guestVisits: Record<string, GuestVisit>;
  readings: Record<string, Reading>;
  dailyLogs: Record<string, DailyLog>;
  photos: Record<string, Photo>;
  threads: Record<string, Thread>;
  messages: Record<string, Message>;
  feedback: Record<string, Feedback>;
  enquiries: Record<string, Enquiry>;
  calendarEvents: Record<string, CalendarEvent>;
  venueBookings: Record<string, VenueBooking>;
  rooms: Record<string, Room>;
  activities: Record<string, Activity>;
  scheduleVersions: Record<string, ScheduleVersion>;
  dishes: Record<string, Dish>;
  menuVersions: Record<string, MenuVersion>;
  dayMenus: Record<string, DayMenu>;
  stockRequests: Record<string, StockRequest>;
  budgetSections: Record<string, BudgetSection>;
  budgetRequests: Record<string, BudgetRequest>;
  budgetAdjustments: Record<string, BudgetAdjustment>;
  receipts: Record<string, Receipt>;
  vendorInvoices: Record<string, VendorInvoice>;
  invoices: Record<string, Invoice>;
  payments: Record<string, Payment>;
  refunds: Record<string, Refund>;
  pendingCharges: Record<string, PendingCharge>;
  invoiceRuns: Record<string, InvoiceRun>;
  directory: Record<string, DirectoryContact>;
  staff: Record<string, Staff>;
  hrNotes: Record<string, HrNote>;
  staffTime: Record<string, StaffTime>;
  surveys: Record<string, Survey>;
  surveyResponses: Record<string, SurveyResponse>;
  broadcasts: Record<string, Broadcast>;
  changeRequests: Record<string, ChangeRequest>;
  notifications: Record<string, Notification>;
  activity: Record<string, ActivityEntry>;
}

/** Collections stored as one Postgres table each (everything except clubId/rev/club). */
export const COLLECTIONS = [
  'prices', 'members', 'memberNotes', 'planChangeRequests', 'familyContacts', 'familyLinks',
  'attendance', 'guestVisits', 'readings', 'dailyLogs', 'photos', 'threads', 'messages', 'feedback', 'enquiries',
  'calendarEvents', 'venueBookings', 'rooms', 'activities', 'scheduleVersions', 'dishes', 'menuVersions',
  'dayMenus', 'stockRequests', 'budgetSections', 'budgetRequests', 'budgetAdjustments', 'receipts', 'vendorInvoices',
  'invoices', 'payments', 'refunds', 'pendingCharges', 'invoiceRuns', 'directory', 'staff', 'hrNotes', 'staffTime',
  'surveys', 'surveyResponses', 'broadcasts', 'changeRequests', 'notifications', 'activity',
] as const;
export type CollectionName = (typeof COLLECTIONS)[number];

/** The signed-in person. Staff ids look like 's1', family ids like 'f1' / 'fm2_0'. */
export type User =
  | { kind: 'staff'; id: string; staff: Staff; clubId: string; clubs: string[] }
  | { kind: 'family'; id: string; contact: FamilyContact; clubId: string; memberIds: string[] };

export type Role = StaffRole | 'family';
