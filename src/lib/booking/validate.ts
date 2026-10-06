import {
  BOOKING_TIME_SLOTS,
  earliestBookableDate,
} from "../../content/booking";

export const EVENT_TYPES = [
  "Wedding",
  "Reception",
  "Engagement",
  "Birthday",
  "Anniversary",
  "Other",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export interface BookingInput {
  customerName?: unknown;
  phone?: unknown;
  email?: unknown;
  eventType?: unknown;
  eventTypeOther?: unknown;
  visitDate?: unknown;
  timeSlot?: unknown;
  message?: unknown;
  website?: unknown; // honeypot — must be empty
}

export interface NormalizedBooking {
  customerName: string;
  phone: string;
  email: string;
  eventType: string;
  visitDate: string; // YYYY-MM-DD
  timeSlot: string;
  message: string | null;
}

export type ValidationResult =
  | { ok: true; data: NormalizedBooking }
  | { ok: false; errors: Record<string, string> };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateString(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

// IST calendar date (YYYY-MM-DD) for "today" at the given instant.
export function todayIst(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function earliestBookableDateString(now: Date = new Date()): string {
  return earliestBookableDate(now).toISOString().slice(0, 10);
}

export function isBookableDate(value: string, now: Date = new Date()): boolean {
  return isValidDateString(value) && value >= earliestBookableDateString(now);
}

export function isAllowedSlot(value: string): boolean {
  return (BOOKING_TIME_SLOTS as readonly string[]).includes(value);
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

export function isValidPhone(value: string): boolean {
  const digits = value.replace(/[^\d]/g, "");
  // Indian numbers: 10 digits, optionally prefixed with +91/91/0.
  return (
    (digits.length === 10 && /^[6-9]\d{9}$/.test(digits)) ||
    (digits.length === 12 && digits.startsWith("91") && /^[6-9]\d{9}$/.test(digits.slice(2))) ||
    (digits.length === 11 && digits.startsWith("0") && /^[6-9]\d{9}$/.test(digits.slice(1)))
  );
}

export function validateBookingInput(
  input: BookingInput,
  now: Date = new Date()
): ValidationResult {
  const errors: Record<string, string> = {};

  // Honeypot: silently treat filled as valid-looking but flag separately.
  if (typeof input.website === "string" && input.website.trim() !== "") {
    return { ok: false, errors: { website: "spam" } };
  }

  const customerName =
    typeof input.customerName === "string" ? input.customerName.trim() : "";
  if (!customerName) errors.customerName = "Please enter your name.";
  else if (customerName.length > 120)
    errors.customerName = "Name is too long.";

  const phone = typeof input.phone === "string" ? input.phone.trim() : "";
  if (!phone) errors.phone = "Please enter your phone number.";
  else if (!isValidPhone(phone))
    errors.phone = "Please enter a valid Indian phone number.";

  const email =
    typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  if (!email) errors.email = "Please enter your email address.";
  else if (!isValidEmail(email))
    errors.email = "Please enter a valid email address.";

  const eventTypeRaw =
    typeof input.eventType === "string" ? input.eventType : "";
  if (!eventTypeRaw) {
    errors.eventType = "Please select an event type.";
  } else if (!(EVENT_TYPES as readonly string[]).includes(eventTypeRaw)) {
    errors.eventType = "Please select a valid event type.";
  }

  let eventType = eventTypeRaw;
  if (eventTypeRaw === "Other") {
    const other =
      typeof input.eventTypeOther === "string"
        ? input.eventTypeOther.trim()
        : "";
    if (!other) errors.eventTypeOther = "Please describe your event.";
    else if (other.length > 80)
      errors.eventTypeOther = "Description is too long.";
    else eventType = `Other: ${other}`;
  }

  const visitDate =
    typeof input.visitDate === "string" ? input.visitDate : "";
  if (!visitDate) errors.visitDate = "Please select a visit date.";
  else if (!isValidDateString(visitDate))
    errors.visitDate = "Please enter a valid date.";
  else if (!isBookableDate(visitDate, now))
    errors.visitDate =
      "Visits can only be booked from tomorrow onwards. Please choose a later date.";

  const timeSlot =
    typeof input.timeSlot === "string" ? input.timeSlot : "";
  if (!timeSlot) errors.timeSlot = "Please select a time slot.";
  else if (!isAllowedSlot(timeSlot))
    errors.timeSlot = "Please select a valid time slot.";

  let message: string | null = null;
  if (typeof input.message === "string" && input.message.trim() !== "") {
    const m = input.message.trim();
    if (m.length > 1000) errors.message = "Message is too long.";
    else message = m;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    data: { customerName, phone, email, eventType, visitDate, timeSlot, message },
  };
}
