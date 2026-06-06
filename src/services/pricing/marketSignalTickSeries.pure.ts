//////////////////////////////////////////////////////
// 📈 MARKET SIGNAL TICK SERIES — PURE HELPERS
//
// Turns a list of MarketSignalTick rows (or any
// structurally-compatible shape) into an audit-friendly
// series the dev UI can render as a chart + delta block.
//
// Pure: no Prisma, no fetch, no env. Deterministic. No
// mutation of the input array. Importable under
// node --test.
//
// Three product actions remain orthogonal:
//   • Provider preview            — no DB write
//   • Record tick (FEED-3A)       — append-only audit
//   • Apply MarketSignalSnapshot  — FEED-1 confirm-token flow
// This series helper only reads tick data; nothing here
// triggers writes or refreshes.
//////////////////////////////////////////////////////

// ------------------------------------------------------
// PUBLIC TYPES
// ------------------------------------------------------

export type MarketSignalTickProviderClass =
  | "INTRADAY"
  | "SETTLEMENT"
  | "MOCK"
  | "OTHER"

/**
 * Structural input — accepts either the API list DTO
 * (`MarketSignalTickListItem`) or a raw Prisma row that
 * carries the same fields. Only the listed properties
 * are read; anything else on the input is ignored.
 */
export type MarketSignalTickSeriesInput = {
  id: string
  providerId: string
  capturedAt: string | Date
  cPrice: number
  demandIndex?: number | null
  confidence?: string | null
  source?: string | null
  symbol?: string | null
}

export type MarketSignalTickSeriesPoint = {
  id: string
  providerId: string
  providerClass: MarketSignalTickProviderClass
  capturedAt: string
  cPrice: number
  demandIndex: number | null
  confidence: string | null
}

export type MarketSignalTickDelta = {
  absolute: number
  percent: number
  intradayCapturedAt: string
  settlementCapturedAt: string
}

export type MarketSignalTickSeries = {
  points: MarketSignalTickSeriesPoint[]
  intradayPoints: MarketSignalTickSeriesPoint[]
  settlementPoints: MarketSignalTickSeriesPoint[]
  mockPoints: MarketSignalTickSeriesPoint[]
  latestIntraday: MarketSignalTickSeriesPoint | null
  latestSettlement: MarketSignalTickSeriesPoint | null
  latestAny: MarketSignalTickSeriesPoint | null
  cPriceMin: number | null
  cPriceMax: number | null
  deltaIntradayVsSettlement: MarketSignalTickDelta | null
}

// ------------------------------------------------------
// CLASSIFICATION
// ------------------------------------------------------

const PROVIDER_CLASS_BY_ID: Record<string, MarketSignalTickProviderClass> = {
  "barchart-preview":            "INTRADAY",
  "barchart-settlement-preview": "SETTLEMENT",
  "mock-delayed-ice":            "MOCK",
}

export function classifyMarketSignalTickProvider(
  providerId: string | null | undefined,
): MarketSignalTickProviderClass {
  if (typeof providerId !== "string") return "OTHER"
  return PROVIDER_CLASS_BY_ID[providerId] ?? "OTHER"
}

// ------------------------------------------------------
// INTERNAL HELPERS
// ------------------------------------------------------

function isUsableNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
}

function toIso(value: string | Date): string | null {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.toISOString() : null
  }
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (trimmed.length === 0) return null
  const parsed = new Date(trimmed)
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null
}

function captureMs(point: MarketSignalTickSeriesPoint): number {
  // Already validated when point was built; this just unwraps.
  return Date.parse(point.capturedAt)
}

function pickLatestByCapturedAt(
  points: ReadonlyArray<MarketSignalTickSeriesPoint>,
): MarketSignalTickSeriesPoint | null {
  if (points.length === 0) return null
  let latest = points[0]
  let latestMs = captureMs(latest)
  for (let i = 1; i < points.length; i++) {
    const ms = captureMs(points[i])
    if (ms > latestMs) {
      latest = points[i]
      latestMs = ms
    }
  }
  return latest
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

// ------------------------------------------------------
// MAIN
// ------------------------------------------------------

export function buildMarketSignalTickSeries(
  ticks: ReadonlyArray<MarketSignalTickSeriesInput>,
): MarketSignalTickSeries {

  const points: MarketSignalTickSeriesPoint[] = []

  if (Array.isArray(ticks)) {
    for (const t of ticks) {
      if (t == null) continue
      if (!isUsableNumber(t.cPrice)) continue
      const iso = toIso(t.capturedAt)
      if (iso == null) continue

      const demand =
        typeof t.demandIndex === "number" && Number.isFinite(t.demandIndex)
          ? t.demandIndex
          : null

      points.push({
        id: t.id,
        providerId: t.providerId,
        providerClass: classifyMarketSignalTickProvider(t.providerId),
        capturedAt: iso,
        cPrice: t.cPrice,
        demandIndex: demand,
        confidence:
          typeof t.confidence === "string" && t.confidence.length > 0
            ? t.confidence
            : null,
      })
    }
  }

  // Sort ascending by capturedAt for chart use; tie-break by id so
  // the order is deterministic when timestamps collide.
  points.sort((a, b) => {
    const am = captureMs(a)
    const bm = captureMs(b)
    if (am !== bm) return am - bm
    return a.id.localeCompare(b.id)
  })

  const intradayPoints = points.filter((p) => p.providerClass === "INTRADAY")
  const settlementPoints = points.filter((p) => p.providerClass === "SETTLEMENT")
  const mockPoints = points.filter((p) => p.providerClass === "MOCK")

  const latestIntraday = pickLatestByCapturedAt(intradayPoints)
  const latestSettlement = pickLatestByCapturedAt(settlementPoints)
  const latestAny = pickLatestByCapturedAt(points)

  let cPriceMin: number | null = null
  let cPriceMax: number | null = null
  for (const p of points) {
    if (cPriceMin == null || p.cPrice < cPriceMin) cPriceMin = p.cPrice
    if (cPriceMax == null || p.cPrice > cPriceMax) cPriceMax = p.cPrice
  }

  return {
    points,
    intradayPoints,
    settlementPoints,
    mockPoints,
    latestIntraday,
    latestSettlement,
    latestAny,
    cPriceMin,
    cPriceMax,
    deltaIntradayVsSettlement: computeMarketSignalTickDelta({
      latestIntraday,
      latestSettlement,
    }),
  }
}

// ------------------------------------------------------
// DELTA — intraday vs settlement
// ------------------------------------------------------

export function computeMarketSignalTickDelta(input: {
  latestIntraday: MarketSignalTickSeriesPoint | null
  latestSettlement: MarketSignalTickSeriesPoint | null
}): MarketSignalTickDelta | null {

  const intraday = input.latestIntraday
  const settlement = input.latestSettlement
  if (!intraday || !settlement) return null
  if (!isUsableNumber(intraday.cPrice) || !isUsableNumber(settlement.cPrice)) {
    return null
  }

  const absolute = round2(intraday.cPrice - settlement.cPrice)
  const percent = round2(((intraday.cPrice - settlement.cPrice) / settlement.cPrice) * 100)

  return {
    absolute,
    percent,
    intradayCapturedAt: intraday.capturedAt,
    settlementCapturedAt: settlement.capturedAt,
  }
}
