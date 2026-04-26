// =====================================================
// METRICS — DERIVED LAYER
//
// Pure functions over the input metrics. No I/O.
// =====================================================

import { FULFILMENT_AWAITING_SLA_DAYS } from "../constants.ts"

import type {
  IntentWindowRow,
  FulfilmentRow,
  IntentConversion,
  FulfilmentMetrics,
} from "../types.ts"

// =====================================================
// safeDiv
//
// Single divide-by-zero guard used everywhere ratio
// metrics are computed. Returns `null` (not Infinity,
// not NaN) when the denominator is zero or invalid.
// Detectors interpret `null` as "metric not available
// → no fire."
// =====================================================

export function safeDiv(
  numerator: number,
  denominator: number
): number | null {
  if (
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator) ||
    denominator === 0
  ) {
    return null
  }
  return numerator / denominator
}

// =====================================================
// monthsOfCover
//
// = contractableGreen / monthlyDrawGreen
// Operational runway. Maps to commitmentHealth via
// MONTHS_OF_COVER_LOW.
// =====================================================

export function computeMonthsOfCover(
  contractableGreen: number,
  monthlyDrawGreen: number
): number | null {
  return safeDiv(contractableGreen, monthlyDrawGreen)
}

// =====================================================
// monthsOfCoverCommittedOnly
//
// = publishedSupplyGreen / committedGreen
// Structural floor. Maps to commitmentHealth via
// MONTHS_OF_COVER_COMMITTED_LOW.
// =====================================================

export function computeMonthsOfCoverCommittedOnly(
  publishedSupplyGreen: number,
  committedGreen: number
): number | null {
  return safeDiv(publishedSupplyGreen, committedGreen)
}

// =====================================================
// intentPressureRatio
//
// = activeOpenIntentLoad.greenKg / contractableGreen
// Maps to demandHealth via INTENT_PRESSURE_HIGH.
// =====================================================

export function computeIntentPressureRatio(
  activeOpenIntentGreenKg: number,
  contractableGreen: number
): number | null {
  return safeDiv(activeOpenIntentGreenKg, contractableGreen)
}

// =====================================================
// intentConversion — SIMPLIFIED v1 MODEL
//
// Conversion in a window is computed as:
//   (intents created in window where consumedAt != null)
//   / (total intents created in window)
//
// "Consumed at all" — i.e. the intent was created in
// the window AND has been consumed by the time the
// monitor runs. This is the SIMPLEST signal that an
// intent eventually became a contract.
//
// LIMITATIONS OF THIS v1 MODEL — KNOWN AND ACCEPTED:
//
//   - It does NOT distinguish failure modes. An intent
//     that EXPIRED, was REJECTED, or was CANCELLED is
//     bucketed identically to an intent that is still
//     OPEN. All four count as "not converted."
//
//   - It does NOT cap the consumption window. An intent
//     created late in the prior 7d window that consumes
//     in the current 7d window still counts as a
//     "prior" conversion. Acceptable because the
//     detector compares two adjacent windows of equal
//     width and the same rule is applied to both.
//
//   - It does NOT weight by intent size (greenKg).
//     A 10kg intent and a 10,000kg intent contribute
//     equally to the rate. The detector reads the rate
//     only, not the magnitude — this is intentional in
//     v1 so the metric stays insensitive to a single
//     large outlier.
//
// Deeper analysis (per-failure-mode buckets, time-to-
// consume distributions, magnitude-weighted conversion)
// is DEFERRED to v1.1. Do not add any of it as part of
// a Phase-1 task.
//
// `conversionRate` returns null when the window has
// zero intents — there is nothing to compute.
// =====================================================

function conversionRate(rows: IntentWindowRow[]): number | null {
  if (rows.length === 0) return null
  let consumed = 0
  for (const r of rows) {
    if (r.consumedAt) consumed++
  }
  return consumed / rows.length
}

export function computeIntentConversion(
  current: IntentWindowRow[],
  prior: IntentWindowRow[]
): IntentConversion {
  const current7d = conversionRate(current)
  const prior7d = conversionRate(prior)

  let deltaPts: number | null = null
  if (current7d !== null && prior7d !== null) {
    deltaPts = (current7d - prior7d) * 100
  }

  return { current7d, prior7d, deltaPts }
}

// =====================================================
// fulfilment metrics
//
// "Overdue" = status = AWAITING_CONFIRMATION AND
// (now − createdAt) > FULFILMENT_AWAITING_SLA_DAYS.
//
// Defined here, in the metric layer, NOT in dataAccess
// — so the SLA constant lives in exactly one place.
//
// =====================================================
// overdueRatio DENOMINATOR — v1.0.1 SEMANTIC CHANGE
// =====================================================
//
// `overdueRatio` is overdueCount / awaitingCount, where
// awaitingCount = rows currently in AWAITING_CONFIRMATION
// — the only rows ELIGIBLE to become overdue under the
// SLA rule above.
//
// Rationale: the ratio is meant to express stress
// WITHIN THE ACTIVE FULFILMENT SET, not against historical
// volume. A producer with 10,000 long-since-CONFIRMED
// fulfilments and 2 stuck AWAITING rows should not look
// healthy because the historical denominator drowns the
// signal. Restricting the denominator to the in-flight
// set keeps the ratio responsive to current operational
// pressure.
//
// Edge case: if there are zero AWAITING_CONFIRMATION
// rows, `overdueRatio` is `null` (mirroring `safeDiv`
// semantics elsewhere in this file). Detectors that
// branch on the ratio MUST treat null as "metric not
// available → no fire," which is exactly what
// FULFILMENT_OVERDUE already does (it gates on
// `overdueRatio !== null && overdueRatio >= …`).
//
// Until v1.0.0 the denominator was `rows.length`. The
// MONITOR_VERSION bump to 1.0.1 stamps this semantic
// shift on every persisted snapshot.
// =====================================================

export function computeFulfilmentMetrics(
  rows: FulfilmentRow[],
  now: Date
): FulfilmentMetrics {

  if (rows.length === 0) {
    return {
      overdueCount: 0,
      overdueRatio: null,
      oldestOverdueDays: null,
    }
  }

  const dayMs = 24 * 60 * 60 * 1000
  const slaMs = FULFILMENT_AWAITING_SLA_DAYS * dayMs

  let awaitingCount = 0
  let overdueCount = 0
  let oldestOverdueDays: number | null = null

  for (const r of rows) {
    if (r.status !== "AWAITING_CONFIRMATION") continue
    awaitingCount++
    const ageMs = now.getTime() - r.createdAt.getTime()
    if (ageMs <= slaMs) continue
    overdueCount++
    const days = ageMs / dayMs
    if (oldestOverdueDays === null || days > oldestOverdueDays) {
      oldestOverdueDays = days
    }
  }

  // safeDiv-equivalent behaviour: zero eligible rows → null.
  const overdueRatio =
    awaitingCount === 0 ? null : overdueCount / awaitingCount

  return {
    overdueCount,
    overdueRatio,
    oldestOverdueDays,
  }
}

// =====================================================
// fulfilment overdue ID extraction
//
// Returns the IDs of fulfilments that breach the SLA.
// Used by attribution.ts; kept next to the SLA logic
// so the rule lives in exactly one place.
// =====================================================

export function listOverdueFulfilmentIds(
  rows: FulfilmentRow[],
  now: Date
): string[] {
  const dayMs = 24 * 60 * 60 * 1000
  const slaMs = FULFILMENT_AWAITING_SLA_DAYS * dayMs
  const out: string[] = []
  for (const r of rows) {
    if (r.status !== "AWAITING_CONFIRMATION") continue
    const ageMs = now.getTime() - r.createdAt.getTime()
    if (ageMs <= slaMs) continue
    out.push(r.id)
  }
  return out
}
