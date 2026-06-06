//////////////////////////////////////////////////////
// 🧪 CLIENT B2B PRICE REFRESH — PURE TESTS
//
// All Prisma + market-signal logic is exercised through
// the pure helper recomputeClientB2BPriceForLot using
// stub pricing fns. No DB. No HTTP.
//////////////////////////////////////////////////////

import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  recomputeClientB2BPriceForLot,
  summarizeClientB2BRefresh,
  type ClientB2BRefreshMarketSignal,
  type ClientB2BRefreshResult,
  type RefreshLotView,
} from "../clientB2BPriceRefresh.pure.ts"
import type {
  MarketplaceB2BPricingResult,
  ProducerPricingFn,
} from "../../../engine/pricing/client/calculateMarketplaceB2BPricing.ts"

// ------------------------------------------------------
// FIXTURES
// ------------------------------------------------------

const SIGNAL_EMPTY: ClientB2BRefreshMarketSignal = {
  id: null, cPrice: null, demandIndex: null,
  source: null, validFrom: null, expiresAt: null,
}

const SIGNAL_HOT: ClientB2BRefreshMarketSignal = {
  id: "sig-1",
  cPrice: 320,
  demandIndex: 1.1,
  source: "MANUAL",
  validFrom: "2026-05-01T00:00:00.000Z",
  expiresAt: null,
}

function lot(overrides: Partial<RefreshLotView> & {
  clientB2BPricePerKg?: number | null
  clientPricePerKg?: number | null
} = {}): RefreshLotView {
  const {
    clientB2BPricePerKg,
    clientPricePerKg = 8,
    ...rest
  } = overrides
  // Use explicit "in" checks so callers can pass null without
  // the `??` fallback silently rewriting it.
  return {
    id: "id" in rest ? (rest.id as string) : "lot-1",
    lotNumber: "lotNumber" in rest ? (rest.lotNumber as string) : "LN-0001",
    name: "name" in rest ? (rest.name as string | null) : "Demo Lot",
    status: "status" in rest ? (rest.status as string) : "PUBLISHED",
    variety: "variety" in rest ? (rest.variety as string) : "Caturra",
    process: "process" in rest ? (rest.process as string) : "WASHED",
    scaScore: "scaScore" in rest ? (rest.scaScore as number | null) : 86,
    availableKg: "availableKg" in rest ? (rest.availableKg as number | null) : 1500,
    estimatedRoastYield:
      "estimatedRoastYield" in rest
        ? (rest.estimatedRoastYield as number | null)
        : 0.85,
    currency: "currency" in rest ? (rest.currency as string | null) : "EUR",
    farm:
      "farm" in rest
        ? rest.farm ?? null
        : { altitude: 1850, producer: { country: "Colombia" } },
    pricingSnapshot:
      clientPricePerKg == null && clientB2BPricePerKg == null
        ? null
        : {
            clientPricePerKg: clientPricePerKg ?? 0,
            clientB2BPricePerKg: clientB2BPricePerKg ?? null,
          },
  }
}

// Build a stub B2B pricing fn that returns a fixed price.
function stubB2B(returns: Partial<MarketplaceB2BPricingResult>) {
  return ((_input: unknown, _opts: unknown): MarketplaceB2BPricingResult => ({
    pricePerKgRoasted: 30,
    currency: "EUR",
    pricingMode: "ADAPTIVE_B2B_ENGINE",
    commercialModel: "MARKET_ANCHORED_MODEL",
    producerGreenPricePerKg: 8,
    originEquivalentRoastedPricePerKg: 9.5,
    b2bReferencePricePerKg: 28,
    adaptiveB2BPricePerKg: 30,
    breakdown: [],
    pricingVersion: "marketplace-b2b-target-anchored-v1",
    ...returns,
  })) as unknown as typeof import("../../../engine/pricing/client/calculateMarketplaceB2BPricing.ts").calculateMarketplaceB2BPricing
}

// Stub producer pricing fn — never called when b2bPricingFn is overridden,
// but the type system still wants it.
const stubProducerFn: ProducerPricingFn = ((_i: unknown) =>
  ({ finalPrice: 8, breakdown: undefined })) as any

// ------------------------------------------------------
// 1. NORMAL RECOMPUTE
// ------------------------------------------------------

describe("recomputeClientB2BPriceForLot — happy path", () => {

  it("returns recomputed price + delta vs persisted", () => {
    const out = recomputeClientB2BPriceForLot(
      lot({ clientB2BPricePerKg: 25, clientPricePerKg: 8 }),
      {
        marketSignal: SIGNAL_HOT,
        marketSignalForEngine: { cPrice: 320, demandIndex: 1.1 },
        producerPricingFn: stubProducerFn,
        b2bPricingFn: stubB2B({ pricePerKgRoasted: 30 }),
      }
    )
    assert.equal(out.persistedClientB2BPricePerKg, 25)
    assert.equal(out.recomputedClientB2BPricePerKg, 30)
    assert.equal(out.deltaAbsolute, 5)
    assert.equal(out.deltaPercent, 20)
    assert.equal(out.pricingSourceBefore, "PERSISTED_CLIENT_B2B")
    assert.equal(out.pricingSourceAfter, "RECOMPUTED_CLIENT_B2B")
    assert.equal(out.skipped, false)
    assert.equal(out.applied, false)
    assert.equal(out.marketSignal.id, "sig-1")
  })

  it("propagates pricing version + mode + commercial model", () => {
    const out = recomputeClientB2BPriceForLot(
      lot({ clientB2BPricePerKg: 25 }),
      {
        marketSignal: SIGNAL_EMPTY,
        marketSignalForEngine: null,
        producerPricingFn: stubProducerFn,
        b2bPricingFn: stubB2B({
          pricePerKgRoasted: 26,
          pricingVersion: "marketplace-b2b-target-anchored-v1",
          pricingMode: "B2B_REFERENCE_FALLBACK",
          commercialModel: "COST_PLUS_MODEL",
        }),
      }
    )
    assert.equal(out.recomputedPricingVersion, "marketplace-b2b-target-anchored-v1")
    assert.equal(out.recomputedPricingMode, "B2B_REFERENCE_FALLBACK")
    assert.equal(out.recomputedCommercialModel, "COST_PLUS_MODEL")
  })

  it("legacyGreenEquivalent computed when only legacy green is present", () => {
    const out = recomputeClientB2BPriceForLot(
      lot({
        clientB2BPricePerKg: null,
        clientPricePerKg: 8.5,
        estimatedRoastYield: 0.85,
      }),
      {
        marketSignal: SIGNAL_EMPTY,
        marketSignalForEngine: null,
        producerPricingFn: stubProducerFn,
        b2bPricingFn: stubB2B({ pricePerKgRoasted: 28 }),
      }
    )
    // 8.5 / 0.85 = 10
    assert.ok(Math.abs((out.legacyGreenEquivalentPricePerKg ?? 0) - 10) < 1e-9)
    assert.equal(out.pricingSourceBefore, "LEGACY_GREEN_EQUIVALENT")
    assert.equal(out.persistedClientB2BPricePerKg, null)
    assert.equal(out.deltaAbsolute, null)
    assert.equal(out.deltaPercent, null)
  })
})

// ------------------------------------------------------
// 2. SKIP RULES
// ------------------------------------------------------

describe("recomputeClientB2BPriceForLot — skip rules", () => {

  it("skips when pricingSnapshot missing", () => {
    const out = recomputeClientB2BPriceForLot(
      { ...lot(), pricingSnapshot: null },
      {
        marketSignal: SIGNAL_EMPTY,
        marketSignalForEngine: null,
        producerPricingFn: stubProducerFn,
        b2bPricingFn: stubB2B({}),
      }
    )
    assert.equal(out.skipped, true)
    assert.equal(out.skipReason, "MISSING_PRICING_SNAPSHOT")
    assert.equal(out.recomputedClientB2BPricePerKg, null)
  })

  it("skips when SCA missing", () => {
    const out = recomputeClientB2BPriceForLot(
      lot({ scaScore: null }),
      {
        marketSignal: SIGNAL_EMPTY,
        marketSignalForEngine: null,
        producerPricingFn: stubProducerFn,
        b2bPricingFn: stubB2B({}),
      }
    )
    assert.equal(out.skipReason, "MISSING_SCA")
    assert.equal(out.skipped, true)
  })

  it("skips when farm altitude missing", () => {
    const out = recomputeClientB2BPriceForLot(
      lot({ farm: { altitude: null, producer: { country: "Colombia" } } }),
      {
        marketSignal: SIGNAL_EMPTY,
        marketSignalForEngine: null,
        producerPricingFn: stubProducerFn,
        b2bPricingFn: stubB2B({}),
      }
    )
    assert.equal(out.skipReason, "MISSING_ALTITUDE")
    assert.equal(out.skipped, true)
  })

  it("skips when variety empty", () => {
    const out = recomputeClientB2BPriceForLot(
      lot({ variety: "" }),
      {
        marketSignal: SIGNAL_EMPTY,
        marketSignalForEngine: null,
        producerPricingFn: stubProducerFn,
        b2bPricingFn: stubB2B({}),
      }
    )
    assert.equal(out.skipReason, "MISSING_VARIETY")
  })

  it("skips when process empty", () => {
    const out = recomputeClientB2BPriceForLot(
      lot({ process: "" }),
      {
        marketSignal: SIGNAL_EMPTY,
        marketSignalForEngine: null,
        producerPricingFn: stubProducerFn,
        b2bPricingFn: stubB2B({}),
      }
    )
    assert.equal(out.skipReason, "MISSING_PROCESS")
  })

  it("skips with B2B_ENGINE_ERROR when engine throws — does NOT bubble up", () => {
    const failing = ((_i: unknown) => {
      throw new Error("boom")
    }) as unknown as typeof import("../../../engine/pricing/client/calculateMarketplaceB2BPricing.ts").calculateMarketplaceB2BPricing
    const out = recomputeClientB2BPriceForLot(
      lot(),
      {
        marketSignal: SIGNAL_EMPTY,
        marketSignalForEngine: null,
        producerPricingFn: stubProducerFn,
        b2bPricingFn: failing,
      }
    )
    assert.equal(out.skipped, true)
    assert.equal(out.skipReason, "B2B_ENGINE_ERROR")
    assert.ok(out.warnings.some((w) => w.includes("boom")))
  })

  it("treats null/zero/negative recomputed as RECOMPUTED_PRICE_NOT_USABLE downstream (apply step) — but pure helper marks it as NO_PRICE source", () => {
    const out = recomputeClientB2BPriceForLot(
      lot({ clientB2BPricePerKg: 25 }),
      {
        marketSignal: SIGNAL_EMPTY,
        marketSignalForEngine: null,
        producerPricingFn: stubProducerFn,
        b2bPricingFn: stubB2B({ pricePerKgRoasted: null }),
      }
    )
    assert.equal(out.recomputedClientB2BPricePerKg, null)
    assert.equal(out.pricingSourceAfter, "NO_PRICE")
    assert.equal(out.deltaAbsolute, null)
    // The helper does not mark skipped here (apply layer does);
    // it just produces a NO_PRICE after-source.
    assert.equal(out.skipped, false)
  })
})

// ------------------------------------------------------
// 3. DELTA MATH
// ------------------------------------------------------

describe("recomputeClientB2BPriceForLot — delta math", () => {

  it("delta is 0 when persisted equals recomputed", () => {
    const out = recomputeClientB2BPriceForLot(
      lot({ clientB2BPricePerKg: 30 }),
      {
        marketSignal: SIGNAL_EMPTY,
        marketSignalForEngine: null,
        producerPricingFn: stubProducerFn,
        b2bPricingFn: stubB2B({ pricePerKgRoasted: 30 }),
      }
    )
    assert.equal(out.deltaAbsolute, 0)
    assert.equal(out.deltaPercent, 0)
  })

  it("rounds delta to 2 decimals", () => {
    const out = recomputeClientB2BPriceForLot(
      lot({ clientB2BPricePerKg: 25.123 }),
      {
        marketSignal: SIGNAL_EMPTY,
        marketSignalForEngine: null,
        producerPricingFn: stubProducerFn,
        b2bPricingFn: stubB2B({ pricePerKgRoasted: 27.456 }),
      }
    )
    // 27.456 - 25.123 = 2.333 → 2.33; pct = 2.333/25.123*100 ≈ 9.29
    assert.equal(out.deltaAbsolute, 2.33)
    assert.ok(Math.abs(out.deltaPercent! - 9.29) < 0.01)
  })

  it("delta is null when persisted is null", () => {
    const out = recomputeClientB2BPriceForLot(
      lot({ clientB2BPricePerKg: null, clientPricePerKg: 8 }),
      {
        marketSignal: SIGNAL_EMPTY,
        marketSignalForEngine: null,
        producerPricingFn: stubProducerFn,
        b2bPricingFn: stubB2B({ pricePerKgRoasted: 30 }),
      }
    )
    assert.equal(out.deltaAbsolute, null)
    assert.equal(out.deltaPercent, null)
    assert.equal(out.pricingSourceBefore, "LEGACY_GREEN_EQUIVALENT")
    assert.equal(out.pricingSourceAfter, "RECOMPUTED_CLIENT_B2B")
  })
})

// ------------------------------------------------------
// 4. summarizeClientB2BRefresh
// ------------------------------------------------------

describe("summarizeClientB2BRefresh", () => {

  function row(over: Partial<ClientB2BRefreshResult>): ClientB2BRefreshResult {
    return {
      greenLotId: "x",
      lotNumber: "LN-X",
      lotName: null,
      status: "PUBLISHED",
      variety: "Caturra",
      process: "WASHED",
      scaScore: 85,
      altitude: 1800,
      country: "Colombia",
      roastYield: 0.85,
      persistedClientB2BPricePerKg: null,
      recomputedClientB2BPricePerKg: null,
      legacyGreenEquivalentPricePerKg: null,
      deltaAbsolute: null,
      deltaPercent: null,
      pricingSourceBefore: "NO_PRICE",
      pricingSourceAfter: "NO_PRICE",
      recomputedPricingVersion: null,
      recomputedPricingMode: null,
      recomputedCommercialModel: null,
      marketSignal: SIGNAL_EMPTY,
      applied: false,
      skipped: false,
      warnings: [],
      ...over,
    }
  }

  it("counts updated + skipped accurately", () => {
    const summary = summarizeClientB2BRefresh({
      results: [
        row({ applied: true,  deltaPercent: 10 }),
        row({ applied: true,  deltaPercent: -5 }),
        row({ skipped: true }),
      ],
      mode: "apply",
      applied: true,
      marketSignal: SIGNAL_HOT,
    })
    assert.equal(summary.count, 3)
    assert.equal(summary.updatedCount, 2)
    assert.equal(summary.skippedCount, 1)
    assert.equal(summary.applied, true)
    assert.equal(summary.mode, "apply")
  })

  it("averageDeltaPercent ignores nulls", () => {
    const summary = summarizeClientB2BRefresh({
      results: [
        row({ deltaPercent: 10 }),
        row({ deltaPercent: 20 }),
        row({ deltaPercent: null }),
      ],
      mode: "dry_run",
      applied: false,
      marketSignal: SIGNAL_EMPTY,
    })
    assert.equal(summary.averageDeltaPercent, 15)
  })

  it("maxDeltaPercent picks the largest by absolute value (signed)", () => {
    const summary = summarizeClientB2BRefresh({
      results: [
        row({ deltaPercent: 5 }),
        row({ deltaPercent: -25 }),
        row({ deltaPercent: 12 }),
      ],
      mode: "dry_run",
      applied: false,
      marketSignal: SIGNAL_EMPTY,
    })
    assert.equal(summary.maxDeltaPercent, -25)
  })

  it("returns null deltas when no row has a delta", () => {
    const summary = summarizeClientB2BRefresh({
      results: [row({}), row({})],
      mode: "dry_run",
      applied: false,
      marketSignal: SIGNAL_EMPTY,
    })
    assert.equal(summary.averageDeltaPercent, null)
    assert.equal(summary.maxDeltaPercent, null)
  })

  it("preserves market signal in the summary", () => {
    const summary = summarizeClientB2BRefresh({
      results: [],
      mode: "dry_run",
      applied: false,
      marketSignal: SIGNAL_HOT,
    })
    assert.equal(summary.marketSignal.id, "sig-1")
    assert.equal(summary.marketSignal.cPrice, 320)
    assert.equal(summary.marketSignal.demandIndex, 1.1)
  })
})
