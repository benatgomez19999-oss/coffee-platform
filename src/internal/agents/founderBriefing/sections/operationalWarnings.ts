// =====================================================
// FOUNDER BRIEFING — OPERATIONAL WARNINGS
//
// Briefing-side detectors that the monitor does NOT
// already cover:
//   - AWAITING_SIGNATURE_SLA_BREACH
//   - PAYMENT_PENDING_SLA_BREACH
//   - INTENT_BACKLOG_HIGH
//
// Anything the monitor catches (FULFILMENT_OVERDUE,
// INTENT_PRESSURE_HIGH, INTENT_CONVERSION_DROP, etc.)
// stays on the monitor — no double-detection.
// =====================================================

import type { FounderBriefingSnapshot } from "../dataAccess.ts"
import type { OperationalWarning } from "../types.ts"
import {
  AWAITING_SIGNATURE_SLA_DAYS,
  PAYMENT_PENDING_SLA_DAYS,
  INTENT_OLDEST_OPEN_SLA_DAYS,
  SAMPLE_ID_CAP,
} from "../config.ts"

const DAY_MS = 24 * 60 * 60 * 1000

export function buildOperationalWarnings(
  snap: FounderBriefingSnapshot,
): OperationalWarning[] {

  const { now, contractRows, openIntentRows } = snap
  const warnings: OperationalWarning[] = []

  // -- AWAITING_SIGNATURE_SLA_BREACH ------------------
  {
    const breaches = contractRows.filter(c =>
      c.status === "AWAITING_SIGNATURE" &&
      (now.getTime() - c.createdAt.getTime()) / DAY_MS > AWAITING_SIGNATURE_SLA_DAYS,
    )
    if (breaches.length > 0) {
      warnings.push({
        code: "AWAITING_SIGNATURE_SLA_BREACH",
        severity: breaches.length >= 5 ? "STRESSED" : "WATCH",
        headline: `${breaches.length} contract(s) awaiting signature > ${AWAITING_SIGNATURE_SLA_DAYS}d`,
        count: breaches.length,
        sampleIds: breaches.slice(0, SAMPLE_ID_CAP).map(b => b.id),
      })
    }
  }

  // -- PAYMENT_PENDING_SLA_BREACH ---------------------
  {
    const breaches = contractRows.filter(c =>
      c.status === "PAYMENT_PENDING" &&
      (now.getTime() - c.createdAt.getTime()) / DAY_MS > PAYMENT_PENDING_SLA_DAYS,
    )
    if (breaches.length > 0) {
      warnings.push({
        code: "PAYMENT_PENDING_SLA_BREACH",
        severity: breaches.length >= 5 ? "STRESSED" : "WATCH",
        headline: `${breaches.length} contract(s) payment-pending > ${PAYMENT_PENDING_SLA_DAYS}d`,
        count: breaches.length,
        sampleIds: breaches.slice(0, SAMPLE_ID_CAP).map(b => b.id),
      })
    }
  }

  // -- INTENT_BACKLOG_HIGH ----------------------------
  {
    const stale = openIntentRows.filter(i =>
      (now.getTime() - i.createdAt.getTime()) / DAY_MS > INTENT_OLDEST_OPEN_SLA_DAYS,
    )
    if (stale.length > 0) {
      warnings.push({
        code: "INTENT_BACKLOG_HIGH",
        severity: stale.length >= 10 ? "STRESSED" : "WATCH",
        headline: `${stale.length} open intent(s) older than ${INTENT_OLDEST_OPEN_SLA_DAYS}d`,
        count: stale.length,
        sampleIds: stale.slice(0, SAMPLE_ID_CAP).map(s => s.id),
      })
    }
  }

  return warnings
}
