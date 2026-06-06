//////////////////////////////////////////////////////
// 🔬 CLIENT B2B PRICING INSPECTOR SERVICE
//
// Read-only orchestrator that builds a rich audit
// payload for a single GreenLot. Reuses:
//   • calculateMarketplaceB2BPricing (for breakdown)
//   • calculateProducerPricing (for green breakdown)
//   • lotAllocationSnapshot + decideLotAllocation
//     (for surface + visibility)
//   • clientB2BPricingBreakdown helpers (pure parsers)
//
// Mutates nothing. Suitable for /api/internal/pricing/lot/[id].
//////////////////////////////////////////////////////

import { prisma } from "@/src/database/prisma"
import { resolveRoastYield, computeRoastedPrice, greenToRoasted } from "@/src/lib/roastYield"
import { calculateProducerPricing } from "@/src/engine/pricing/producer/calculatePricing"
import {
  calculateMarketplaceB2BPricing,
  type MarketplaceB2BPricingResult,
  type ProducerPricingFn,
} from "@/src/engine/pricing/client/calculateMarketplaceB2BPricing"
import { buildAllocationSnapshots } from "@/src/services/allocation/snapshot/lotAllocationSnapshot.service"
import { decideLotAllocation } from "@/src/services/allocation/engine/lotAllocationEngine"
import {
  buildCommercialInspectionFromBreakdown,
  buildTargetInspectionFromBreakdown,
  classifyDeltaStatus,
  deriveVisibility,
  type CommercialInspection,
  type DeltaStatus,
  type TargetInspection,
} from "./clientB2BPricingBreakdown"

// ------------------------------------------------------
// PUBLIC TYPES
// ------------------------------------------------------

export type ClientB2BPricingInspectionLot = {
  id: string
  lotNumber: string
  name: string | null
  status: string
  variety: string
  process: string
  harvestYear: number | null
  scaScore: number | null
  altitude: number | null
  country: string | null
  region: string | null
  producerName: string | null
  farmName: string | null
  availableGreenKg: number
  availableRoastedKg: number
  roastYield: number
  currency: string
}

export type ClientB2BPricingInspection = {
  generatedAt: string
  lot: ClientB2BPricingInspectionLot

  persisted: {
    producerGreenPricePerKg: number | null
    legacyClientGreenPricePerKg: number | null
    clientB2BPricePerKg: number | null
    clientB2BPricingVersion: string | null
    clientB2BPricingMode: string | null
    clientB2BPriceComputedAt: string | null
    pricingSource: string
  }

  recomputed: {
    clientB2BPricePerKg: number | null
    pricingVersion: string | null
    pricingMode: string | null
    commercialModel: string | null
    pricingSource: string
    warnings: string[]
  }

  delta: {
    absolute: number | null
    percent: number | null
    status: DeltaStatus
  }

  producer: {
    greenPricePerKg: number | null
    originEquivalentRoastedPricePerKg: number | null
    breakdown: unknown[]
  }

  target: TargetInspection

  commercial: CommercialInspection

  marketSignal: {
    id: string | null
    cPrice: number | null
    demandIndex: number | null
    source: string | null
    validFrom: string | null
    expiresAt: string | null
    used: boolean
  }

  allocation: {
    recommendedSurface: string | null
    contractAssignableGreenKg: number | null
    contractAssignableRoastedKg: number | null
    marketplaceGreenKg: number | null
    marketplaceRoastedKg: number | null
    exclusiveMicrolotGreenKg: number | null
    blockedGreenKg: number | null
    reasons: Array<{ code: string; severity: string; message: string }>
  }

  visibility: {
    appearsInMarketplace: boolean
    appearsInContractCatalog: boolean
    pricingSourceMarketplace: string | null
    pricingSourceContractCatalog: string | null
  }

  breakdown: {
    persistedClientB2B: unknown | null
    recomputedClientB2B: unknown[]
    producerGreen: unknown[]
    raw?: unknown
  }
}

// ------------------------------------------------------
// CONSTANTS
// ------------------------------------------------------

const DEFAULT_COUNTRY = "COLOMBIA"

// ------------------------------------------------------
// HELPERS
// ------------------------------------------------------

function isUsableNumber(v: number | null | undefined): v is number {
  return typeof v === "number" && Number.isFinite(v) && v > 0
}

function round2(v: number): number {
  return Math.round(v * 100) / 100
}

function buildProducerPricingFn(): ProducerPricingFn {
  return ((engineInput: {
    scaScore: number
    altitude: number
    variety: string
    process: string
    country?: string
    marketData?: { cPrice?: number; demandIndex?: number }
  }) =>
    calculateProducerPricing({
      scaScore: engineInput.scaScore,
      altitude: engineInput.altitude,
      variety: engineInput.variety as any,
      process: engineInput.process as any,
      country: engineInput.country,
      marketData: engineInput.marketData,
    })) as any
}

async function loadActiveMarketSignal(): Promise<{
  signalForView: ClientB2BPricingInspection["marketSignal"]
  forEngine: { cPrice: number; demandIndex: number } | null
}> {
  try {
    const snap = await prisma.marketSignalSnapshot.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    })
    if (!snap) {
      return {
        signalForView: {
          id: null, cPrice: null, demandIndex: null,
          source: null, validFrom: null, expiresAt: null,
          used: false,
        },
        forEngine: null,
      }
    }
    const expired = !!snap.expiresAt && snap.expiresAt <= new Date()
    const inBand =
      Number.isFinite(snap.cPrice) && snap.cPrice >= 50 && snap.cPrice <= 600 &&
      Number.isFinite(snap.demandIndex) && snap.demandIndex >= 0.8 && snap.demandIndex <= 1.2
    const usable = !expired && inBand
    return {
      signalForView: {
        id: snap.id,
        cPrice: Number.isFinite(snap.cPrice) ? snap.cPrice : null,
        demandIndex: Number.isFinite(snap.demandIndex) ? snap.demandIndex : null,
        source: snap.source ?? null,
        validFrom: snap.validFrom ? snap.validFrom.toISOString() : null,
        expiresAt: snap.expiresAt ? snap.expiresAt.toISOString() : null,
        used: usable,
      },
      forEngine: usable
        ? { cPrice: snap.cPrice, demandIndex: snap.demandIndex }
        : null,
    }
  } catch (err) {
    console.warn("[CLIENT_B2B_INSPECTOR] market signal read failed", err)
    return {
      signalForView: {
        id: null, cPrice: null, demandIndex: null,
        source: null, validFrom: null, expiresAt: null,
        used: false,
      },
      forEngine: null,
    }
  }
}

// ------------------------------------------------------
// MAIN
// ------------------------------------------------------

export async function getClientB2BPricingInspection(
  greenLotId: string
): Promise<ClientB2BPricingInspection | null> {

  const generatedAt = new Date().toISOString()

  const lotRow = await prisma.greenLot.findUnique({
    where: { id: greenLotId },
    select: {
      id: true,
      lotNumber: true,
      name: true,
      status: true,
      variety: true,
      process: true,
      harvestYear: true,
      scaScore: true,
      altitude: true,
      availableKg: true,
      estimatedRoastYield: true,
      currency: true,
      farm: {
        select: {
          name: true,
          region: true,
          altitude: true,
          producer: { select: { name: true, country: true } },
        },
      },
      pricingSnapshot: {
        select: {
          producerPricePerKg: true,
          clientPricePerKg: true,
          clientB2BPricePerKg: true,
          clientB2BPricingVersion: true,
          clientB2BPricingMode: true,
          clientB2BPriceComputedAt: true,
          clientB2BPricingBreakdown: true,
          breakdown: true,
        },
      },
    },
  })

  if (!lotRow) return null

  const country =
    lotRow.farm?.producer?.country?.trim() || DEFAULT_COUNTRY
  const altitude =
    (lotRow.farm?.altitude ?? null) ?? lotRow.altitude ?? null
  const roastYield = resolveRoastYield({
    estimatedRoastYield: lotRow.estimatedRoastYield ?? null,
    process: lotRow.process as "WASHED" | "NATURAL" | "HONEY" | "ANAEROBIC",
  })
  const availableGreenKg =
    typeof lotRow.availableKg === "number" && Number.isFinite(lotRow.availableKg)
      ? lotRow.availableKg
      : 0
  const availableRoastedKg = round2(greenToRoasted(availableGreenKg, roastYield))
  const currency = (lotRow.currency ?? "EUR").trim() || "EUR"

  const lotView: ClientB2BPricingInspectionLot = {
    id: lotRow.id,
    lotNumber: lotRow.lotNumber,
    name: lotRow.name,
    status: lotRow.status,
    variety: lotRow.variety,
    process: lotRow.process,
    harvestYear: lotRow.harvestYear ?? null,
    scaScore: lotRow.scaScore ?? null,
    altitude,
    country,
    region: lotRow.farm?.region ?? null,
    producerName: lotRow.farm?.producer?.name ?? null,
    farmName: lotRow.farm?.name ?? null,
    availableGreenKg: round2(availableGreenKg),
    availableRoastedKg,
    roastYield,
    currency,
  }

  // ─── Persisted ─────────────────────────────────────
  const persistedB2B = lotRow.pricingSnapshot?.clientB2BPricePerKg ?? null
  const legacyClientGreen = lotRow.pricingSnapshot?.clientPricePerKg ?? null
  const producerGreenPersisted = lotRow.pricingSnapshot?.producerPricePerKg ?? null
  const persistedSource: string = isUsableNumber(persistedB2B)
    ? "PERSISTED_CLIENT_B2B"
    : isUsableNumber(legacyClientGreen)
      ? "LEGACY_GREEN_EQUIVALENT"
      : "NO_PRICE"

  // ─── Market signal ─────────────────────────────────
  const { signalForView, forEngine } = await loadActiveMarketSignal()

  // ─── Producer green recompute ─────────────────────
  let producerRecomputeResult:
    | { finalPrice: number; breakdown?: unknown }
    | null = null
  if (
    lotRow.scaScore != null &&
    altitude != null &&
    lotRow.variety &&
    lotRow.process
  ) {
    try {
      producerRecomputeResult = calculateProducerPricing({
        scaScore: lotRow.scaScore,
        altitude,
        variety: lotRow.variety as any,
        process: lotRow.process as any,
        country,
        marketData: forEngine ?? undefined,
      })
    } catch (err) {
      console.warn(
        "[CLIENT_B2B_INSPECTOR] producer engine recompute failed for",
        greenLotId,
        err
      )
    }
  }

  // ─── B2B recompute (full breakdown) ───────────────
  let b2bResult: MarketplaceB2BPricingResult | null = null
  const recomputeWarnings: string[] = []
  if (
    lotRow.scaScore != null &&
    altitude != null &&
    lotRow.variety &&
    lotRow.process &&
    lotRow.pricingSnapshot
  ) {
    try {
      b2bResult = calculateMarketplaceB2BPricing(
        {
          scaScore: lotRow.scaScore,
          altitude,
          variety: lotRow.variety,
          process: lotRow.process,
          country,
          roastYield,
          currency,
          marketplaceGreenKg: availableGreenKg,
          marketData: forEngine,
        },
        { producerPricingFn: buildProducerPricingFn() }
      )
      if (b2bResult.fallbackReason) {
        recomputeWarnings.push(`B2B engine fallback: ${b2bResult.fallbackReason}`)
      }
    } catch (err) {
      recomputeWarnings.push(
        `calculateMarketplaceB2BPricing threw: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  } else {
    if (!lotRow.pricingSnapshot) recomputeWarnings.push("MISSING_PRICING_SNAPSHOT")
    if (lotRow.scaScore == null) recomputeWarnings.push("MISSING_SCA")
    if (altitude == null) recomputeWarnings.push("MISSING_ALTITUDE")
    if (!lotRow.variety) recomputeWarnings.push("MISSING_VARIETY")
    if (!lotRow.process) recomputeWarnings.push("MISSING_PROCESS")
  }

  const recomputedB2B = b2bResult && isUsableNumber(b2bResult.pricePerKgRoasted)
    ? b2bResult.pricePerKgRoasted
    : null
  const recomputedSource: string = isUsableNumber(recomputedB2B)
    ? "RECOMPUTED_CLIENT_B2B"
    : "NO_PRICE"

  // ─── Delta ────────────────────────────────────────
  const deltaAbsolute =
    isUsableNumber(persistedB2B) && isUsableNumber(recomputedB2B)
      ? round2(recomputedB2B - persistedB2B)
      : null
  const deltaPercent =
    isUsableNumber(persistedB2B) && isUsableNumber(recomputedB2B)
      ? round2(((recomputedB2B - persistedB2B) / persistedB2B) * 100)
      : null

  const deltaStatus = classifyDeltaStatus({
    persisted: persistedB2B,
    recomputed: recomputedB2B,
  })

  // ─── Origin-equivalent legacy green roasted ───────
  const legacyGreenEquivalent = isUsableNumber(legacyClientGreen)
    ? round2(computeRoastedPrice(legacyClientGreen, roastYield))
    : null

  // ─── Allocation surface ───────────────────────────
  let allocationFields: ClientB2BPricingInspection["allocation"] = {
    recommendedSurface: null,
    contractAssignableGreenKg: null,
    contractAssignableRoastedKg: null,
    marketplaceGreenKg: null,
    marketplaceRoastedKg: null,
    exclusiveMicrolotGreenKg: null,
    blockedGreenKg: null,
    reasons: [],
  }
  let visibility: { appearsInMarketplace: boolean; appearsInContractCatalog: boolean } = {
    appearsInMarketplace: false,
    appearsInContractCatalog: false,
  }
  try {
    const snapshots = await buildAllocationSnapshots({ greenLotId })
    if (snapshots.length > 0) {
      const decision = decideLotAllocation(snapshots[0])
      const cag = decision.contractAssignableGreenKg ?? 0
      const meg = decision.marketplaceEligibleGreenKg ?? 0
      const eg = decision.exclusiveMicrolotGreenKg ?? 0
      allocationFields = {
        recommendedSurface: decision.recommendedSurface,
        contractAssignableGreenKg: cag,
        contractAssignableRoastedKg: round2(greenToRoasted(cag, roastYield)),
        marketplaceGreenKg: meg,
        marketplaceRoastedKg: round2(greenToRoasted(meg, roastYield)),
        exclusiveMicrolotGreenKg: eg,
        blockedGreenKg: decision.blockedGreenKg ?? 0,
        reasons: decision.reasons.map((r) => ({
          code: r.code,
          severity: r.severity,
          message: r.message,
        })),
      }
      visibility = deriveVisibility({
        recommendedSurface: decision.recommendedSurface,
        marketplaceEligibleGreenKg: meg,
        exclusiveMicrolotGreenKg: eg,
        contractAssignableGreenKg: cag,
      })
    }
  } catch (err) {
    console.warn(
      "[CLIENT_B2B_INSPECTOR] allocation snapshot/decision failed for",
      greenLotId, err
    )
  }

  // ─── Pricing sources for marketplace + catalog ────
  // Mirrors the priority logic in marketplaceLot.mapper +
  // contractCatalog.mapper: persisted wins, else
  // adaptive recompute fallback, else legacy origin-equivalent.
  const surfacePricingSource =
    isUsableNumber(persistedB2B)
      ? "PERSISTED_CLIENT_B2B"
      : isUsableNumber(recomputedB2B)
        ? "ADAPTIVE_RECOMPUTE_FALLBACK"
        : "LEGACY_ORIGIN_EQUIVALENT_FALLBACK"

  return {
    generatedAt,
    lot: lotView,

    persisted: {
      producerGreenPricePerKg: producerGreenPersisted,
      legacyClientGreenPricePerKg: legacyClientGreen,
      clientB2BPricePerKg: isUsableNumber(persistedB2B) ? persistedB2B : null,
      clientB2BPricingVersion: lotRow.pricingSnapshot?.clientB2BPricingVersion ?? null,
      clientB2BPricingMode: lotRow.pricingSnapshot?.clientB2BPricingMode ?? null,
      clientB2BPriceComputedAt:
        lotRow.pricingSnapshot?.clientB2BPriceComputedAt
          ? lotRow.pricingSnapshot.clientB2BPriceComputedAt.toISOString()
          : null,
      pricingSource: persistedSource,
    },

    recomputed: {
      clientB2BPricePerKg: recomputedB2B,
      pricingVersion: b2bResult?.pricingVersion ?? null,
      pricingMode: b2bResult?.pricingMode ?? null,
      commercialModel: b2bResult?.commercialModel ?? null,
      pricingSource: recomputedSource,
      warnings: recomputeWarnings,
    },

    delta: {
      absolute: deltaAbsolute,
      percent: deltaPercent,
      status: deltaStatus,
    },

    producer: {
      greenPricePerKg:
        producerRecomputeResult && Number.isFinite(producerRecomputeResult.finalPrice)
          ? producerRecomputeResult.finalPrice
          : null,
      originEquivalentRoastedPricePerKg: legacyGreenEquivalent,
      breakdown: Array.isArray((producerRecomputeResult as any)?.breakdown)
        ? ((producerRecomputeResult as any).breakdown as unknown[])
        : [],
    },

    target: buildTargetInspectionFromBreakdown(b2bResult?.breakdown ?? null),
    commercial: buildCommercialInspectionFromBreakdown(b2bResult?.breakdown ?? null),

    marketSignal: signalForView,

    allocation: allocationFields,

    visibility: {
      appearsInMarketplace: visibility.appearsInMarketplace,
      appearsInContractCatalog: visibility.appearsInContractCatalog,
      pricingSourceMarketplace: visibility.appearsInMarketplace ? surfacePricingSource : null,
      pricingSourceContractCatalog: visibility.appearsInContractCatalog ? surfacePricingSource : null,
    },

    breakdown: {
      persistedClientB2B: lotRow.pricingSnapshot?.clientB2BPricingBreakdown ?? null,
      recomputedClientB2B: b2bResult ? (b2bResult.breakdown as unknown[]) : [],
      producerGreen: Array.isArray((producerRecomputeResult as any)?.breakdown)
        ? ((producerRecomputeResult as any).breakdown as unknown[])
        : [],
      raw: lotRow.pricingSnapshot?.breakdown ?? null,
    },
  }
}
