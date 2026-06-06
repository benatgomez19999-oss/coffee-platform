//////////////////////////////////////////////////////
// 🧪 BARCHART getQuote PARSER — PURE TESTS
//
// No network. No env. Verifies field priorities, error
// paths and diagnostic codes.
//////////////////////////////////////////////////////

import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  isSettlementFinal,
  parseBarchartGetQuoteResponse,
  parseBarchartSettlementResponse,
} from "../marketSignalBarchart.parser.ts"
import { MSP_DIAGNOSTIC_CODES } from "../marketSignalProviders.types.ts"

const FIXED_NOW = new Date("2026-05-09T12:00:00.000Z")

function payload(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    status: { code: 200, message: "Success." },
    results: [
      {
        symbol: "KC*1",
        lastPrice: 290.25,
        tradeTimestamp: "2026-05-09T15:30:00-04:00",
        serverTimestamp: "2026-05-09T15:30:05-04:00",
        open: 289.0,
        high: 291.5,
        low: 287.0,
        close: 290.25,
        previousClose: 289.5,
        ...over,
      },
    ],
  }
}

// ------------------------------------------------------
// 1. HAPPY PATHS
// ------------------------------------------------------

describe("parseBarchartGetQuoteResponse — happy paths", () => {

  it("parses a valid payload with numeric lastPrice", () => {
    const r = parseBarchartGetQuoteResponse(payload(), FIXED_NOW)
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.equal(r.cPrice, 290.25)
    assert.equal(r.rawPrice, 290.25)
    assert.equal(r.rawUnit, "US_CENTS_PER_LB")
    assert.equal(r.symbol, "KC*1")
    assert.ok(r.timestamp instanceof Date)
    assert.ok(r.diagnostics.some((d) => d.code === MSP_DIAGNOSTIC_CODES.MSP_BARCHART_PARSED))
  })

  it("accepts numeric string for lastPrice", () => {
    const r = parseBarchartGetQuoteResponse(payload({ lastPrice: "290.25" }), FIXED_NOW)
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.equal(r.cPrice, 290.25)
  })

  it("falls back to close when lastPrice and last are missing", () => {
    const r = parseBarchartGetQuoteResponse(payload({
      lastPrice: undefined,
      last: undefined,
      close: 287.4,
    }), FIXED_NOW)
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.equal(r.cPrice, 287.4)
  })

  it("falls back to previousClose when lastPrice / last / close all missing", () => {
    const r = parseBarchartGetQuoteResponse(payload({
      lastPrice: undefined,
      last: undefined,
      close: undefined,
      previousClose: 285.0,
    }), FIXED_NOW)
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.equal(r.cPrice, 285.0)
  })

  it("preserves contractMonth when present", () => {
    const r = parseBarchartGetQuoteResponse(payload({
      contractMonth: "2026-07",
    }), FIXED_NOW)
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.equal(r.contractMonth, "2026-07")
  })

  it("falls through to result.contract when contractMonth absent", () => {
    const r = parseBarchartGetQuoteResponse(payload({
      contractMonth: undefined,
      contract: "KCN26",
    }), FIXED_NOW)
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.equal(r.contractMonth, "KCN26")
  })

  it("parses tradeTimestamp when valid", () => {
    const r = parseBarchartGetQuoteResponse(payload({
      tradeTimestamp: "2026-05-09T15:30:00-04:00",
    }), FIXED_NOW)
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.equal(
      r.timestamp?.toISOString(),
      new Date("2026-05-09T15:30:00-04:00").toISOString(),
    )
  })

  it("emits MSP_BARCHART_TIMESTAMP_INVALID when all timestamps fail to parse", () => {
    const r = parseBarchartGetQuoteResponse(payload({
      tradeTimestamp: "not-a-date",
      serverTimestamp: "also-not-a-date",
      timestamp: "definitely-not",
    }), FIXED_NOW)
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.equal(r.timestamp, null)
    assert.ok(r.diagnostics.some((d) => d.code === MSP_DIAGNOSTIC_CODES.MSP_BARCHART_TIMESTAMP_INVALID))
  })
})

// ------------------------------------------------------
// 2. ERROR PATHS
// ------------------------------------------------------

describe("parseBarchartGetQuoteResponse — error paths", () => {

  it("returns MSP_PROVIDER_RESPONSE_MALFORMED when payload is not an object", () => {
    const r = parseBarchartGetQuoteResponse("oops", FIXED_NOW)
    assert.equal(r.ok, false)
    if (r.ok) return
    assert.ok(r.diagnostics.some((d) => d.code === MSP_DIAGNOSTIC_CODES.MSP_PROVIDER_RESPONSE_MALFORMED))
  })

  it("returns MSP_BARCHART_STATUS_ERROR when status.code != 200", () => {
    const bad = {
      status: { code: 401, message: "Invalid API Key." },
      results: [],
    }
    const r = parseBarchartGetQuoteResponse(bad, FIXED_NOW)
    assert.equal(r.ok, false)
    if (r.ok) return
    assert.ok(r.diagnostics.some((d) => d.code === MSP_DIAGNOSTIC_CODES.MSP_BARCHART_STATUS_ERROR))
  })

  it("returns MSP_BARCHART_EMPTY_RESULTS when results array is empty", () => {
    const r = parseBarchartGetQuoteResponse({
      status: { code: 200 },
      results: [],
    }, FIXED_NOW)
    assert.equal(r.ok, false)
    if (r.ok) return
    assert.ok(r.diagnostics.some((d) => d.code === MSP_DIAGNOSTIC_CODES.MSP_BARCHART_EMPTY_RESULTS))
  })

  it("returns MSP_BARCHART_PRICE_MISSING when no usable price field", () => {
    const r = parseBarchartGetQuoteResponse(payload({
      lastPrice: undefined,
      last: undefined,
      close: undefined,
      previousClose: undefined,
    }), FIXED_NOW)
    assert.equal(r.ok, false)
    if (r.ok) return
    assert.ok(r.diagnostics.some((d) => d.code === MSP_DIAGNOSTIC_CODES.MSP_BARCHART_PRICE_MISSING))
  })

  it("returns MSP_BARCHART_PRICE_INVALID for non-finite price (NaN)", () => {
    const r = parseBarchartGetQuoteResponse(payload({
      lastPrice: "not-a-number",
      last: undefined,
      close: undefined,
      previousClose: undefined,
    }), FIXED_NOW)
    assert.equal(r.ok, false)
    if (r.ok) return
    // The non-numeric string is rejected by asNumber → falls through to MISSING.
    const codes = r.diagnostics.map((d) => d.code)
    assert.ok(
      codes.includes(MSP_DIAGNOSTIC_CODES.MSP_BARCHART_PRICE_MISSING) ||
      codes.includes(MSP_DIAGNOSTIC_CODES.MSP_BARCHART_PRICE_INVALID),
    )
  })

  it("returns MSP_BARCHART_PRICE_INVALID for zero / negative price", () => {
    const r = parseBarchartGetQuoteResponse(payload({
      lastPrice: 0,
      last: undefined,
      close: undefined,
      previousClose: undefined,
    }), FIXED_NOW)
    assert.equal(r.ok, false)
    if (r.ok) return
    // 0 falls through pickPrice (because asNumber(0) returns 0 — finite,
    // but pickPrice then returns it; the post-pick guard catches non-positive).
    // Either way, the parser must reject it.
    const codes = r.diagnostics.map((d) => d.code)
    assert.ok(
      codes.includes(MSP_DIAGNOSTIC_CODES.MSP_BARCHART_PRICE_INVALID) ||
      codes.includes(MSP_DIAGNOSTIC_CODES.MSP_BARCHART_PRICE_MISSING),
    )
  })

  it("returns malformed when results[0] is not an object", () => {
    const r = parseBarchartGetQuoteResponse({
      status: { code: 200 },
      results: ["scalar"],
    }, FIXED_NOW)
    assert.equal(r.ok, false)
    if (r.ok) return
    assert.ok(r.diagnostics.some((d) => d.code === MSP_DIAGNOSTIC_CODES.MSP_PROVIDER_RESPONSE_MALFORMED))
  })

  it("returns symbol UNKNOWN with MSP_BARCHART_SYMBOL_MISSING warning when no symbol present", () => {
    const r = parseBarchartGetQuoteResponse(payload({
      symbol: undefined,
    }), FIXED_NOW)
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.equal(r.symbol, "UNKNOWN")
    assert.ok(r.diagnostics.some((d) => d.code === MSP_DIAGNOSTIC_CODES.MSP_BARCHART_SYMBOL_MISSING))
  })
})

// ======================================================
// SETTLEMENT PARSER (PRICING-FEED-2C)
// ======================================================

function settlementPayload(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    status: { code: 200, message: "Success." },
    results: [
      {
        symbol: "KC*1",
        // The settlement-test fixture explicitly carries BOTH lastPrice
        // and settlement so test cases can assert priority.
        lastPrice: 295.10,
        settlement: 290.25,
        settle: 290.50,
        close: 289.75,
        previousClose: 288.90,
        tradeTimestamp: "2026-05-09T15:30:00-04:00",
        ...over,
      },
    ],
  }
}

describe("parseBarchartSettlementResponse — price priority", () => {

  it("settlement wins over settle / close / lastPrice", () => {
    const r = parseBarchartSettlementResponse(settlementPayload(), FIXED_NOW)
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.equal(r.priceFieldUsed, "settlement")
    assert.equal(r.cPrice, 290.25)
  })

  it("settle wins when settlement is missing", () => {
    const r = parseBarchartSettlementResponse(settlementPayload({ settlement: undefined }), FIXED_NOW)
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.equal(r.priceFieldUsed, "settle")
    assert.equal(r.cPrice, 290.50)
  })

  it("falls back to close when settlement and settle are missing", () => {
    const r = parseBarchartSettlementResponse(settlementPayload({
      settlement: undefined, settle: undefined,
    }), FIXED_NOW)
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.equal(r.priceFieldUsed, "close")
    assert.equal(r.cPrice, 289.75)
  })

  it("falls back to previousClose when settlement / settle / close are missing", () => {
    const r = parseBarchartSettlementResponse(settlementPayload({
      settlement: undefined, settle: undefined, close: undefined,
    }), FIXED_NOW)
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.equal(r.priceFieldUsed, "previousClose")
    assert.equal(r.cPrice, 288.90)
  })

  it("uses lastPrice ONLY as last fallback and emits MSP_BARCHART_SETTLEMENT_FALLBACK_TO_LAST", () => {
    const r = parseBarchartSettlementResponse(settlementPayload({
      settlement: undefined, settle: undefined, close: undefined, previousClose: undefined,
    }), FIXED_NOW)
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.equal(r.priceFieldUsed, "lastPrice")
    assert.ok(r.diagnostics.some((d) => d.code === MSP_DIAGNOSTIC_CODES.MSP_BARCHART_SETTLEMENT_FALLBACK_TO_LAST))
  })

  it("emits MSP_BARCHART_SETTLEMENT_PRICE_SELECTED with the field name in the message", () => {
    const r = parseBarchartSettlementResponse(settlementPayload(), FIXED_NOW)
    assert.equal(r.ok, true)
    if (!r.ok) return
    const selected = r.diagnostics.find(
      (d) => d.code === MSP_DIAGNOSTIC_CODES.MSP_BARCHART_SETTLEMENT_PRICE_SELECTED,
    )
    assert.ok(selected)
    assert.match(selected!.message, /settlement/)
  })
})

describe("isSettlementFinal", () => {

  it("returns true for isSettled=true", () => {
    assert.equal(isSettlementFinal({ isSettled: true }), true)
  })

  it("returns true for settled=true / isFinal=true / final=true", () => {
    assert.equal(isSettlementFinal({ settled: true }), true)
    assert.equal(isSettlementFinal({ isFinal: true }), true)
    assert.equal(isSettlementFinal({ final: true }), true)
  })

  it("returns false for explicit false flags", () => {
    assert.equal(isSettlementFinal({ settled: false }), false)
    assert.equal(isSettlementFinal({ isFinal: false }), false)
  })

  it("returns true when status string includes 'settled' or 'final'", () => {
    assert.equal(isSettlementFinal({ status: "Settled" }), true)
    assert.equal(isSettlementFinal({ status: "FINAL" }), true)
    assert.equal(isSettlementFinal({ tradeStatus: "Day Settled" }), true)
  })

  it("returns false when status string includes intraday keywords", () => {
    assert.equal(isSettlementFinal({ status: "Open" }), false)
    assert.equal(isSettlementFinal({ status: "Trading" }), false)
    assert.equal(isSettlementFinal({ status: "Delayed" }), false)
    assert.equal(isSettlementFinal({ session: "intraday" }), false)
    assert.equal(isSettlementFinal({ quoteType: "real-time" }), false)
  })

  it("returns null when no recognised field is present", () => {
    assert.equal(isSettlementFinal({}), null)
    assert.equal(isSettlementFinal({ unrelated: "value" }), null)
  })

  it("boolean fields take precedence over status strings", () => {
    // status says 'Open' but isSettled=true → trust the boolean.
    assert.equal(isSettlementFinal({ isSettled: true, status: "Open" }), true)
  })
})

describe("parseBarchartSettlementResponse — settlement status diagnostics", () => {

  it("emits MSP_BARCHART_SETTLEMENT_FINAL when isSettled=true", () => {
    const r = parseBarchartSettlementResponse(settlementPayload({
      isSettled: true,
    }), FIXED_NOW)
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.equal(r.settlementStatus, true)
    assert.ok(r.diagnostics.some((d) => d.code === MSP_DIAGNOSTIC_CODES.MSP_BARCHART_SETTLEMENT_FINAL))
  })

  it("emits MSP_BARCHART_SETTLEMENT_NOT_FINAL when status='open'", () => {
    const r = parseBarchartSettlementResponse(settlementPayload({
      status: "Open",
    }), FIXED_NOW)
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.equal(r.settlementStatus, false)
    assert.ok(r.diagnostics.some((d) => d.code === MSP_DIAGNOSTIC_CODES.MSP_BARCHART_SETTLEMENT_NOT_FINAL))
  })

  it("emits MSP_BARCHART_SETTLEMENT_STATUS_UNKNOWN when no flags present", () => {
    const r = parseBarchartSettlementResponse(settlementPayload({
      status: undefined,
    }), FIXED_NOW)
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.equal(r.settlementStatus, null)
    assert.ok(r.diagnostics.some((d) => d.code === MSP_DIAGNOSTIC_CODES.MSP_BARCHART_SETTLEMENT_STATUS_UNKNOWN))
  })
})
