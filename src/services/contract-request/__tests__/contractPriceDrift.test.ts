//////////////////////////////////////////////////////
// 🧪 CONTRACT-REQUEST-2 — price drift pure helper tests
//////////////////////////////////////////////////////

import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  CONTRACT_PRICE_DRIFT_TOLERANCE_EUR,
  evaluateContractPriceDrift,
} from "../contractPriceDrift.pure.ts"

// ------------------------------------------------------
// MATCH paths
// ------------------------------------------------------

describe("evaluateContractPriceDrift — match / tolerance", () => {

  it("exact match → MATCH, not blocking", () => {
    const r = evaluateContractPriceDrift({
      intentPreviewPricePerKg: 12.5,
      currentPricePerKg: 12.5,
    })
    assert.equal(r.status, "MATCH")
    assert.equal(r.blocking, false)
    assert.equal(r.delta, 0)
    assert.equal(r.deltaPercent, 0)
  })

  it("within the default tolerance → MATCH", () => {
    const r = evaluateContractPriceDrift({
      intentPreviewPricePerKg: 12.50,
      currentPricePerKg: 12.50 + CONTRACT_PRICE_DRIFT_TOLERANCE_EUR,
    })
    assert.equal(r.status, "MATCH")
    assert.equal(r.blocking, false)
  })

  it("respects a custom absoluteTolerance", () => {
    const r = evaluateContractPriceDrift({
      intentPreviewPricePerKg: 12.5,
      currentPricePerKg: 12.55,
      absoluteTolerance: 0.10,
    })
    assert.equal(r.status, "MATCH")
    assert.equal(r.blocking, false)
  })

  it("ignores a non-numeric / negative custom tolerance and falls back to default", () => {
    const r = evaluateContractPriceDrift({
      intentPreviewPricePerKg: 12.5,
      currentPricePerKg: 13.0,
      absoluteTolerance: -1 as number,
    })
    assert.equal(r.status, "HIGHER_CURRENT_PRICE")
  })
})

// ------------------------------------------------------
// HIGHER paths
// ------------------------------------------------------

describe("evaluateContractPriceDrift — higher current price", () => {

  it("clearly higher → HIGHER_CURRENT_PRICE, blocking", () => {
    const r = evaluateContractPriceDrift({
      intentPreviewPricePerKg: 12.50,
      currentPricePerKg: 14.00,
    })
    assert.equal(r.status, "HIGHER_CURRENT_PRICE")
    assert.equal(r.blocking, true)
    assert.ok(r.delta && r.delta > 0)
    assert.ok(r.deltaPercent && r.deltaPercent > 0)
  })

  it("rounds delta to 4 decimals and percent to 2", () => {
    const r = evaluateContractPriceDrift({
      intentPreviewPricePerKg: 10,
      currentPricePerKg: 10.12345,
    })
    assert.equal(r.status, "HIGHER_CURRENT_PRICE")
    assert.equal(r.delta, 0.1235)
    // 100 * 0.12345 / 10 = 1.2345 → rounded to 1.23
    assert.equal(r.deltaPercent, 1.23)
  })
})

// ------------------------------------------------------
// LOWER paths
// ------------------------------------------------------

describe("evaluateContractPriceDrift — lower current price", () => {

  it("clearly lower → LOWER_CURRENT_PRICE, NOT blocking (favourable for buyer)", () => {
    const r = evaluateContractPriceDrift({
      intentPreviewPricePerKg: 14.00,
      currentPricePerKg: 12.50,
    })
    assert.equal(r.status, "LOWER_CURRENT_PRICE")
    assert.equal(r.blocking, false)
    assert.ok(r.delta && r.delta < 0)
    assert.ok(r.deltaPercent && r.deltaPercent < 0)
  })

  it("includes a friendly headline", () => {
    const r = evaluateContractPriceDrift({
      intentPreviewPricePerKg: 14,
      currentPricePerKg: 12,
    })
    assert.match(r.message, /lower than your original request/i)
  })
})

// ------------------------------------------------------
// MISSING paths
// ------------------------------------------------------

describe("evaluateContractPriceDrift — missing prices are blocking", () => {

  it("missing preview → MISSING_INTENT_PRICE, blocking", () => {
    const r = evaluateContractPriceDrift({
      intentPreviewPricePerKg: null,
      currentPricePerKg: 12.5,
    })
    assert.equal(r.status, "MISSING_INTENT_PRICE")
    assert.equal(r.blocking, true)
  })

  it("missing current → MISSING_CURRENT_PRICE, blocking", () => {
    const r = evaluateContractPriceDrift({
      intentPreviewPricePerKg: 12.5,
      currentPricePerKg: null,
    })
    assert.equal(r.status, "MISSING_CURRENT_PRICE")
    assert.equal(r.blocking, true)
  })

  it("non-positive prices are treated as missing", () => {
    for (const bad of [0, -1, NaN, Infinity]) {
      const r1 = evaluateContractPriceDrift({
        intentPreviewPricePerKg: bad,
        currentPricePerKg: 12.5,
      })
      const r2 = evaluateContractPriceDrift({
        intentPreviewPricePerKg: 12.5,
        currentPricePerKg: bad,
      })
      assert.equal(r1.blocking, true)
      assert.equal(r2.blocking, true)
    }
  })
})

// ------------------------------------------------------
// MESSAGE CONTENT — no technical terms
// ------------------------------------------------------

describe("evaluateContractPriceDrift — buyer-facing messages", () => {

  it("no message mentions enum or technical names", () => {
    const cases = [
      evaluateContractPriceDrift({ intentPreviewPricePerKg: 12.5, currentPricePerKg: 12.5 }),
      evaluateContractPriceDrift({ intentPreviewPricePerKg: 12.5, currentPricePerKg: 14 }),
      evaluateContractPriceDrift({ intentPreviewPricePerKg: 14, currentPricePerKg: 12 }),
      evaluateContractPriceDrift({ intentPreviewPricePerKg: null, currentPricePerKg: 12.5 }),
      evaluateContractPriceDrift({ intentPreviewPricePerKg: 12.5, currentPricePerKg: null }),
    ]
    for (const r of cases) {
      assert.doesNotMatch(
        r.message,
        /HIGHER_CURRENT_PRICE|LOWER_CURRENT_PRICE|MISSING_INTENT_PRICE|MISSING_CURRENT_PRICE|MATCH|previewPricePerKg|currentPricePerKg|clientB2BPricePerKg|deltaKg|PricingSnapshot|resolveClientB2BPriceForLot/i,
      )
    }
  })
})
