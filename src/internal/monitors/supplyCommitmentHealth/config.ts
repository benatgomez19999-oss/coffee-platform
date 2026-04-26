// =====================================================
// SUPPLY & COMMITMENT HEALTH MONITOR — CONFIG
//
// Detector thresholds. Pure data, no logic.
//
// Editing thresholds is a behavioural change.
// Bump MONITOR_VERSION in constants.ts on any edit.
// =====================================================

// =====================================================
// COMMITMENT_LOAD_HIGH
//
// Inputs: committedGreen, publishedSupplyGreen
// Axis:   commitment
//
// Bands: ratio = committedGreen / publishedSupplyGreen
// =====================================================

export const COMMITMENT_LOAD_HIGH = {
  WATCH: 0.7,
  STRESSED: 0.9,
  CRITICAL: 1.0,
}

// =====================================================
// MONTHS_OF_COVER_LOW
//
// Inputs: monthsOfCover (= contractableGreen / monthlyDrawGreen)
// Axis:   commitment   (NOT supply — see plan / detector file)
//
// Bands are LESS THAN.
// =====================================================

export const MONTHS_OF_COVER_LOW = {
  WATCH: 9,
  STRESSED: 6,
  CRITICAL: 3,
}

// =====================================================
// MONTHS_OF_COVER_COMMITTED_LOW
//
// Inputs: monthsOfCoverCommittedOnly
//         (= publishedSupplyGreen / committedGreen)
// Axis:   commitment
//
// Bands are LESS THAN.
// =====================================================

export const MONTHS_OF_COVER_COMMITTED_LOW = {
  WATCH: 9,
  STRESSED: 6,
  CRITICAL: 3,
}

// =====================================================
// INTENT_PRESSURE_HIGH
//
// Inputs: intentPressureRatio
//         (= activeOpenIntentLoad.greenKg / contractableGreen)
// Axis:   demand
// =====================================================

export const INTENT_PRESSURE_HIGH = {
  WATCH: 0.30,
  STRESSED: 0.50,
  CRITICAL: 0.75,
}

// =====================================================
// INTENT_CONVERSION_DROP
//
// Inputs: intentConversion.deltaPts
//         (current 7d conversion − prior 7d conversion,
//          expressed in percentage points)
// Axis:   demand
//
// Bands are NEGATIVE (drops). A delta of −12 fires WATCH.
// =====================================================

export const INTENT_CONVERSION_DROP = {
  WATCH: -10,
  STRESSED: -20,
  CRITICAL: -30,
}

// =====================================================
// FULFILMENT_OVERDUE
//
// Inputs: fulfilment.overdueCount, overdueRatio,
//         oldestOverdueDays
// Axis:   fulfilment
//
// "Overdue" = still in AWAITING_CONFIRMATION more than
// FULFILMENT_AWAITING_SLA_DAYS after createdAt
// (see constants.ts).
// =====================================================

export const FULFILMENT_OVERDUE = {
  WATCH: { minOverdueCount: 1 },
  STRESSED: { minOverdueRatio: 0.05, maxOldestDays: 7 },
  CRITICAL: { minOverdueRatio: 0.10, maxOldestDays: 14 },
}

// =====================================================
// PHASE 2 — SUPPLY-AXIS DETECTOR THRESHOLDS
//
// All four detectors below land on supplyHealth.
// They are additive: nothing in Phase 1 reads them,
// nothing in Phase 1 changes because of them.
//
// Bumping any threshold here is a behavioural change.
// Bump MONITOR_VERSION in constants.ts on any edit.
// =====================================================

// =====================================================
// FARM_CONCENTRATION_HIGH
//
// Inputs: farmConcentration.topNShare
//         (Σ availableKg of top-3 farms / publishedSupplyGreen)
// Axis:   supply  (structural fragility)
//
// Bands are GREATER-THAN-OR-EQUAL.
// =====================================================

export const FARM_CONCENTRATION_HIGH = {
  TOP_N: 3,
  WATCH: 0.50,
  STRESSED: 0.70,
  CRITICAL: 0.85,
}

// =====================================================
// SUPPLY_DIVERSITY_LOW
//
// Inputs: supplyDiversity.distinctFarmCount
// Axis:   supply  (structural fragility)
//
// Bands are LESS THAN. distinctLotCount is reported in
// the metric but the detector reads farm count only;
// farms are the unit of supply-side fragility, lots
// rotate within farms.
// =====================================================

export const SUPPLY_DIVERSITY_LOW = {
  WATCH: 8,
  STRESSED: 5,
  CRITICAL: 3,
}

// =====================================================
// PINNED_LOT_OVEREXPOSED
//
// Inputs: pinnedLotExposure.worstRatio
//         (= Σ monthlyGreenKg of contracts pinned to a
//            single greenLot / lot.availableKg)
//         pinnedLotExposure.depletedPinnedLotIds
// Axis:   supply  (backing fragility)
//
// Bands on worstRatio are GREATER-THAN-OR-EQUAL.
// Any depleted pinned lot (availableKg = 0 with pinned
// commitments) forces CRITICAL — the lot has zero
// remaining headroom and the ratio is mathematically
// undefined, so the count path replaces the ratio path.
// =====================================================

export const PINNED_LOT_OVEREXPOSED = {
  WATCH: 1.0,
  STRESSED: 2.0,
  CRITICAL: 3.0,
}

// =====================================================
// UNBACKED_COMMITMENTS_HIGH
//
// Inputs: unbackedCommitment.shareOfMonthlyDraw
//         (= Σ monthlyGreenKg of committed contracts
//            with greenLotId = null / monthlyDrawGreen)
// Axis:   supply  (backing fragility)
//
// Bands are GREATER-THAN-OR-EQUAL.
// shareOfMonthlyDraw = null (zero monthly draw) → no fire.
// =====================================================

export const UNBACKED_COMMITMENTS_HIGH = {
  WATCH: 0.10,
  STRESSED: 0.25,
  CRITICAL: 0.50,
}

// =====================================================
// SIGNAL TOP-N
//
// How many fired detectors appear in `signals`.
// =====================================================

export const SIGNAL_TOP_N = 5
