//////////////////////////////////////////////////////
// 🧪 MARKET SIGNAL TICK INSPECTOR — PURE TESTS
//
// Pure tests for the read-only inspector formatters.
// No Prisma, no HTTP.
//////////////////////////////////////////////////////

import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  buildMarketSignalTickInspectionFromRow,
  detectKnownSecretKeys,
  serialiseMarketSignalTickInspection,
  validateMarketSignalTickInspectionId,
  type MarketSignalTickInspectionRow,
} from "../marketSignalTickInspection.pure.ts"

const FIXED_NOW = new Date("2026-05-10T12:00:00.000Z")
const CAPTURED = new Date("2026-05-10T11:55:00.000Z")
const VALID_FROM = new Date("2026-05-10T11:00:00.000Z")
const EXPIRES_AT = new Date("2026-05-11T11:00:00.000Z")
const CREATED_AT = new Date("2026-05-10T11:55:00.123Z")

function row(over: Partial<MarketSignalTickInspectionRow> = {}): MarketSignalTickInspectionRow {
  return {
    id: "tick-1",
    providerId: "barchart-preview",
    providerKind: "EXTERNAL_HTTP",
    source: "API_FEED",
    cPrice: 290.25,
    demandIndex: 1.10,
    confidence: "HIGH",
    rawUnit: "US_CENTS_PER_LB",
    rawValue: 290.25,
    symbol: "KC*1",
    contractMonth: null,
    capturedAt: CAPTURED,
    validFrom: VALID_FROM,
    expiresAt: EXPIRES_AT,
    sourceName: "Barchart OnDemand getQuote KC*1",
    sourceUrl: "https://ondemand.websol.barchart.com/getQuote.json?symbols=KC*1",
    note: "Barchart preview · KC*1",
    diagnostics: [],
    rawPayload: { symbol: "KC*1", lastPrice: 290.25, status: 200 },
    createdAt: CREATED_AT,
    ...over,
  }
}

// ------------------------------------------------------
// 1. ID VALIDATION
// ------------------------------------------------------

describe("validateMarketSignalTickInspectionId", () => {

  it("rejects non-string", () => {
    assert.equal(validateMarketSignalTickInspectionId(42).ok, false)
    assert.equal(validateMarketSignalTickInspectionId(null).ok, false)
    assert.equal(validateMarketSignalTickInspectionId(undefined).ok, false)
  })

  it("rejects empty / whitespace-only string", () => {
    assert.equal(validateMarketSignalTickInspectionId("").ok, false)
    assert.equal(validateMarketSignalTickInspectionId("   ").ok, false)
  })

  it("accepts a trimmed non-empty string", () => {
    const r = validateMarketSignalTickInspectionId("  abc123  ")
    assert.equal(r.ok, true)
    assert.equal(r.id, "abc123")
  })
})

// ------------------------------------------------------
// 2. SECRET KEY DETECTOR (read-only)
// ------------------------------------------------------

describe("detectKnownSecretKeys", () => {

  it("returns false for null / undefined / primitives", () => {
    assert.equal(detectKnownSecretKeys(null), false)
    assert.equal(detectKnownSecretKeys(undefined), false)
    assert.equal(detectKnownSecretKeys(42), false)
    assert.equal(detectKnownSecretKeys("hello"), false)
  })

  it("returns false for clean payloads", () => {
    assert.equal(
      detectKnownSecretKeys({ symbol: "KC*1", lastPrice: 290.25 }),
      false,
    )
  })

  it("returns true when apiKey is present at any depth", () => {
    assert.equal(detectKnownSecretKeys({ apiKey: "secret" }), true)
    assert.equal(
      detectKnownSecretKeys({ nested: { deep: { apiKey: "x" } } }),
      true,
    )
    assert.equal(
      detectKnownSecretKeys([{ ok: 1 }, { ok: 2 }, { token: "x" }]),
      true,
    )
  })

  it("matches case-insensitively and on substrings", () => {
    assert.equal(detectKnownSecretKeys({ Authorization: "Bearer x" }), true)
    assert.equal(detectKnownSecretKeys({ MY_APIKEY: "x" }), true)
    assert.equal(detectKnownSecretKeys({ user_secret: "x" }), true)
  })
})

// ------------------------------------------------------
// 3. SERIALISER (dates → ISO)
// ------------------------------------------------------

describe("serialiseMarketSignalTickInspection", () => {

  it("serialises every core field with ISO dates", () => {
    const out = serialiseMarketSignalTickInspection(row())
    assert.equal(out.id, "tick-1")
    assert.equal(out.providerId, "barchart-preview")
    assert.equal(out.providerKind, "EXTERNAL_HTTP")
    assert.equal(out.source, "API_FEED")
    assert.equal(out.cPrice, 290.25)
    assert.equal(out.demandIndex, 1.10)
    assert.equal(out.confidence, "HIGH")
    assert.equal(out.rawUnit, "US_CENTS_PER_LB")
    assert.equal(out.rawValue, 290.25)
    assert.equal(out.symbol, "KC*1")
    assert.equal(out.contractMonth, null)
    assert.equal(out.capturedAt, CAPTURED.toISOString())
    assert.equal(out.validFrom, VALID_FROM.toISOString())
    assert.equal(out.expiresAt, EXPIRES_AT.toISOString())
    assert.equal(out.createdAt, CREATED_AT.toISOString())
    assert.equal(out.sourceName, "Barchart OnDemand getQuote KC*1")
    assert.equal(out.note, "Barchart preview · KC*1")
  })

  it("accepts pre-stringified ISO dates and round-trips them", () => {
    const out = serialiseMarketSignalTickInspection(row({
      capturedAt: CAPTURED.toISOString(),
      validFrom: VALID_FROM.toISOString(),
      expiresAt: null,
      createdAt: CREATED_AT.toISOString(),
    }))
    assert.equal(out.capturedAt, CAPTURED.toISOString())
    assert.equal(out.validFrom, VALID_FROM.toISOString())
    assert.equal(out.expiresAt, null)
    assert.equal(out.createdAt, CREATED_AT.toISOString())
  })
})

// ------------------------------------------------------
// 4. MAIN BUILDER
// ------------------------------------------------------

describe("buildMarketSignalTickInspectionFromRow", () => {

  it("returns MST_TICK_NOT_FOUND for null row", () => {
    const r = buildMarketSignalTickInspectionFromRow(null, { now: FIXED_NOW })
    assert.equal(r.ok, false)
    if (r.ok) return
    assert.equal(r.error.code, "MST_TICK_NOT_FOUND")
    assert.equal(r.generatedAt, FIXED_NOW.toISOString())
  })

  it("serialises a clean row with safety all-false", () => {
    const r = buildMarketSignalTickInspectionFromRow(row(), { now: FIXED_NOW })
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.equal(r.tick.id, "tick-1")
    assert.equal(r.tick.cPrice, 290.25)
    assert.equal(r.safety.rawPayloadSanitised, false)
    assert.equal(r.safety.sourceUrlSanitised, false)
    assert.equal(r.safety.containsKnownSecretKeys, false)
  })

  it("rawPayload is sanitised on read when payload contains secret-looking keys", () => {
    const r = buildMarketSignalTickInspectionFromRow(row({
      rawPayload: {
        symbol: "KC*1",
        apiKey: "very-secret-on-read",
        nested: { token: "abc" },
      },
    }), { now: FIXED_NOW })
    assert.equal(r.ok, true)
    if (!r.ok) return
    const stringified = JSON.stringify(r.tick.rawPayload)
    assert.equal(stringified.includes("very-secret-on-read"), false)
    assert.equal(stringified.includes("\"abc\""), false)
    assert.ok(stringified.includes("[REDACTED]"))
    assert.equal(r.safety.rawPayloadSanitised, true)
    assert.equal(r.safety.containsKnownSecretKeys, true)
  })

  it("sourceUrl is sanitised on read when query carries an apikey", () => {
    const r = buildMarketSignalTickInspectionFromRow(row({
      sourceUrl: "https://example.com/getQuote.json?apikey=very-secret&symbols=KC*1",
    }), { now: FIXED_NOW })
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.ok(r.tick.sourceUrl)
    assert.equal(r.tick.sourceUrl!.includes("very-secret"), false)
    assert.equal(r.tick.sourceUrl!.includes("apikey"), false)
    assert.equal(r.safety.sourceUrlSanitised, true)
  })

  it("diagnostics blob is also scrubbed", () => {
    const r = buildMarketSignalTickInspectionFromRow(row({
      diagnostics: { warnings: [{ token: "leak" }], note: "ok" },
    }), { now: FIXED_NOW })
    assert.equal(r.ok, true)
    if (!r.ok) return
    const stringified = JSON.stringify(r.tick.diagnostics)
    assert.equal(stringified.includes("\"leak\""), false)
    assert.ok(stringified.includes("[REDACTED]"))
    assert.equal(r.safety.rawPayloadSanitised, true)
  })

  it("does NOT mutate the input row", () => {
    const original = row({
      rawPayload: { apiKey: "x" },
      sourceUrl: "https://example.com/q?apikey=x&symbols=KC*1",
      diagnostics: { token: "y" },
    })
    const beforeRaw = JSON.stringify(original.rawPayload)
    const beforeUrl = original.sourceUrl
    const beforeDiag = JSON.stringify(original.diagnostics)
    buildMarketSignalTickInspectionFromRow(original, { now: FIXED_NOW })
    assert.equal(JSON.stringify(original.rawPayload), beforeRaw)
    assert.equal(original.sourceUrl, beforeUrl)
    assert.equal(JSON.stringify(original.diagnostics), beforeDiag)
  })

  it("preserves clean diagnostics array verbatim", () => {
    const diag = [{ code: "MSP_BARCHART_PARSED", severity: "info", message: "ok" }]
    const r = buildMarketSignalTickInspectionFromRow(row({ diagnostics: diag }), { now: FIXED_NOW })
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.deepEqual(r.tick.diagnostics, diag)
  })

  it("preserves null sourceUrl + payload through to the inspection result", () => {
    const r = buildMarketSignalTickInspectionFromRow(row({
      sourceUrl: null,
      rawPayload: null,
      diagnostics: null,
    }), { now: FIXED_NOW })
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.equal(r.tick.sourceUrl, null)
    assert.equal(r.tick.rawPayload, null)
    assert.equal(r.tick.diagnostics, null)
    assert.equal(r.safety.rawPayloadSanitised, false)
    assert.equal(r.safety.sourceUrlSanitised, false)
    assert.equal(r.safety.containsKnownSecretKeys, false)
  })

  it("serialises dates to ISO consistently (capturedAt / validFrom / expiresAt / createdAt)", () => {
    const r = buildMarketSignalTickInspectionFromRow(row(), { now: FIXED_NOW })
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.equal(r.tick.capturedAt, CAPTURED.toISOString())
    assert.equal(r.tick.validFrom, VALID_FROM.toISOString())
    assert.equal(r.tick.expiresAt, EXPIRES_AT.toISOString())
    assert.equal(r.tick.createdAt, CREATED_AT.toISOString())
  })

  // Per spec: "no update/delete paths exist in helper."
  it("module surface is read-only — no update/delete exports", async () => {
    const mod = await import("../marketSignalTickInspection.pure.ts")
    const exportedNames = Object.keys(mod)
    for (const forbidden of ["update", "delete", "remove", "patch", "applyTickInspection", "mutateTickInspection"]) {
      assert.equal(
        exportedNames.some((n) => n.toLowerCase().includes(forbidden)),
        false,
        `${forbidden} should not appear in inspector module exports`,
      )
    }
  })
})
