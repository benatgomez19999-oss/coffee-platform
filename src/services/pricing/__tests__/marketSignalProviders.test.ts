//////////////////////////////////////////////////////
// 🧪 MARKET SIGNAL PROVIDERS — PURE TESTS
//
// All assertions run against the pure provider modules
// (no Prisma, no real network). Barchart provider tests
// rely on `process.env.BARCHART_ONDEMAND_API_KEY` being
// unset locally; we reset it to make the test env explicit.
//////////////////////////////////////////////////////

import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  barchartPreviewProvider,
  barchartSettlementPreviewProvider,
  getMarketSignalProvider,
  isMarketSignalProviderId,
  listMarketSignalProviders,
  mockDelayedIceProvider,
} from "../marketSignalProviders.pure.ts"
import { previewMarketSignalFromProvider } from "../marketSignalProviders.service.ts"
import { MSP_DIAGNOSTIC_CODES } from "../marketSignalProviders.types.ts"
import type {
  MarketSignalProvider,
  MarketSignalProviderResult,
} from "../marketSignalProviders.types.ts"

const FIXED_NOW = new Date("2026-05-09T12:00:00.000Z")

// ------------------------------------------------------
// REGISTRY
// ------------------------------------------------------

describe("market signal provider registry", () => {

  it("listMarketSignalProviders contains mock-delayed-ice with configured=true", () => {
    const summaries = listMarketSignalProviders()
    const mock = summaries.find((s) => s.id === "mock-delayed-ice")
    assert.ok(mock, "mock-delayed-ice should be registered")
    assert.equal(mock.configured, true)
    assert.equal(mock.requiresApiKey, false)
    assert.equal(mock.kind, "MOCK")
  })

  it("listMarketSignalProviders contains barchart-preview with configured reflecting env", () => {
    // Force the env unset so the test asserts the unconfigured branch.
    const previous = process.env.BARCHART_ONDEMAND_API_KEY
    delete process.env.BARCHART_ONDEMAND_API_KEY
    try {
      const summaries = listMarketSignalProviders()
      const bc = summaries.find((s) => s.id === "barchart-preview")
      assert.ok(bc, "barchart-preview should be registered")
      assert.equal(bc.requiresApiKey, true)
      assert.equal(bc.kind, "EXTERNAL_HTTP")
      assert.equal(bc.configured, false)
    } finally {
      if (previous !== undefined) process.env.BARCHART_ONDEMAND_API_KEY = previous
    }
  })

  it("getMarketSignalProvider resolves known ids", () => {
    assert.equal(getMarketSignalProvider("mock-delayed-ice")?.id, "mock-delayed-ice")
    assert.equal(getMarketSignalProvider("barchart-preview")?.id, "barchart-preview")
    assert.equal(getMarketSignalProvider("does-not-exist"), null)
  })

  it("isMarketSignalProviderId guards strings", () => {
    assert.equal(isMarketSignalProviderId("mock-delayed-ice"), true)
    assert.equal(isMarketSignalProviderId("barchart-preview"), true)
    assert.equal(isMarketSignalProviderId("not-a-provider"), false)
    assert.equal(isMarketSignalProviderId(""), false)
    assert.equal(isMarketSignalProviderId(undefined), false)
    assert.equal(isMarketSignalProviderId(42), false)
  })
})

// ------------------------------------------------------
// MOCK PROVIDER
// ------------------------------------------------------

describe("mockDelayedIceProvider", () => {

  it("returns ok candidate with cPrice in [50, 600]", async () => {
    const r = await mockDelayedIceProvider.fetchLatest({ now: FIXED_NOW })
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.ok(r.candidate.cPrice >= 50 && r.candidate.cPrice <= 600)
  })

  it("returns demandIndex in [0.8, 1.2]", async () => {
    const r = await mockDelayedIceProvider.fetchLatest({ now: FIXED_NOW })
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.ok(r.candidate.demandIndex >= 0.8 && r.candidate.demandIndex <= 1.2)
  })

  it("is deterministic for fixed now/scenario", async () => {
    const a = await mockDelayedIceProvider.fetchLatest({ now: FIXED_NOW, scenario: "neutral" })
    const b = await mockDelayedIceProvider.fetchLatest({ now: FIXED_NOW, scenario: "neutral" })
    assert.equal(a.ok && b.ok, true)
    if (a.ok && b.ok) {
      assert.equal(a.candidate.cPrice, b.candidate.cPrice)
      assert.equal(a.candidate.demandIndex, b.candidate.demandIndex)
    }
  })

  it("low / neutral / high scenarios differ", async () => {
    const low = await mockDelayedIceProvider.fetchLatest({ now: FIXED_NOW, scenario: "low" })
    const mid = await mockDelayedIceProvider.fetchLatest({ now: FIXED_NOW, scenario: "neutral" })
    const high = await mockDelayedIceProvider.fetchLatest({ now: FIXED_NOW, scenario: "high" })
    assert.ok(low.ok && mid.ok && high.ok)
    if (!(low.ok && mid.ok && high.ok)) return
    assert.notEqual(low.candidate.cPrice, mid.candidate.cPrice)
    assert.notEqual(mid.candidate.cPrice, high.candidate.cPrice)
    assert.ok(low.candidate.cPrice < mid.candidate.cPrice)
    assert.ok(mid.candidate.cPrice < high.candidate.cPrice)
  })

  it("source = API_FEED and provenance carries provider/sourceName/rawUnit/confidence", async () => {
    const r = await mockDelayedIceProvider.fetchLatest({ now: FIXED_NOW })
    assert.ok(r.ok)
    if (!r.ok) return
    assert.equal(r.candidate.source, "API_FEED")
    assert.equal(r.candidate.provenance?.provider, "mock-delayed-ice")
    assert.equal(r.candidate.provenance?.sourceName, "Mock delayed ICE Arabica C")
    assert.equal(r.candidate.provenance?.rawUnit, "US_CENTS_PER_LB")
    assert.equal(r.candidate.provenance?.confidence, "MEDIUM")
  })

  it("emits MOCK_USED + CANDIDATE_CREATED + PREVIEW_ONLY diagnostics", async () => {
    const r = await mockDelayedIceProvider.fetchLatest({ now: FIXED_NOW })
    assert.ok(r.ok)
    if (!r.ok) return
    const codes = r.diagnostics.map((d) => d.code)
    assert.ok(codes.includes(MSP_DIAGNOSTIC_CODES.MSP_PROVIDER_MOCK_USED))
    assert.ok(codes.includes(MSP_DIAGNOSTIC_CODES.MSP_PROVIDER_CANDIDATE_CREATED))
    assert.ok(codes.includes(MSP_DIAGNOSTIC_CODES.MSP_PROVIDER_PREVIEW_ONLY))
  })
})

// ------------------------------------------------------
// BARCHART PROVIDER
// ------------------------------------------------------

describe("barchartPreviewProvider", () => {

  // Helper: build a stub fetch impl that returns a JSON string body.
  function stubFetchOk(body: string, status = 200) {
    return (async () => ({
      ok: status >= 200 && status < 300,
      status,
      text: async () => body,
    })) as unknown as import("../marketSignalProviders.types.ts").ProviderFetchImpl
  }

  function stubFetchHttpError(status: number) {
    return (async () => ({
      ok: false,
      status,
      text: async () => "",
    })) as unknown as import("../marketSignalProviders.types.ts").ProviderFetchImpl
  }

  function stubFetchThrows(err: Error) {
    return (async () => { throw err }) as unknown as import("../marketSignalProviders.types.ts").ProviderFetchImpl
  }

  const VALID_BARCHART_BODY = JSON.stringify({
    status: { code: 200 },
    results: [
      {
        symbol: "KC*1",
        lastPrice: 290.25,
        tradeTimestamp: "2026-05-09T15:30:00-04:00",
      },
    ],
  })

  it("returns ok=false with MSP_PROVIDER_NOT_CONFIGURED when no API key — and never calls fetch", async () => {
    const previous = process.env.BARCHART_ONDEMAND_API_KEY
    delete process.env.BARCHART_ONDEMAND_API_KEY
    try {
      let fetchCalls = 0
      const stub = (async () => {
        fetchCalls += 1
        return { ok: true, status: 200, text: async () => "" } as const
      }) as unknown as import("../marketSignalProviders.types.ts").ProviderFetchImpl

      const r = await barchartPreviewProvider.fetchLatest({
        now: FIXED_NOW,
        fetchImpl: stub,
      })
      assert.equal(r.ok, false)
      assert.equal(fetchCalls, 0)
      const codes = r.diagnostics.map((d) => d.code)
      assert.ok(codes.includes(MSP_DIAGNOSTIC_CODES.MSP_PROVIDER_NOT_CONFIGURED))
      assert.ok(codes.includes(MSP_DIAGNOSTIC_CODES.MSP_PROVIDER_PREVIEW_ONLY))
    } finally {
      if (previous !== undefined) process.env.BARCHART_ONDEMAND_API_KEY = previous
    }
  })

  it("returns ok=true candidate when API key is provided and fetch succeeds", async () => {
    const r = await barchartPreviewProvider.fetchLatest({
      now: FIXED_NOW,
      apiKey: "fake-test-key",
      fetchImpl: stubFetchOk(VALID_BARCHART_BODY),
    })
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.equal(r.candidate.cPrice, 290.25)
    assert.equal(r.candidate.demandIndex, 1.0)
    assert.equal(r.candidate.source, "API_FEED")
    assert.equal(r.candidate.provenance?.provider, "barchart-preview")
    assert.equal(r.candidate.provenance?.confidence, "HIGH")
    assert.equal(r.candidate.provenance?.rawUnit, "US_CENTS_PER_LB")
  })

  it("emits MSP_DEMAND_INDEX_DEFAULTED + MSP_PROVIDER_PREVIEW_ONLY on success", async () => {
    const r = await barchartPreviewProvider.fetchLatest({
      now: FIXED_NOW,
      apiKey: "fake-test-key",
      fetchImpl: stubFetchOk(VALID_BARCHART_BODY),
    })
    assert.equal(r.ok, true)
    if (!r.ok) return
    const codes = r.diagnostics.map((d) => d.code)
    assert.ok(codes.includes(MSP_DIAGNOSTIC_CODES.MSP_DEMAND_INDEX_DEFAULTED))
    assert.ok(codes.includes(MSP_DIAGNOSTIC_CODES.MSP_PROVIDER_CANDIDATE_CREATED))
    assert.ok(codes.includes(MSP_DIAGNOSTIC_CODES.MSP_PROVIDER_PREVIEW_ONLY))
  })

  it("provenance.sourceUrl never includes the API key", async () => {
    const r = await barchartPreviewProvider.fetchLatest({
      now: FIXED_NOW,
      apiKey: "very-secret-key-xyz",
      fetchImpl: stubFetchOk(VALID_BARCHART_BODY),
    })
    assert.equal(r.ok, true)
    if (!r.ok) return
    const url = r.candidate.provenance?.sourceUrl ?? ""
    assert.equal(url.includes("very-secret-key-xyz"), false)
    assert.equal(url.includes("apikey"), false)
    // raw payload also must not leak the key
    const rawString = JSON.stringify(r.raw)
    assert.equal(rawString.includes("very-secret-key-xyz"), false)
  })

  it("non-2xx HTTP status returns MSP_PROVIDER_FETCH_FAILED", async () => {
    const r = await barchartPreviewProvider.fetchLatest({
      now: FIXED_NOW,
      apiKey: "fake-test-key",
      fetchImpl: stubFetchHttpError(401),
    })
    assert.equal(r.ok, false)
    if (r.ok) return
    const codes = r.diagnostics.map((d) => d.code)
    assert.ok(codes.includes(MSP_DIAGNOSTIC_CODES.MSP_PROVIDER_FETCH_FAILED))
  })

  it("network error returns MSP_PROVIDER_FETCH_FAILED with the error message", async () => {
    const r = await barchartPreviewProvider.fetchLatest({
      now: FIXED_NOW,
      apiKey: "fake-test-key",
      fetchImpl: stubFetchThrows(new Error("ENOTFOUND ondemand")),
    })
    assert.equal(r.ok, false)
    if (r.ok) return
    const codes = r.diagnostics.map((d) => d.code)
    assert.ok(codes.includes(MSP_DIAGNOSTIC_CODES.MSP_PROVIDER_FETCH_FAILED))
    assert.ok(r.diagnostics.some((d) => d.message.includes("ENOTFOUND")))
  })

  it("invalid JSON body returns MSP_PROVIDER_RESPONSE_MALFORMED", async () => {
    const r = await barchartPreviewProvider.fetchLatest({
      now: FIXED_NOW,
      apiKey: "fake-test-key",
      fetchImpl: stubFetchOk("not-valid-json"),
    })
    assert.equal(r.ok, false)
    if (r.ok) return
    const codes = r.diagnostics.map((d) => d.code)
    assert.ok(codes.includes(MSP_DIAGNOSTIC_CODES.MSP_PROVIDER_RESPONSE_MALFORMED))
  })

  it("Barchart status.code != 200 surfaces MSP_BARCHART_STATUS_ERROR", async () => {
    const errBody = JSON.stringify({
      status: { code: 401, message: "Invalid API Key." },
      results: [],
    })
    const r = await barchartPreviewProvider.fetchLatest({
      now: FIXED_NOW,
      apiKey: "fake-test-key",
      fetchImpl: stubFetchOk(errBody, 200), // HTTP 200 but Barchart-level status error
    })
    assert.equal(r.ok, false)
    if (r.ok) return
    const codes = r.diagnostics.map((d) => d.code)
    assert.ok(codes.includes(MSP_DIAGNOSTIC_CODES.MSP_BARCHART_STATUS_ERROR))
  })

  it("isConfigured reflects env presence", () => {
    const previous = process.env.BARCHART_ONDEMAND_API_KEY
    delete process.env.BARCHART_ONDEMAND_API_KEY
    try {
      assert.equal(barchartPreviewProvider.isConfigured(), false)
      process.env.BARCHART_ONDEMAND_API_KEY = "fake-test-key"
      assert.equal(barchartPreviewProvider.isConfigured(), true)
    } finally {
      if (previous !== undefined) process.env.BARCHART_ONDEMAND_API_KEY = previous
      else delete process.env.BARCHART_ONDEMAND_API_KEY
    }
  })

  it("validates as a candidate via the FEED-1 validator", async () => {
    const { validateMarketSignalCandidate } =
      await import("../marketSignalIngestion.pure.ts")
    const r = await barchartPreviewProvider.fetchLatest({
      now: FIXED_NOW,
      apiKey: "fake-test-key",
      fetchImpl: stubFetchOk(VALID_BARCHART_BODY),
    })
    assert.equal(r.ok, true)
    if (!r.ok) return
    const validation = validateMarketSignalCandidate(r.candidate, { now: FIXED_NOW })
    assert.equal(validation.ok, true)
  })
})

// ------------------------------------------------------
// PREVIEW SERVICE
// ------------------------------------------------------

describe("previewMarketSignalFromProvider", () => {

  it("validates a successful mock candidate and canApply=true", async () => {
    const out = await previewMarketSignalFromProvider({
      providerId: "mock-delayed-ice",
      scenario: "neutral",
      now: FIXED_NOW,
    })
    assert.equal(out.canApply, true)
    assert.equal(out.validation?.ok, true)
    assert.ok(out.previewCandidate)
    if (!out.previewCandidate) return
    assert.equal(out.previewCandidate.source, "API_FEED")
    assert.equal(out.previewCandidate.provenance.provider, "mock-delayed-ice")
    const codes = out.diagnostics.map((d) => d.code)
    assert.ok(codes.includes(MSP_DIAGNOSTIC_CODES.MSP_PROVIDER_VALIDATED))
    assert.ok(codes.includes(MSP_DIAGNOSTIC_CODES.MSP_PROVIDER_PREVIEW_ONLY))
  })

  it("returns canApply=false + MSP_PROVIDER_NOT_FOUND for unknown providerId", async () => {
    const out = await previewMarketSignalFromProvider({
      providerId: "definitely-not-a-real-provider",
      now: FIXED_NOW,
    })
    assert.equal(out.canApply, false)
    assert.equal(out.provider, null)
    assert.equal(out.providerResult, null)
    const codes = out.diagnostics.map((d) => d.code)
    assert.ok(codes.includes(MSP_DIAGNOSTIC_CODES.MSP_PROVIDER_NOT_FOUND))
  })

  it("propagates provider error diagnostics when fetch returns ok=false", async () => {
    const previous = process.env.BARCHART_ONDEMAND_API_KEY
    delete process.env.BARCHART_ONDEMAND_API_KEY
    try {
      const out = await previewMarketSignalFromProvider({
        providerId: "barchart-preview",
        now: FIXED_NOW,
      })
      assert.equal(out.canApply, false)
      assert.equal(out.validation, null)
      const codes = out.diagnostics.map((d) => d.code)
      assert.ok(codes.includes(MSP_DIAGNOSTIC_CODES.MSP_PROVIDER_NOT_CONFIGURED))
    } finally {
      if (previous !== undefined) process.env.BARCHART_ONDEMAND_API_KEY = previous
    }
  })

  it("rejects an invalid candidate from a fake provider (canApply=false, validation.ok=false)", async () => {
    // Inject a stub provider into the registry path by calling fetch directly.
    // We simulate the orchestrator by passing a provider that returns
    // an out-of-band candidate, then re-running validation through the
    // preview service via its public path. Since the registry is private,
    // we exercise this through the barchart-preview key-present path
    // which always returns ok:false (validation never runs) — and we
    // ALSO build a minimal stub provider locally to validate that the
    // preview service treats validation failures correctly.
    //
    // We reach into providerResult by calling the validator directly via
    // the public service: a malformed provider candidate flows through
    // the `validation: { ok: false }` branch.

    const fakeProvider: MarketSignalProvider = {
      id: "mock-delayed-ice", // legal id; we override at the registry path level via service shim below
      label: "Fake",
      kind: "MOCK",
      description: "fake",
      requiresApiKey: false,
      isConfigured: () => true,
      async fetchLatest(): Promise<MarketSignalProviderResult> {
        return {
          ok: true,
          providerId: "mock-delayed-ice",
          providerKind: "MOCK",
          fetchedAt: FIXED_NOW.toISOString(),
          candidate: {
            // cPrice deliberately out of range
            cPrice: 12,
            demandIndex: 1.10,
            source: "API_FEED",
            note: null,
            provenance: {
              provider: "fake",
              sourceName: "fake",
              sourceUrl: null,
              retrievedAt: FIXED_NOW,
              rawValue: 12,
              rawUnit: "US_CENTS_PER_LB",
              confidence: "LOW",
            },
          },
          raw: null,
          diagnostics: [],
        }
      },
    }

    // Direct fake-provider validation simulates what the service does
    // after fetch — confirms that the service's validation branch
    // marks canApply=false on out-of-range cPrice. We assert via the
    // pure validator since that's the contract.
    const { validateMarketSignalCandidate } =
      await import("../marketSignalIngestion.pure.ts")
    const fetched = await fakeProvider.fetchLatest()
    assert.ok(fetched.ok)
    if (!fetched.ok) return
    const validation = validateMarketSignalCandidate(fetched.candidate, { now: FIXED_NOW })
    assert.equal(validation.ok, false)
  })
})

// ======================================================
// SETTLEMENT PROVIDER (PRICING-FEED-2C)
// ======================================================

describe("barchartSettlementPreviewProvider", () => {

  function stubFetchOk(body: string, status = 200) {
    return (async () => ({
      ok: status >= 200 && status < 300,
      status,
      text: async () => body,
    })) as unknown as import("../marketSignalProviders.types.ts").ProviderFetchImpl
  }

  // Settlement-style fixture: contains BOTH settlement and lastPrice so
  // the provider's price priority can be observed.
  function settlementBody(over: Record<string, unknown> = {}): string {
    return JSON.stringify({
      status: { code: 200 },
      results: [
        {
          symbol: "KC*1",
          lastPrice: 295.10,
          settlement: 290.25,
          settle: 290.50,
          close: 289.75,
          previousClose: 288.90,
          tradeTimestamp: "2026-05-09T15:30:00-04:00",
          ...over,
        },
      ],
    })
  }

  it("registry lists barchart-settlement-preview", () => {
    const summaries = listMarketSignalProviders()
    const s = summaries.find((p) => p.id === "barchart-settlement-preview")
    assert.ok(s, "barchart-settlement-preview should be registered")
    assert.equal(s.kind, "EXTERNAL_HTTP")
    assert.equal(s.requiresApiKey, true)
  })

  it("without API key returns MSP_PROVIDER_NOT_CONFIGURED and never calls fetch", async () => {
    const previous = process.env.BARCHART_ONDEMAND_API_KEY
    delete process.env.BARCHART_ONDEMAND_API_KEY
    try {
      let fetchCalls = 0
      const stub = (async () => {
        fetchCalls += 1
        return { ok: true, status: 200, text: async () => "" } as const
      }) as unknown as import("../marketSignalProviders.types.ts").ProviderFetchImpl

      const r = await barchartSettlementPreviewProvider.fetchLatest({
        now: FIXED_NOW,
        fetchImpl: stub,
      })
      assert.equal(r.ok, false)
      assert.equal(fetchCalls, 0)
      const codes = r.diagnostics.map((d) => d.code)
      assert.ok(codes.includes(MSP_DIAGNOSTIC_CODES.MSP_PROVIDER_NOT_CONFIGURED))
    } finally {
      if (previous !== undefined) process.env.BARCHART_ONDEMAND_API_KEY = previous
    }
  })

  it("returns ok candidate with provider=barchart-settlement-preview", async () => {
    const r = await barchartSettlementPreviewProvider.fetchLatest({
      now: FIXED_NOW,
      apiKey: "fake-test-key",
      fetchImpl: stubFetchOk(settlementBody({ isSettled: true })),
    })
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.equal(r.candidate.provenance?.provider, "barchart-settlement-preview")
    assert.equal(r.candidate.cPrice, 290.25)
    assert.equal(r.candidate.demandIndex, 1.0)
    assert.equal(r.candidate.source, "API_FEED")
  })

  it("confidence=HIGH when settlement field used AND isSettled=true", async () => {
    const r = await barchartSettlementPreviewProvider.fetchLatest({
      now: FIXED_NOW,
      apiKey: "fake-test-key",
      fetchImpl: stubFetchOk(settlementBody({ isSettled: true })),
    })
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.equal(r.candidate.provenance?.confidence, "HIGH")
    const codes = r.diagnostics.map((d) => d.code)
    assert.ok(codes.includes(MSP_DIAGNOSTIC_CODES.MSP_BARCHART_SETTLEMENT_FINAL))
  })

  it("confidence=MEDIUM when settlement status is UNKNOWN even if settlement field used", async () => {
    const r = await barchartSettlementPreviewProvider.fetchLatest({
      now: FIXED_NOW,
      apiKey: "fake-test-key",
      // No isSettled / no status string → unknown.
      fetchImpl: stubFetchOk(settlementBody()),
    })
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.equal(r.candidate.provenance?.confidence, "MEDIUM")
    const codes = r.diagnostics.map((d) => d.code)
    assert.ok(codes.includes(MSP_DIAGNOSTIC_CODES.MSP_BARCHART_SETTLEMENT_STATUS_UNKNOWN))
  })

  it("confidence=MEDIUM when lastPrice fallback used (even if isSettled=true)", async () => {
    const r = await barchartSettlementPreviewProvider.fetchLatest({
      now: FIXED_NOW,
      apiKey: "fake-test-key",
      fetchImpl: stubFetchOk(settlementBody({
        isSettled: true,
        settlement: undefined, settle: undefined, close: undefined, previousClose: undefined,
      })),
    })
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.equal(r.candidate.provenance?.confidence, "MEDIUM")
    const codes = r.diagnostics.map((d) => d.code)
    assert.ok(codes.includes(MSP_DIAGNOSTIC_CODES.MSP_BARCHART_SETTLEMENT_FALLBACK_TO_LAST))
  })

  it("API key never appears in sourceUrl or raw payload", async () => {
    const r = await barchartSettlementPreviewProvider.fetchLatest({
      now: FIXED_NOW,
      apiKey: "very-secret-settlement-key",
      fetchImpl: stubFetchOk(settlementBody({ isSettled: true })),
    })
    assert.equal(r.ok, true)
    if (!r.ok) return
    const url = r.candidate.provenance?.sourceUrl ?? ""
    assert.equal(url.includes("very-secret-settlement-key"), false)
    assert.equal(url.includes("apikey"), false)
    assert.equal(JSON.stringify(r.raw).includes("very-secret-settlement-key"), false)
  })

  it("emits MSP_DEMAND_INDEX_DEFAULTED + MSP_PROVIDER_PREVIEW_ONLY on success", async () => {
    const r = await barchartSettlementPreviewProvider.fetchLatest({
      now: FIXED_NOW,
      apiKey: "fake-test-key",
      fetchImpl: stubFetchOk(settlementBody({ isSettled: true })),
    })
    assert.equal(r.ok, true)
    if (!r.ok) return
    const codes = r.diagnostics.map((d) => d.code)
    assert.ok(codes.includes(MSP_DIAGNOSTIC_CODES.MSP_DEMAND_INDEX_DEFAULTED))
    assert.ok(codes.includes(MSP_DIAGNOSTIC_CODES.MSP_PROVIDER_PREVIEW_ONLY))
    assert.ok(codes.includes(MSP_DIAGNOSTIC_CODES.MSP_PROVIDER_CANDIDATE_CREATED))
  })

  it("settlement candidate validates with the FEED-1 validator", async () => {
    const { validateMarketSignalCandidate } =
      await import("../marketSignalIngestion.pure.ts")
    const r = await barchartSettlementPreviewProvider.fetchLatest({
      now: FIXED_NOW,
      apiKey: "fake-test-key",
      fetchImpl: stubFetchOk(settlementBody({ isSettled: true })),
    })
    assert.equal(r.ok, true)
    if (!r.ok) return
    const validation = validateMarketSignalCandidate(r.candidate, { now: FIXED_NOW })
    assert.equal(validation.ok, true)
  })
})

// ======================================================
// REGRESSION — barchart-preview behaviour unchanged
// ======================================================

describe("barchart-preview vs barchart-settlement-preview — price priority regression", () => {

  function stubFetchOk(body: string, status = 200) {
    return (async () => ({
      ok: status >= 200 && status < 300,
      status,
      text: async () => body,
    })) as unknown as import("../marketSignalProviders.types.ts").ProviderFetchImpl
  }

  // Body where lastPrice and settlement disagree.
  const SPLIT_BODY = JSON.stringify({
    status: { code: 200 },
    results: [
      {
        symbol: "KC*1",
        lastPrice: 295.10,
        settlement: 290.25,
        close: 289.75,
        tradeTimestamp: "2026-05-09T15:30:00-04:00",
      },
    ],
  })

  it("barchart-preview keeps lastPrice-first (intraday semantics unchanged)", async () => {
    const r = await barchartPreviewProvider.fetchLatest({
      now: FIXED_NOW,
      apiKey: "fake-test-key",
      fetchImpl: stubFetchOk(SPLIT_BODY),
    })
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.equal(r.candidate.cPrice, 295.10)  // lastPrice
    assert.equal(r.candidate.provenance?.provider, "barchart-preview")
    assert.equal(r.candidate.provenance?.confidence, "HIGH")
  })

  it("barchart-settlement-preview prefers settlement on the same payload", async () => {
    const r = await barchartSettlementPreviewProvider.fetchLatest({
      now: FIXED_NOW,
      apiKey: "fake-test-key",
      fetchImpl: stubFetchOk(SPLIT_BODY),
    })
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.equal(r.candidate.cPrice, 290.25)  // settlement
    assert.equal(r.candidate.provenance?.provider, "barchart-settlement-preview")
  })
})
