//////////////////////////////////////////////////////
// 📈 MARKET SIGNAL TICK — PRISMA SERVICE
//
// Append-only writer + lister. Recording a tick:
//   • NEVER updates MarketSignalSnapshot
//   • NEVER refreshes PricingSnapshot.clientB2BPricePerKg
//   • NEVER mutates Contract.lockedPricePerKg
//   • NEVER mutates DemandIntent.previewPricePerKg
//   • NEVER updates an existing tick row (only INSERT)
//
// Re-exports the public types from marketSignalTick.types.ts
// so callers don't need to learn the split.
//////////////////////////////////////////////////////

import { Prisma, MarketSignalSource } from "@prisma/client"
import { prisma } from "@/src/database/prisma"

import {
  buildMarketSignalTickFromProviderPreview,
  validateMarketSignalTickInput,
} from "./marketSignalTick.pure"
import {
  buildMarketSignalTickInspectionFromRow,
  validateMarketSignalTickInspectionId,
  type MarketSignalTickInspectionResult,
} from "./marketSignalTickInspection.pure"
import type {
  MarketSignalTickDiagnostic,
  MarketSignalTickInput,
} from "./marketSignalTick.types"
import type { MarketSignalProviderPreview } from "./marketSignalProviders.types"

// Re-export public types.
export type {
  MarketSignalTickInput,
  MarketSignalTickDiagnostic,
  NormalizedMarketSignalTick,
  MarketSignalTickValidationResult,
} from "./marketSignalTick.types"
export {
  buildMarketSignalTickFromProviderPreview,
  validateMarketSignalTickInput,
  sanitizeMarketSignalTickRawPayload,
  sanitizeMarketSignalTickSourceUrl,
} from "./marketSignalTick.pure"

// PRICING-FEED-3C — re-export inspector types + helpers from the
// pure inspection module so callers don't need to learn the split.
export type {
  MarketSignalTickInspectionResult,
  MarketSignalTickInspectionRow,
  MarketSignalTickInspectionSafety,
  MarketSignalTickInspectionTick,
  MarketSignalTickInspectionErrorCode,
} from "./marketSignalTickInspection.pure"
export {
  buildMarketSignalTickInspectionFromRow,
  detectKnownSecretKeys,
  serialiseMarketSignalTickInspection,
  validateMarketSignalTickInspectionId,
} from "./marketSignalTickInspection.pure"

// ------------------------------------------------------
// PUBLIC RESULT TYPES
// ------------------------------------------------------

export type RecordMarketSignalTickResult = {
  ok: boolean
  applied: boolean
  tick: {
    id: string
    providerId: string
    providerKind: string
    cPrice: number
    demandIndex: number | null
    confidence: string | null
    capturedAt: string
    sourceName: string | null
  } | null
  diagnostics: MarketSignalTickDiagnostic[]
}

export type MarketSignalTickListItem = {
  id: string
  providerId: string
  providerKind: string
  source: string
  cPrice: number
  demandIndex: number | null
  confidence: string | null
  symbol: string | null
  contractMonth: string | null
  capturedAt: string
  validFrom: string | null
  expiresAt: string | null
  sourceName: string | null
  sourceUrl: string | null
  note: string | null
}

export type MarketSignalTickListResult = {
  generatedAt: string
  count: number
  ticks: MarketSignalTickListItem[]
}

// ------------------------------------------------------
// CONSTANTS
// ------------------------------------------------------

const LIST_DEFAULT_LIMIT = 50
const LIST_MIN_LIMIT = 1
const LIST_MAX_LIMIT = 500

function clampLimit(raw: number | undefined): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return LIST_DEFAULT_LIMIT
  const floored = Math.floor(raw)
  if (floored < LIST_MIN_LIMIT) return LIST_MIN_LIMIT
  if (floored > LIST_MAX_LIMIT) return LIST_MAX_LIMIT
  return floored
}

function parseSinceDate(value: Date | string | undefined): Date | undefined {
  if (value == null) return undefined
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value : undefined
  }
  if (typeof value !== "string") return undefined
  const parsed = new Date(value.trim())
  return Number.isFinite(parsed.getTime()) ? parsed : undefined
}

// ------------------------------------------------------
// RECORD ONE TICK FROM RAW INPUT
// ------------------------------------------------------

export async function recordMarketSignalTick(
  input: MarketSignalTickInput,
): Promise<RecordMarketSignalTickResult> {

  const validation = validateMarketSignalTickInput(input)
  if (!validation.ok) {
    return { ok: false, applied: false, tick: null, diagnostics: validation.diagnostics }
  }

  return persistTick(validation.tick, validation.diagnostics)
}

// ------------------------------------------------------
// RECORD ONE TICK FROM A PROVIDER PREVIEW
// ------------------------------------------------------

export async function recordMarketSignalTickFromProviderPreview(
  preview: MarketSignalProviderPreview | null | undefined,
): Promise<RecordMarketSignalTickResult> {

  const validation = buildMarketSignalTickFromProviderPreview(preview)
  if (!validation.ok) {
    return { ok: false, applied: false, tick: null, diagnostics: validation.diagnostics }
  }

  return persistTick(validation.tick, validation.diagnostics)
}

// ------------------------------------------------------
// LIST TICKS — newest first
// ------------------------------------------------------

export async function listMarketSignalTicks(options: {
  providerId?: string
  limit?: number
  since?: Date | string
} = {}): Promise<MarketSignalTickListResult> {

  const generatedAt = new Date().toISOString()
  const take = clampLimit(options.limit)
  const since = parseSinceDate(options.since)

  const where: Prisma.MarketSignalTickWhereInput = {}
  if (typeof options.providerId === "string" && options.providerId.trim().length > 0) {
    where.providerId = options.providerId.trim()
  }
  if (since) {
    where.capturedAt = { gte: since }
  }

  const rows = await prisma.marketSignalTick.findMany({
    where,
    orderBy: { capturedAt: "desc" },
    take,
    select: {
      id: true,
      providerId: true,
      providerKind: true,
      source: true,
      cPrice: true,
      demandIndex: true,
      confidence: true,
      symbol: true,
      contractMonth: true,
      capturedAt: true,
      validFrom: true,
      expiresAt: true,
      sourceName: true,
      sourceUrl: true,
      note: true,
    },
  })

  const ticks: MarketSignalTickListItem[] = rows.map((r) => ({
    id: r.id,
    providerId: r.providerId,
    providerKind: r.providerKind,
    source: r.source,
    cPrice: r.cPrice,
    demandIndex: r.demandIndex ?? null,
    confidence: r.confidence ?? null,
    symbol: r.symbol ?? null,
    contractMonth: r.contractMonth ?? null,
    capturedAt: r.capturedAt.toISOString(),
    validFrom: r.validFrom ? r.validFrom.toISOString() : null,
    expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
    sourceName: r.sourceName ?? null,
    sourceUrl: r.sourceUrl ?? null,
    note: r.note ?? null,
  }))

  return {
    generatedAt,
    count: ticks.length,
    ticks,
  }
}

// ------------------------------------------------------
// INSPECT ONE TICK (PRICING-FEED-3C)
//
// Read-only. No mutation, no apply, no B2B refresh.
// Validates the id, fetches the row, and runs the pure
// inspection builder which re-sanitises on read.
// ------------------------------------------------------

export async function getMarketSignalTickInspection(
  id: unknown,
): Promise<MarketSignalTickInspectionResult> {

  const generatedAt = new Date().toISOString()
  const idCheck = validateMarketSignalTickInspectionId(id)
  if (!idCheck.ok || !idCheck.id) {
    return {
      ok: false,
      generatedAt,
      error: {
        code: "MST_TICK_INVALID_ID",
        message: idCheck.reason ?? "Invalid tick id.",
      },
    }
  }

  let row: Awaited<ReturnType<typeof prisma.marketSignalTick.findUnique>>
  try {
    row = await prisma.marketSignalTick.findUnique({ where: { id: idCheck.id } })
  } catch (err) {
    console.warn("[MARKET_SIGNAL_TICK_INSPECT] read failed", err)
    return {
      ok: false,
      generatedAt,
      error: {
        code: "MST_TICK_NOT_FOUND",
        message: "Failed to load MarketSignalTick row.",
      },
    }
  }

  return buildMarketSignalTickInspectionFromRow(row)
}

// ------------------------------------------------------
// INTERNAL — persist a normalised tick (append-only)
// ------------------------------------------------------

async function persistTick(
  tick: import("./marketSignalTick.types").NormalizedMarketSignalTick,
  diagnostics: MarketSignalTickDiagnostic[],
): Promise<RecordMarketSignalTickResult> {

  const data: Prisma.MarketSignalTickCreateInput = {
    providerId: tick.providerId,
    providerKind: tick.providerKind,
    source: tick.source as MarketSignalSource,
    cPrice: tick.cPrice,
    demandIndex: tick.demandIndex,
    confidence: tick.confidence,
    rawUnit: tick.rawUnit,
    rawValue: tick.rawValue,
    symbol: tick.symbol,
    contractMonth: tick.contractMonth,
    capturedAt: tick.capturedAt,
    validFrom: tick.validFrom,
    expiresAt: tick.expiresAt,
    sourceName: tick.sourceName,
    sourceUrl: tick.sourceUrl,
    note: tick.note,
    diagnostics:
      tick.diagnostics === undefined
        ? Prisma.JsonNull
        : (tick.diagnostics as Prisma.InputJsonValue),
    rawPayload:
      tick.rawPayload === undefined
        ? Prisma.JsonNull
        : (tick.rawPayload as Prisma.InputJsonValue),
  }

  try {
    const created = await prisma.marketSignalTick.create({ data })
    return {
      ok: true,
      applied: true,
      diagnostics,
      tick: {
        id: created.id,
        providerId: created.providerId,
        providerKind: created.providerKind,
        cPrice: created.cPrice,
        demandIndex: created.demandIndex ?? null,
        confidence: created.confidence ?? null,
        capturedAt: created.capturedAt.toISOString(),
        sourceName: created.sourceName ?? null,
      },
    }
  } catch (err) {
    console.warn("[MARKET_SIGNAL_TICK] persist failed", err)
    return {
      ok: false,
      applied: false,
      tick: null,
      diagnostics: [
        ...diagnostics,
        {
          code: "MST_PERSIST_FAILED",
          severity: "error",
          message: `Tick persist failed: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
    }
  }
}
