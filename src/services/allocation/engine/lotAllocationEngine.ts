//////////////////////////////////////////////////////
// ⚖️ DECISION ENGINE
//
// Pure function: LotAllocationSnapshot → LotAllocationDecision.
// No Prisma. No DB. No fetch. No env reads. No Date.now()
// is forbidden — but evaluatedAt does call new Date() so
// callers that need bit-for-bit determinism should freeze
// the policy and stamp the timestamp themselves.
//
// Surface routing (priority order):
//
//   1. STRUCTURAL HOLDS  — DRAFT / SOLD / RESERVED+shipment / no pricing
//   2. EXCLUSIVE         — rare variety, OR high SCA + microlot-sized
//   3. SMALL LOT         — totalGreenKg below contract minimum
//   4. PREMIUM MICROLOT  — premium SCA + microlot-sized (non-exclusive)
//   5. CONTRACT-VIABLE   — at least one customer profile fits
//   6. NO-VIABLE-PROFILE — fall back to marketplace if free ≥ minMarketplace
//   7. RESIDUAL HOLD     — sub-marketplace residual, blocked
//
// The safety buffer protects contract supply from over-commit
// (mirrors src/services/system/supply.service.ts). It is
// applied ONLY on paths 5–6. Microlot / exclusive / small-lot
// paths bypass it because they don't drive recurring contracts
// and would be neutered by a flat 400 kg deduction.
//////////////////////////////////////////////////////

import type {
  AllocationPolicy,
  AllocationReason,
  AllocationReasonCode,
  AllocationReasonSeverity,
  AllocationSurface,
  LotAllocationDecision,
  LotAllocationSnapshot,
  ViableProfile,
} from "../domain/types.ts"
import {
  clampNonNegative,
  computeFreeGreenKg,
  computeProfileViability,
  isRareVariety,
} from "../domain/partition.ts"
import { computeAllocationConfidence } from "./confidence.ts"
import { DEFAULT_ALLOCATION_POLICY } from "../policy/allocationPolicy.ts"

// ------------------------------------------------------
// REASON MESSAGES
// Keep one short, audit-friendly sentence per code.
// ------------------------------------------------------

const REASON_MESSAGES: Record<AllocationReasonCode, string> = {
  LOT_NOT_PUBLISHED: "Lot is not yet published.",
  LOT_ALREADY_SOLD: "Lot is already sold.",
  SHIPMENT_ALREADY_RESERVED: "Lot is reserved for an active shipment.",
  SAFETY_BUFFER_RESERVED: "Structural safety buffer withheld.",

  CONTRACT_COMMITTED: "Volume committed to existing contracts.",
  DEMAND_INTENT_RESERVED: "Volume reserved by open demand intents.",

  CONTRACT_VOLUME_SUFFICIENT: "Lot can sustain monthly contracts for at least one customer profile.",
  CONTRACT_VOLUME_INSUFFICIENT: "Lot cannot sustain a viable contract for any tracked profile.",
  MONTHLY_CONTRACT_CAPACITY_AVAILABLE: "Monthly contract capacity is available against this lot.",
  RESIDUAL_TOO_SMALL_FOR_CONTRACT: "Residual is below contract viability and below marketplace minimum.",
  RESIDUAL_MARKETPLACE_ELIGIBLE: "Residual after contract reserve is large enough for marketplace.",

  PREMIUM_MICROLOT_MARKETPLACE: "Premium microlot routed to open marketplace.",
  RARE_VARIETY_EXCLUSIVE: "Rare variety routed as exclusive microlot.",
  HIGH_SCA_EXCLUSIVE: "High SCA score routed as exclusive microlot.",
  LOW_VOLUME_LOT: "Total lot volume below contract minimum — marketplace by default.",

  MISSING_ROAST_YIELD: "Roast yield is a process default, not a measured value.",
  MISSING_PRICING: "Lot has no pricing snapshot.",
  QUALITY_HOLD: "SCA score missing — quality unverified.",
  RISK_HOLD: "Risk signal triggered hold.",
  PRICING_HOLD: "Pricing inconsistency triggered hold.",
}

function makeReason(
  code: AllocationReasonCode,
  severity: AllocationReasonSeverity,
  message?: string
): AllocationReason {
  return { code, severity, message: message ?? REASON_MESSAGES[code] }
}

// ------------------------------------------------------
// MAIN ENTRY
// ------------------------------------------------------

export function decideLotAllocation(
  snap: LotAllocationSnapshot,
  policy: AllocationPolicy = DEFAULT_ALLOCATION_POLICY
): LotAllocationDecision {

  const evaluatedAt = new Date().toISOString()
  const reasons: AllocationReason[] = []

  const totalGreenKg = clampNonNegative(snap.totalGreenKg)
  const availableGreenKg = clampNonNegative(snap.availableGreenKg)
  const committedContractGreenKg = clampNonNegative(snap.committedContractGreenKg)
  const reservedIntentGreenKg = clampNonNegative(snap.reservedIntentGreenKg)

  // ===================================================
  // 1. STRUCTURAL HOLDS
  // ===================================================

  const buildHold = (code: AllocationReasonCode): LotAllocationDecision => {
    reasons.unshift(makeReason(code, "blocking"))

    // Reserved-by-existing-claims still belong to those claims even
    // on a hold — this matters for downstream display.
    const reservedFromClaims = clampNonNegative(
      Math.min(committedContractGreenKg, availableGreenKg)
    )
    const blockedRemainder = clampNonNegative(
      availableGreenKg - reservedFromClaims
    )

    return {
      greenLotId: snap.greenLotId,
      lotNumber: snap.lotNumber,
      totalGreenKg,
      availableGreenKg,
      committedContractGreenKg,
      reservedIntentGreenKg,
      safetyBufferGreenKg: 0,
      contractReservedGreenKg: reservedFromClaims,
      contractAssignableGreenKg: 0,
      marketplaceEligibleGreenKg: 0,
      exclusiveMicrolotGreenKg: 0,
      blockedGreenKg: blockedRemainder,
      recommendedSurface: "HOLD",
      viableProfiles: [],
      reasons,
      confidence: computeAllocationConfidence({
        usedDefaultRoastYield: snap.usedDefaultRoastYield,
        hasScaScore: snap.scaScore != null,
        hasPricing: snap.greenPricePerKg != null,
        hasFarmRegion: snap.farmRegion != null,
        hasAltitude: snap.farmAltitude != null,
        viableProfileCount: 0,
        hasBlockingReason: true,
      }),
      policyVersion: policy.policyVersion,
      evaluatedAt,
    }
  }

  if (snap.status === "DRAFT") return buildHold("LOT_NOT_PUBLISHED")
  if (snap.status === "SOLD") return buildHold("LOT_ALREADY_SOLD")
  if (snap.status === "RESERVED" || snap.shipmentId) return buildHold("SHIPMENT_ALREADY_RESERVED")
  if (snap.greenPricePerKg == null) return buildHold("MISSING_PRICING")

  // ===================================================
  // 2. UNCLAIMED POOL
  //    available − committed − openIntents (no buffer yet)
  // ===================================================

  const unclaimedGreenKg = computeFreeGreenKg({
    availableGreenKg,
    committedContractGreenKg,
    reservedIntentGreenKg,
    safetyBufferGreenKg: 0,
  })

  // Reserved by EXISTING claims — fixed regardless of branch.
  const contractReservedGreenKg = clampNonNegative(
    Math.min(committedContractGreenKg, availableGreenKg)
  )

  if (committedContractGreenKg > 0) reasons.push(makeReason("CONTRACT_COMMITTED", "info"))
  if (reservedIntentGreenKg > 0) reasons.push(makeReason("DEMAND_INTENT_RESERVED", "info"))
  if (snap.usedDefaultRoastYield) reasons.push(makeReason("MISSING_ROAST_YIELD", "warning"))
  if (snap.scaScore == null) reasons.push(makeReason("QUALITY_HOLD", "warning"))

  // ===================================================
  // 3. CLASSIFY THE FREE POOL
  //    Classification uses unclaimedGreenKg (pre-buffer)
  //    so a 400 kg structural buffer cannot mis-classify
  //    a 480 kg microlot as "below threshold" or starve
  //    an exclusive lot of its own kg.
  // ===================================================

  const sca = snap.scaScore ?? 0
  const isRare = isRareVariety(snap.variety, policy.rareVarieties)
  const isHighSca = sca >= policy.exclusiveScaThreshold
  const isPremiumSca = sca >= policy.premiumScaThreshold
  const isMicrolotSized = unclaimedGreenKg > 0 && unclaimedGreenKg <= policy.microLotMaxGreenKg

  // Exclusive: rare variety always wins; high-SCA only when
  // paired with microlot-sized free pool (so we don't pull
  // a 4-tonne SCA-90 lot out of contract supply).
  const isExclusive = isRare || (isHighSca && isMicrolotSized)
  const isSmallLot = totalGreenKg < policy.minContractGreenKg
  const isPremiumMicrolot = !isExclusive && isPremiumSca && isMicrolotSized

  // ===================================================
  // 4. PROFILE VIABILITY
  //    Computed against the post-buffer free pool the
  //    contract path would actually see — so we don't
  //    promise viability we can't honour.
  // ===================================================

  const plannedSafetyBuffer = Math.min(
    clampNonNegative(policy.safetyBufferGreenKg),
    unclaimedGreenKg
  )
  const contractCandidateFreeKg = clampNonNegative(
    unclaimedGreenKg - plannedSafetyBuffer
  )

  const viableProfiles: ViableProfile[] = computeProfileViability({
    freeGreenKg: contractCandidateFreeKg,
    roastYield: snap.estimatedRoastYield,
    profiles: policy.contractProfiles,
    minimumContractMonths: policy.minimumContractMonths,
    scaScore: snap.scaScore,
  })

  // ===================================================
  // 5. ROUTE THE FREE POOL
  // ===================================================

  let safetyBufferGreenKg = 0
  let contractAssignableGreenKg = 0
  let marketplaceEligibleGreenKg = 0
  let exclusiveMicrolotGreenKg = 0
  let blockedGreenKg = 0
  let surface: AllocationSurface = "HOLD"

  if (unclaimedGreenKg <= 0) {
    // Everything is locked by existing claims. If contracts
    // own all of it, that's a healthy CONTRACT_CATALOG state;
    // otherwise (e.g. only intents claim it), HOLD.
    if (contractReservedGreenKg > 0 && contractReservedGreenKg >= availableGreenKg - 1e-6) {
      surface = "CONTRACT_CATALOG"
      reasons.push(makeReason("CONTRACT_VOLUME_SUFFICIENT", "info"))
    } else {
      surface = "HOLD"
    }
  } else if (isExclusive) {
    // No buffer applies — exclusive lots are one-off sales.
    exclusiveMicrolotGreenKg = unclaimedGreenKg
    surface = "EXCLUSIVE_MICROLOT"
    if (isRare) reasons.push(makeReason("RARE_VARIETY_EXCLUSIVE", "info"))
    if (isHighSca) reasons.push(makeReason("HIGH_SCA_EXCLUSIVE", "info"))
  } else if (isSmallLot) {
    // No buffer — the lot is structurally below contract minimum.
    marketplaceEligibleGreenKg = unclaimedGreenKg
    surface = "OPEN_MARKETPLACE"
    if (isPremiumMicrolot) reasons.push(makeReason("PREMIUM_MICROLOT_MARKETPLACE", "info"))
    reasons.push(makeReason("LOW_VOLUME_LOT", "info"))
  } else if (isPremiumMicrolot) {
    // No buffer — premium microlot is a one-off premium sale.
    marketplaceEligibleGreenKg = unclaimedGreenKg
    surface = "OPEN_MARKETPLACE"
    reasons.push(makeReason("PREMIUM_MICROLOT_MARKETPLACE", "info"))
  } else if (viableProfiles.length > 0) {
    // CONTRACT path — the buffer applies here.
    safetyBufferGreenKg = plannedSafetyBuffer
    if (safetyBufferGreenKg > 0) {
      reasons.push(makeReason("SAFETY_BUFFER_RESERVED", "info"))
    }

    const free = contractCandidateFreeKg

    // Reserve enough for the most-demanding viable profile.
    const best = viableProfiles.reduce(
      (a, b) => (a.monthlyGreenKg > b.monthlyGreenKg ? a : b)
    )
    const reservedForFutureContract =
      best.monthlyGreenKg * policy.residualContractCoverageMonths

    contractAssignableGreenKg = Math.min(free, reservedForFutureContract)
    const residualGreenKg = clampNonNegative(free - contractAssignableGreenKg)

    if (residualGreenKg >= policy.minMarketplaceKg) {
      marketplaceEligibleGreenKg = residualGreenKg
      surface = "SPLIT"
      reasons.push(makeReason("RESIDUAL_MARKETPLACE_ELIGIBLE", "info"))
    } else {
      // Roll a tiny residual back into the contract pool —
      // listing 2 kg of green in marketplace is just noise.
      contractAssignableGreenKg += residualGreenKg
      surface = "CONTRACT_CATALOG"
    }

    reasons.push(makeReason("CONTRACT_VOLUME_SUFFICIENT", "info"))
    reasons.push(makeReason("MONTHLY_CONTRACT_CAPACITY_AVAILABLE", "info"))
  } else {
    // No viable profile but the lot is contract-sized.
    // Apply the buffer and either route to marketplace or hold.
    safetyBufferGreenKg = plannedSafetyBuffer
    if (safetyBufferGreenKg > 0) {
      reasons.push(makeReason("SAFETY_BUFFER_RESERVED", "info"))
    }

    const free = contractCandidateFreeKg

    if (free >= policy.minMarketplaceKg) {
      marketplaceEligibleGreenKg = free
      surface = "OPEN_MARKETPLACE"
      reasons.push(makeReason("CONTRACT_VOLUME_INSUFFICIENT", "warning"))
    } else if (free > 0) {
      blockedGreenKg += free
      surface = "HOLD"
      reasons.push(makeReason("RESIDUAL_TOO_SMALL_FOR_CONTRACT", "warning"))
    } else {
      // free is 0 — buffer ate everything that wasn't claimed.
      surface = "HOLD"
      reasons.push(makeReason("RESIDUAL_TOO_SMALL_FOR_CONTRACT", "warning"))
    }
  }

  // ===================================================
  // 6. POOL INVARIANT
  //    Sum of partitions should never exceed available.
  //    Tiny rounding deltas are absorbed by the marketplace
  //    bucket first, then by the assignable bucket.
  // ===================================================

  const poolSum =
    contractReservedGreenKg +
    contractAssignableGreenKg +
    marketplaceEligibleGreenKg +
    exclusiveMicrolotGreenKg +
    blockedGreenKg +
    safetyBufferGreenKg

  if (poolSum > availableGreenKg + 1e-6) {
    let overflow = poolSum - availableGreenKg
    const drainOrder: Array<["marketplace" | "assignable" | "exclusive" | "blocked"]> = [
      ["marketplace"],
      ["assignable"],
      ["exclusive"],
      ["blocked"],
    ]
    for (const [bucket] of drainOrder) {
      if (overflow <= 0) break
      if (bucket === "marketplace" && marketplaceEligibleGreenKg > 0) {
        const drain = Math.min(marketplaceEligibleGreenKg, overflow)
        marketplaceEligibleGreenKg -= drain
        overflow -= drain
      } else if (bucket === "assignable" && contractAssignableGreenKg > 0) {
        const drain = Math.min(contractAssignableGreenKg, overflow)
        contractAssignableGreenKg -= drain
        overflow -= drain
      } else if (bucket === "exclusive" && exclusiveMicrolotGreenKg > 0) {
        const drain = Math.min(exclusiveMicrolotGreenKg, overflow)
        exclusiveMicrolotGreenKg -= drain
        overflow -= drain
      } else if (bucket === "blocked" && blockedGreenKg > 0) {
        const drain = Math.min(blockedGreenKg, overflow)
        blockedGreenKg -= drain
        overflow -= drain
      }
    }
  }

  // ===================================================
  // 7. CONFIDENCE
  // ===================================================

  const hasBlockingReason = reasons.some((r) => r.severity === "blocking")
  const confidence = computeAllocationConfidence({
    usedDefaultRoastYield: snap.usedDefaultRoastYield,
    hasScaScore: snap.scaScore != null,
    hasPricing: snap.greenPricePerKg != null,
    hasFarmRegion: snap.farmRegion != null,
    hasAltitude: snap.farmAltitude != null,
    viableProfileCount: viableProfiles.length,
    hasBlockingReason,
  })

  return {
    greenLotId: snap.greenLotId,
    lotNumber: snap.lotNumber,
    totalGreenKg,
    availableGreenKg,
    committedContractGreenKg,
    reservedIntentGreenKg,
    safetyBufferGreenKg: clampNonNegative(safetyBufferGreenKg),
    contractReservedGreenKg: clampNonNegative(contractReservedGreenKg),
    contractAssignableGreenKg: clampNonNegative(contractAssignableGreenKg),
    marketplaceEligibleGreenKg: clampNonNegative(marketplaceEligibleGreenKg),
    exclusiveMicrolotGreenKg: clampNonNegative(exclusiveMicrolotGreenKg),
    blockedGreenKg: clampNonNegative(blockedGreenKg),
    recommendedSurface: surface,
    viableProfiles,
    reasons,
    confidence,
    policyVersion: policy.policyVersion,
    evaluatedAt,
  }
}
