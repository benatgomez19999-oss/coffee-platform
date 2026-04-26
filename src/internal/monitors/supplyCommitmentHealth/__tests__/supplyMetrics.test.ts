// =====================================================
// UNIT TESTS — Phase 2 supply-axis metrics
//
// Pure function tests for the four metrics added to
// metrics/inputs.ts in v1.1.0:
//
//   - computeFarmConcentration
//   - computeSupplyDiversity
//   - computePinnedLotExposure
//   - computeUnbackedCommitment
//
// No DB, no Prisma.
// =====================================================

import { test } from "node:test"
import assert from "node:assert/strict"

import {
  computeFarmConcentration,
  computeSupplyDiversity,
  computePinnedLotExposure,
  computeUnbackedCommitment,
} from "../metrics/inputs.ts"

import { PINNED_LOT_OVEREXPOSED } from "../config.ts"

import type {
  GreenLotAttributionRow,
  CommittedContractRow,
} from "../types.ts"

// =====================================================
// farmConcentration
// =====================================================

test("farmConcentration: empty input → null share, zero counts", () => {
  const r = computeFarmConcentration([])
  assert.equal(r.topNShare, null)
  assert.deepEqual(r.topNFarmIds, [])
  assert.equal(r.distinctFarmCount, 0)
  assert.equal(r.totalGreen, 0)
})

test("farmConcentration: single farm → topNShare = 1", () => {
  const rows: GreenLotAttributionRow[] = [
    { id: "l1", availableKg: 500, farmId: "f1" },
    { id: "l2", availableKg: 300, farmId: "f1" },
  ]
  const r = computeFarmConcentration(rows)
  assert.equal(r.topNShare, 1)
  assert.deepEqual(r.topNFarmIds, ["f1"])
  assert.equal(r.distinctFarmCount, 1)
  assert.equal(r.totalGreen, 800)
})

test("farmConcentration: top-3 of 5 farms ranked by share desc", () => {
  // Shares: f1=400, f2=300, f3=200, f4=80, f5=20 (total=1000)
  // Top-3 = 900 → 0.9
  const rows: GreenLotAttributionRow[] = [
    { id: "a", availableKg: 400, farmId: "f1" },
    { id: "b", availableKg: 300, farmId: "f2" },
    { id: "c", availableKg: 200, farmId: "f3" },
    { id: "d", availableKg: 80,  farmId: "f4" },
    { id: "e", availableKg: 20,  farmId: "f5" },
  ]
  const r = computeFarmConcentration(rows)
  assert.equal(r.topNShare, 0.9)
  assert.deepEqual(r.topNFarmIds, ["f1", "f2", "f3"])
  assert.equal(r.distinctFarmCount, 5)
  assert.equal(r.totalGreen, 1000)
})

test("farmConcentration: ignores availableKg <= 0", () => {
  const rows: GreenLotAttributionRow[] = [
    { id: "a", availableKg: 100, farmId: "f1" },
    { id: "b", availableKg: 0,   farmId: "f2" }, // ignored
  ]
  const r = computeFarmConcentration(rows)
  assert.equal(r.distinctFarmCount, 1)
  assert.equal(r.totalGreen, 100)
})

test("farmConcentration: deterministic tie-break by farmId asc", () => {
  // Two farms tied at 100 each. Top-1 should be the lexicographically
  // smaller farmId. Top-N here is 3 so both end up in topNFarmIds, but
  // the order matters for downstream consumers.
  const rows: GreenLotAttributionRow[] = [
    { id: "a", availableKg: 100, farmId: "fb" },
    { id: "b", availableKg: 100, farmId: "fa" },
  ]
  const r = computeFarmConcentration(rows)
  assert.deepEqual(r.topNFarmIds, ["fa", "fb"])
})

test("farmConcentration: fewer farms than TOP_N → topNShare uses all", () => {
  const rows: GreenLotAttributionRow[] = [
    { id: "a", availableKg: 60, farmId: "f1" },
    { id: "b", availableKg: 40, farmId: "f2" },
  ]
  const r = computeFarmConcentration(rows)
  assert.equal(r.topNShare, 1)
  assert.equal(r.topNFarmIds.length, 2)
})

// =====================================================
// supplyDiversity
// =====================================================

test("supplyDiversity: empty → zero / zero", () => {
  const r = computeSupplyDiversity([])
  assert.equal(r.distinctFarmCount, 0)
  assert.equal(r.distinctLotCount, 0)
})

test("supplyDiversity: counts distinct farms and lots", () => {
  const rows: GreenLotAttributionRow[] = [
    { id: "l1", availableKg: 1, farmId: "f1" },
    { id: "l2", availableKg: 1, farmId: "f1" },
    { id: "l3", availableKg: 1, farmId: "f2" },
    { id: "l4", availableKg: 1, farmId: "f3" },
  ]
  const r = computeSupplyDiversity(rows)
  assert.equal(r.distinctFarmCount, 3)
  assert.equal(r.distinctLotCount, 4)
})

test("supplyDiversity: ignores availableKg <= 0", () => {
  const rows: GreenLotAttributionRow[] = [
    { id: "l1", availableKg: 1, farmId: "f1" },
    { id: "l2", availableKg: 0, farmId: "f2" }, // ignored
  ]
  const r = computeSupplyDiversity(rows)
  assert.equal(r.distinctFarmCount, 1)
  assert.equal(r.distinctLotCount, 1)
})

// =====================================================
// pinnedLotExposure
// =====================================================

const W = PINNED_LOT_OVEREXPOSED.WATCH

test("pinnedLotExposure: empty inputs → all neutral", () => {
  const r = computePinnedLotExposure([], [], W)
  assert.equal(r.worstLotId, null)
  assert.equal(r.worstRatio, null)
  assert.equal(r.exposedLotCount, 0)
  assert.equal(r.totalPinnedMonthlyGreen, 0)
  assert.deepEqual(r.depletedPinnedLotIds, [])
})

test("pinnedLotExposure: ignores contracts with greenLotId = null", () => {
  const lots: GreenLotAttributionRow[] = [
    { id: "lotA", availableKg: 1000, farmId: "f1" },
  ]
  const contracts: CommittedContractRow[] = [
    { id: "c1", status: "ACTIVE", monthlyGreenKg: 100, greenLotId: null, companyId: "co" },
  ]
  const r = computePinnedLotExposure(lots, contracts, W)
  assert.equal(r.worstLotId, null)
  assert.equal(r.worstRatio, null)
  assert.equal(r.totalPinnedMonthlyGreen, 0)
})

test("pinnedLotExposure: ignores non-committed statuses", () => {
  const lots: GreenLotAttributionRow[] = [
    { id: "lotA", availableKg: 1000, farmId: "f1" },
  ]
  const contracts: CommittedContractRow[] = [
    { id: "c1", status: "AWAITING_SIGNATURE", monthlyGreenKg: 500, greenLotId: "lotA", companyId: "co" },
    { id: "c2", status: "PENDING",            monthlyGreenKg: 500, greenLotId: "lotA", companyId: "co" },
  ]
  const r = computePinnedLotExposure(lots, contracts, W)
  assert.equal(r.totalPinnedMonthlyGreen, 0)
  assert.equal(r.worstLotId, null)
})

test("pinnedLotExposure: computes worst ratio across pinned lots", () => {
  // lotA: draw 200 / available 1000 = 0.2
  // lotB: draw 800 / available 500 = 1.6  ← worst
  // lotC: draw 100 / available 200 = 0.5
  const lots: GreenLotAttributionRow[] = [
    { id: "lotA", availableKg: 1000, farmId: "f1" },
    { id: "lotB", availableKg: 500,  farmId: "f2" },
    { id: "lotC", availableKg: 200,  farmId: "f3" },
  ]
  const contracts: CommittedContractRow[] = [
    { id: "c1", status: "ACTIVE",  monthlyGreenKg: 200, greenLotId: "lotA", companyId: "co" },
    { id: "c2", status: "SIGNED",  monthlyGreenKg: 800, greenLotId: "lotB", companyId: "co" },
    { id: "c3", status: "ACTIVE",  monthlyGreenKg: 100, greenLotId: "lotC", companyId: "co" },
  ]
  const r = computePinnedLotExposure(lots, contracts, W)
  assert.equal(r.worstLotId, "lotB")
  assert.equal(r.worstRatio, 1.6)
  assert.equal(r.totalPinnedMonthlyGreen, 1100)
  // exposedLotCount counts ratios >= WATCH (1.0). Only lotB qualifies.
  assert.equal(r.exposedLotCount, 1)
  assert.deepEqual(r.depletedPinnedLotIds, [])
})

test("pinnedLotExposure: depleted lot (availableKg=0) goes into depleted list, not ratio", () => {
  const lots: GreenLotAttributionRow[] = [
    // lotA still published with headroom
    { id: "lotA", availableKg: 500, farmId: "f1" },
    // lotB intentionally NOT in published set (depleted / unpublished)
  ]
  const contracts: CommittedContractRow[] = [
    { id: "c1", status: "ACTIVE", monthlyGreenKg: 100, greenLotId: "lotA", companyId: "co" },
    { id: "c2", status: "ACTIVE", monthlyGreenKg: 100, greenLotId: "lotB", companyId: "co" },
  ]
  const r = computePinnedLotExposure(lots, contracts, W)
  assert.deepEqual(r.depletedPinnedLotIds, ["lotB"])
  // worst finite ratio comes from lotA = 100/500 = 0.2
  assert.equal(r.worstLotId, "lotA")
  assert.equal(r.worstRatio, 0.2)
})

test("pinnedLotExposure: depleted list is sorted and capped", () => {
  // Build many depleted pinned lots, none published.
  const lots: GreenLotAttributionRow[] = []
  const contracts: CommittedContractRow[] = []
  for (let i = 0; i < 20; i++) {
    contracts.push({
      id: `c${i}`,
      status: "ACTIVE",
      monthlyGreenKg: 1,
      greenLotId: `lot-${String(i).padStart(3, "0")}`,
      companyId: "co",
    })
  }
  const r = computePinnedLotExposure(lots, contracts, W)
  // ATTRIBUTION_TOP_N = 10
  assert.equal(r.depletedPinnedLotIds.length, 10)
  // Sorted ascending by lotId.
  assert.equal(r.depletedPinnedLotIds[0], "lot-000")
  assert.equal(r.depletedPinnedLotIds[9], "lot-009")
})

// =====================================================
// unbackedCommitment
//
// "Unbacked" = committed contract whose greenLotId is
// NON-NULL but does NOT match any lot in the published
// supply set. The contract was pinned to a lot that has
// since been depleted / unpublished.
//
// Free-floating contracts (greenLotId = null) are NOT
// counted by this metric — they are a different failure
// mode and out of scope for v1.1.
// =====================================================

test("unbackedCommitment: empty → zeros and null share", () => {
  const r = computeUnbackedCommitment([], [], 0)
  assert.equal(r.contractCount, 0)
  assert.equal(r.monthlyGreenKg, 0)
  assert.equal(r.shareOfMonthlyDraw, null)
  assert.deepEqual(r.contractIds, [])
})

test("unbackedCommitment: counts pinned contracts whose lot is NOT in the published set", () => {
  const lots: GreenLotAttributionRow[] = [
    { id: "lotA", availableKg: 1000, farmId: "f1" },
    { id: "lotB", availableKg: 500,  farmId: "f2" },
  ]
  const contracts: CommittedContractRow[] = [
    // backed: lotA is published → excluded
    { id: "b1", status: "ACTIVE", monthlyGreenKg: 700, greenLotId: "lotA",  companyId: "co" },
    // unbacked: lotGone is NOT in the published set → counted
    { id: "u1", status: "ACTIVE", monthlyGreenKg: 100, greenLotId: "lotGone", companyId: "co" },
    { id: "u2", status: "SIGNED", monthlyGreenKg: 200, greenLotId: "lotMissing", companyId: "co" },
    // free-floating: greenLotId = null → intentionally NOT counted
    { id: "n1", status: "ACTIVE", monthlyGreenKg: 999, greenLotId: null,    companyId: "co" },
    // not committed → excluded
    { id: "x1", status: "AWAITING_SIGNATURE", monthlyGreenKg: 999, greenLotId: "lotGone", companyId: "co" },
    { id: "x2", status: "COMPLETED",          monthlyGreenKg: 999, greenLotId: "lotMissing", companyId: "co" },
  ]
  // monthlyDrawGreen for the share denominator: pass 1000 to keep
  // arithmetic obvious. Unbacked = 300 → share = 0.3.
  const r = computeUnbackedCommitment(lots, contracts, 1000)
  assert.equal(r.contractCount, 2)
  assert.equal(r.monthlyGreenKg, 300)
  assert.equal(r.shareOfMonthlyDraw, 0.3)
  // Sorted by kg desc, id asc.
  assert.deepEqual(r.contractIds, ["u2", "u1"])
})

test("unbackedCommitment REGRESSION: greenLotId = null is NOT counted as unbacked", () => {
  const contracts: CommittedContractRow[] = [
    { id: "n1", status: "ACTIVE", monthlyGreenKg: 500, greenLotId: null, companyId: "co" },
    { id: "n2", status: "SIGNED", monthlyGreenKg: 500, greenLotId: null, companyId: "co" },
  ]
  const r = computeUnbackedCommitment([], contracts, 1000)
  assert.equal(r.contractCount, 0)
  assert.equal(r.monthlyGreenKg, 0)
  assert.equal(r.shareOfMonthlyDraw, 0)
})

test("unbackedCommitment: pinned-to-published contracts are NOT counted", () => {
  const lots: GreenLotAttributionRow[] = [
    { id: "lotA", availableKg: 1000, farmId: "f1" },
  ]
  const contracts: CommittedContractRow[] = [
    { id: "p1", status: "ACTIVE", monthlyGreenKg: 100, greenLotId: "lotA", companyId: "co" },
  ]
  const r = computeUnbackedCommitment(lots, contracts, 1000)
  assert.equal(r.contractCount, 0)
  assert.equal(r.shareOfMonthlyDraw, 0)
})

test("unbackedCommitment: monthlyDrawGreen = 0 → shareOfMonthlyDraw is null", () => {
  const r = computeUnbackedCommitment([], [], 0)
  assert.equal(r.shareOfMonthlyDraw, null)
})

test("unbackedCommitment: contractIds capped at top-N", () => {
  const contracts: CommittedContractRow[] = []
  for (let i = 0; i < 25; i++) {
    contracts.push({
      id: `u-${String(i).padStart(3, "0")}`,
      status: "ACTIVE",
      monthlyGreenKg: 100 - i, // descending so order is well-defined
      greenLotId: `gone-${i}`, // none of these are in the published set
      companyId: "co",
    })
  }
  // Empty published set → every pinned contract is unbacked.
  const r = computeUnbackedCommitment([], contracts, 10000)
  // ATTRIBUTION_TOP_N = 10
  assert.equal(r.contractIds.length, 10)
  assert.equal(r.contractIds[0], "u-000") // largest kg first
})
