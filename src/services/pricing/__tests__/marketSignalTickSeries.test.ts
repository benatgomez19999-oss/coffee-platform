//////////////////////////////////////////////////////
// 🧪 MARKET SIGNAL TICK SERIES — PURE TESTS
//
// Builder + classifier + delta. No DB, no HTTP.
//////////////////////////////////////////////////////

import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  buildMarketSignalTickSeries,
  classifyMarketSignalTickProvider,
  computeMarketSignalTickDelta,
  type MarketSignalTickSeriesInput,
} from "../marketSignalTickSeries.pure.ts"

const T1 = "2026-05-09T12:00:00.000Z"
const T2 = "2026-05-09T13:00:00.000Z"
const T3 = "2026-05-09T14:00:00.000Z"
const T4 = "2026-05-09T15:00:00.000Z"

function tick(over: Partial<MarketSignalTickSeriesInput> & { id: string; providerId: string; capturedAt: string; cPrice: number }): MarketSignalTickSeriesInput {
  return {
    demandIndex: null,
    confidence: null,
    ...over,
  }
}

// ------------------------------------------------------
// CLASSIFIER
// ------------------------------------------------------

describe("classifyMarketSignalTickProvider", () => {
  it("classifies barchart-preview as INTRADAY", () => {
    assert.equal(classifyMarketSignalTickProvider("barchart-preview"), "INTRADAY")
  })
  it("classifies barchart-settlement-preview as SETTLEMENT", () => {
    assert.equal(classifyMarketSignalTickProvider("barchart-settlement-preview"), "SETTLEMENT")
  })
  it("classifies mock-delayed-ice as MOCK", () => {
    assert.equal(classifyMarketSignalTickProvider("mock-delayed-ice"), "MOCK")
  })
  it("falls back to OTHER for unknown ids and non-strings", () => {
    assert.equal(classifyMarketSignalTickProvider("anything-else"), "OTHER")
    assert.equal(classifyMarketSignalTickProvider(""), "OTHER")
    assert.equal(classifyMarketSignalTickProvider(null), "OTHER")
    assert.equal(classifyMarketSignalTickProvider(undefined), "OTHER")
  })
})

// ------------------------------------------------------
// BUILDER — empty / sorting / classification
// ------------------------------------------------------

describe("buildMarketSignalTickSeries", () => {

  it("empty input returns empty buckets and null delta", () => {
    const s = buildMarketSignalTickSeries([])
    assert.deepEqual(s.points, [])
    assert.deepEqual(s.intradayPoints, [])
    assert.deepEqual(s.settlementPoints, [])
    assert.deepEqual(s.mockPoints, [])
    assert.equal(s.latestIntraday, null)
    assert.equal(s.latestSettlement, null)
    assert.equal(s.latestAny, null)
    assert.equal(s.cPriceMin, null)
    assert.equal(s.cPriceMax, null)
    assert.equal(s.deltaIntradayVsSettlement, null)
  })

  it("sorts points ascending by capturedAt (with id tie-break)", () => {
    const s = buildMarketSignalTickSeries([
      tick({ id: "c", providerId: "barchart-preview", capturedAt: T3, cPrice: 295 }),
      tick({ id: "a", providerId: "barchart-preview", capturedAt: T1, cPrice: 290 }),
      tick({ id: "b", providerId: "barchart-preview", capturedAt: T2, cPrice: 292 }),
    ])
    assert.deepEqual(s.points.map((p) => p.id), ["a", "b", "c"])
  })

  it("buckets by provider class", () => {
    const s = buildMarketSignalTickSeries([
      tick({ id: "i1", providerId: "barchart-preview",            capturedAt: T1, cPrice: 290 }),
      tick({ id: "s1", providerId: "barchart-settlement-preview", capturedAt: T2, cPrice: 280 }),
      tick({ id: "m1", providerId: "mock-delayed-ice",             capturedAt: T3, cPrice: 290 }),
      tick({ id: "o1", providerId: "future-provider",              capturedAt: T4, cPrice: 300 }),
    ])
    assert.deepEqual(s.intradayPoints.map((p) => p.id), ["i1"])
    assert.deepEqual(s.settlementPoints.map((p) => p.id), ["s1"])
    assert.deepEqual(s.mockPoints.map((p) => p.id), ["m1"])
    assert.equal(s.points.find((p) => p.id === "o1")?.providerClass, "OTHER")
  })

  it("computes cPriceMin / cPriceMax across all points", () => {
    const s = buildMarketSignalTickSeries([
      tick({ id: "a", providerId: "barchart-preview",            capturedAt: T1, cPrice: 290 }),
      tick({ id: "b", providerId: "barchart-settlement-preview", capturedAt: T2, cPrice: 280 }),
      tick({ id: "c", providerId: "barchart-preview",            capturedAt: T3, cPrice: 305 }),
    ])
    assert.equal(s.cPriceMin, 280)
    assert.equal(s.cPriceMax, 305)
  })

  it("picks the latest intraday by capturedAt (not by array order)", () => {
    const s = buildMarketSignalTickSeries([
      tick({ id: "i-late",  providerId: "barchart-preview", capturedAt: T3, cPrice: 305 }),
      tick({ id: "i-early", providerId: "barchart-preview", capturedAt: T1, cPrice: 290 }),
    ])
    assert.equal(s.latestIntraday?.id, "i-late")
    assert.equal(s.latestIntraday?.capturedAt, T3)
  })

  it("picks the latest settlement by capturedAt", () => {
    const s = buildMarketSignalTickSeries([
      tick({ id: "s-mid",  providerId: "barchart-settlement-preview", capturedAt: T2, cPrice: 282 }),
      tick({ id: "s-late", providerId: "barchart-settlement-preview", capturedAt: T4, cPrice: 285 }),
      tick({ id: "s-early",providerId: "barchart-settlement-preview", capturedAt: T1, cPrice: 280 }),
    ])
    assert.equal(s.latestSettlement?.id, "s-late")
  })

  it("ignores invalid cPrice defensively", () => {
    const s = buildMarketSignalTickSeries([
      tick({ id: "ok",  providerId: "barchart-preview", capturedAt: T1, cPrice: 290 }),
      tick({ id: "nan", providerId: "barchart-preview", capturedAt: T2, cPrice: Number.NaN }),
      tick({ id: "inf", providerId: "barchart-preview", capturedAt: T3, cPrice: Number.POSITIVE_INFINITY }),
      tick({ id: "neg", providerId: "barchart-preview", capturedAt: T4, cPrice: -10 }),
    ])
    assert.deepEqual(s.points.map((p) => p.id), ["ok"])
  })

  it("ignores ticks with unparseable capturedAt", () => {
    const s = buildMarketSignalTickSeries([
      tick({ id: "ok",  providerId: "barchart-preview", capturedAt: T1, cPrice: 290 }),
      tick({ id: "bad", providerId: "barchart-preview", capturedAt: "not-a-date", cPrice: 295 }),
    ])
    assert.deepEqual(s.points.map((p) => p.id), ["ok"])
  })

  it("preserves confidence and demandIndex on each point", () => {
    const s = buildMarketSignalTickSeries([
      tick({
        id: "x", providerId: "barchart-settlement-preview",
        capturedAt: T1, cPrice: 290, demandIndex: 1.05, confidence: "HIGH",
      }),
    ])
    const p = s.points[0]
    assert.equal(p.confidence, "HIGH")
    assert.equal(p.demandIndex, 1.05)
  })

  it("does not mutate the input array", () => {
    const input = [
      tick({ id: "c", providerId: "barchart-preview", capturedAt: T3, cPrice: 295 }),
      tick({ id: "a", providerId: "barchart-preview", capturedAt: T1, cPrice: 290 }),
      tick({ id: "b", providerId: "barchart-preview", capturedAt: T2, cPrice: 292 }),
    ]
    const original = input.map((t) => t.id)
    buildMarketSignalTickSeries(input)
    assert.deepEqual(input.map((t) => t.id), original)
  })

  it("handles only intraday — delta is null", () => {
    const s = buildMarketSignalTickSeries([
      tick({ id: "i1", providerId: "barchart-preview", capturedAt: T1, cPrice: 290 }),
    ])
    assert.equal(s.latestIntraday?.id, "i1")
    assert.equal(s.latestSettlement, null)
    assert.equal(s.deltaIntradayVsSettlement, null)
  })

  it("handles only settlement — delta is null", () => {
    const s = buildMarketSignalTickSeries([
      tick({ id: "s1", providerId: "barchart-settlement-preview", capturedAt: T1, cPrice: 280 }),
    ])
    assert.equal(s.latestSettlement?.id, "s1")
    assert.equal(s.latestIntraday, null)
    assert.equal(s.deltaIntradayVsSettlement, null)
  })

  it("computes delta absolute and percent when both latest values exist", () => {
    const s = buildMarketSignalTickSeries([
      tick({ id: "i1", providerId: "barchart-preview",            capturedAt: T3, cPrice: 295 }),
      tick({ id: "s1", providerId: "barchart-settlement-preview", capturedAt: T2, cPrice: 290 }),
    ])
    assert.ok(s.deltaIntradayVsSettlement)
    assert.equal(s.deltaIntradayVsSettlement!.absolute, 5)
    // (295 - 290) / 290 * 100 ≈ 1.72
    assert.equal(s.deltaIntradayVsSettlement!.percent, 1.72)
    assert.equal(s.deltaIntradayVsSettlement!.intradayCapturedAt, T3)
    assert.equal(s.deltaIntradayVsSettlement!.settlementCapturedAt, T2)
  })

  it("delta is negative when intraday is below settlement", () => {
    const s = buildMarketSignalTickSeries([
      tick({ id: "i1", providerId: "barchart-preview",            capturedAt: T2, cPrice: 280 }),
      tick({ id: "s1", providerId: "barchart-settlement-preview", capturedAt: T1, cPrice: 290 }),
    ])
    assert.equal(s.deltaIntradayVsSettlement!.absolute, -10)
    assert.ok(s.deltaIntradayVsSettlement!.percent < 0)
  })
})

// ------------------------------------------------------
// COMPUTE DELTA — direct
// ------------------------------------------------------

describe("computeMarketSignalTickDelta", () => {

  it("returns null when either side is missing", () => {
    assert.equal(
      computeMarketSignalTickDelta({ latestIntraday: null, latestSettlement: null }),
      null,
    )
    assert.equal(
      computeMarketSignalTickDelta({
        latestIntraday: null,
        latestSettlement: { id: "s", providerId: "barchart-settlement-preview", providerClass: "SETTLEMENT", capturedAt: T1, cPrice: 280, demandIndex: null, confidence: null },
      }),
      null,
    )
  })

  it("rounds absolute and percent to 2 decimals", () => {
    const d = computeMarketSignalTickDelta({
      latestIntraday:  { id: "i", providerId: "barchart-preview",            providerClass: "INTRADAY",   capturedAt: T2, cPrice: 297.123, demandIndex: null, confidence: null },
      latestSettlement:{ id: "s", providerId: "barchart-settlement-preview", providerClass: "SETTLEMENT", capturedAt: T1, cPrice: 290.000, demandIndex: null, confidence: null },
    })
    assert.ok(d)
    assert.equal(d!.absolute, 7.12)
    assert.equal(d!.percent, 2.46)
  })
})
