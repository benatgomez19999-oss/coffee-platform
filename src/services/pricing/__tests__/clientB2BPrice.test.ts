//////////////////////////////////////////////////////
// 🧪 CLIENT B2B PRICE RESOLVER — UNIT TESTS
//
// Pure tests. No Prisma. No HTTP.
//////////////////////////////////////////////////////

import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  ClientB2BPriceError,
  resolveClientB2BPriceForLot,
  type LotForB2BResolution,
} from "../clientB2BPrice.ts"

function lot(overrides: Partial<LotForB2BResolution> & {
  clientB2BPricePerKg?: number | null
  clientPricePerKg?: number
} = {}): LotForB2BResolution {
  const {
    clientB2BPricePerKg,
    clientPricePerKg = 8,
    ...rest
  } = overrides
  return {
    estimatedRoastYield: 0.85,
    process: "WASHED",
    pricingSnapshot: {
      clientB2BPricePerKg: clientB2BPricePerKg ?? null,
      clientPricePerKg,
    },
    ...rest,
  }
}

describe("resolveClientB2BPriceForLot", () => {

  it("uses persisted clientB2BPricePerKg when present", () => {
    const out = resolveClientB2BPriceForLot(lot({
      clientB2BPricePerKg: 28.9,
      clientPricePerKg: 7.5,
    }))
    assert.equal(out.pricePerKgRoasted, 28.9)
    assert.equal(out.source, "CLIENT_B2B_PERSISTED")
    assert.equal(out.legacyGreenPricePerKg, 7.5)
  })

  it("falls back to legacy green/yield when persisted is missing", () => {
    const out = resolveClientB2BPriceForLot(lot({
      clientB2BPricePerKg: null,
      clientPricePerKg: 8.5,
      estimatedRoastYield: 0.85,
    }))
    assert.equal(out.source, "LEGACY_GREEN_EQUIVALENT")
    // 8.5 / 0.85 = 10
    assert.ok(Math.abs(out.pricePerKgRoasted - 10) < 1e-9)
    assert.equal(out.legacyGreenPricePerKg, 8.5)
  })

  it("ignores zero/negative/NaN persisted B2B and falls back", () => {
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const out = resolveClientB2BPriceForLot(lot({
        clientB2BPricePerKg: bad,
        clientPricePerKg: 8.5,
      }))
      assert.equal(
        out.source, "LEGACY_GREEN_EQUIVALENT",
        `expected fallback for ${bad}`
      )
    }
  })

  it("preserves the resolved roastYield", () => {
    const out = resolveClientB2BPriceForLot(lot({
      estimatedRoastYield: 0.82,
      process: "NATURAL",
    }))
    assert.equal(out.roastYield, 0.82)
  })

  it("source is CLIENT_B2B_PERSISTED for valid persisted price", () => {
    const out = resolveClientB2BPriceForLot(lot({ clientB2BPricePerKg: 25 }))
    assert.equal(out.source, "CLIENT_B2B_PERSISTED")
  })

  it("source is LEGACY_GREEN_EQUIVALENT when only green present", () => {
    const out = resolveClientB2BPriceForLot(lot({
      clientB2BPricePerKg: null,
      clientPricePerKg: 6,
    }))
    assert.equal(out.source, "LEGACY_GREEN_EQUIVALENT")
  })

  it("uses process default yield when estimatedRoastYield is missing", () => {
    const out = resolveClientB2BPriceForLot({
      estimatedRoastYield: null,
      process: "NATURAL",
      pricingSnapshot: {
        clientB2BPricePerKg: null,
        clientPricePerKg: 8.2,
      },
    })
    // Default NATURAL yield 0.82 → 8.2 / 0.82 = 10
    assert.ok(Math.abs(out.pricePerKgRoasted - 10) < 1e-9)
    assert.equal(out.roastYield, 0.82)
  })

  it("throws LOT_NO_PRICING when pricingSnapshot is null", () => {
    try {
      resolveClientB2BPriceForLot({
        estimatedRoastYield: 0.85,
        process: "WASHED",
        pricingSnapshot: null,
      })
      assert.fail("expected ClientB2BPriceError")
    } catch (err) {
      assert.ok(err instanceof ClientB2BPriceError)
      assert.equal((err as ClientB2BPriceError).code, "LOT_NO_PRICING")
    }
  })

  it("throws LOT_NO_PRICING when both prices are unusable", () => {
    try {
      resolveClientB2BPriceForLot({
        estimatedRoastYield: 0.85,
        process: "WASHED",
        pricingSnapshot: {
          clientB2BPricePerKg: 0,
          // clientPricePerKg is required by Prisma; simulate corrupt value
          clientPricePerKg: 0,
        },
      })
      assert.fail("expected ClientB2BPriceError")
    } catch (err) {
      assert.ok(err instanceof ClientB2BPriceError)
      assert.equal((err as ClientB2BPriceError).code, "LOT_NO_PRICING")
    }
  })
})
