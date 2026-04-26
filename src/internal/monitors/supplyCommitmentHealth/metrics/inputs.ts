// =====================================================
// METRICS — INPUT LAYER
//
// Pure functions over the rows returned by dataAccess.
// No I/O, no Prisma, no business services.
// =====================================================

import {
  COMMITTED_CONTRACT_STATUSES,
  ATTRIBUTION_TOP_N,
} from "../constants.ts"
import { FARM_CONCENTRATION_HIGH } from "../config.ts"

import type {
  CommittedContractRow,
  OpenIntentRow,
  GreenLotAttributionRow,
  ActiveOpenIntentLoad,
  FarmConcentration,
  PinnedLotExposure,
  SupplyDiversity,
  UnbackedCommitment,
} from "../types.ts"

// =====================================================
// publishedSupplyGreen
// =====================================================

export function computePublishedSupplyGreen(
  rows: GreenLotAttributionRow[]
): number {
  let total = 0
  for (const r of rows) total += r.availableKg
  return total
}

// =====================================================
// committedGreen
//
// Strict OTP-confirmed set only — by design.
// Belt-and-braces: even though dataAccess filters by
// COMMITTED_CONTRACT_STATUSES, we re-check here so the
// invariant is enforced at every layer. The unit test
// for this function feeds in a mixed-status array and
// asserts AWAITING_SIGNATURE / PENDING / COMPLETED /
// CANCELLED contribute zero.
// =====================================================

export function computeCommittedGreen(
  rows: CommittedContractRow[]
): number {
  const committedSet = new Set<string>(COMMITTED_CONTRACT_STATUSES)
  let total = 0
  for (const r of rows) {
    if (!committedSet.has(r.status)) continue
    if (typeof r.monthlyGreenKg !== "number") continue
    if (Number.isNaN(r.monthlyGreenKg)) continue
    total += r.monthlyGreenKg
  }
  return total
}

// =====================================================
// monthlyDrawGreen — Option A (CONFIRMED)
//
//   monthlyDrawGreen = Σ Contract.monthlyGreenKg
//                      over committed status set.
//
// Identical formula to committedGreen by definition.
// They are kept as separate functions because they
// answer different questions and may diverge in v1.1
// (e.g. monthlyDrawGreen could weight by remaining
// duration). For v1 they return the same number.
// =====================================================

export function computeMonthlyDrawGreen(
  rows: CommittedContractRow[]
): number {
  return computeCommittedGreen(rows)
}

// =====================================================
// activeOpenIntentLoad
// =====================================================

export function computeActiveOpenIntentLoad(
  rows: OpenIntentRow[]
): ActiveOpenIntentLoad {

  let greenKg = 0
  let roastedKg = 0
  let offeredRoastedKg = 0
  let createCount = 0
  let amendCount = 0

  for (const r of rows) {
    greenKg += r.deltaKg
    roastedKg += r.requestedKg
    offeredRoastedKg += r.offeredKg ?? 0
    if (r.type === "CREATE") createCount++
    else if (r.type === "AMEND") amendCount++
  }

  return {
    greenKg,
    roastedKg,
    offeredRoastedKg,
    intentCount: rows.length,
    createCount,
    amendCount,
  }
}

// =====================================================
// PHASE 2 — SUPPLY-AXIS METRICS
//
// All four functions below are pure aggregations over
// rows that the snapshot already contains. They MUST
// NOT introduce new Prisma reads. Any data they need
// has to be present on GreenLotAttributionRow or
// CommittedContractRow today.
// =====================================================

// =====================================================
// farmConcentration
//
// Top-N farms (N from FARM_CONCENTRATION_HIGH.TOP_N)
// by total availableKg, expressed as a share of
// publishedSupplyGreen.
//
// Determinism: farms are sorted by share desc, then by
// farmId asc to break ties so the report is stable for
// identical input.
//
// Edge cases:
//   - empty rows / zero total green → topNShare = null,
//     distinctFarmCount = 0, totalGreen = 0.
//   - fewer than TOP_N farms → topNShare is the share
//     of however many farms exist.
// =====================================================

export function computeFarmConcentration(
  rows: GreenLotAttributionRow[]
): FarmConcentration {

  const byFarm = new Map<string, number>()
  let totalGreen = 0

  for (const r of rows) {
    if (!(r.availableKg > 0)) continue
    totalGreen += r.availableKg
    byFarm.set(r.farmId, (byFarm.get(r.farmId) ?? 0) + r.availableKg)
  }

  const distinctFarmCount = byFarm.size

  if (distinctFarmCount === 0 || totalGreen <= 0) {
    return {
      topNShare: null,
      topNFarmIds: [],
      distinctFarmCount,
      totalGreen,
    }
  }

  const ranked = [...byFarm.entries()]
    .sort((a, b) => {
      const d = b[1] - a[1]
      if (d !== 0) return d
      return a[0].localeCompare(b[0])
    })
    .slice(0, FARM_CONCENTRATION_HIGH.TOP_N)

  let topSum = 0
  for (const [, kg] of ranked) topSum += kg

  return {
    topNShare: topSum / totalGreen,
    topNFarmIds: ranked.map(([farmId]) => farmId),
    distinctFarmCount,
    totalGreen,
  }
}

// =====================================================
// supplyDiversity
//
// Pure structural counts. distinctFarmCount mirrors the
// farmConcentration count (both restricted to lots with
// availableKg > 0) and is recomputed here so each metric
// is independently testable.
// =====================================================

export function computeSupplyDiversity(
  rows: GreenLotAttributionRow[]
): SupplyDiversity {

  const farms = new Set<string>()
  const lots = new Set<string>()

  for (const r of rows) {
    if (!(r.availableKg > 0)) continue
    farms.add(r.farmId)
    lots.add(r.id)
  }

  return {
    distinctFarmCount: farms.size,
    distinctLotCount: lots.size,
  }
}

// =====================================================
// pinnedLotExposure
//
// A "pinned" contract is one whose `greenLotId` is set
// — its monthly draw is structurally tied to a specific
// lot. Per-lot exposure ratio is:
//
//   ratio = Σ monthlyGreenKg of pinned contracts on lot
//         / lot.availableKg
//
// Lots with availableKg = 0 (depleted) cannot be ranked
// by ratio (mathematically infinite) so are listed
// separately in `depletedPinnedLotIds`. The detector
// treats any depleted pinned lot as CRITICAL.
//
// Lots that have pinned commitments but are NOT in the
// published-supply set (e.g. unpublished, sold out and
// removed) are still counted in the depleted bucket
// because they have zero available headroom from the
// monitor's perspective.
//
// `worstLotId` / `worstRatio` track the lot with the
// largest finite ratio. `exposedLotCount` counts lots
// whose finite ratio crosses the WATCH threshold.
// Determinism: tie-break on lotId asc.
// =====================================================

export function computePinnedLotExposure(
  greenLots: GreenLotAttributionRow[],
  contracts: CommittedContractRow[],
  watchRatio: number
): PinnedLotExposure {

  // Σ committed monthly green pinned to each lotId.
  const pinnedDrawByLot = new Map<string, number>()
  let totalPinnedMonthlyGreen = 0

  const committedSet = new Set<string>(COMMITTED_CONTRACT_STATUSES)

  for (const c of contracts) {
    if (!committedSet.has(c.status)) continue
    if (c.greenLotId === null) continue
    if (typeof c.monthlyGreenKg !== "number") continue
    if (Number.isNaN(c.monthlyGreenKg)) continue
    if (c.monthlyGreenKg <= 0) continue
    pinnedDrawByLot.set(
      c.greenLotId,
      (pinnedDrawByLot.get(c.greenLotId) ?? 0) + c.monthlyGreenKg
    )
    totalPinnedMonthlyGreen += c.monthlyGreenKg
  }

  // Lookup of lot.availableKg for the published set.
  const availableByLot = new Map<string, number>()
  for (const l of greenLots) {
    availableByLot.set(l.id, l.availableKg)
  }

  let worstLotId: string | null = null
  let worstRatio: number | null = null
  let exposedLotCount = 0
  const depletedPinnedLotIds: string[] = []

  // Stable iteration order by lotId.
  const pinnedLotIds = [...pinnedDrawByLot.keys()].sort()

  for (const lotId of pinnedLotIds) {
    const draw = pinnedDrawByLot.get(lotId) ?? 0
    const available = availableByLot.get(lotId) ?? 0

    if (available <= 0) {
      // Depleted (or no longer published). Tracked separately —
      // ratio is undefined.
      depletedPinnedLotIds.push(lotId)
      continue
    }

    const ratio = draw / available

    if (ratio >= watchRatio) {
      exposedLotCount++
    }

    if (
      worstRatio === null ||
      ratio > worstRatio ||
      (ratio === worstRatio &&
        worstLotId !== null &&
        lotId.localeCompare(worstLotId) < 0)
    ) {
      worstRatio = ratio
      worstLotId = lotId
    }
  }

  return {
    worstLotId,
    worstRatio,
    exposedLotCount,
    totalPinnedMonthlyGreen,
    depletedPinnedLotIds: depletedPinnedLotIds.slice(0, ATTRIBUTION_TOP_N),
  }
}

// =====================================================
// unbackedCommitment
//
// "Unbacked" = a committed contract with a NON-NULL
// greenLotId whose referenced lot is NOT present in the
// published supply set. The contract is *pinned* — it
// claims a specific lot — but that lot has been
// depleted, unpublished, or otherwise disappeared from
// the contractable pool. The structural backing the
// contract relied on is gone.
//
// Contracts with greenLotId = NULL are intentionally
// EXCLUDED from this metric. They are not "stale" — they
// were never pinned to a specific lot in the first
// place, so they draw against general supply rather than
// against a vanished reservation. They are a different
// failure mode and are not in scope for v1.1.
//
// Note the deliberate overlap with pinnedLotExposure:
// the same set of stale lot ids is summarised at the
// LOT level by pinnedLotExposure.depletedPinnedLotIds
// (CRITICAL via the depleted path) and at the CONTRACT
// level here. The two views answer different questions:
// "which lots are gone?" vs. "what share of monthly
// draw is structurally exposed?"
//
// monthlyDrawGreen is passed in (rather than recomputed)
// so the share denominator stays consistent with the
// rest of the report.
//
// Edge case: monthlyDrawGreen = 0 → shareOfMonthlyDraw
// is null (safeDiv parity). The detector treats null as
// "no fire."
// =====================================================

export function computeUnbackedCommitment(
  greenLots: GreenLotAttributionRow[],
  contracts: CommittedContractRow[],
  monthlyDrawGreen: number
): UnbackedCommitment {

  // Lot ids in the published supply set. dataAccess.ts
  // already filters by status = PUBLISHED AND availableKg > 0,
  // so membership in this set means "currently part of the
  // contractable pool."
  const publishedLotIds = new Set<string>()
  for (const l of greenLots) {
    publishedLotIds.add(l.id)
  }

  const committedSet = new Set<string>(COMMITTED_CONTRACT_STATUSES)

  type Row = { id: string; kg: number }
  const unbacked: Row[] = []
  let monthlyGreenKg = 0

  for (const c of contracts) {
    if (!committedSet.has(c.status)) continue
    // Free-floating (no pin) is intentionally excluded.
    if (c.greenLotId === null) continue
    // Pinned to a lot that is still in the published set →
    // not stale, not unbacked.
    if (publishedLotIds.has(c.greenLotId)) continue
    if (typeof c.monthlyGreenKg !== "number") continue
    if (Number.isNaN(c.monthlyGreenKg)) continue
    if (c.monthlyGreenKg <= 0) continue
    unbacked.push({ id: c.id, kg: c.monthlyGreenKg })
    monthlyGreenKg += c.monthlyGreenKg
  }

  unbacked.sort((a, b) => {
    const d = b.kg - a.kg
    if (d !== 0) return d
    return a.id.localeCompare(b.id)
  })

  const shareOfMonthlyDraw =
    monthlyDrawGreen > 0 ? monthlyGreenKg / monthlyDrawGreen : null

  return {
    contractCount: unbacked.length,
    monthlyGreenKg,
    shareOfMonthlyDraw,
    contractIds: unbacked.slice(0, ATTRIBUTION_TOP_N).map((r) => r.id),
  }
}
