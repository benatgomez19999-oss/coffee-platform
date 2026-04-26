// =====================================================
// UNIT TESTS — attribution.ts
//
// Bounded output, stable ordering, IDs only.
// =====================================================

import { test } from "node:test"
import assert from "node:assert/strict"

import { buildAttribution } from "../attribution.ts"
import { ATTRIBUTION_TOP_N } from "../constants.ts"
import type { DataAccessSnapshot, DetectorResult } from "../types.ts"

const NOW = new Date("2026-04-10T12:00:00Z")

function snapshot(): DataAccessSnapshot {
  const contracts = []
  for (let i = 0; i < 25; i++) {
    contracts.push({
      id: `ct-${String(i).padStart(3, "0")}`,
      status: "ACTIVE",
      monthlyGreenKg: 100 - i,
      greenLotId: null,
      companyId: "co",
    })
  }
  const lots = []
  for (let i = 0; i < 25; i++) {
    lots.push({
      id: `lot-${String(i).padStart(3, "0")}`,
      availableKg: 1000 - i,
      farmId: "f",
    })
  }
  return {
    runStartedAt: NOW,
    publishedSupplyGreenRows: lots,
    contractableSupplyResult: {
      contractableKg: 0,
      grossAvailableKg: 0,
      committedKg: 0,
      reservedByIntentsKg: 0,
    },
    committedContractRows: contracts,
    openIntentRowsCurrent: [],
    intentWindowCurrent: [],
    intentWindowPrior: [],
    fulfilmentRows: [],
    inputCounts: {
      greenLotCount: lots.length,
      committedContractCount: contracts.length,
      openIntentCount: 0,
      fulfilmentRowCount: 0,
      windowIntentCountCurrent: 0,
      windowIntentCountPrior: 0,
    },
  }
}

function fired(name: DetectorResult["name"]): DetectorResult {
  return {
    name,
    severity: "WATCH",
    axis: "commitment",
    observed: 0,
    threshold: 0,
    rationale: {},
    contributingIds: {},
  }
}

test("attribution: COMMITMENT_LOAD_HIGH returns top-N contracts and lots", () => {
  const a = buildAttribution([fired("COMMITMENT_LOAD_HIGH")], snapshot())
  const ids = a.byDetector.COMMITMENT_LOAD_HIGH
  assert.ok(ids)
  assert.equal(ids.contractIds?.length, ATTRIBUTION_TOP_N)
  assert.equal(ids.greenLotIds?.length, ATTRIBUTION_TOP_N)
  // Largest first
  assert.equal(ids.contractIds?.[0], "ct-000")
  assert.equal(ids.greenLotIds?.[0], "lot-000")
})

test("attribution: deterministic across runs", () => {
  const s = snapshot()
  const a = buildAttribution([fired("MONTHS_OF_COVER_LOW")], s)
  const b = buildAttribution([fired("MONTHS_OF_COVER_LOW")], s)
  assert.deepEqual(a, b)
})

test("attribution: empty detectors → empty byDetector", () => {
  const a = buildAttribution([], snapshot())
  assert.deepEqual(a.byDetector, {})
})

test("attribution: bounded — never exceeds top-N", () => {
  const big = snapshot()
  // Push to 100 contracts
  for (let i = 25; i < 100; i++) {
    big.committedContractRows.push({
      id: `ct-${String(i).padStart(3, "0")}`,
      status: "ACTIVE",
      monthlyGreenKg: 1,
      greenLotId: null,
      companyId: "co",
    })
  }
  const a = buildAttribution([fired("COMMITMENT_LOAD_HIGH")], big)
  assert.ok(
    (a.byDetector.COMMITMENT_LOAD_HIGH?.contractIds?.length ?? 0) <= ATTRIBUTION_TOP_N
  )
})
