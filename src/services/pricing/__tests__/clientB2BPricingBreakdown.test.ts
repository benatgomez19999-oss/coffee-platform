//////////////////////////////////////////////////////
// 🧪 CLIENT B2B PRICING BREAKDOWN — PURE TESTS
//////////////////////////////////////////////////////

import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  buildCommercialInspectionFromBreakdown,
  buildTargetInspectionFromBreakdown,
  classifyDeltaStatus,
  deriveVisibility,
  findBreakdownValue,
  getBooleanBreakdownValue,
  getNumberBreakdownValue,
  getStringBreakdownValue,
  type BreakdownItem,
} from "../clientB2BPricingBreakdown.ts"

const SAMPLE: BreakdownItem[] = [
  { label: "scaScore", value: 91 },
  { label: "altitude", value: 2050 },
  { label: "variety", value: "GEISHA" },
  { label: "process", value: "WASHED" },
  { label: "country", value: "COLOMBIA" },
  { label: "roastYield", value: 0.85 },
  { label: "marketplaceGreenKg", value: 350 },
  { label: "producerPrestigeTier", value: null },
  { label: "cPrice", value: 320 },
  { label: "demandIndex", value: 1.05 },
  { label: "producerGreenPricePerKg", value: 8 },
  { label: "originEquivalentRoastedPricePerKg", value: 9.41 },
  { label: "costPlusFinal", value: 28.9 },
  { label: "commercialModel", value: "MARKET_ANCHORED_MODEL" },
  { label: "marketTargetSourceVersion", value: "research-2026-05" },
  { label: "marketTargetPricingClass", value: "GEISHA" },
  { label: "marketTargetExpected", value: 400 },
  { label: "marketTargetLow", value: 350 },
  { label: "marketTargetHigh", value: 500 },
  { label: "targetScaBucket", value: "91" },
  { label: "targetAltitudeBucket", value: "2050+" },
  { label: "targetCountryGroup", value: "COLOMBIA" },
  { label: "softScarcityModifier", value: 1.05 },
  { label: "softMarketSignalModifier", value: 1.02 },
  { label: "softPrestigeModifier", value: 1.0 },
  { label: "marketAnchoredPrice", value: 410 },
  { label: "finalBeforeClamp", value: 410 },
  { label: "clampMin", value: 350 },
  { label: "clampMax", value: 500 },
  { label: "clampApplied", value: false },
  { label: "finalPrice", value: 410 },
]

// ------------------------------------------------------
// Lookup helpers
// ------------------------------------------------------

describe("breakdown lookups", () => {

  it("findBreakdownValue returns the value at the matching label", () => {
    assert.equal(findBreakdownValue(SAMPLE, "scaScore"), 91)
    assert.equal(findBreakdownValue(SAMPLE, "variety"), "GEISHA")
  })

  it("findBreakdownValue returns null for missing label", () => {
    assert.equal(findBreakdownValue(SAMPLE, "doesNotExist"), null)
  })

  it("findBreakdownValue returns null on empty / null breakdown", () => {
    assert.equal(findBreakdownValue([], "scaScore"), null)
    assert.equal(findBreakdownValue(null, "scaScore"), null)
    assert.equal(findBreakdownValue(undefined, "scaScore"), null)
  })

  it("getNumberBreakdownValue rejects non-numeric / non-finite values", () => {
    const ext: BreakdownItem[] = [
      ...SAMPLE,
      { label: "naField", value: Number.NaN },
      { label: "infField", value: Number.POSITIVE_INFINITY },
      { label: "stringField", value: "nope" },
    ]
    assert.equal(getNumberBreakdownValue(ext, "scaScore"), 91)
    assert.equal(getNumberBreakdownValue(ext, "naField"), null)
    assert.equal(getNumberBreakdownValue(ext, "infField"), null)
    assert.equal(getNumberBreakdownValue(ext, "stringField"), null)
    assert.equal(getNumberBreakdownValue(ext, "missing"), null)
  })

  it("getBooleanBreakdownValue extracts clampApplied", () => {
    assert.equal(getBooleanBreakdownValue(SAMPLE, "clampApplied"), false)
    assert.equal(getBooleanBreakdownValue(SAMPLE, "scaScore"), null)
    assert.equal(getBooleanBreakdownValue(SAMPLE, "missing"), null)
  })

  it("getStringBreakdownValue rejects non-string / empty", () => {
    assert.equal(getStringBreakdownValue(SAMPLE, "variety"), "GEISHA")
    assert.equal(getStringBreakdownValue(SAMPLE, "scaScore"), null)
    assert.equal(getStringBreakdownValue([{ label: "x", value: "" }], "x"), null)
  })
})

// ------------------------------------------------------
// Commercial inspection
// ------------------------------------------------------

describe("buildCommercialInspectionFromBreakdown", () => {

  it("extracts every commercial-layer field from a market-anchored result", () => {
    const c = buildCommercialInspectionFromBreakdown(SAMPLE)
    assert.equal(c.costPlusFinal, 28.9)
    assert.equal(c.marketAnchoredPrice, 410)
    assert.equal(c.finalBeforeClamp, 410)
    assert.equal(c.clampMin, 350)
    assert.equal(c.clampMax, 500)
    assert.equal(c.clampApplied, false)
    assert.equal(c.softScarcityModifier, 1.05)
    assert.equal(c.softMarketSignalModifier, 1.02)
    assert.equal(c.softPrestigeModifier, 1.0)
  })

  it("returns nulls cleanly when the breakdown is empty", () => {
    const c = buildCommercialInspectionFromBreakdown([])
    assert.equal(c.costPlusFinal, null)
    assert.equal(c.marketAnchoredPrice, null)
    assert.equal(c.finalBeforeClamp, null)
    assert.equal(c.clampMin, null)
    assert.equal(c.clampMax, null)
    assert.equal(c.clampApplied, null)
    assert.equal(c.softScarcityModifier, null)
    assert.equal(c.softMarketSignalModifier, null)
    assert.equal(c.softPrestigeModifier, null)
  })

  it("falls back to costPlusPostClamp when costPlusFinal absent", () => {
    const breakdown: BreakdownItem[] = [
      { label: "costPlusPostClamp", value: 23.4 },
      { label: "marketAnchoredPrice", value: 30 },
    ]
    const c = buildCommercialInspectionFromBreakdown(breakdown)
    assert.equal(c.costPlusFinal, 23.4)
  })
})

// ------------------------------------------------------
// Target inspection
// ------------------------------------------------------

describe("buildTargetInspectionFromBreakdown", () => {

  it("flags ok when expected/low/high are all present", () => {
    const t = buildTargetInspectionFromBreakdown(SAMPLE)
    assert.equal(t.ok, true)
    assert.equal(t.expected, 400)
    assert.equal(t.low, 350)
    assert.equal(t.high, 500)
    assert.equal(t.pricingClass, "GEISHA")
    assert.equal(t.scaBucket, "91")
    assert.equal(t.altitudeBucket, "2050+")
    assert.equal(t.countryGroup, "COLOMBIA")
    assert.equal(t.sourceVersion, "research-2026-05")
    assert.equal(t.reasons.length, 0)
  })

  it("flags ok=false and surfaces fallback reasons when target is missing", () => {
    const breakdown: BreakdownItem[] = [
      { label: "marketTargetMissing", value: "no row for COLOMBIA / SCA 80" },
      { label: "marketTargetFallbackReason", value: "USED_NORMAL_SPECIALTY" },
    ]
    const t = buildTargetInspectionFromBreakdown(breakdown)
    assert.equal(t.ok, false)
    assert.equal(t.expected, null)
    assert.equal(t.low, null)
    assert.equal(t.high, null)
    assert.ok(t.reasons.some((r) => r.includes("marketTargetMissing")))
    assert.ok(t.reasons.some((r) => r.includes("marketTargetFallbackReason")))
  })
})

// ------------------------------------------------------
// Delta classification
// ------------------------------------------------------

describe("classifyDeltaStatus", () => {

  it("returns MATCH for identical values", () => {
    assert.equal(
      classifyDeltaStatus({ persisted: 400, recomputed: 400 }),
      "MATCH"
    )
  })

  it("returns MATCH for sub-threshold drift", () => {
    // 400 → 401 = 0.25%, below the 0.5% default threshold.
    assert.equal(
      classifyDeltaStatus({ persisted: 400, recomputed: 401 }),
      "MATCH"
    )
  })

  it("returns DRIFT_HIGH when recomputed > persisted (above threshold)", () => {
    assert.equal(
      classifyDeltaStatus({ persisted: 400, recomputed: 450 }),
      "DRIFT_HIGH"
    )
  })

  it("returns DRIFT_LOW when recomputed < persisted (above threshold)", () => {
    assert.equal(
      classifyDeltaStatus({ persisted: 400, recomputed: 350 }),
      "DRIFT_LOW"
    )
  })

  it("returns NO_PERSISTED when persisted is null/0", () => {
    assert.equal(
      classifyDeltaStatus({ persisted: null, recomputed: 400 }),
      "NO_PERSISTED"
    )
    assert.equal(
      classifyDeltaStatus({ persisted: 0, recomputed: 400 }),
      "NO_PERSISTED"
    )
  })

  it("returns NO_RECOMPUTE when recomputed is null", () => {
    assert.equal(
      classifyDeltaStatus({ persisted: 400, recomputed: null }),
      "NO_RECOMPUTE"
    )
  })

  it("respects a custom threshold", () => {
    assert.equal(
      classifyDeltaStatus({ persisted: 100, recomputed: 101, thresholdPercent: 0.1 }),
      "DRIFT_HIGH"
    )
    assert.equal(
      classifyDeltaStatus({ persisted: 100, recomputed: 101, thresholdPercent: 5 }),
      "MATCH"
    )
  })
})

// ------------------------------------------------------
// Visibility derivation
// ------------------------------------------------------

describe("deriveVisibility", () => {

  it("OPEN_MARKETPLACE → marketplace true / catalog false", () => {
    const v = deriveVisibility({
      recommendedSurface: "OPEN_MARKETPLACE",
      marketplaceEligibleGreenKg: 1500,
      exclusiveMicrolotGreenKg: 0,
      contractAssignableGreenKg: 0,
    })
    assert.equal(v.appearsInMarketplace, true)
    assert.equal(v.appearsInContractCatalog, false)
  })

  it("EXCLUSIVE_MICROLOT → marketplace true / catalog false", () => {
    const v = deriveVisibility({
      recommendedSurface: "EXCLUSIVE_MICROLOT",
      marketplaceEligibleGreenKg: 0,
      exclusiveMicrolotGreenKg: 350,
      contractAssignableGreenKg: 0,
    })
    assert.equal(v.appearsInMarketplace, true)
    assert.equal(v.appearsInContractCatalog, false)
  })

  it("CONTRACT_CATALOG → catalog true / marketplace false", () => {
    const v = deriveVisibility({
      recommendedSurface: "CONTRACT_CATALOG",
      marketplaceEligibleGreenKg: 0,
      exclusiveMicrolotGreenKg: 0,
      contractAssignableGreenKg: 8000,
    })
    assert.equal(v.appearsInMarketplace, false)
    assert.equal(v.appearsInContractCatalog, true)
  })

  it("SPLIT → both surfaces true when both pools positive", () => {
    const v = deriveVisibility({
      recommendedSurface: "SPLIT",
      marketplaceEligibleGreenKg: 4000,
      exclusiveMicrolotGreenKg: 0,
      contractAssignableGreenKg: 12000,
    })
    assert.equal(v.appearsInMarketplace, true)
    assert.equal(v.appearsInContractCatalog, true)
  })

  it("HOLD → both surfaces false", () => {
    const v = deriveVisibility({
      recommendedSurface: "HOLD",
      marketplaceEligibleGreenKg: 1000,
      exclusiveMicrolotGreenKg: 1000,
      contractAssignableGreenKg: 1000,
    })
    assert.equal(v.appearsInMarketplace, false)
    assert.equal(v.appearsInContractCatalog, false)
  })

  it("zero-pool surfaces flip to false even when surface label allows them", () => {
    const v = deriveVisibility({
      recommendedSurface: "CONTRACT_CATALOG",
      marketplaceEligibleGreenKg: 0,
      exclusiveMicrolotGreenKg: 0,
      contractAssignableGreenKg: 0,
    })
    assert.equal(v.appearsInContractCatalog, false)
  })
})
