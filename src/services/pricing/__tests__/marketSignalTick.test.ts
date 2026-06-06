//////////////////////////////////////////////////////
// 🧪 MARKET SIGNAL TICK — PURE TESTS
//
// No Prisma, no HTTP. Validator + builder + sanitisers.
//////////////////////////////////////////////////////

import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  buildMarketSignalTickFromProviderPreview,
  sanitizeMarketSignalTickRawPayload,
  sanitizeMarketSignalTickSourceUrl,
  validateMarketSignalTickInput,
} from "../marketSignalTick.pure.ts"
import type {
  MarketSignalTickInput,
} from "../marketSignalTick.types.ts"
import type { MarketSignalProviderPreview } from "../marketSignalProviders.types.ts"

const FIXED_NOW = new Date("2026-05-09T12:00:00.000Z")

function tick(over: Partial<MarketSignalTickInput> = {}): MarketSignalTickInput {
  return {
    providerId: "mock-delayed-ice",
    providerKind: "MOCK",
    source: "API_FEED",
    cPrice: 290,
    demandIndex: 1.10,
    confidence: "MEDIUM",
    rawUnit: "US_CENTS_PER_LB",
    rawValue: 290,
    symbol: "KC*1",
    contractMonth: null,
    capturedAt: FIXED_NOW,
    validFrom: FIXED_NOW,
    expiresAt: null,
    sourceName: "Mock delayed ICE Arabica C",
    sourceUrl: null,
    note: null,
    diagnostics: null,
    rawPayload: null,
    ...over,
  }
}

// ------------------------------------------------------
// VALIDATOR
// ------------------------------------------------------

describe("validateMarketSignalTickInput — happy path", () => {

  it("accepts a fully-populated tick", () => {
    const r = validateMarketSignalTickInput(tick(), { now: FIXED_NOW })
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.equal(r.tick.cPrice, 290)
    assert.equal(r.tick.demandIndex, 1.10)
    assert.equal(r.tick.providerId, "mock-delayed-ice")
    assert.ok(r.diagnostics.some((d) => d.code === "MST_TICK_VALID"))
  })

  it("defaults capturedAt to now when missing", () => {
    const r = validateMarketSignalTickInput(
      tick({ capturedAt: null }),
      { now: FIXED_NOW },
    )
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.equal(r.tick.capturedAt.toISOString(), FIXED_NOW.toISOString())
  })

  it("accepts null demandIndex", () => {
    const r = validateMarketSignalTickInput(
      tick({ demandIndex: null }),
      { now: FIXED_NOW },
    )
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.equal(r.tick.demandIndex, null)
  })

  it("does NOT reject an expired expiresAt — ticks are historical", () => {
    const r = validateMarketSignalTickInput(
      tick({
        validFrom: new Date("2020-01-01T00:00:00.000Z"),
        expiresAt: new Date("2020-01-02T00:00:00.000Z"),
      }),
      { now: FIXED_NOW },
    )
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.equal(r.tick.expiresAt?.toISOString(), "2020-01-02T00:00:00.000Z")
  })
})

describe("validateMarketSignalTickInput — error paths", () => {

  it("rejects cPrice below 50", () => {
    const r = validateMarketSignalTickInput(tick({ cPrice: 49 }), { now: FIXED_NOW })
    assert.equal(r.ok, false)
    if (r.ok) return
    assert.ok(r.diagnostics.some((d) => d.code === "MST_CPRICE_OUT_OF_RANGE"))
  })

  it("rejects cPrice above 600", () => {
    const r = validateMarketSignalTickInput(tick({ cPrice: 601 }), { now: FIXED_NOW })
    assert.equal(r.ok, false)
    if (r.ok) return
    assert.ok(r.diagnostics.some((d) => d.code === "MST_CPRICE_OUT_OF_RANGE"))
  })

  it("rejects non-finite cPrice", () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY]) {
      const r = validateMarketSignalTickInput(tick({ cPrice: bad }), { now: FIXED_NOW })
      assert.equal(r.ok, false, `expected reject for ${bad}`)
    }
  })

  it("rejects demandIndex below 0.8", () => {
    const r = validateMarketSignalTickInput(tick({ demandIndex: 0.79 }), { now: FIXED_NOW })
    assert.equal(r.ok, false)
    if (r.ok) return
    assert.ok(r.diagnostics.some((d) => d.code === "MST_DEMAND_INDEX_OUT_OF_RANGE"))
  })

  it("rejects demandIndex above 1.2", () => {
    const r = validateMarketSignalTickInput(tick({ demandIndex: 1.21 }), { now: FIXED_NOW })
    assert.equal(r.ok, false)
    if (r.ok) return
    assert.ok(r.diagnostics.some((d) => d.code === "MST_DEMAND_INDEX_OUT_OF_RANGE"))
  })

  it("rejects an unknown source value", () => {
    const r = validateMarketSignalTickInput(
      // @ts-expect-error — runtime guard
      tick({ source: "MAGIC" }),
      { now: FIXED_NOW },
    )
    assert.equal(r.ok, false)
    if (r.ok) return
    assert.ok(r.diagnostics.some((d) => d.code === "MST_INVALID_SOURCE"))
  })

  it("rejects invalid capturedAt", () => {
    const r = validateMarketSignalTickInput(
      tick({ capturedAt: "not-a-date" }),
      { now: FIXED_NOW },
    )
    assert.equal(r.ok, false)
    if (r.ok) return
    assert.ok(r.diagnostics.some((d) => d.code === "MST_INVALID_CAPTURED_AT"))
  })
})

describe("validateMarketSignalTickInput — sanitisation", () => {

  it("strips api key from sourceUrl and emits MST_SOURCE_URL_SANITIZED", () => {
    const r = validateMarketSignalTickInput(
      tick({ sourceUrl: "https://example.com/getQuote.json?apikey=very-secret&symbols=KC*1" }),
      { now: FIXED_NOW },
    )
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.ok(r.tick.sourceUrl)
    assert.equal(r.tick.sourceUrl!.includes("very-secret"), false)
    assert.equal(r.tick.sourceUrl!.includes("apikey"), false)
    assert.ok(r.diagnostics.some((d) => d.code === "MST_SOURCE_URL_SANITIZED"))
  })

  it("strips embedded credentials from sourceUrl", () => {
    const r = validateMarketSignalTickInput(
      tick({ sourceUrl: "https://user:pass@example.com/path" }),
      { now: FIXED_NOW },
    )
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.equal(r.tick.sourceUrl!.includes("user:pass"), false)
    assert.equal(r.tick.sourceUrl!.includes("@"), false)
    assert.ok(r.diagnostics.some((d) => d.code === "MST_SOURCE_URL_SANITIZED"))
  })

  it("redacts apiKey/token/secret recursively from rawPayload", () => {
    const payload = {
      foo: "ok",
      apiKey: "very-secret",
      nested: {
        token: "abc",
        items: [{ Authorization: "Bearer xyz" }],
      },
    }
    const r = validateMarketSignalTickInput(
      tick({ rawPayload: payload }),
      { now: FIXED_NOW },
    )
    assert.equal(r.ok, true)
    if (!r.ok) return
    const stringified = JSON.stringify(r.tick.rawPayload)
    assert.equal(stringified.includes("very-secret"), false)
    assert.equal(stringified.includes("\"abc\""), false)
    assert.equal(stringified.includes("Bearer xyz"), false)
    assert.ok(stringified.includes("[REDACTED]"))
    assert.ok(r.diagnostics.some((d) => d.code === "MST_RAW_PAYLOAD_REDACTED"))
  })

  it("preserves non-secret payload fields untouched", () => {
    const payload = { symbol: "KC*1", lastPrice: 290.25, results: [{ a: 1 }] }
    const r = validateMarketSignalTickInput(
      tick({ rawPayload: payload }),
      { now: FIXED_NOW },
    )
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.deepEqual(r.tick.rawPayload, payload)
  })

  it("does NOT silently clamp cPrice 49 → 50", () => {
    const r = validateMarketSignalTickInput(tick({ cPrice: 49 }), { now: FIXED_NOW })
    assert.equal(r.ok, false)
  })
})

// ------------------------------------------------------
// PROVIDER PREVIEW BUILDER
// ------------------------------------------------------

function makePreview(over: Partial<MarketSignalProviderPreview> = {}): MarketSignalProviderPreview {
  return {
    generatedAt: FIXED_NOW.toISOString(),
    provider: {
      id: "mock-delayed-ice",
      label: "Mock delayed ICE Arabica C",
      kind: "MOCK",
      description: "...",
      requiresApiKey: false,
      configured: true,
    },
    providerResult: {
      ok: true,
      providerId: "mock-delayed-ice",
      providerKind: "MOCK",
      fetchedAt: FIXED_NOW.toISOString(),
      candidate: {
        cPrice: 290,
        demandIndex: 1.10,
        source: "API_FEED",
        provenance: {
          provider: "mock-delayed-ice",
          sourceName: "Mock delayed ICE Arabica C",
          sourceUrl: null,
          retrievedAt: FIXED_NOW,
          rawValue: 290,
          rawUnit: "US_CENTS_PER_LB",
          confidence: "MEDIUM",
        },
      },
      raw: { symbol: "KC*1", scenario: "neutral" },
      diagnostics: [],
    },
    validation: {
      ok: true,
      candidate: {
        cPrice: 290,
        demandIndex: 1.10,
        source: "API_FEED",
        note: null,
        validFrom: FIXED_NOW,
        expiresAt: null,
        provenance: {
          provider: "mock-delayed-ice",
          sourceName: "Mock delayed ICE Arabica C",
          sourceUrl: null,
          retrievedAt: FIXED_NOW,
          rawValue: 290,
          rawUnit: "US_CENTS_PER_LB",
          confidence: "MEDIUM",
        },
        diagnostics: [],
      },
    },
    previewCandidate: {
      cPrice: 290,
      demandIndex: 1.10,
      source: "API_FEED",
      note: null,
      validFrom: FIXED_NOW,
      expiresAt: null,
      provenance: {
        provider: "mock-delayed-ice",
        sourceName: "Mock delayed ICE Arabica C",
        sourceUrl: null,
        retrievedAt: FIXED_NOW,
        rawValue: 290,
        rawUnit: "US_CENTS_PER_LB",
        confidence: "MEDIUM",
      },
      diagnostics: [],
    },
    diagnostics: [],
    canApply: true,
    ...over,
  }
}

describe("buildMarketSignalTickFromProviderPreview", () => {

  it("builds a valid tick from a successful mock provider preview", () => {
    const r = buildMarketSignalTickFromProviderPreview(makePreview(), { now: FIXED_NOW })
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.equal(r.tick.providerId, "mock-delayed-ice")
    assert.equal(r.tick.providerKind, "MOCK")
    assert.equal(r.tick.cPrice, 290)
    assert.equal(r.tick.demandIndex, 1.10)
    assert.equal(r.tick.confidence, "MEDIUM")
    assert.equal(r.tick.rawUnit, "US_CENTS_PER_LB")
    assert.equal(r.tick.symbol, "KC*1")
    assert.equal(r.tick.sourceName, "Mock delayed ICE Arabica C")
    assert.ok(r.diagnostics.some((d) => d.code === "MST_TICK_VALID"))
  })

  it("rejects a preview with canApply=false", () => {
    const r = buildMarketSignalTickFromProviderPreview(
      makePreview({ canApply: false }),
      { now: FIXED_NOW },
    )
    assert.equal(r.ok, false)
    if (r.ok) return
    assert.ok(r.diagnostics.some((d) => d.code === "MST_PROVIDER_PREVIEW_NOT_APPLICABLE"))
  })

  it("rejects a missing preview", () => {
    const r = buildMarketSignalTickFromProviderPreview(null, { now: FIXED_NOW })
    assert.equal(r.ok, false)
    if (r.ok) return
    assert.ok(r.diagnostics.some((d) => d.code === "MST_PROVIDER_PREVIEW_INVALID"))
  })

  it("preserves providerId / kind / sourceName / confidence", () => {
    const r = buildMarketSignalTickFromProviderPreview(makePreview({
      provider: {
        id: "barchart-settlement-preview",
        label: "Barchart settlement / EOD preview",
        kind: "EXTERNAL_HTTP",
        description: "...",
        requiresApiKey: true,
        configured: true,
      },
    }), { now: FIXED_NOW })
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.equal(r.tick.providerId, "barchart-settlement-preview")
    assert.equal(r.tick.providerKind, "EXTERNAL_HTTP")
  })
})

// ------------------------------------------------------
// SANITISERS — STANDALONE
// ------------------------------------------------------

describe("sanitizeMarketSignalTickSourceUrl", () => {

  it("returns null for null/empty input without flagging changed", () => {
    const a = sanitizeMarketSignalTickSourceUrl(null)
    assert.equal(a.url, null)
    assert.equal(a.changed, false)

    const b = sanitizeMarketSignalTickSourceUrl("")
    assert.equal(b.url, null)
    assert.equal(b.changed, false)
  })

  it("returns null + changed=true for an unparseable URL", () => {
    const r = sanitizeMarketSignalTickSourceUrl("not a url")
    assert.equal(r.url, null)
    assert.equal(r.changed, true)
  })

  it("keeps allow-listed query params (symbols / fields)", () => {
    const r = sanitizeMarketSignalTickSourceUrl(
      "https://example.com/getQuote.json?symbols=KC*1&fields=lastPrice",
    )
    assert.ok(r.url)
    // The exact URL-encoding of '*' depends on the runtime; assert
    // the param name + a recognisable substring of the value.
    assert.ok(r.url!.includes("symbols="))
    assert.ok(r.url!.includes("KC"))
    assert.ok(r.url!.includes("fields=lastPrice"))
  })

  it("strips unknown / suspicious query params", () => {
    const r = sanitizeMarketSignalTickSourceUrl(
      "https://example.com/getQuote.json?apikey=KEY&symbols=KC*1&secret=ABC",
    )
    assert.ok(r.url)
    assert.equal(r.url!.includes("apikey"), false)
    assert.equal(r.url!.includes("secret"), false)
    assert.equal(r.changed, true)
  })
})

describe("sanitizeMarketSignalTickRawPayload", () => {

  it("redacts at any depth", () => {
    const r = sanitizeMarketSignalTickRawPayload({
      level1: {
        apiKey: "secret",
        items: [
          { token: "x", okField: "kept" },
          { Authorization: "Bearer y" },
        ],
      },
    })
    const s = JSON.stringify(r.value)
    assert.equal(s.includes("secret"), false)
    assert.equal(s.includes("Bearer y"), false)
    assert.equal(s.includes("\"x\""), false)
    assert.ok(s.includes("kept"))
    assert.ok(s.includes("[REDACTED]"))
    assert.equal(r.changed, true)
  })

  it("returns input unchanged when no secret-looking key is present", () => {
    const input = { a: 1, b: "two", nested: { c: [1, 2, 3] } }
    const r = sanitizeMarketSignalTickRawPayload(input)
    assert.deepEqual(r.value, input)
    assert.equal(r.changed, false)
  })

  it("handles primitives + nullish", () => {
    assert.deepEqual(sanitizeMarketSignalTickRawPayload(null), { value: null, changed: false })
    assert.deepEqual(sanitizeMarketSignalTickRawPayload(undefined), { value: undefined, changed: false })
    assert.deepEqual(sanitizeMarketSignalTickRawPayload(42), { value: 42, changed: false })
    assert.deepEqual(sanitizeMarketSignalTickRawPayload("hello"), { value: "hello", changed: false })
  })
})
