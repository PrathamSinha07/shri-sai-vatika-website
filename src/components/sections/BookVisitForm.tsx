"use client";

import { useEffect, useMemo, useState } from "react";
import { BOOKING_TIME_SLOTS } from "@/content/booking";
import { site } from "@/content/site";
import { whatsappUrl } from "@/lib/whatsapp";
import { EVENT_TYPES } from "@/lib/booking/validate";

type Status = "idle" | "submitting" | "success" | "error";

export default function BookVisitForm() {
  const [visitDate, setVisitDate] = useState("");
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [availabilityError, setAvailabilityError] = useState(false);
  const [timeSlot, setTimeSlot] = useState("");
  const [eventType, setEventType] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [emailIssue, setEmailIssue] = useState(false);
  const [customerName, setCustomerName] = useState("");

  const minDate = useMemo(() => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const get = (t: string) => parts.find((p) => p.type === t)!.value;
    const d = new Date(
      Date.UTC(Number(get("year")), Number(get("month")) - 1, Number(get("day")))
    );
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  }, []);

  useEffect(() => {
    if (!visitDate) return;
    let active = true;
    fetch(`/api/visit-bookings/availability?date=${encodeURIComponent(visitDate)}`)
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) throw new Error("unavailable");
        return json.booked as string[];
      })
      .then((booked) => {
        if (!active) return;
        setBookedSlots(booked);
        setTimeSlot((current) => (booked.includes(current) ? "" : current));
      })
      .catch(() => {
        if (!active) return;
        setBookedSlots([]);
        setAvailabilityError(true);
      });
    return () => {
      active = false;
    };
  }, [visitDate]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setErrors({});
    setFormError("");
    const form = new FormData(event.currentTarget);
    const payload = {
      customerName: form.get("customerName"),
      phone: form.get("phone"),
      email: form.get("email"),
      eventType: form.get("eventType"),
      eventTypeOther: form.get("eventTypeOther"),
      visitDate: form.get("visitDate"),
      timeSlot: form.get("timeSlot"),
      message: form.get("message"),
      website: form.get("website"), // honeypot
    };

    try {
      const res = await fetch("/api/visit-bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        setCustomerName(String(payload.customerName ?? ""));
        setEmailIssue(Boolean(json.emailIssue));
        setStatus("success");
        return;
      }
      if (json?.errors) {
        setErrors(json.errors);
        setFormError("Please review the highlighted fields.");
      } else {
        setFormError(
          json?.error ?? "We couldn't submit your request right now. Please try again."
        );
      }
      // Slot conflict / unavailable: refresh availability for that date.
      if (res.status === 409 && visitDate) {
        fetch(`/api/visit-bookings/availability?date=${encodeURIComponent(visitDate)}`)
          .then(async (r) => {
            const j = await r.json().catch(() => null);
            if (r.ok && j?.ok) {
              setBookedSlots(j.booked as string[]);
              setTimeSlot("");
            }
          })
          .catch(() => undefined);
      }
      setStatus("error");
    } catch {
      setFormError("Network issue — please check your connection and try again.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="mx-auto max-w-xl text-center" aria-live="polite">
        <h3 className="font-display text-section text-primary-deep">
          Visit Request Received
        </h3>
        <p className="text-body mt-4 text-muted-foreground">
          Thank you{customerName ? `, ${customerName}` : ""}. Your visit
          request has been received.
        </p>
        <p className="text-body mt-3 text-muted-foreground">
          Date: <strong>{visitDate}</strong>
          <br />
          Time: <strong>{timeSlot}</strong>
        </p>
        <p className="text-body mt-3 text-muted-foreground">
          Our team will contact you regarding your visit.
        </p>
        {emailIssue && (
          <p className="text-small mt-3 text-muted-foreground">
            (We could not send the confirmation email right now, but your
            request has been saved.)
          </p>
        )}
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <a
            href={whatsappUrl(
              `Namaste, I just requested a visit to ${site.name} on ${visitDate} (${timeSlot}). Please confirm availability.`
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-text inline-flex items-center justify-center bg-primary px-7 py-4 text-surface transition-colors hover:bg-primary-deep"
          >
            WhatsApp Us
          </a>
          <a
            href={site.phoneHref}
            className="btn-text inline-flex items-center justify-center border border-primary px-7 py-4 text-primary transition-colors hover:bg-primary hover:text-surface"
          >
            Call Us
          </a>
        </div>
      </div>
    );
  }

  const inputClass =
    "w-full border border-border bg-surface px-4 py-3 text-body text-foreground placeholder:text-muted-foreground/70 focus:border-gold focus:outline-none";
  const errorClass = "mt-1 text-small text-primary";

  return (
    <form onSubmit={onSubmit} noValidate className="mx-auto max-w-2xl">
      <div aria-live="polite" className="sr-only">
        {formError}
      </div>
      {formError && (
        <p className="mb-6 border border-primary/40 bg-primary/5 px-4 py-3 text-small text-primary" role="alert">
          {formError}
        </p>
      )}

      {/* Honeypot — hidden from humans */}
      <div aria-hidden="true" className="sr-only">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="customerName" className="text-small font-semibold tracking-wide text-foreground">
            Customer Name *
          </label>
          <input id="customerName" name="customerName" type="text" required maxLength={120} className={`${inputClass} mt-2`} />
          {errors.customerName && <p className={errorClass}>{errors.customerName}</p>}
        </div>
        <div>
          <label htmlFor="phone" className="text-small font-semibold tracking-wide text-foreground">
            Phone *
          </label>
          <input id="phone" name="phone" type="tel" required inputMode="tel" placeholder="Enter your phone number" className={`${inputClass} mt-2`} />
          {errors.phone && <p className={errorClass}>{errors.phone}</p>}
        </div>
        <div>
          <label htmlFor="email" className="text-small font-semibold tracking-wide text-foreground">
            Email *
          </label>
          <input id="email" name="email" type="email" required autoComplete="email" className={`${inputClass} mt-2`} />
          {errors.email && <p className={errorClass}>{errors.email}</p>}
        </div>
        <div>
          <label htmlFor="eventType" className="text-small font-semibold tracking-wide text-foreground">
            Event Type *
          </label>
          <select id="eventType" name="eventType" required defaultValue="" className={`${inputClass} mt-2`} onChange={(e) => setEventType(e.target.value)}>
            <option value="" disabled>Select event type</option>
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          {errors.eventType && <p className={errorClass}>{errors.eventType}</p>}
        </div>
      </div>

      {eventType === "Other" && (
        <div className="mt-6">
          <label htmlFor="eventTypeOther" className="text-small font-semibold tracking-wide text-foreground">
            Please describe your event *
          </label>
          <input id="eventTypeOther" name="eventTypeOther" type="text" maxLength={80} className={`${inputClass} mt-2`} />
          {errors.eventTypeOther && <p className={errorClass}>{errors.eventTypeOther}</p>}
        </div>
      )}

      <div className="mt-6">
        <label htmlFor="visitDate" className="text-small font-semibold tracking-wide text-foreground">
          Visit Date *
        </label>
        <input
          id="visitDate"
          name="visitDate"
          type="date"
          required
          min={minDate}
          value={visitDate}
          onChange={(e) => {
            setVisitDate(e.target.value);
            setTimeSlot("");
            setBookedSlots([]);
            setAvailabilityError(false);
          }}
          className={`${inputClass} mt-2`}
        />
        <p className="text-small mt-1 text-muted-foreground">
          Visits can be booked from {minDate} onwards (Asia/Kolkata).
        </p>
        {errors.visitDate && <p className={errorClass}>{errors.visitDate}</p>}
      </div>

      <fieldset className="mt-6">
        <legend className="text-small font-semibold tracking-wide text-foreground">
          Time Slot *
        </legend>
        {!visitDate && (
          <p className="text-small mt-2 text-muted-foreground">
            Select a visit date to see available slots.
          </p>
        )}
        {availabilityError && (
          <p className="text-small mt-2 text-primary">
            Could not load availability right now. You may still submit; the server will verify the slot.
          </p>
        )}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {BOOKING_TIME_SLOTS.map((slot) => {
            const booked = bookedSlots.includes(slot);
            return (
              <label
                key={slot}
                className={`flex cursor-pointer items-center justify-between border px-4 py-3 text-small transition-colors ${
                  booked
                    ? "cursor-not-allowed border-border bg-ivory text-muted-foreground/70 line-through"
                    : timeSlot === slot
                      ? "border-primary bg-surface text-primary"
                      : "border-border bg-surface text-foreground hover:border-gold"
                }`}
              >
                <input
                  type="radio"
                  name="timeSlot"
                  value={slot}
                  disabled={booked || !visitDate}
                  checked={timeSlot === slot}
                  onChange={() => setTimeSlot(slot)}
                  className="sr-only"
                />
                <span>{slot}</span>
                <span className="text-[0.7rem] uppercase tracking-wider">
                  {booked ? "Booked" : timeSlot === slot ? "Selected" : "Available"}
                </span>
              </label>
            );
          })}
        </div>
        {errors.timeSlot && <p className={errorClass}>{errors.timeSlot}</p>}
      </fieldset>

      <div className="mt-6">
        <label htmlFor="message" className="text-small font-semibold tracking-wide text-foreground">
          Message (optional)
        </label>
        <textarea id="message" name="message" rows={4} maxLength={1000} className={`${inputClass} mt-2`} />
        {errors.message && <p className={errorClass}>{errors.message}</p>}
      </div>

      <button
        type="submit"
        disabled={status === "submitting"}
        className="btn-text mt-8 inline-flex w-full items-center justify-center bg-primary px-7 py-4 text-surface transition-colors hover:bg-primary-deep disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {status === "submitting" ? "Submitting…" : "Request Visit"}
      </button>
      <p className="text-small mt-4 text-muted-foreground">
        Submitting this form places a visit request — our team confirms every
        booking personally.
      </p>
      <p className="text-small mt-6 text-muted-foreground">
        Prefer WhatsApp? Message us directly.
      </p>
      <a
        href={whatsappUrl(
          `Namaste, I would like to plan a visit to ${site.name}. Please share available dates and time slots.`
        )}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-text mt-2 inline-flex items-center border border-primary px-7 py-3 text-primary transition-colors hover:bg-primary hover:text-surface"
      >
        WhatsApp Us
      </a>
    </form>
  );
}
