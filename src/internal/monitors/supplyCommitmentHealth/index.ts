// =====================================================
// SUPPLY & COMMITMENT HEALTH MONITOR
//
// Single public entry point. Returns a fully assembled
// CommitmentHealthReport. Does NOT persist — persistence
// is a separate concern handled by the route layer so
// that callers can surface persistenceFailed cleanly.
//
// Read-only. Performs zero writes to business tables.
// Performs zero writes to its own audit table.
//
// =====================================================
// PHASE 1 LIMITATIONS — READ THIS BEFORE TRUSTING THE
// OUTPUT FOR ANYTHING OPERATIONALLY LOAD-BEARING
// =====================================================
//
// This monitor is honest about what it does and does
// not do. The list below is the COMPLETE set of known
// v1 limitations. Each one is intentional and each one
// has a documented owner (the file where it lives).
//
//   1. NON-ATOMIC SNAPSHOT.
//      `loadSnapshot` reads each table separately. Drift
//      between reads is possible and acceptable. The
//      `inputFingerprint` reflects the actual rows seen,
//      not a transactional view. See dataAccess.ts for
//      the full consistency model.
//
//   2. SIMPLIFIED INTENT CONVERSION.
//      `intentConversion` only counts whether an intent
//      eventually `consumedAt`-ed. It does NOT distinguish
//      EXPIRED / REJECTED / CANCELLED / still-OPEN, and
//      does NOT weight by intent size. Per-failure-mode
//      buckets are deferred to v1.1. See metrics/derived.ts.
//
//   3. FULFILMENT SLA APPROXIMATION.
//      `ProducerFulfilment` has no `expectedAt` field.
//      "Overdue" is approximated as
//        status = AWAITING_CONFIRMATION AND
//        age-from-createdAt > FULFILMENT_AWAITING_SLA_DAYS.
//      The SLA constant lives in constants.ts. The real
//      due date will replace this approximation when the
//      schema gains `expectedAt`.
//
//   4. INTENTIONAL DIVERGENCE FROM
//      getContractableSupply() FILTERS.
//      The monitor uses a STRICT OTP-confirmed committed
//      set (SIGNED, PAYMENT_PENDING, ACTIVE, PAST_DUE).
//      `getContractableSupply()` uses a DIFFERENT,
//      broader set that includes AWAITING_SIGNATURE.
//      Both are correct for their respective questions
//      ("legally locked" vs. "safe to offer"). The
//      monitor consumes `getContractableSupply()`
//      wholesale and does not reconcile the two filters.
//      See constants.ts.
//
//   5. SUPPLY-SIDE FRAGILITY DETECTORS — RESOLVED IN v1.1.0.
//      Originally `supplyHealth` had no detectors and
//      always read OK. As of v1.1.0 the axis is driven by
//      four additive detectors (FARM_CONCENTRATION_HIGH,
//      SUPPLY_DIVERSITY_LOW, PINNED_LOT_OVEREXPOSED,
//      UNBACKED_COMMITMENTS_HIGH) that aggregate over
//      rows already in the snapshot — no new Prisma reads,
//      no schema changes, no Phase 1 behaviour change.
//      See constants.ts CHANGELOG entry for v1.1.0.
//
//   6. LEGACY monthlyGreenKg FALLBACK.
//      `monthlyGreenKg` is filled from `monthlyVolumeKg`
//      when null, mirroring the existing service. This
//      is a known accuracy tax against legacy contracts.
//      See dataAccess.ts.
//
//   7. AUTH GATE IS DEV-ONLY.
//      The HTTP route gates on NODE_ENV === "development"
//      because no INTERNAL/OPERATOR/ADMIN role exists in
//      the platform yet. The monitor itself is callable
//      directly from server-side code with no gate. See
//      app/api/internal/monitors/.../run/route.ts.
//
// If any of the above changes, MONITOR_VERSION must be
// bumped in constants.ts and a CHANGELOG entry added.
// =====================================================

import { loadSnapshot } from "./dataAccess.ts"

import {
  computePublishedSupplyGreen,
  computeCommittedGreen,
  computeMonthlyDrawGreen,
  computeActiveOpenIntentLoad,
  computeFarmConcentration,
  computeSupplyDiversity,
  computePinnedLotExposure,
  computeUnbackedCommitment,
} from "./metrics/inputs.ts"

import { PINNED_LOT_OVEREXPOSED } from "./config.ts"

import {
  computeMonthsOfCover,
  computeMonthsOfCoverCommittedOnly,
  computeIntentPressureRatio,
  computeIntentConversion,
  computeFulfilmentMetrics,
} from "./metrics/derived.ts"

import { runDetectors } from "./detectors/index.ts"
import { rollupHealthAxes } from "./healthAxes.ts"
import { buildAttribution } from "./attribution.ts"
import { computeInputFingerprint } from "./fingerprint.ts"
import { assembleReport } from "./report.ts"

import type { CommitmentHealthReport, Metrics } from "./types.ts"

export async function runSupplyCommitmentHealthMonitor(args?: {
  now?: Date
  runId?: string
}): Promise<CommitmentHealthReport> {

  const now = args?.now ?? new Date()
  const runStartedAt = now

  // -------------------------------------------------
  // 1. SNAPSHOT
  // -------------------------------------------------

  const snapshot = await loadSnapshot(now)

  // -------------------------------------------------
  // 2. INPUT METRICS
  // -------------------------------------------------

  const publishedSupplyGreen = computePublishedSupplyGreen(
    snapshot.publishedSupplyGreenRows
  )
  const contractableGreen = snapshot.contractableSupplyResult.contractableKg
  const committedGreen = computeCommittedGreen(snapshot.committedContractRows)
  const monthlyDrawGreen = computeMonthlyDrawGreen(
    snapshot.committedContractRows
  )
  const activeOpenIntentLoad = computeActiveOpenIntentLoad(
    snapshot.openIntentRowsCurrent
  )

  // Phase 2 — supply-axis metrics. Pure aggregations
  // over rows already in the snapshot. No new reads.
  const farmConcentration = computeFarmConcentration(
    snapshot.publishedSupplyGreenRows
  )
  const supplyDiversity = computeSupplyDiversity(
    snapshot.publishedSupplyGreenRows
  )
  const pinnedLotExposure = computePinnedLotExposure(
    snapshot.publishedSupplyGreenRows,
    snapshot.committedContractRows,
    PINNED_LOT_OVEREXPOSED.WATCH
  )
  const unbackedCommitment = computeUnbackedCommitment(
    snapshot.publishedSupplyGreenRows,
    snapshot.committedContractRows,
    monthlyDrawGreen
  )

  // -------------------------------------------------
  // 3. DERIVED METRICS
  // -------------------------------------------------

  const monthsOfCover = computeMonthsOfCover(
    contractableGreen,
    monthlyDrawGreen
  )
  const monthsOfCoverCommittedOnly = computeMonthsOfCoverCommittedOnly(
    publishedSupplyGreen,
    committedGreen
  )
  const intentPressureRatio = computeIntentPressureRatio(
    activeOpenIntentLoad.greenKg,
    contractableGreen
  )
  const intentConversion = computeIntentConversion(
    snapshot.intentWindowCurrent,
    snapshot.intentWindowPrior
  )
  const fulfilment = computeFulfilmentMetrics(
    snapshot.fulfilmentRows,
    snapshot.runStartedAt
  )

  const metrics: Metrics = {
    publishedSupplyGreen,
    contractableGreen,
    committedGreen,
    monthlyDrawGreen,
    monthsOfCover,
    monthsOfCoverCommittedOnly,
    activeOpenIntentLoad,
    intentPressureRatio,
    intentConversion,
    fulfilment,
    // Phase 2 — supply-axis metrics. Additive only.
    farmConcentration,
    pinnedLotExposure,
    supplyDiversity,
    unbackedCommitment,
  }

  // -------------------------------------------------
  // 4. DETECTORS
  // -------------------------------------------------

  const detectors = runDetectors(metrics)

  // -------------------------------------------------
  // 5. AXES
  // -------------------------------------------------

  const axes = rollupHealthAxes(detectors)

  // -------------------------------------------------
  // 6. ATTRIBUTION
  // -------------------------------------------------

  const attribution = buildAttribution(detectors, snapshot)

  // -------------------------------------------------
  // 7. FINGERPRINT
  // -------------------------------------------------

  const inputFingerprint = computeInputFingerprint(snapshot)

  // -------------------------------------------------
  // 8. ASSEMBLE
  // -------------------------------------------------

  const runFinishedAt = new Date()

  return assembleReport({
    runStartedAt,
    runFinishedAt,
    inputFingerprint,
    inputCounts: snapshot.inputCounts,
    metrics,
    detectors,
    axes,
    attribution,
    runId: args?.runId,
  })
}
