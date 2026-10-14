import { BOOKING_STATUSES } from "@/content/booking";

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const OWNER_ACTIONS = ["confirm", "cancel", "complete", "reschedule"] as const;

export type OwnerAction = (typeof OWNER_ACTIONS)[number];

export interface ActionRule {
  /** Statuses the booking must be in *before* the action may be applied. */
  from: readonly BookingStatus[];
  /** Status written by the server — never taken from the client. */
  to: BookingStatus;
}

/**
 * Owner action state machine. Terminal states (COMPLETED, CANCELLED) allow no
 * actions, so an old tab can never resurrect or double-act on a finished
 * booking. Enforced server-side in the booking API before any write.
 */
export const ACTION_RULES: Record<OwnerAction, ActionRule> = {
  confirm: { from: ["PENDING", "RESCHEDULED"], to: "CONFIRMED" },
  cancel: { from: ["PENDING", "CONFIRMED", "RESCHEDULED"], to: "CANCELLED" },
  complete: { from: ["CONFIRMED"], to: "COMPLETED" },
  reschedule: { from: ["PENDING", "CONFIRMED", "RESCHEDULED"], to: "RESCHEDULED" },
};

export function isBookingStatus(value: unknown): value is BookingStatus {
  return typeof value === "string" && (BOOKING_STATUSES as readonly string[]).includes(value);
}

export function isOwnerAction(value: unknown): value is OwnerAction {
  return typeof value === "string" && (OWNER_ACTIONS as readonly string[]).includes(value);
}

/** True when `action` is a legal transition out of `status`. */
export function canApplyAction(status: BookingStatus, action: OwnerAction): boolean {
  return ACTION_RULES[action].from.includes(status);
}

/** The status the server writes for an action, or null when illegal. */
export function nextStatusFor(status: BookingStatus, action: OwnerAction): BookingStatus | null {
  return canApplyAction(status, action) ? ACTION_RULES[action].to : null;
}

/** Actions offered to the owner for a given booking status. */
export function availableActions(status: BookingStatus): OwnerAction[] {
  return OWNER_ACTIONS.filter((action) => canApplyAction(status, action));
}
