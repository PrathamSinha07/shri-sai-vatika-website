// Owner-facing booking access. Runs on the server only, after an explicit
// authorization check, using the service-role key (PostgREST), exactly like
// the public booking route. RLS stays enabled with no public read policies —
// the browser never talks to Supabase directly.
import { requiredEnv } from "@/lib/env";
import { BOOKING_TIME_SLOTS } from "@/content/booking";
import { todayIst } from "@/lib/booking/validate";
import type { BookingStatus, OwnerAction } from "@/lib/admin/transitions";

export interface AdminBooking {
  id: string;
  customerName: string;
  phone: string;
  email: string;
  eventType: string;
  eventDate: string | null;
  visitDate: string;
  timeSlot: string;
  message: string | null;
  status: BookingStatus;
  ownerNotes: string | null;
  rescheduledFrom: string | null;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export class BookingConflictError extends Error {
  constructor(message = "booking_conflict") {
    super(message);
    this.name = "BookingConflictError";
  }
}

export class BookingStaleError extends Error {
  constructor() {
    super("booking_changed");
    this.name = "BookingStaleError";
  }
}

export class BookingNotFoundError extends Error {
  constructor() {
    super("booking_not_found");
    this.name = "BookingNotFoundError";
  }
}

export class AdminBookingStoreError extends Error {
  constructor() {
    super("admin_booking_store_error");
    this.name = "AdminBookingStoreError";
  }
}

interface BookingRow {
  id: string;
  created_at: string;
  updated_at: string;
  customer_name: string;
  phone: string;
  email: string;
  event_type: string;
  event_date: string | null;
  visit_date: string;
  time_slot: string;
  message: string | null;
  status: string;
  owner_notes: string | null;
  rescheduled_from: string | null;
  source: string;
}

function mapRow(row: BookingRow): AdminBooking {
  return {
    id: row.id,
    customerName: row.customer_name,
    phone: row.phone,
    email: row.email,
    eventType: row.event_type,
    eventDate: row.event_date,
    visitDate: row.visit_date,
    timeSlot: row.time_slot,
    message: row.message,
    status: row.status as BookingStatus,
    ownerNotes: row.owner_notes,
    rescheduledFrom: row.rescheduled_from,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function baseUrl(): string {
  return requiredEnv("SUPABASE_URL").replace(/\/$/, "");
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  const key = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

function query(params: Array<[string, string]>): string {
  return params.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join("&");
}

export const BOOKING_SORT_FIELDS = ["created_at", "visit_date", "customer_name", "status"] as const;
export type BookingSortField = (typeof BOOKING_SORT_FIELDS)[number];

export interface ListBookingsParams {
  status?: BookingStatus;
  visitDate?: string;
  upcoming?: boolean;
  search?: string;
  sort?: BookingSortField;
  order?: "asc" | "desc";
  page: number;
  pageSize: number;
}

export interface ListBookingsResult {
  items: AdminBooking[];
  total: number;
  page: number;
  pageSize: number;
}

/** Strips characters that carry meaning in PostgREST's `or=(...)` syntax. */
function sanitizeSearchTerm(value: string): string {
  return value.replace(/[*",()%]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);
}

export async function listBookings(params: ListBookingsParams): Promise<ListBookingsResult> {
  const filters: Array<[string, string]> = [["select", "*"]];

  if (params.status) filters.push(["status", `eq.${params.status}`]);
  if (params.visitDate) filters.push(["visit_date", `eq.${params.visitDate}`]);
  if (params.upcoming) filters.push(["visit_date", `gte.${todayIst()}`]);

  const term = sanitizeSearchTerm(params.search ?? "");
  if (term) {
    filters.push([
      "or",
      `(${["customer_name", "phone", "email"]
        .map((field) => `${field}.ilike.*${term}*`)
        .join(",")})`,
    ]);
  }

  const sort = params.sort ?? "created_at";
  const order = params.order === "asc" ? "asc" : "desc";
  filters.push(["order", `${sort}.${order}`]);

  const start = (params.page - 1) * params.pageSize;
  const res = await fetch(`${baseUrl()}/rest/v1/visit_bookings?${query(filters)}`, {
    headers: headers({
      Prefer: "count=exact",
      Range: `${start}-${start + params.pageSize - 1}`,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    console.error(`Admin booking list failed (${res.status})`);
    throw new AdminBookingStoreError();
  }

  const rows = (await res.json()) as BookingRow[];
  const contentRange = res.headers.get("content-range") ?? "";
  const total = Number.parseInt(contentRange.split("/")[1] ?? "0", 10) || rows.length;

  return { items: rows.map(mapRow), total, page: params.page, pageSize: params.pageSize };
}

export async function getBooking(id: string): Promise<AdminBooking | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const res = await fetch(
    `${baseUrl()}/rest/v1/visit_bookings?${query([
      ["id", `eq.${id}`],
      ["select", "*"],
      ["limit", "1"],
    ])}`,
    { headers: headers(), cache: "no-store" }
  );
  if (!res.ok) throw new AdminBookingStoreError();
  const rows = (await res.json()) as BookingRow[];
  return rows[0] ? mapRow(rows[0]) : null;
}

/**
 * Counts the OTHER bookings that consume capacity at a date + slot — i.e.
 * everything except CANCELLED rows and except the booking being rescheduled.
 * Only used as a friendly pre-check for rescheduling; the slot-capacity
 * trigger in the database (migration 0003) is the atomic final arbiter.
 */
export async function countOtherActiveBookings(
  visitDate: string,
  timeSlot: string,
  exceptId: string
): Promise<number> {
  const filters: Array<[string, string]> = [
    ["visit_date", `eq.${visitDate}`],
    ["time_slot", `eq.${timeSlot}`],
    ["status", "neq.CANCELLED"],
    ["id", `neq.${exceptId}`],
    ["select", "id"],
  ];

  const res = await fetch(`${baseUrl()}/rest/v1/visit_bookings?${query(filters)}`, {
    headers: headers(),
    cache: "no-store",
  });
  if (!res.ok) throw new AdminBookingStoreError();
  const rows = (await res.json()) as Array<{ id: string }>;
  return rows.length;
}

export interface ExpectedState {
  status: BookingStatus;
  visitDate?: string;
  timeSlot?: string;
}

export interface ApplyActionInput {
  id: string;
  action: OwnerAction;
  expected: ExpectedState;
  nextStatus: BookingStatus;
  visitDate?: string;
  timeSlot?: string;
}

/**
 * Compare-and-swap update. The WHERE clause pins the exact state the owner
 * saw, so a concurrent action (or a second tab) can never be silently
 * overwritten: zero matched rows means the booking moved on.
 * The slot-capacity trigger (migration 0003) is the final arbiter for
 * rescheduling — a full destination slot aborts the whole statement. Owner
 * actions that consume no new capacity (confirm, cancel, complete) skip the
 * capacity check entirely and can never be blocked by it.
 */
export async function applyBookingAction(input: ApplyActionInput): Promise<AdminBooking> {
  const filters: Array<[string, string]> = [
    ["id", `eq.${input.id}`],
    ["status", `eq.${input.expected.status}`],
  ];

  const body: Record<string, string> = { status: input.nextStatus };

  if (input.action === "reschedule") {
    if (input.expected.visitDate) filters.push(["visit_date", `eq.${input.expected.visitDate}`]);
    if (input.expected.timeSlot) filters.push(["time_slot", `eq.${input.expected.timeSlot}`]);
    if (input.visitDate) body.visit_date = input.visitDate;
    if (input.timeSlot) body.time_slot = input.timeSlot;
  }

  const res = await fetch(`${baseUrl()}/rest/v1/visit_bookings?${query(filters)}`, {
    method: "PATCH",
    headers: headers({ Prefer: "return=representation" }),
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // Slot-capacity trigger: the destination slot was full when this
    // statement ran. The statement is atomic, so nothing was applied.
    if (text.includes("slot capacity exceeded")) throw new BookingConflictError();
    // Unique violation: the destination slot was taken between our check and
    // this write. The statement is atomic, so nothing was partially applied.
    if (text.includes("23505") || res.status === 409) throw new BookingConflictError();
    // CHECK violation (e.g. a visit date that is no longer in the future).
    if (text.includes("23514")) throw new BookingConflictError("booking_rule_violation");
    console.error(`Admin booking action failed (${res.status})`);
    throw new AdminBookingStoreError();
  }

  const rows = (await res.json()) as BookingRow[];
  if (!rows[0]) throw new BookingStaleError();
  return mapRow(rows[0]);
}

export interface OverviewMetrics {
  total: number;
  pending: number;
  confirmed: number;
  rescheduled: number;
  completed: number;
  cancelled: number;
  upcoming: number;
  recent: AdminBooking[];
}

/**
 * Aggregate counters are computed from a PII-free projection
 * (`status`, `visit_date`); only the short recent list carries
 * customer details, and it is rendered strictly after authorization.
 */
export async function getOverviewMetrics(): Promise<OverviewMetrics> {
  const res = await fetch(`${baseUrl()}/rest/v1/visit_bookings?select=status,visit_date`, {
    headers: headers(),
    cache: "no-store",
  });
  if (!res.ok) throw new AdminBookingStoreError();

  const rows = (await res.json()) as Array<{ status: string; visit_date: string }>;
  const today = todayIst();

  const count = (status: BookingStatus) => rows.filter((row) => row.status === status).length;
  const activeStatuses: readonly string[] = ["PENDING", "CONFIRMED", "RESCHEDULED"];

  const recentRes = await fetch(
    `${baseUrl()}/rest/v1/visit_bookings?${query([
      ["select", "*"],
      ["order", "created_at.desc"],
      ["limit", "5"],
    ])}`,
    { headers: headers(), cache: "no-store" }
  );
  if (!recentRes.ok) throw new AdminBookingStoreError();
  const recentRows = (await recentRes.json()) as BookingRow[];

  return {
    total: rows.length,
    pending: count("PENDING"),
    confirmed: count("CONFIRMED"),
    rescheduled: count("RESCHEDULED"),
    completed: count("COMPLETED"),
    cancelled: count("CANCELLED"),
    upcoming: rows.filter(
      (row) => activeStatuses.includes(row.status) && row.visit_date >= today
    ).length,
    recent: recentRows.map(mapRow),
  };
}

/** Destinations offered in the reschedule form: the fixed slots only. */
export const RESCHEDULE_SLOTS = BOOKING_TIME_SLOTS;
