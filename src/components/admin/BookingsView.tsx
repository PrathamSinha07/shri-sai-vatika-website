"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import StatusBadge from "./StatusBadge";
import { formatDate, formatDateTime } from "./format";
import { availableActions, type OwnerAction } from "@/lib/admin/transitions";
import type { AdminBooking } from "@/lib/admin/bookings";
import { BOOKING_TIME_SLOTS } from "@/content/booking";
import { earliestBookableDateString } from "@/lib/booking/validate";

const PAGE_SIZE = 20;

const STATUS_OPTIONS = ["ALL", "PENDING", "CONFIRMED", "RESCHEDULED", "COMPLETED", "CANCELLED"] as const;

const ACTION_LABELS: Record<OwnerAction, string> = {
  confirm: "Confirm visit",
  cancel: "Cancel booking",
  complete: "Mark completed",
  reschedule: "Reschedule",
};

const SORT_COLUMNS = [
  { field: "customer_name", label: "Customer" },
  { field: "created_at", label: "Received" },
  { field: "visit_date", label: "Visit" },
  { field: "status", label: "Status" },
] as const;

type SortField = (typeof SORT_COLUMNS)[number]["field"];

interface Filters {
  status: string;
  visitDate: string;
  upcoming: boolean;
  q: string;
}

interface ListState {
  items: AdminBooking[];
  total: number;
  pageCount: number;
}

export default function BookingsView() {
  const router = useRouter();

  const [filters, setFilters] = useState<Filters>({
    status: "ALL",
    visitDate: "",
    upcoming: false,
    q: "",
  });
  const [sort, setSort] = useState<{ field: SortField; order: "asc" | "desc" }>({
    field: "created_at",
    order: "desc",
  });
  const [page, setPage] = useState(1);
  const [listVersion, setListVersion] = useState(0);

  const [data, setData] = useState<ListState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminBooking | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newSlot, setNewSlot] = useState<string>(BOOKING_TIME_SLOTS[0]);

  const [live, setLive] = useState("");
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  // Authenticated fetch: one silent refresh attempt, then the caller's
  // request again. A dead session sends the owner back to the sign-in page.
  const apiFetch = useCallback(
    async (input: string, init?: RequestInit) => {
      let res = await fetch(input, init);
      if (res.status === 401) {
        const refreshed = await fetch("/api/admin/auth/refresh", { method: "POST" });
        if (refreshed.ok) {
          res = await fetch(input, init);
        } else {
          router.replace("/admin/login?expired=1");
        }
      }
      return res;
    },
    [router]
  );

  // List loading (debounced so typing in search does not spam the API).
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.status !== "ALL") params.set("status", filters.status);
      if (filters.visitDate) params.set("visitDate", filters.visitDate);
      if (filters.upcoming) params.set("upcoming", "true");
      if (filters.q.trim()) params.set("q", filters.q.trim());
      params.set("sort", sort.field);
      params.set("order", sort.order);
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));

      try {
        const res = await apiFetch(`/api/admin/bookings?${params.toString()}`, {
          signal: controller.signal,
        });
        const body = (await res.json().catch(() => null)) as
          | { ok?: boolean; error?: string; items?: AdminBooking[]; total?: number; pageCount?: number }
          | null;
        if (controller.signal.aborted) return;
        if (!res.ok || !body?.ok) {
          setError(body?.error ?? "We couldn't load the bookings right now.");
          setData(null);
        } else {
          setData({
            items: body.items ?? [],
            total: body.total ?? 0,
            pageCount: body.pageCount ?? 1,
          });
          setError(null);
        }
      } catch {
        if (!controller.signal.aborted) setError("We couldn't load the bookings right now.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [filters, sort, page, listVersion, apiFetch]);

  function closeDetail() {
    setSelectedId(null);
    setSelected(null);
    setActionError(null);
  }

  // Detail loading for the open booking. Loading state is started by
  // openDetail(), so this effect only talks to the network.
  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(`/api/admin/bookings/${selectedId}`);
        const body = (await res.json().catch(() => null)) as
          | { ok?: boolean; error?: string; booking?: AdminBooking }
          | null;
        if (cancelled) return;
        if (res.ok && body?.ok && body.booking) {
          setSelected(body.booking);
        } else {
          setDetailError(body?.error ?? "We couldn't load this booking right now.");
        }
      } catch {
        if (!cancelled) setDetailError("We couldn't load this booking right now.");
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId, apiFetch]);

  // Escape closes the detail panel and focus returns to the row it came from.
  useEffect(() => {
    if (!selectedId) return;
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDetail();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      restoreFocusRef.current?.focus?.();
    };
  }, [selectedId]);

  function openDetail(booking: AdminBooking, trigger: HTMLElement | null) {
    restoreFocusRef.current = trigger;
    setActionError(null);
    setConfirmingCancel(false);
    setRescheduling(false);
    setSelected(null);
    setDetailError(null);
    setDetailLoading(true);
    setSelectedId(booking.id);
  }

  async function runAction(action: OwnerAction, extra?: { visitDate: string; timeSlot: string }) {
    if (!selected) return;
    setActionBusy(true);
    setActionError(null);
    try {
      const res = await apiFetch(`/api/admin/bookings/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          expected: {
            status: selected.status,
            visitDate: selected.visitDate,
            timeSlot: selected.timeSlot,
          },
          ...(extra ?? {}),
        }),
      });
      const body = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string; booking?: AdminBooking }
        | null;

      if (res.ok && body?.ok && body.booking) {
        setSelected(body.booking);
        setListVersion((version) => version + 1);
        setLive(`${ACTION_LABELS[action]} applied. Status is now ${body.booking.status.toLowerCase()}.`);
        setConfirmingCancel(false);
        setRescheduling(false);
        return;
      }
      setActionError(body?.error ?? "We couldn't update this booking right now.");
      setLive(body?.error ?? "The update failed.");
    } catch {
      setActionError("We couldn't update this booking right now.");
      setLive("The update failed.");
    } finally {
      setActionBusy(false);
    }
  }

  function toggleSort(field: SortField) {
    setSort((current) =>
      current.field === field
        ? { field, order: current.order === "asc" ? "desc" : "asc" }
        : { field, order: field === "customer_name" ? "asc" : "desc" }
    );
    setPage(1);
  }

  const items = data?.items ?? [];
  const minDate = earliestBookableDateString();

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-primary-deep">Bookings</h1>
          <p className="text-small mt-1 text-muted-foreground">
            {loading ? "Loading bookings…" : `${data?.total ?? 0} visit request${(data?.total ?? 0) === 1 ? "" : "s"}`}
          </p>
        </div>
      </div>

      <section
        aria-label="Filter bookings"
        className="mt-6 rounded-card border border-border bg-surface p-4"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <label htmlFor="booking-search" className="text-small block font-semibold text-foreground">
              Search
            </label>
            <input
              id="booking-search"
              type="search"
              value={filters.q}
              placeholder="Name, phone or email"
              onChange={(event) => {
                setFilters((current) => ({ ...current, q: event.target.value }));
                setPage(1);
              }}
              className="mt-1.5 w-full rounded-control border border-border bg-background px-3 py-2 text-small"
            />
          </div>

          <div>
            <label htmlFor="booking-status" className="text-small block font-semibold text-foreground">
              Status
            </label>
            <select
              id="booking-status"
              value={filters.status}
              onChange={(event) => {
                setFilters((current) => ({ ...current, status: event.target.value }));
                setPage(1);
              }}
              className="mt-1.5 w-full rounded-control border border-border bg-background px-3 py-2 text-small"
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status === "ALL" ? "All statuses" : status.charAt(0) + status.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="booking-date" className="text-small block font-semibold text-foreground">
              Visit date
            </label>
            <input
              id="booking-date"
              type="date"
              value={filters.visitDate}
              onChange={(event) => {
                setFilters((current) => ({ ...current, visitDate: event.target.value }));
                setPage(1);
              }}
              className="mt-1.5 w-full rounded-control border border-border bg-background px-3 py-2 text-small"
            />
          </div>
        </div>

        <label className="text-small mt-4 inline-flex items-center gap-2 font-semibold text-foreground">
          <input
            type="checkbox"
            checked={filters.upcoming}
            onChange={(event) => {
              setFilters((current) => ({ ...current, upcoming: event.target.checked }));
              setPage(1);
            }}
            className="h-4 w-4 accent-[#6b1220]"
          />
          Upcoming visits only
        </label>
      </section>

      <p aria-live="polite" className="sr-only">
        {live}
      </p>

      {error ? (
        <div className="mt-6 rounded-card border border-[#e3bbbb] bg-[#f8e7e7] p-4">
          <p className="text-small font-semibold text-[#8a2222]">{error}</p>
          <button
            type="button"
            onClick={() => setListVersion((version) => version + 1)}
            className="text-small mt-2 underline underline-offset-4 text-[#8a2222]"
          >
            Try again
          </button>
        </div>
      ) : null}

      {!error && loading && !data ? (
        <p className="text-small mt-8 text-muted-foreground" role="status">
          Loading bookings…
        </p>
      ) : null}

      {!error && data && items.length === 0 ? (
        <p className="mt-8 rounded-card border border-dashed border-border bg-surface p-6 text-small text-muted-foreground">
          No bookings match these filters. Clear the filters to see every visit
          request.
        </p>
      ) : null}

      {items.length > 0 ? (
        <>
          {/* Desktop table */}
          <div className="mt-6 hidden overflow-hidden rounded-card border border-border bg-surface md:block">
            <table className="w-full border-collapse text-left text-small">
              <caption className="sr-only">Visit booking requests</caption>
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  {SORT_COLUMNS.slice(0, 2).map((column) => (
                    <th
                      key={column.field}
                      scope="col"
                      className="px-4 py-3 font-semibold"
                      aria-sort={
                        sort.field === column.field
                          ? sort.order === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort(column.field)}
                        className="inline-flex items-center gap-1 py-1.5 font-semibold uppercase tracking-[0.08em] hover:text-foreground"
                      >
                        {column.label}
                        <span aria-hidden="true">
                          {sort.field === column.field ? (sort.order === "asc" ? "▲" : "▼") : "↕"}
                        </span>
                      </button>
                    </th>
                  ))}
                  <th scope="col" className="px-4 py-3 font-semibold">Phone</th>
                  {SORT_COLUMNS.slice(2).map((column) => (
                    <th
                      key={column.field}
                      scope="col"
                      className="px-4 py-3 font-semibold"
                      aria-sort={
                        sort.field === column.field
                          ? sort.order === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort(column.field)}
                        className="inline-flex items-center gap-1 py-1.5 font-semibold uppercase tracking-[0.08em] hover:text-foreground"
                      >
                        {column.label}
                        <span aria-hidden="true">
                          {sort.field === column.field ? (sort.order === "asc" ? "▲" : "▼") : "↕"}
                        </span>
                      </button>
                    </th>
                  ))}
                  <th scope="col" className="px-4 py-3 font-semibold">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((booking) => (
                  <tr key={booking.id} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-3">
                      <span className="font-semibold text-foreground">{booking.customerName}</span>
                      <span className="block text-muted-foreground">{booking.eventType}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDateTime(booking.createdAt)}</td>
                    <td className="px-4 py-3">
                      <a href={`tel:${booking.phone.replace(/[^\d+]/g, "")}`} className="hover:text-primary">
                        {booking.phone}
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      {formatDate(booking.visitDate)}
                      <span className="block text-muted-foreground">{booking.timeSlot}</span>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={booking.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={(event) => openDetail(booking, event.currentTarget)}
                        className="btn-text btn-outline"
                      >
                        View<span className="sr-only"> booking from {booking.customerName}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="mt-6 space-y-3 md:hidden">
            {items.map((booking) => (
              <li key={booking.id} className="rounded-card border border-border bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">{booking.customerName}</p>
                    <p className="text-small text-muted-foreground">{booking.eventType}</p>
                  </div>
                  <StatusBadge status={booking.status} />
                </div>
                <dl className="text-small mt-3 space-y-1 text-muted-foreground">
                  <div className="flex gap-2">
                    <dt className="font-semibold text-foreground">Visit:</dt>
                    <dd>{formatDate(booking.visitDate)} · {booking.timeSlot}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-semibold text-foreground">Phone:</dt>
                    <dd><a href={`tel:${booking.phone.replace(/[^\d+]/g, "")}`} className="hover:text-primary">{booking.phone}</a></dd>
                  </div>
                </dl>
                <button
                  type="button"
                  onClick={(event) => openDetail(booking, event.currentTarget)}
                  className="btn-text btn-outline btn-block mt-3"
                >
                  View booking
                </button>
              </li>
            ))}
          </ul>

          <nav aria-label="Bookings pagination" className="mt-6 flex items-center justify-between gap-4">
            <p className="text-small text-muted-foreground">
              Page {page} of {Math.max(1, data?.pageCount ?? 1)}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1 || loading}
                className="btn-text btn-quiet"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((current) => current + 1)}
                disabled={page >= (data?.pageCount ?? 1) || loading}
                className="btn-text btn-quiet"
              >
                Next
              </button>
            </div>
          </nav>
        </>
      ) : null}

      {selectedId ? (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-primary-deep/40"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeDetail();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="booking-detail-title"
            className="h-full w-full max-w-md overflow-y-auto bg-surface p-5 sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <h2 id="booking-detail-title" className="font-display text-2xl text-primary-deep">
                Booking details
              </h2>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={closeDetail}
                aria-label="Close booking details"
                className="btn-text btn-quiet"
              >
                Close
              </button>
            </div>

            {detailLoading ? (
              <p className="text-small mt-6 text-muted-foreground" role="status">Loading booking…</p>
            ) : null}

            {detailError ? (
              <p className="text-small mt-6 rounded-control border border-[#e3bbbb] bg-[#f8e7e7] px-3 py-2 text-[#8a2222]">
                {detailError}
              </p>
            ) : null}

            {selected ? (
              <>
                <div className="mt-4">
                  <StatusBadge status={selected.status} />
                </div>

                <dl className="text-small mt-4 space-y-3">
                  <div>
                    <dt className="font-semibold uppercase tracking-[0.1em] text-muted-foreground">Customer</dt>
                    <dd className="text-foreground">{selected.customerName}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold uppercase tracking-[0.1em] text-muted-foreground">Phone</dt>
                    <dd>
                      <a href={`tel:${selected.phone.replace(/[^\d+]/g, "")}`} className="text-primary underline underline-offset-4">
                        {selected.phone}
                      </a>
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold uppercase tracking-[0.1em] text-muted-foreground">Email</dt>
                    <dd className="break-all text-foreground">{selected.email}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold uppercase tracking-[0.1em] text-muted-foreground">Event</dt>
                    <dd className="text-foreground">
                      {selected.eventType}
                      {selected.eventDate ? ` · ${formatDate(selected.eventDate)}` : ""}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold uppercase tracking-[0.1em] text-muted-foreground">Visit</dt>
                    <dd className="text-foreground">{formatDate(selected.visitDate)} · {selected.timeSlot}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold uppercase tracking-[0.1em] text-muted-foreground">Received</dt>
                    <dd className="text-foreground">{formatDateTime(selected.createdAt)}</dd>
                  </div>
                  {selected.message ? (
                    <div>
                      <dt className="font-semibold uppercase tracking-[0.1em] text-muted-foreground">Message</dt>
                      <dd className="text-foreground">{selected.message}</dd>
                    </div>
                  ) : null}
                </dl>

                <div aria-live="polite">
                  {actionError ? (
                    <p className="text-small mt-5 rounded-control border border-[#e3bbbb] bg-[#f8e7e7] px-3 py-2 text-[#8a2222]">
                      {actionError}
                    </p>
                  ) : null}
                </div>

                {availableActions(selected.status).length > 0 ? (
                  <div className="mt-6 border-t border-border pt-5">
                    <h3 className="text-small font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                      Actions
                    </h3>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {availableActions(selected.status)
                        .filter((action) => action !== "cancel" && action !== "reschedule")
                        .map((action) => (
                          <button
                            key={action}
                            type="button"
                            disabled={actionBusy}
                            onClick={() => runAction(action)}
                            className="btn-text btn-primary"
                          >
                            {ACTION_LABELS[action]}
                          </button>
                        ))}
                    </div>

                    {availableActions(selected.status).includes("reschedule") ? (
                      <div className="mt-4">
                        {rescheduling ? (
                          <form
                            className="space-y-3"
                            onSubmit={(event) => {
                              event.preventDefault();
                              runAction("reschedule", { visitDate: newDate, timeSlot: newSlot });
                            }}
                          >
                            <div>
                              <label htmlFor="reschedule-date" className="text-small block font-semibold text-foreground">
                                New visit date
                              </label>
                              <input
                                id="reschedule-date"
                                type="date"
                                required
                                min={minDate}
                                value={newDate}
                                onChange={(event) => setNewDate(event.target.value)}
                                className="mt-1.5 w-full rounded-control border border-border bg-background px-3 py-2 text-small"
                              />
                            </div>
                            <div>
                              <label htmlFor="reschedule-slot" className="text-small block font-semibold text-foreground">
                                New time slot
                              </label>
                              <select
                                id="reschedule-slot"
                                value={newSlot}
                                onChange={(event) => setNewSlot(event.target.value)}
                                className="mt-1.5 w-full rounded-control border border-border bg-background px-3 py-2 text-small"
                              >
                                {BOOKING_TIME_SLOTS.map((slot) => (
                                  <option key={slot} value={slot}>{slot}</option>
                                ))}
                              </select>
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="submit"
                                disabled={actionBusy || !newDate}
                                className="btn-text btn-primary"
                              >
                                {actionBusy ? "Rescheduling…" : "Save new slot"}
                              </button>
                              <button
                                type="button"
                                disabled={actionBusy}
                                onClick={() => setRescheduling(false)}
                                className="btn-text btn-quiet"
                              >
                                Keep current slot
                              </button>
                            </div>
                          </form>
                        ) : (
                          <button
                            type="button"
                            disabled={actionBusy}
                            onClick={() => {
                              setNewDate("");
                              setNewSlot(BOOKING_TIME_SLOTS[0]);
                              setRescheduling(true);
                            }}
                            className="btn-text btn-outline"
                          >
                            Reschedule
                          </button>
                        )}
                      </div>
                    ) : null}

                    {availableActions(selected.status).includes("cancel") ? (
                      <div className="mt-4">
                        {confirmingCancel ? (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={actionBusy}
                              onClick={() => runAction("cancel")}
                              className="btn-text btn-danger"
                            >
                              {actionBusy ? "Cancelling…" : "Yes, cancel this booking"}
                            </button>
                            <button
                              type="button"
                              disabled={actionBusy}
                              onClick={() => setConfirmingCancel(false)}
                              className="btn-text btn-quiet"
                            >
                              Keep booking
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={actionBusy}
                            onClick={() => setConfirmingCancel(true)}
                            className="btn-text btn-danger-outline"
                          >
                            Cancel booking
                          </button>
                        )}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-small mt-6 border-t border-border pt-5 text-muted-foreground">
                    This booking is finished — no further actions are available.
                  </p>
                )}
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
