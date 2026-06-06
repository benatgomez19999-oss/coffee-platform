//////////////////////////////////////////////////////
// 🧪 DEV CONTRACT SCENARIO — PURE TESTS
//
// Pure tests: picker, contract payload builder,
// hasClientActivity. No Prisma, no HTTP.
//////////////////////////////////////////////////////

import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  buildDevContractPayload,
  hasClientActivity,
  pickEligibleLotsForContractScenario,
  resolveDevContractRoastYield,
  roastedToGreenLocal,
  sortEligibleContractLots,
  type EligibleContractLot,
} from "../devContractScenario.pure.ts"
import {
  DEV_CONTRACT_SCENARIO_KINDS,
  getDevContractScenarioSpec,
  isDevContractScenarioKind,
} from "../devContractScenario.types.ts"

const FIXED_NOW = new Date("2026-05-10T12:00:00.000Z")

function lot(over: Partial<EligibleContractLot> & { id: string; lotNumber: string }): EligibleContractLot {
  return {
    variety: "Caturra",
    process: "WASHED",
    scaScore: 85,
    altitude: 1700,
    estimatedRoastYield: 0.85,
    availableGreenKg: 1000,
    clientB2BPricePerKg: 14.5,
    legacyGreenPricePerKg: 7.5,
    status: "PUBLISHED",
    ...over,
  }
}

// ------------------------------------------------------
// KIND GUARDS + SPEC
// ------------------------------------------------------

describe("DevContractScenarioKind guard + spec", () => {

  it("isDevContractScenarioKind accepts all documented kinds", () => {
    for (const k of DEV_CONTRACT_SCENARIO_KINDS) {
      assert.ok(isDevContractScenarioKind(k))
    }
  })

  it("isDevContractScenarioKind rejects unknown / non-string", () => {
    assert.equal(isDevContractScenarioKind("banana"), false)
    assert.equal(isDevContractScenarioKind(""), false)
    assert.equal(isDevContractScenarioKind(null), false)
    assert.equal(isDevContractScenarioKind(42), false)
  })

  it("empty_contracts spec has no contracts and no demand intents", () => {
    const spec = getDevContractScenarioSpec("empty_contracts")
    assert.equal(spec.contracts.length, 0)
    assert.equal(spec.demandIntents.length, 0)
  })

  it("one_active_contract creates exactly one ACTIVE contract", () => {
    const spec = getDevContractScenarioSpec("one_active_contract")
    assert.equal(spec.contracts.length, 1)
    assert.equal(spec.contracts[0].status, "ACTIVE")
    assert.equal(spec.demandIntents.length, 0)
  })

  it("one_pending_signature creates exactly one AWAITING_SIGNATURE contract", () => {
    const spec = getDevContractScenarioSpec("one_pending_signature")
    assert.equal(spec.contracts.length, 1)
    assert.equal(spec.contracts[0].status, "AWAITING_SIGNATURE")
  })

  it("mixed_contract_portfolio carries ACTIVE + AWAITING_SIGNATURE + PAYMENT_PENDING + COMPLETED", () => {
    const spec = getDevContractScenarioSpec("mixed_contract_portfolio")
    const statuses = spec.contracts.map((c) => c.status).sort()
    assert.deepEqual(statuses, [
      "ACTIVE", "AWAITING_SIGNATURE", "COMPLETED", "PAYMENT_PENDING",
    ])
  })

  it("demand_intent_pending creates exactly one OPEN intent and no contract", () => {
    const spec = getDevContractScenarioSpec("demand_intent_pending")
    assert.equal(spec.contracts.length, 0)
    assert.equal(spec.demandIntents.length, 1)
    assert.equal(spec.demandIntents[0].status, "OPEN")
  })
})

// ------------------------------------------------------
// SORT + PICK
// ------------------------------------------------------

describe("sortEligibleContractLots", () => {

  it("sorts by SCA desc, then price desc, then lotNumber asc", () => {
    const out = sortEligibleContractLots([
      lot({ id: "low",      lotNumber: "LN-3", scaScore: 84, clientB2BPricePerKg: 30 }),
      lot({ id: "premium",  lotNumber: "LN-1", scaScore: 91, clientB2BPricePerKg: 400 }),
      lot({ id: "midA",     lotNumber: "LN-2", scaScore: 87, clientB2BPricePerKg: 28 }),
      lot({ id: "midB",     lotNumber: "LN-9", scaScore: 87, clientB2BPricePerKg: 28 }),
    ])
    assert.deepEqual(out.map((l) => l.id), ["premium", "midA", "midB", "low"])
  })

  it("treats null SCA / null price as lowest priority", () => {
    const out = sortEligibleContractLots([
      lot({ id: "noSca", lotNumber: "LN-2", scaScore: null, clientB2BPricePerKg: 50 }),
      lot({ id: "real",  lotNumber: "LN-1", scaScore: 86, clientB2BPricePerKg: 25 }),
    ])
    assert.equal(out[0].id, "real")
  })

  it("does not mutate the input array", () => {
    const input = [
      lot({ id: "c", lotNumber: "LN-3", scaScore: 84 }),
      lot({ id: "a", lotNumber: "LN-1", scaScore: 88 }),
    ]
    const before = input.map((l) => l.id)
    sortEligibleContractLots(input)
    assert.deepEqual(input.map((l) => l.id), before)
  })
})

describe("pickEligibleLotsForContractScenario", () => {

  it("empty_contracts picks 0 lots even when many are available", () => {
    const r = pickEligibleLotsForContractScenario("empty_contracts", [
      lot({ id: "a", lotNumber: "LN-1" }),
      lot({ id: "b", lotNumber: "LN-2" }),
    ])
    assert.equal(r.ok, true)
    assert.equal(r.needed, 0)
    assert.equal(r.picked.length, 0)
  })

  it("one_active_contract picks exactly one (top of sort)", () => {
    const r = pickEligibleLotsForContractScenario("one_active_contract", [
      lot({ id: "a", lotNumber: "LN-1", scaScore: 85 }),
      lot({ id: "b", lotNumber: "LN-2", scaScore: 91 }),
    ])
    assert.equal(r.ok, true)
    assert.equal(r.picked.length, 1)
    assert.equal(r.picked[0].id, "b")
  })

  it("mixed_contract_portfolio picks 4 (one per contract recipe)", () => {
    const lots: EligibleContractLot[] = []
    for (let i = 0; i < 6; i++) {
      lots.push(lot({ id: `L${i}`, lotNumber: `LN-${i}`, scaScore: 90 - i }))
    }
    const r = pickEligibleLotsForContractScenario("mixed_contract_portfolio", lots)
    assert.equal(r.ok, true)
    assert.equal(r.needed, 4)
    assert.equal(r.picked.length, 4)
  })

  it("returns ok:false with a clear message when not enough lots", () => {
    const r = pickEligibleLotsForContractScenario("mixed_contract_portfolio", [
      lot({ id: "a", lotNumber: "LN-1" }),
    ])
    assert.equal(r.ok, false)
    assert.equal(r.picked.length, 0)
    assert.match(r.message ?? "", /Seed marketplace.contract catalog lots first/)
  })
})

// ------------------------------------------------------
// PRICING / VOLUME HELPERS
// ------------------------------------------------------

describe("resolveDevContractRoastYield", () => {
  it("uses estimatedRoastYield when set", () => {
    assert.equal(resolveDevContractRoastYield({ estimatedRoastYield: 0.83, process: "WASHED" }), 0.83)
  })
  it("falls back to process default", () => {
    assert.equal(resolveDevContractRoastYield({ estimatedRoastYield: null, process: "NATURAL" }), 0.82)
    assert.equal(resolveDevContractRoastYield({ estimatedRoastYield: null, process: "WASHED" }), 0.85)
  })
  it("clamps to [0.5, 1.0]", () => {
    assert.equal(resolveDevContractRoastYield({ estimatedRoastYield: 1.4, process: "WASHED" }), 1.0)
    assert.equal(resolveDevContractRoastYield({ estimatedRoastYield: 0.1, process: "WASHED" }), 0.5)
  })
})

describe("roastedToGreenLocal", () => {
  it("converts roasted to green using yield floor", () => {
    assert.equal(roastedToGreenLocal(170, 0.85), 200)
  })
  it("floors yield at 0.5", () => {
    assert.equal(roastedToGreenLocal(100, 0.1), 200) // 100 / 0.5
  })
})

// ------------------------------------------------------
// CONTRACT PAYLOAD BUILDER
// ------------------------------------------------------

describe("buildDevContractPayload", () => {

  it("monthlyGreenKg derived from yield, lockedPrice carries persisted clientB2B", () => {
    const spec = getDevContractScenarioSpec("one_active_contract")
    const recipe = spec.contracts[0]
    const out = buildDevContractPayload({
      lot: lot({ id: "lot-1", lotNumber: "LN-1", clientB2BPricePerKg: 25 }),
      recipe,
      resolvedPricePerKgRoasted: 25,
      now: FIXED_NOW,
    })
    assert.equal(out.status, "ACTIVE")
    assert.equal(out.monthlyVolumeKg, 600)
    // monthlyGreenKg = 600 / 0.85 ≈ 705.88
    assert.ok(Math.abs(out.monthlyGreenKg - (600 / 0.85)) < 1e-6)
    assert.equal(out.lockedPricePerKg, 25)
    assert.equal(out.bagSizeKg, 20)
    // 600 / 20 = 30 bags
    assert.equal(out.bagsPerDelivery, 30)
    // pricePerBag = 25 * 20 = 500
    assert.equal(out.pricePerBag, 500)
    // monthlyPrice = 30 * 500 = 15000
    assert.equal(out.monthlyPrice, 15000)
  })

  it("ACTIVE recipe sets nextExecution; AWAITING_SIGNATURE leaves it null", () => {
    const active = buildDevContractPayload({
      lot: lot({ id: "l", lotNumber: "LN-1" }),
      recipe: getDevContractScenarioSpec("one_active_contract").contracts[0],
      resolvedPricePerKgRoasted: 25,
      now: FIXED_NOW,
    })
    assert.ok(active.nextExecution instanceof Date)

    const pending = buildDevContractPayload({
      lot: lot({ id: "l", lotNumber: "LN-1" }),
      recipe: getDevContractScenarioSpec("one_pending_signature").contracts[0],
      resolvedPricePerKgRoasted: 25,
      now: FIXED_NOW,
    })
    assert.equal(pending.nextExecution, null)
  })

  it("startDate respects startOffsetDays (active is backdated 60 days)", () => {
    const out = buildDevContractPayload({
      lot: lot({ id: "l", lotNumber: "LN-1" }),
      recipe: getDevContractScenarioSpec("one_active_contract").contracts[0],
      resolvedPricePerKgRoasted: 25,
      now: FIXED_NOW,
    })
    const offsetMs = FIXED_NOW.getTime() - out.startDate.getTime()
    const offsetDays = Math.round(offsetMs / (24 * 60 * 60 * 1000))
    assert.equal(offsetDays, 60)
  })
})

// ------------------------------------------------------
// hasClientActivity
// ------------------------------------------------------

describe("hasClientActivity", () => {

  it("returns false when all counts are zero", () => {
    assert.equal(hasClientActivity({
      activeContracts: 0,
      pendingSignatureContracts: 0,
      pendingPaymentContracts: 0,
      pendingRequests: 0,
    }), false)
  })

  it("returns true when any contract bucket is non-zero", () => {
    assert.equal(hasClientActivity({
      activeContracts: 1,
      pendingSignatureContracts: 0,
      pendingPaymentContracts: 0,
      pendingRequests: 0,
    }), true)
    assert.equal(hasClientActivity({
      activeContracts: 0,
      pendingSignatureContracts: 1,
      pendingPaymentContracts: 0,
      pendingRequests: 0,
    }), true)
    assert.equal(hasClientActivity({
      activeContracts: 0,
      pendingSignatureContracts: 0,
      pendingPaymentContracts: 1,
      pendingRequests: 0,
    }), true)
  })

  it("returns true when pendingRequests > 0", () => {
    assert.equal(hasClientActivity({
      activeContracts: 0,
      pendingSignatureContracts: 0,
      pendingPaymentContracts: 0,
      pendingRequests: 2,
    }), true)
  })

  it("tolerates undefined fields (treats as 0)", () => {
    assert.equal(hasClientActivity({} as any), false)
  })
})
