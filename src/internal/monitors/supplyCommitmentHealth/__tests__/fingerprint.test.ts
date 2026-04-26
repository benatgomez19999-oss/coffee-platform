// =====================================================
// UNIT TESTS — fingerprint.ts
//
// Properties asserted:
//   - same input → same fingerprint
//   - any single row change → different fingerprint
//   - order-independent
// =====================================================

import { test } from "node:test"
import assert from "node:assert/strict"

import { computeInputFingerprint } from "../fingerprint.ts"
import type { DataAccessSnapshot } from "../types.ts"

const FIXED_NOW = new Date("2026-04-10T12:00:00Z")

function snapshotFixture(): DataAccessSnapshot {
  return {
    runStartedAt: FIXED_NOW,
    publishedSupplyGreenRows: [
      { id: "lot-a", availableKg: 1000, farmId: "f1" },
      { id: "lot-b", availableKg: 500, farmId: "f2" },
    ],
    contractableSupplyResult: {
      contractableKg: 1200,
      grossAvailableKg: 1500,
      committedKg: 200,
      reservedByIntentsKg: 100,
    },
    committedContractRows: [
      { id: "ct-1", status: "ACTIVE", monthlyGreenKg: 100, greenLotId: "lot-a", companyId: "co-1" },
      { id: "ct-2", status: "SIGNED", monthlyGreenKg: 50, greenLotId: null, companyId: "co-2" },
    ],
    openIntentRowsCurrent: [
      {
        id: "oi-1",
        greenLotId: "lot-a",
        companyId: "co-1",
        type: "CREATE",
        requestedKg: 50,
        offeredKg: 40,
        deltaKg: 30,
        expiresAt: new Date("2026-05-01T00:00:00Z"),
        createdAt: new Date("2026-04-09T00:00:00Z"),
      },
    ],
    intentWindowCurrent: [],
    intentWindowPrior: [],
    fulfilmentRows: [
      {
        id: "pf-1",
        status: "AWAITING_CONFIRMATION",
        greenLotId: "lot-a",
        producerId: "p-1",
        createdAt: new Date("2026-04-01T00:00:00Z"),
        updatedAt: new Date("2026-04-01T00:00:00Z"),
      },
    ],
    inputCounts: {
      greenLotCount: 2,
      committedContractCount: 2,
      openIntentCount: 1,
      fulfilmentRowCount: 1,
      windowIntentCountCurrent: 0,
      windowIntentCountPrior: 0,
    },
  }
}

test("fingerprint: same input → same fingerprint (determinism)", () => {
  const a = computeInputFingerprint(snapshotFixture())
  const b = computeInputFingerprint(snapshotFixture())
  assert.equal(a, b)
})

test("fingerprint: changing a contract status → different fingerprint", () => {
  const s1 = snapshotFixture()
  const s2 = snapshotFixture()
  s2.committedContractRows[0].status = "PAYMENT_PENDING"
  assert.notEqual(
    computeInputFingerprint(s1),
    computeInputFingerprint(s2)
  )
})

test("fingerprint: changing a green lot availableKg → different fingerprint", () => {
  const s1 = snapshotFixture()
  const s2 = snapshotFixture()
  s2.publishedSupplyGreenRows[0].availableKg = 999
  assert.notEqual(
    computeInputFingerprint(s1),
    computeInputFingerprint(s2)
  )
})

test("fingerprint: changing the contractable supply numeric result → different fingerprint", () => {
  const s1 = snapshotFixture()
  const s2 = snapshotFixture()
  s2.contractableSupplyResult.contractableKg = 9999
  assert.notEqual(
    computeInputFingerprint(s1),
    computeInputFingerprint(s2)
  )
})

test("fingerprint: order-independent — reversing committed contracts yields the same fingerprint", () => {
  const s1 = snapshotFixture()
  const s2 = snapshotFixture()
  s2.committedContractRows.reverse()
  assert.equal(
    computeInputFingerprint(s1),
    computeInputFingerprint(s2)
  )
})

test("fingerprint: order-independent — reversing green lots yields the same fingerprint", () => {
  const s1 = snapshotFixture()
  const s2 = snapshotFixture()
  s2.publishedSupplyGreenRows.reverse()
  assert.equal(
    computeInputFingerprint(s1),
    computeInputFingerprint(s2)
  )
})

test("fingerprint: empty snapshot is stable", () => {
  const empty: DataAccessSnapshot = {
    runStartedAt: FIXED_NOW,
    publishedSupplyGreenRows: [],
    contractableSupplyResult: {
      contractableKg: 0,
      grossAvailableKg: 0,
      committedKg: 0,
      reservedByIntentsKg: 0,
    },
    committedContractRows: [],
    openIntentRowsCurrent: [],
    intentWindowCurrent: [],
    intentWindowPrior: [],
    fulfilmentRows: [],
    inputCounts: {
      greenLotCount: 0,
      committedContractCount: 0,
      openIntentCount: 0,
      fulfilmentRowCount: 0,
      windowIntentCountCurrent: 0,
      windowIntentCountPrior: 0,
    },
  }
  const a = computeInputFingerprint(empty)
  const b = computeInputFingerprint(empty)
  assert.equal(a, b)
  assert.ok(typeof a === "string" && a.length > 0)
})
