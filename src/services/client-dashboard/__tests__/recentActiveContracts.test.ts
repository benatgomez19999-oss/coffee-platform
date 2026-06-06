//////////////////////////////////////////////////////
// 🧪 RECENT ACTIVE CONTRACTS — PURE TESTS
//////////////////////////////////////////////////////

import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  pickRecentActiveContracts,
  type DashboardContractLike,
} from "../recentActiveContracts.ts"

function c(over: Partial<DashboardContractLike> & { id: string; status: string }): DashboardContractLike {
  return {
    monthlyVolumeKg: 400,
    lockedPricePerKg: 24.5,
    nextExecution: "2026-06-01T00:00:00.000Z",
    createdAt: "2026-05-01T00:00:00.000Z",
    greenLot: {
      name: "Finca Demo",
      variety: "Geisha",
      process: "WASHED",
      farm: { name: "Finca Demo Farm", region: "Huila" },
      producer: { country: "Colombia" },
    },
    ...over,
  }
}

describe("pickRecentActiveContracts", () => {

  it("returns empty array for empty input", () => {
    assert.deepEqual(pickRecentActiveContracts([]), [])
  })

  it("filters out COMPLETED and CANCELLED contracts", () => {
    const rows = pickRecentActiveContracts([
      c({ id: "c1", status: "ACTIVE" }),
      c({ id: "c2", status: "COMPLETED" }),
      c({ id: "c3", status: "CANCELLED" }),
    ])
    assert.equal(rows.length, 1)
    assert.equal(rows[0].id, "c1")
  })

  it("includes AWAITING_SIGNATURE and PAYMENT_PENDING", () => {
    const rows = pickRecentActiveContracts([
      c({ id: "c1", status: "AWAITING_SIGNATURE" }),
      c({ id: "c2", status: "PAYMENT_PENDING" }),
    ])
    assert.equal(rows.length, 2)
  })

  it("orders ACTIVE before AWAITING_SIGNATURE before PAYMENT_PENDING", () => {
    const rows = pickRecentActiveContracts([
      c({ id: "p", status: "PAYMENT_PENDING" }),
      c({ id: "s", status: "AWAITING_SIGNATURE" }),
      c({ id: "a", status: "ACTIVE" }),
    ])
    assert.deepEqual(rows.map((r) => r.id), ["a", "s", "p"])
  })

  it("breaks ties on createdAt descending (newest first)", () => {
    const rows = pickRecentActiveContracts([
      c({ id: "old", status: "ACTIVE", createdAt: "2026-01-01T00:00:00.000Z" }),
      c({ id: "new", status: "ACTIVE", createdAt: "2026-04-01T00:00:00.000Z" }),
    ])
    assert.equal(rows[0].id, "new")
  })

  it("respects the limit (default 3)", () => {
    const rows = pickRecentActiveContracts([
      c({ id: "1", status: "ACTIVE" }),
      c({ id: "2", status: "ACTIVE" }),
      c({ id: "3", status: "ACTIVE" }),
      c({ id: "4", status: "ACTIVE" }),
      c({ id: "5", status: "ACTIVE" }),
    ])
    assert.equal(rows.length, 3)
  })

  it("supports a custom limit and clamps negative limits to 0", () => {
    const five = pickRecentActiveContracts([
      c({ id: "1", status: "ACTIVE" }),
      c({ id: "2", status: "ACTIVE" }),
    ], 5)
    assert.equal(five.length, 2)
    assert.deepEqual(pickRecentActiveContracts([c({ id: "1", status: "ACTIVE" })], -1), [])
  })

  it("builds a title from greenLot.name, falling back to farm.name then placeholder", () => {
    const rows = pickRecentActiveContracts([
      c({ id: "1", status: "ACTIVE", greenLot: { name: "Special Geisha" } }),
      c({ id: "2", status: "ACTIVE", greenLot: { name: null, farm: { name: "El Paraíso" } } }),
      c({ id: "3", status: "ACTIVE", greenLot: null }),
    ])
    assert.equal(rows[0].title, "Special Geisha")
    assert.equal(rows[1].title, "El Paraíso")
    assert.equal(rows[2].title, "Active contract")
  })

  it("preserves monthlyVolumeKg + lockedPricePerKg + nextExecutionIso", () => {
    const rows = pickRecentActiveContracts([
      c({
        id: "1", status: "ACTIVE",
        monthlyVolumeKg: 480, lockedPricePerKg: 21.8,
        nextExecution: "2025-05-28T00:00:00.000Z",
      }),
    ])
    assert.equal(rows[0].monthlyVolumeKg, 480)
    assert.equal(rows[0].lockedPricePerKg, 21.8)
    assert.equal(rows[0].nextExecutionIso, "2025-05-28T00:00:00.000Z")
  })

  it("builds a region · process subtitle when both are present", () => {
    const rows = pickRecentActiveContracts([
      c({ id: "1", status: "ACTIVE",
        greenLot: { farm: { region: "Huila" }, producer: { country: "Colombia" }, process: "WASHED" },
      }),
    ])
    assert.equal(rows[0].subtitle, "Huila · Colombia · Washed")
  })

  it("ignores non-string status entries defensively", () => {
    const rows = pickRecentActiveContracts([
      // @ts-expect-error — runtime guard
      c({ id: "1", status: null }),
      c({ id: "2", status: "ACTIVE" }),
    ])
    assert.equal(rows.length, 1)
    assert.equal(rows[0].id, "2")
  })
})
