//////////////////////////////////////////////////////
// 🤝 CONTRACT REQUEST — PURE HELPERS (CONTRACT-REQUEST-1)
//
// Validates the body the "Configure monthly supply"
// modal sends to POST /api/demand-intent, plus a few
// shared projections used by the modal + dashboard:
//
//   - validateContractRequestInput → sanitises greenLotId
//     + requestedKg + durationMonths into the shape the
//     route forwards to createDemandIntent
//   - hasPendingRequestForLot → tells the catalog UI which
//     CTAs to grey out
//   - formatDemandIntentOutcome → maps the service's
//     semaphore (green/yellow/red) into producer-friendly
//     UI strings without leaking enum names
//
// No Prisma. No DOM. Tests live in
// src/services/contract-request/__tests__/.
//////////////////////////////////////////////////////

//////////////////////////////////////////////////////
// CONSTANTS
//////////////////////////////////////////////////////

// Sanity caps. The modal will refuse to submit beyond
// these and the route also enforces them, so the modal
// can never disagree with the server.
export const MIN_MONTHLY_ROASTED_KG = 1
export const MAX_MONTHLY_ROASTED_KG = 50000

// Duration options exposed in the modal. Persistence on
// DemandIntent is not added this sprint — the value is
// captured only for the contract wizard handoff.
export const ALLOWED_DURATION_MONTHS = [3, 6, 12, 24] as const
export type ContractRequestDuration = (typeof ALLOWED_DURATION_MONTHS)[number]

export function getDefaultContractRequestDurationMonths(): ContractRequestDuration {
  return 6
}

//////////////////////////////////////////////////////
// SHAPES
//////////////////////////////////////////////////////

export type ContractRequestInput = {
  greenLotId: unknown
  requestedKg: unknown
  durationMonths?: unknown
  // CONTRACT-REQUEST-3 — buyer's start month/date. Accepts an
  // ISO date string (`YYYY-MM-DD`) or a year-month string
  // (`YYYY-MM`). The latter is normalised to the first day of
  // that month.
  requestedStartDate?: unknown
}

export type SanitisedContractRequestInput = {
  greenLotId: string
  requestedKg: number
  durationMonths: ContractRequestDuration
  // CONTRACT-REQUEST-3 — `Date` if the buyer supplied one,
  // `null` if the modal didn't collect it. The service
  // persists null on `DemandIntent.requestedStartDate` so
  // existing flows keep working unchanged.
  requestedStartDate: Date | null
}

export type ContractRequestValidationError = {
  code:
    | "GREEN_LOT_ID_REQUIRED"
    | "REQUESTED_KG_REQUIRED"
    | "REQUESTED_KG_INVALID"
    | "REQUESTED_KG_TOO_SMALL"
    | "REQUESTED_KG_TOO_LARGE"
    | "DURATION_INVALID"
    | "START_DATE_INVALID"
    | "START_DATE_TOO_OLD"
    | "START_DATE_TOO_FAR"
  message: string
}

export type ContractRequestValidationResult =
  | { ok: true; value: SanitisedContractRequestInput }
  | { ok: false; error: ContractRequestValidationError }

//////////////////////////////////////////////////////
// CONTRACT-REQUEST-3 — START DATE BOUNDS
//
// We accept the current month (so a buyer creating a request
// "right now" can pick this month as the start) and cap the
// future at 24 months. Past months — beyond the current one
// — are rejected as misclicks.
//////////////////////////////////////////////////////

export const CONTRACT_REQUEST_MAX_FUTURE_MONTHS = 24

//////////////////////////////////////////////////////
// PRIMITIVES
//////////////////////////////////////////////////////

function trim(value: unknown): string {
  if (typeof value !== "string") return ""
  return value.trim()
}

function coerceFiniteNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (trimmed === "") return null
    const n = Number(trimmed)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function isAllowedDuration(value: number): value is ContractRequestDuration {
  return (ALLOWED_DURATION_MONTHS as readonly number[]).includes(value)
}

//////////////////////////////////////////////////////
// CONTRACT-REQUEST-3 — DURATION HELPER (extracted)
//
// Returned shape mirrors the main validator so callers
// (modal, service-layer sanitiser) can reuse the same
// error codes.
//////////////////////////////////////////////////////

export type ContractRequestDurationResult =
  | { ok: true; value: ContractRequestDuration }
  | { ok: false; error: ContractRequestValidationError }

export function validateContractRequestDuration(
  value: unknown,
): ContractRequestDurationResult {
  if (value === undefined || value === null) {
    return { ok: true, value: getDefaultContractRequestDurationMonths() }
  }
  const n = coerceFiniteNumber(value)
  if (n === null || !isAllowedDuration(n)) {
    return {
      ok: false,
      error: {
        code: "DURATION_INVALID",
        message: "Choose a duration of 3, 6, 12 or 24 months.",
      },
    }
  }
  return { ok: true, value: n }
}

//////////////////////////////////////////////////////
// CONTRACT-REQUEST-3 — START DATE HELPER
//
// Accepts:
//   - `null` / `undefined` / empty string → null (not collected)
//   - `YYYY-MM` → first day of that month at 00:00 UTC
//   - `YYYY-MM-DD` → that day at 00:00 UTC
//   - any other ISO 8601 string that `Date` can parse — but we
//     normalise to the first day of its month so the value the
//     contract wizard prefills lines up with the modal's
//     "start month" semantics.
//
// Rejects:
//   - non-string, non-Date inputs
//   - invalid date strings
//   - months strictly before the current month
//   - months more than CONTRACT_REQUEST_MAX_FUTURE_MONTHS from now
//
// Returns the normalised first-of-month Date (UTC).
//////////////////////////////////////////////////////

export type ContractRequestStartDateResult =
  | { ok: true; value: Date | null }
  | { ok: false; error: ContractRequestValidationError }

const YEAR_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/
const YEAR_MONTH_DAY_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

function firstOfMonthUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

function monthsBetween(a: Date, b: Date): number {
  return (
    (b.getUTCFullYear() - a.getUTCFullYear()) * 12 +
    (b.getUTCMonth() - a.getUTCMonth())
  )
}

export function validateContractRequestStartDate(
  value: unknown,
  now: Date = new Date(),
): ContractRequestStartDateResult {
  if (value === undefined || value === null) {
    return { ok: true, value: null }
  }

  let parsed: Date | null = null

  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) {
      return {
        ok: false,
        error: {
          code: "START_DATE_INVALID",
          message: "Pick a valid start month.",
        },
      }
    }
    parsed = value
  } else if (typeof value === "string") {
    const trimmed = value.trim()
    if (trimmed === "") return { ok: true, value: null }
    if (YEAR_MONTH_RE.test(trimmed)) {
      // `YYYY-MM` → first day of that month, UTC.
      parsed = new Date(`${trimmed}-01T00:00:00Z`)
    } else if (YEAR_MONTH_DAY_RE.test(trimmed)) {
      parsed = new Date(`${trimmed}T00:00:00Z`)
    } else {
      const d = new Date(trimmed)
      if (Number.isFinite(d.getTime())) parsed = d
    }
  }

  if (!parsed || !Number.isFinite(parsed.getTime())) {
    return {
      ok: false,
      error: {
        code: "START_DATE_INVALID",
        message: "Pick a valid start month.",
      },
    }
  }

  const normalised = firstOfMonthUTC(parsed)
  const currentMonth = firstOfMonthUTC(now)
  const monthsAhead = monthsBetween(currentMonth, normalised)

  if (monthsAhead < 0) {
    return {
      ok: false,
      error: {
        code: "START_DATE_TOO_OLD",
        message: "Start month can't be in the past.",
      },
    }
  }
  if (monthsAhead > CONTRACT_REQUEST_MAX_FUTURE_MONTHS) {
    return {
      ok: false,
      error: {
        code: "START_DATE_TOO_FAR",
        message:
          `Pick a start month within the next ${CONTRACT_REQUEST_MAX_FUTURE_MONTHS} months.`,
      },
    }
  }

  return { ok: true, value: normalised }
}

//////////////////////////////////////////////////////
// MAIN VALIDATION
//
// Producer-friendly error messages. We deliberately do
// NOT mention "ROASTED" / "GREEN" / semaphore names —
// the modal UI tells the buyer the unit, the validator
// just enforces the contract.
//////////////////////////////////////////////////////

export function validateContractRequestInput(
  input: ContractRequestInput,
  now: Date = new Date(),
): ContractRequestValidationResult {

  // greenLotId
  const greenLotId = trim(input.greenLotId)
  if (greenLotId === "") {
    return {
      ok: false,
      error: {
        code: "GREEN_LOT_ID_REQUIRED",
        message: "Select a coffee lot before sending the request.",
      },
    }
  }

  // requestedKg
  if (input.requestedKg === undefined || input.requestedKg === null) {
    return {
      ok: false,
      error: {
        code: "REQUESTED_KG_REQUIRED",
        message: "Enter the monthly volume you want to commit to.",
      },
    }
  }
  const requestedKg = coerceFiniteNumber(input.requestedKg)
  if (requestedKg === null) {
    return {
      ok: false,
      error: {
        code: "REQUESTED_KG_INVALID",
        message: "Monthly volume must be a number.",
      },
    }
  }
  if (requestedKg < MIN_MONTHLY_ROASTED_KG) {
    return {
      ok: false,
      error: {
        code: "REQUESTED_KG_TOO_SMALL",
        message: "Monthly volume must be greater than zero.",
      },
    }
  }
  if (requestedKg > MAX_MONTHLY_ROASTED_KG) {
    return {
      ok: false,
      error: {
        code: "REQUESTED_KG_TOO_LARGE",
        message:
          `That monthly volume is unusually large. Talk to your origin manager for volumes above ${MAX_MONTHLY_ROASTED_KG.toLocaleString()} kg/month.`,
      },
    }
  }
  // Round to integer kg — the DB stores Float but we don't
  // want fractional kilograms on a buyer commitment.
  const requestedKgInt = Math.round(requestedKg)

  // duration — optional in the payload (CONTRACT-REQUEST-3
  // persists it on the intent; the modal still sends it).
  const durationResult = validateContractRequestDuration(input.durationMonths)
  if (!durationResult.ok) return { ok: false, error: durationResult.error }

  // CONTRACT-REQUEST-3 — optional start month.
  const startDateResult = validateContractRequestStartDate(
    input.requestedStartDate,
    now,
  )
  if (!startDateResult.ok) return { ok: false, error: startDateResult.error }

  return {
    ok: true,
    value: {
      greenLotId,
      requestedKg: requestedKgInt,
      durationMonths: durationResult.value,
      requestedStartDate: startDateResult.value,
    },
  }
}

//////////////////////////////////////////////////////
// CONTRACT-REQUEST-3 — service-layer sanitiser
//
// Thin wrapper around validateContractRequestInput for
// callers that don't need to surface field-level error
// codes individually (e.g. internal scripts, tests).
// Keeps the route layer as the single user-facing
// boundary.
//////////////////////////////////////////////////////

export function sanitiseContractRequestCreateInput(
  input: ContractRequestInput,
  now: Date = new Date(),
): ContractRequestValidationResult {
  return validateContractRequestInput(input, now)
}

//////////////////////////////////////////////////////
// PENDING-INTENT HELPER (UI-side)
//
// The dashboard already fetches the buyer's intents.
// This helper tells a card whether the buyer already
// has a non-terminal request open for that lot, so the
// CTA can flip to a "Pending request" chip.
//
// Statuses considered "pending":
//   OPEN / COUNTERED / WAITING
// Terminal/cancelled statuses (CANCELLED / CONSUMED /
// EXPIRED / REJECTED) do NOT block a new request.
//////////////////////////////////////////////////////

export type PendingIntentLike = {
  status?: string | null
  greenLotId?: string | null
}

const PENDING_INTENT_STATUSES = new Set<string>(["OPEN", "COUNTERED", "WAITING"])

export function hasPendingRequestForLot(
  intents: ReadonlyArray<PendingIntentLike> | null | undefined,
  greenLotId: string | null | undefined,
): boolean {
  if (!intents || intents.length === 0) return false
  if (typeof greenLotId !== "string" || greenLotId === "") return false
  for (const i of intents) {
    if (!i) continue
    if (i.greenLotId !== greenLotId) continue
    const s = (i.status ?? "").toUpperCase()
    if (PENDING_INTENT_STATUSES.has(s)) return true
  }
  return false
}

//////////////////////////////////////////////////////
// OUTCOME PROJECTION
//
// The service returns:
//   { intent: DemandIntent, semaphore: { status, ... } }
//
// status is "green" / "yellow" / "red". The modal needs
// a friendly variant + the buyer-facing volumes, all in
// one place so we don't pattern-match status strings in
// JSX.
//
// "tone" is for UI styling and matches the existing
// dashboard palette (success / warning / blocking).
//////////////////////////////////////////////////////

export type DemandIntentOutcome =
  | { kind: "approved";  intentId: string; tone: "success";  headline: string; cta: "CONTINUE_TO_CONTRACT" }
  | { kind: "counter";   intentId: string; tone: "warning";  headline: string; offeredKg: number; cta: "ACCEPT_OR_CANCEL" }
  | { kind: "rejected";  intentId: string; tone: "blocking"; headline: string; cta: "JOIN_WAITLIST" }

export type DemandIntentApiPayload = {
  intent: {
    id: string
    status?: string | null
    requestedKg?: number | null
    offeredKg?: number | null
  }
  semaphore?: {
    status?: string | null
  } | null
}

export function formatDemandIntentOutcome(
  payload: DemandIntentApiPayload,
): DemandIntentOutcome | null {
  const intent = payload?.intent
  if (!intent || typeof intent.id !== "string" || intent.id === "") return null

  const semaphore = (payload?.semaphore?.status ?? "").toLowerCase()
  const status = (intent.status ?? "").toUpperCase()

  if (semaphore === "green" || status === "OPEN") {
    return {
      kind: "approved",
      intentId: intent.id,
      tone: "success",
      headline: "Supply is available — your request is approved.",
      cta: "CONTINUE_TO_CONTRACT",
    }
  }

  if (semaphore === "yellow" || status === "COUNTERED") {
    const offered =
      typeof intent.offeredKg === "number" && Number.isFinite(intent.offeredKg)
        ? Math.round(intent.offeredKg)
        : 0
    return {
      kind: "counter",
      intentId: intent.id,
      tone: "warning",
      headline:
        offered > 0
          ? `We can offer ${offered.toLocaleString()} kg/month on this lot.`
          : "We can offer a smaller volume on this lot.",
      offeredKg: offered,
      cta: "ACCEPT_OR_CANCEL",
    }
  }

  // red / REJECTED
  return {
    kind: "rejected",
    intentId: intent.id,
    tone: "blocking",
    headline: "This lot doesn't have enough supply for that monthly volume.",
    cta: "JOIN_WAITLIST",
  }
}
