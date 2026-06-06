//////////////////////////////////////////////////////
// 📡 MARKET SIGNAL INGESTION — PRISMA SERVICE
//
// Validates a candidate, optionally writes a new
// MarketSignalSnapshot. Active uniqueness is enforced
// transactionally (deactivate previous active rows,
// then create new active row).
//
// THIS SERVICE NEVER:
//   - updates PricingSnapshot.clientB2BPricePerKg
//   - touches Contract.lockedPricePerKg
//   - touches DemandIntent.previewPricePerKg
//   - changes target tables / pricing engines
//
// B2B refresh is intentionally a separate, manual
// step (PRICING-WIRE-2 → /dev/pricing).
//////////////////////////////////////////////////////

import { Prisma, MarketSignalSource } from "@prisma/client"
import { prisma } from "@/src/database/prisma"

import {
  buildMarketSignalProvenanceNote,
  validateMarketSignalCandidate,
} from "./marketSignalIngestion.pure"
import type {
  MarketSignalIngestionCandidate,
  MarketSignalIngestionDiagnostic,
  NormalizedMarketSignalCandidate,
} from "./marketSignalIngestion.types"

// ------------------------------------------------------
// PUBLIC TYPES
// ------------------------------------------------------

export type MarketSignalActiveSnapshotView = {
  id: string | null
  cPrice: number | null
  demandIndex: number | null
  source: string | null
  validFrom: string | null
  expiresAt: string | null
  createdAt: string | null
  note: string | null
}

export type MarketSignalCreatedView = {
  id: string
  cPrice: number
  demandIndex: number
  source: string
  validFrom: string
  expiresAt: string | null
  isActive: boolean
  note: string | null
  createdAt: string
}

export type MarketSignalIngestionPreview = {
  generatedAt: string
  ok: boolean
  candidate: NormalizedMarketSignalCandidate | null
  diagnostics: MarketSignalIngestionDiagnostic[]
  activeBefore: MarketSignalActiveSnapshotView
  wouldDeactivateActive: boolean
}

export type MarketSignalIngestionApplyResult = MarketSignalIngestionPreview & {
  applied: boolean
  createdSnapshot: MarketSignalCreatedView | null
}

// ------------------------------------------------------
// HELPERS
// ------------------------------------------------------

const EMPTY_ACTIVE: MarketSignalActiveSnapshotView = {
  id: null,
  cPrice: null,
  demandIndex: null,
  source: null,
  validFrom: null,
  expiresAt: null,
  createdAt: null,
  note: null,
}

async function loadActiveSnapshotView(): Promise<MarketSignalActiveSnapshotView> {
  try {
    const snap = await prisma.marketSignalSnapshot.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    })
    if (!snap) return EMPTY_ACTIVE
    return {
      id: snap.id,
      cPrice: snap.cPrice,
      demandIndex: snap.demandIndex,
      source: snap.source,
      validFrom: snap.validFrom.toISOString(),
      expiresAt: snap.expiresAt ? snap.expiresAt.toISOString() : null,
      createdAt: snap.createdAt.toISOString(),
      note: snap.note ?? null,
    }
  } catch (err) {
    console.warn("[MARKET_SIGNAL_INGESTION] active read failed", err)
    return EMPTY_ACTIVE
  }
}

export async function listRecentMarketSignalSnapshots(
  limit = 10,
): Promise<Array<MarketSignalCreatedView & { isActive: boolean }>> {
  const safeLimit = Math.min(50, Math.max(1, Math.floor(limit)))
  const rows = await prisma.marketSignalSnapshot.findMany({
    orderBy: { createdAt: "desc" },
    take: safeLimit,
  })
  return rows.map((s) => ({
    id: s.id,
    cPrice: s.cPrice,
    demandIndex: s.demandIndex,
    source: s.source,
    validFrom: s.validFrom.toISOString(),
    expiresAt: s.expiresAt ? s.expiresAt.toISOString() : null,
    isActive: s.isActive,
    note: s.note ?? null,
    createdAt: s.createdAt.toISOString(),
  }))
}

// ------------------------------------------------------
// PREVIEW (no writes)
// ------------------------------------------------------

export async function previewMarketSignalIngestion(
  raw: MarketSignalIngestionCandidate,
): Promise<MarketSignalIngestionPreview> {

  const generatedAt = new Date().toISOString()
  const validation = validateMarketSignalCandidate(raw)
  const activeBefore = await loadActiveSnapshotView()

  if (!validation.ok) {
    return {
      generatedAt,
      ok: false,
      candidate: null,
      diagnostics: validation.diagnostics,
      activeBefore,
      wouldDeactivateActive: false,
    }
  }

  return {
    generatedAt,
    ok: true,
    candidate: validation.candidate,
    diagnostics: validation.candidate.diagnostics,
    activeBefore,
    wouldDeactivateActive: activeBefore.id !== null,
  }
}

// ------------------------------------------------------
// APPLY (transactional write)
// ------------------------------------------------------

export async function applyMarketSignalIngestion(
  raw: MarketSignalIngestionCandidate,
): Promise<MarketSignalIngestionApplyResult> {

  const preview = await previewMarketSignalIngestion(raw)
  if (!preview.ok || !preview.candidate) {
    return { ...preview, applied: false, createdSnapshot: null }
  }

  const candidate = preview.candidate
  const now = new Date()
  const note = buildMarketSignalProvenanceNote(candidate, now)

  const created = await prisma.$transaction(async (tx) => {
    await tx.marketSignalSnapshot.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    })

    const data: Prisma.MarketSignalSnapshotCreateInput = {
      cPrice: candidate.cPrice,
      demandIndex: candidate.demandIndex,
      source: candidate.source as MarketSignalSource,
      isActive: true,
      note,
      validFrom: candidate.validFrom,
      expiresAt: candidate.expiresAt,
    }

    return tx.marketSignalSnapshot.create({ data })
  })

  return {
    ...preview,
    applied: true,
    createdSnapshot: {
      id: created.id,
      cPrice: created.cPrice,
      demandIndex: created.demandIndex,
      source: created.source,
      validFrom: created.validFrom.toISOString(),
      expiresAt: created.expiresAt ? created.expiresAt.toISOString() : null,
      isActive: created.isActive,
      note: created.note ?? null,
      createdAt: created.createdAt.toISOString(),
    },
  }
}

// ------------------------------------------------------
// PROVIDER INTERFACE (architectural seam for FEED-2)
// ------------------------------------------------------

export type MarketSignalProvider = {
  id: string
  label: string
  fetchLatest(): Promise<MarketSignalIngestionCandidate>
}

/**
 * Trivial pass-through provider — wraps a candidate the operator
 * has already typed in. Useful as the canonical "manual" provider
 * and as a stub for tests / future external feeds.
 */
export function manualProvider(
  candidate: MarketSignalIngestionCandidate,
): MarketSignalProvider {
  return {
    id: "manual",
    label: "Manual",
    async fetchLatest() {
      return candidate
    },
  }
}
