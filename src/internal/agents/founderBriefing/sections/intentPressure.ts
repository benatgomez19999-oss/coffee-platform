// =====================================================
// FOUNDER BRIEFING — INTENT PRESSURE SECTION
//
// Counts and green-kg from the briefing's own openIntent
// query. intentPressureRatio and intentConversion are
// forwarded verbatim from the monitor.
// =====================================================

import type { FounderBriefingSnapshot } from "../dataAccess.ts"
import type { IntentPressureSection } from "../types.ts"
import { asGreenKg } from "../types.ts"

const DAY_MS = 24 * 60 * 60 * 1000

export function buildIntentPressureSection(
  snap: FounderBriefingSnapshot,
): IntentPressureSection {

  const { now, monitorReport, openIntentRows } = snap

  let openIntentsCount   = 0
  let openIntentsGreenKg = 0
  let oldestCreatedAt: Date | null = null

  for (const row of openIntentRows) {
    openIntentsCount++
    openIntentsGreenKg += row.deltaKg
    if (oldestCreatedAt === null || row.createdAt < oldestCreatedAt) {
      oldestCreatedAt = row.createdAt
    }
  }

  const oldestOpenIntentAgeDays = oldestCreatedAt
    ? Math.floor((now.getTime() - oldestCreatedAt.getTime()) / DAY_MS)
    : null

  const conv = monitorReport.metrics.intentConversion

  return {
    openIntentsCount,
    openIntentsGreenKg:  asGreenKg(openIntentsGreenKg),
    intentPressureRatio: monitorReport.metrics.intentPressureRatio,
    oldestOpenIntentAgeDays,
    intentConversion: {
      current7d: conv.current7d,
      prior7d:   conv.prior7d,
      deltaPts:  conv.deltaPts,
    },
  }
}
