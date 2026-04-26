// =====================================================
// FOUNDER BRIEFING — CONTRACT PRESSURE SECTION
//
// Aggregations over the briefing's own contract snapshot.
// Uses Contract.createdAt as the age proxy (no per-status
// transition timestamp exists in v1 — over-approximates
// in the safe direction).
//
// Monthly committed draw is intentionally NOT computed
// here. It is identical to the monitor's
// metrics.monthlyDrawGreen and is already exposed as
// supplyHealth.keyMetrics.monthlyDrawGreenKg — duplicating
// it here would surface the same number twice in one
// briefing.
// =====================================================

import type { ContractStatus } from "@prisma/client"
import type { FounderBriefingSnapshot } from "../dataAccess.ts"
import type { ContractPressureSection } from "../types.ts"
import {
  AWAITING_SIGNATURE_SLA_DAYS,
  PAYMENT_PENDING_SLA_DAYS,
  RENEWAL_WINDOW_MONTHS,
} from "../config.ts"

const DAY_MS = 24 * 60 * 60 * 1000

const RENEWAL_STATUSES: ReadonlySet<ContractStatus> = new Set([
  "ACTIVE",
  "PAST_DUE",
])

export function buildContractPressureSection(
  snap: FounderBriefingSnapshot,
): ContractPressureSection {

  const { now, contractRows, contractCounts } = snap

  let awaitingSignatureOlderThanSlaCount = 0
  let paymentPendingOlderThanSlaCount    = 0
  let upcomingRenewalsCount              = 0

  for (const c of contractRows) {
    const ageDays = (now.getTime() - c.createdAt.getTime()) / DAY_MS

    if (c.status === "AWAITING_SIGNATURE" && ageDays > AWAITING_SIGNATURE_SLA_DAYS) {
      awaitingSignatureOlderThanSlaCount++
    }

    if (c.status === "PAYMENT_PENDING" && ageDays > PAYMENT_PENDING_SLA_DAYS) {
      paymentPendingOlderThanSlaCount++
    }

    if (RENEWAL_STATUSES.has(c.status) && c.remainingMonths <= RENEWAL_WINDOW_MONTHS) {
      upcomingRenewalsCount++
    }
  }

  return {
    countsByStatus: contractCounts,
    awaitingSignatureOlderThanSlaCount,
    paymentPendingOlderThanSlaCount,
    upcomingRenewalsCount,
  }
}
