//////////////////////////////////////////////////////
// 🧠 CLIENT B2B PRICE REFRESH — PURE HELPERS
//
// No Prisma, no @-aliases, no DB. Importable under
// `node --test --experimental-strip-types`. The Prisma-
// backed entry points live in clientB2BPriceRefresh.service.ts
// and re-export the public types from here.
//////////////////////////////////////////////////////

import { resolveRoastYield, computeRoastedPrice } from "../../lib/roastYield.ts"
import {
  calculateMarketplaceB2BPricing,
  type MarketplaceB2BPricingResult,
  type ProducerPricingFn,
} from "../../engine/pricing/client/calculateMarketplaceB2BPricing.ts"

// ------------------------------------------------------
// PUBLIC TYPES
// ------------------------------------------------------

export type ClientB2BRefreshMode = "dry_run" | "apply"

export type ClientB2BRefreshLotStatus =
  | "PUBLISHED" | "RESERVED" | "SOLD" | "DRAFT"

export type ClientB2BRefreshScope = {
  greenLotId?: string
  includeStatuses?: ReadonlyArray<ClientB2BRefreshLotStatus>
  limit?: number
}

export type ClientB2BRefreshPriceSource =
  | "PERSISTED_CLIENT_B2B"
  | "RECOMPUTED_CLIENT_B2B"
  | "LEGACY_GREEN_EQUIVALENT"
  | "NO_PRICE"

export type ClientB2BRefreshMarketSignal = {
  id: string | null
  cPrice: number | null
  demandIndex: number | null
  source: string | null
  validFrom: string | null
  expiresAt: string | null
}

export type ClientB2BRefreshResult = {
  greenLotId: string
  lotNumber: string
  lotName: string | null
  status: string

  variety: string
  process: string
  scaScore: number | null
  altitude: number | null
  country: string | null
  roastYield: number

  persistedClientB2BPricePerKg: number | null
  recomputedClientB2BPricePerKg: number | null
  legacyGreenEquivalentPricePerKg: number | null

  deltaAbsolute: number | null
  deltaPercent: number | null

  pricingSourceBefore: ClientB2BRefreshPriceSource
  pricingSourceAfter: ClientB2BRefreshPriceSource

  recomputedPricingVersion: string | null
  recomputedPricingMode: string | null
  recomputedCommercialModel?: string | null

  marketSignal: ClientB2BRefreshMarketSignal

  applied: boolean
  skipped: boolean
  skipReason?: string

  warnings: string[]
}

export type ClientB2BRefreshSummary = {
  generatedAt: string
  mode: ClientB2BRefreshMode
  applied: boolean
  count: number
  updatedCount: number
  skippedCount: number
  averageDeltaPercent: number | null
  maxDeltaPercent: number | null
  marketSignal: ClientB2BRefreshMarketSignal
  results: ClientB2BRefreshResult[]
}

export type RefreshLotView = {
  id: string
  lotNumber: string
  name: string | null
  status: string
  variety: string
  process: string
  scaScore: number | null
  availableKg: number | null
  estimatedRoastYield: number | null
  currency: string | null
  farm: {
    altitude: number | null
    producer: { country: string | null } | null
  } | null
  pricingSnapshot: {
    clientPricePerKg: number
    clientB2BPricePerKg: number | null
  } | null
}

export type RecomputeDependencies = {
  marketSignal: ClientB2BRefreshMarketSignal
  marketSignalForEngine: { cPrice?: number; demandIndex?: number } | null
  producerPricingFn: ProducerPricingFn
  b2bPricingFn?: typeof calculateMarketplaceB2BPricing
}

// ------------------------------------------------------
// CONSTANTS
// ------------------------------------------------------

export const REFRESH_DEFAULT_LIMIT = 100
export const REFRESH_DEFAULT_STATUSES: ReadonlyArray<ClientB2BRefreshLotStatus> = [
  "PUBLISHED",
  "RESERVED",
]
export const REFRESH_DEFAULT_COUNTRY = "COLOMBIA"

export const EMPTY_MARKET_SIGNAL: ClientB2BRefreshMarketSignal = {
  id: null, cPrice: null, demandIndex: null,
  source: null, validFrom: null, expiresAt: null,
}

// ------------------------------------------------------
// PURE HELPERS
// ------------------------------------------------------

export function isUsableNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function classifyBeforeSource(input: {
  persisted: number | null
  legacyGreen: number | null
}): ClientB2BRefreshPriceSource {
  if (isUsableNumber(input.persisted)) return "PERSISTED_CLIENT_B2B"
  if (isUsableNumber(input.legacyGreen)) return "LEGACY_GREEN_EQUIVALENT"
  return "NO_PRICE"
}

function classifyAfterSource(recomputed: number | null): ClientB2BRefreshPriceSource {
  if (isUsableNumber(recomputed)) return "RECOMPUTED_CLIENT_B2B"
  return "NO_PRICE"
}

function deltaFor(input: {
  persisted: number | null
  recomputed: number | null
}): { abs: number | null; pct: number | null } {
  if (!isUsableNumber(input.persisted) || !isUsableNumber(input.recomputed)) {
    return { abs: null, pct: null }
  }
  const abs = round2(input.recomputed - input.persisted)
  const pct = round2(((input.recomputed - input.persisted) / input.persisted) * 100)
  return { abs, pct }
}

/**
 * Pure recompute. Throws ONLY for caller-programmer errors.
 * Per-lot fail conditions return a `skipped: true` result with
 * a warning so the caller can keep iterating.
 */
export function recomputeClientB2BPriceForLot(
  lot: RefreshLotView,
  deps: RecomputeDependencies
): ClientB2BRefreshResult {

  const country = lot.farm?.producer?.country?.trim() || REFRESH_DEFAULT_COUNTRY
  const altitude = lot.farm?.altitude ?? null

  const roastYield = resolveRoastYield({
    estimatedRoastYield: lot.estimatedRoastYield ?? null,
    process: lot.process as "WASHED" | "NATURAL" | "HONEY" | "ANAEROBIC",
  })

  const persisted = lot.pricingSnapshot?.clientB2BPricePerKg ?? null
  const legacyGreenPersisted = lot.pricingSnapshot?.clientPricePerKg ?? null
  const legacyGreenEquivalent = isUsableNumber(legacyGreenPersisted)
    ? round2(computeRoastedPrice(legacyGreenPersisted, roastYield))
    : null

  const baseResult: ClientB2BRefreshResult = {
    greenLotId: lot.id,
    lotNumber: lot.lotNumber,
    lotName: lot.name,
    status: lot.status,

    variety: lot.variety ?? "",
    process: lot.process ?? "",
    scaScore: lot.scaScore ?? null,
    altitude,
    country,
    roastYield,

    persistedClientB2BPricePerKg: isUsableNumber(persisted) ? persisted : null,
    recomputedClientB2BPricePerKg: null,
    legacyGreenEquivalentPricePerKg: legacyGreenEquivalent,

    deltaAbsolute: null,
    deltaPercent: null,

    pricingSourceBefore: classifyBeforeSource({
      persisted,
      legacyGreen: legacyGreenEquivalent,
    }),
    pricingSourceAfter: "NO_PRICE",

    recomputedPricingVersion: null,
    recomputedPricingMode: null,
    recomputedCommercialModel: null,

    marketSignal: deps.marketSignal,

    applied: false,
    skipped: false,
    warnings: [],
  }

  // ─── Hard skip cases ──────────────────────────────
  if (!lot.pricingSnapshot) {
    return {
      ...baseResult,
      skipped: true,
      skipReason: "MISSING_PRICING_SNAPSHOT",
      warnings: ["GreenLot has no PricingSnapshot — cannot recompute B2B."],
    }
  }
  if (lot.scaScore == null || !Number.isFinite(lot.scaScore)) {
    return {
      ...baseResult,
      skipped: true,
      skipReason: "MISSING_SCA",
      warnings: ["GreenLot has no SCA score — B2B engine cannot price."],
    }
  }
  if (altitude == null || !Number.isFinite(altitude)) {
    return {
      ...baseResult,
      skipped: true,
      skipReason: "MISSING_ALTITUDE",
      warnings: ["Farm altitude missing — B2B engine cannot price."],
    }
  }
  if (!lot.variety) {
    return {
      ...baseResult,
      skipped: true,
      skipReason: "MISSING_VARIETY",
      warnings: ["GreenLot variety is empty."],
    }
  }
  if (!lot.process) {
    return {
      ...baseResult,
      skipped: true,
      skipReason: "MISSING_PROCESS",
      warnings: ["GreenLot process is empty."],
    }
  }

  // ─── Recompute ────────────────────────────────────
  const b2bFn = deps.b2bPricingFn ?? calculateMarketplaceB2BPricing
  let priced: MarketplaceB2BPricingResult
  try {
    priced = b2bFn(
      {
        scaScore: lot.scaScore,
        altitude,
        variety: lot.variety,
        process: lot.process,
        country,
        roastYield,
        currency: lot.currency ?? "EUR",
        marketplaceGreenKg:
          typeof lot.availableKg === "number" && Number.isFinite(lot.availableKg)
            ? lot.availableKg
            : 0,
        marketData: deps.marketSignalForEngine,
      },
      { producerPricingFn: deps.producerPricingFn }
    )
  } catch (err) {
    return {
      ...baseResult,
      skipped: true,
      skipReason: "B2B_ENGINE_ERROR",
      warnings: [
        `calculateMarketplaceB2BPricing threw: ${err instanceof Error ? err.message : String(err)}`,
      ],
    }
  }

  const recomputed = isUsableNumber(priced.pricePerKgRoasted)
    ? priced.pricePerKgRoasted
    : null
  const { abs, pct } = deltaFor({
    persisted: baseResult.persistedClientB2BPricePerKg,
    recomputed,
  })

  return {
    ...baseResult,
    recomputedClientB2BPricePerKg: recomputed,
    deltaAbsolute: abs,
    deltaPercent: pct,
    pricingSourceAfter: classifyAfterSource(recomputed),
    recomputedPricingVersion: priced.pricingVersion,
    recomputedPricingMode: priced.pricingMode,
    recomputedCommercialModel: priced.commercialModel ?? null,
    warnings: priced.fallbackReason
      ? [`B2B engine fallback: ${priced.fallbackReason}`]
      : [],
  }
}

/**
 * Aggregate results into the summary shape the API + UI consume.
 */
export function summarizeClientB2BRefresh(input: {
  results: ReadonlyArray<ClientB2BRefreshResult>
  mode: ClientB2BRefreshMode
  applied: boolean
  marketSignal: ClientB2BRefreshMarketSignal
}): ClientB2BRefreshSummary {

  const results = [...input.results]
  const updatedCount = results.filter((r) => r.applied).length
  const skippedCount = results.filter((r) => r.skipped).length

  const deltas = results
    .map((r) => r.deltaPercent)
    .filter((p): p is number => typeof p === "number" && Number.isFinite(p))

  const averageDeltaPercent = deltas.length
    ? round2(deltas.reduce((s, v) => s + v, 0) / deltas.length)
    : null

  const maxDeltaPercent = deltas.length
    ? round2(deltas.reduce((m, v) => (Math.abs(v) > Math.abs(m) ? v : m), 0))
    : null

  return {
    generatedAt: new Date().toISOString(),
    mode: input.mode,
    applied: input.applied,
    count: results.length,
    updatedCount,
    skippedCount,
    averageDeltaPercent,
    maxDeltaPercent,
    marketSignal: input.marketSignal,
    results,
  }
}

export function normaliseStatuses(
  raw: ReadonlyArray<ClientB2BRefreshLotStatus> | undefined
): ReadonlyArray<ClientB2BRefreshLotStatus> {
  if (!raw || raw.length === 0) return REFRESH_DEFAULT_STATUSES
  const seen = new Set<ClientB2BRefreshLotStatus>()
  for (const s of raw) {
    if (s === "PUBLISHED" || s === "RESERVED" || s === "SOLD" || s === "DRAFT") {
      seen.add(s)
    }
  }
  return seen.size > 0 ? Array.from(seen) : REFRESH_DEFAULT_STATUSES
}

export function normaliseLimit(raw: number | undefined): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return REFRESH_DEFAULT_LIMIT
  const floored = Math.floor(raw)
  if (floored < 1) return 1
  if (floored > 500) return 500
  return floored
}
