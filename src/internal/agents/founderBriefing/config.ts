// =====================================================
// FOUNDER BRIEFING — CONFIG
//
// All thresholds and tunables live here. Editing any
// constant in this file is a behavioural change.
// Bump BRIEFING_VERSION when constants change.
// =====================================================

export const BRIEFING_VERSION = "founder-briefing/1.0.0"

// -----------------------------------------------------
// SLA windows (days)
// -----------------------------------------------------
// "Older than X days in this status" → operational warning.
//
// Contract.createdAt is used as the age proxy. The schema
// has no per-status transition timestamp in v1, so this is
// an over-approximation: a contract that recently advanced
// from PENDING to PAYMENT_PENDING will be flagged based on
// its original createdAt. Acceptable for v1 since the cost
// is at worst a noisier alert, never a missed one.
export const AWAITING_SIGNATURE_SLA_DAYS = 3
export const PAYMENT_PENDING_SLA_DAYS    = 5
export const INTENT_OLDEST_OPEN_SLA_DAYS = 5

// -----------------------------------------------------
// Renewal window (months)
// -----------------------------------------------------
// Contracts with remainingMonths <= this are flagged as
// upcoming renewals.
export const RENEWAL_WINDOW_MONTHS = 1

// -----------------------------------------------------
// Sampling cap for warning sampleIds
// -----------------------------------------------------
export const SAMPLE_ID_CAP = 5

// -----------------------------------------------------
// Severity weights — used to rank candidate actions
// -----------------------------------------------------
export const SEVERITY_WEIGHTS: Record<"CRITICAL" | "STRESSED" | "WATCH", number> = {
  CRITICAL: 14,
  STRESSED: 10,
  WATCH:    4,
}

// -----------------------------------------------------
// Provenance — surfaced verbatim in briefing.notes
// -----------------------------------------------------
export const DATA_SOURCES = ["prisma", "supplyCommitmentHealth"] as const

export const EXCLUDED_SOURCES = [
  "engine",
  "ai",
  "spatialMarket",
  "brain",
  "decision",
  "signals",
] as const
