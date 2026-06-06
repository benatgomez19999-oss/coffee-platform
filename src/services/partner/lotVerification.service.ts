import { Prisma } from "@prisma/client"
import { prisma } from "@/src/database/prisma";
import { calculateProducerPricing } from "@/src/engine/pricing/producer/calculatePricing";
import { calculateMarketplaceB2BPricing } from "@/src/engine/pricing/client/calculateMarketplaceB2BPricing"
import { resolveRoastYield } from "@/src/lib/roastYield"
import { eventBus } from "@/src/events/core/eventBus"
import { EVENTS } from "@/src/events/core/eventTypes"
import {
  evaluateLotMediaReadiness,
  normalizeLotMediaRole,
  normalizeLotMediaSource,
  normalizeLotMediaVisibility,
} from "@/src/services/lot-media/lotMedia.pure"
import type {
  LotMediaItem,
  LotMediaReadinessBlockingReason,
} from "@/src/services/lot-media/lotMedia.types"

//////////////////////////////////////////////////////
// FARM-MEDIA-1 — readiness error
//
// Thrown by verifyLotService when the partner tries to
// promote a draft to a verified GreenLot but the lot's
// farm has not had any verified FARM + PROCESS media
// uploaded yet. The route layer surfaces this with a
// 400 response and a `code: "LOT_MEDIA_NOT_READY"` body.
//////////////////////////////////////////////////////

export class LotMediaNotReadyError extends Error {
  readonly code = "LOT_MEDIA_NOT_READY"
  readonly status = 400
  readonly reasons: LotMediaReadinessBlockingReason[]

  constructor(reasons: LotMediaReadinessBlockingReason[]) {
    const summary = reasons.map((r) => r.message).join(" ")
    super(summary || "Lot media is not ready for verification.")
    this.name = "LotMediaNotReadyError"
    this.reasons = reasons
  }
}

// Light projection helper used inside verifyLotService.
// Mirrors what the snapshot mapper does for the marketplace path
// but stays inline because verifyLotService runs in the request
// transaction and we don't need the full snapshot pipeline.
function projectMediaRows(
  rows: ReadonlyArray<{
    id: string
    url: string
    role: string
    source: string
    visibility?: string | null
    position: number
    isPrimary: boolean
    altText: string | null
  }>,
): LotMediaItem[] {
  const out: LotMediaItem[] = []
  for (const r of rows) {
    if (typeof r.url !== "string" || r.url.trim() === "") continue
    const role = normalizeLotMediaRole(r.role)
    const source = normalizeLotMediaSource(r.source)
    if (!role || !source) continue
    // LOT-MEDIA-2 — visibility falls back to PUBLIC_MARKET so
    // LOT-MEDIA-1 rows still satisfy the readiness gate after
    // upgrade. Unknown values get the same default rather
    // than dropping the row entirely.
    const visibility =
      normalizeLotMediaVisibility(r.visibility) ?? "PUBLIC_MARKET"
    out.push({
      id: r.id,
      url: r.url,
      role,
      source,
      visibility,
      position: Number.isFinite(r.position) && r.position >= 0 ? r.position : 0,
      isPrimary: r.isPrimary === true,
      altText: r.altText ?? null,
    })
  }
  return out
}

// =====================================================
// LOT VERIFICATION SERVICE
//
// Orquesta:
// — validación input
// — obtención de draft + farm
// — conversión volumen
// — pricing real
// — creación de greenLot + snapshot
// — transición de estado
//
// ⚠️ SINGLE SOURCE OF TRUTH
// =====================================================

export async function verifyLotService(input: {

  lotId: string
  scaScore: number
  conversionRate: number
  estimatedRoastYield?: number

}) {

  //////////////////////////////////////////////////////
  // 🧠 INPUT VALIDATION
  //////////////////////////////////////////////////////

  if (isNaN(input.conversionRate) || isNaN(input.scaScore)) {
    throw new Error("Invalid numeric values");
  }

  if (input.conversionRate <= 0 || input.scaScore <= 0) {
    throw new Error("Values must be greater than 0");
  }

  //////////////////////////////////////////////////////
  // 1. GET DRAFT
  //////////////////////////////////////////////////////

  const draft = await prisma.producerLotDraft.findUnique({
    where: { id: input.lotId },
  });

  if (!draft) {
    throw new Error("Draft not found");
  }

  //////////////////////////////////////////////////////
  // 🛑 IDEMPOTENCY GUARD
  //////////////////////////////////////////////////////

  if (draft.status === "VERIFIED") {
    throw new Error("Lot already verified");
  }

  //////////////////////////////////////////////////////
  // 2. GET FARM (CRÍTICO PARA PRICING)
  //////////////////////////////////////////////////////

  const farm = await prisma.farm.findUnique({
    where: { id: draft.farmId },
  });

  if (!farm) {
    throw new Error("Farm not found");
  }

  if (!farm.altitude) {
    throw new Error("Farm altitude missing");
  }

  //////////////////////////////////////////////////////
  // 🖼️ FARM-MEDIA-1 — MEDIA READINESS GUARD
  //
  // A draft cannot be promoted to a verified GreenLot
  // without verified FARM + PROCESS media on the lot's
  // farm (or attached to the draft itself via a future
  // upload flow). Editorial / tonal placeholder sources
  // never satisfy this gate.
  //
  // Throws LotMediaNotReadyError which the route layer
  // turns into a 400 with code "LOT_MEDIA_NOT_READY".
  // Dev seeds bypass this gate entirely because they
  // skip verifyLotService and create GreenLots directly.
  //////////////////////////////////////////////////////

  const farmMediaRows = await prisma.farmMedia.findMany({
    where: { farmId: farm.id },
    select: {
      id: true,
      url: true,
      role: true,
      source: true,
      visibility: true,
      position: true,
      isPrimary: true,
      altText: true,
    },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  })

  const readiness = evaluateLotMediaReadiness({
    lotMedia: [],
    farmMedia: projectMediaRows(farmMediaRows),
    mode: "VERIFY",
  })

  if (!readiness.ready) {
    throw new LotMediaNotReadyError(readiness.blockingReasons)
  }

  //////////////////////////////////////////////////////
  // 3. OPTIONAL MARKET CONTEXT
  //
  // Read the active MarketSignalSnapshot if one exists.
  // All failures fall back silently — this is never a
  // hard dependency. Lot verification must always work.
  //////////////////////////////////////////////////////

  type MarketContextUsed = {
    cPrice: number
    demandIndex: number
    source: string
    snapshotId: string
    appliedAt: string
  }

  let marketData: { cPrice: number; demandIndex: number } | undefined = undefined
  let marketContext: MarketContextUsed | undefined = undefined

  try {
    const snapshot = await prisma.marketSignalSnapshot.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    })

    if (
      snapshot &&
      (!snapshot.expiresAt || snapshot.expiresAt > new Date()) &&
      Number.isFinite(snapshot.cPrice) && snapshot.cPrice >= 50 && snapshot.cPrice <= 600 &&
      Number.isFinite(snapshot.demandIndex) && snapshot.demandIndex >= 0.8 && snapshot.demandIndex <= 1.2
    ) {
      marketData = {
        cPrice: snapshot.cPrice,
        demandIndex: snapshot.demandIndex,
      }
      marketContext = {
        cPrice: snapshot.cPrice,
        demandIndex: snapshot.demandIndex,
        source: snapshot.source,
        snapshotId: snapshot.id,
        appliedAt: new Date().toISOString(),
      }
    }
  } catch (err) {
    console.warn("[VERIFY_LOT] Market snapshot read failed — using deterministic pricing", err)
  }

  //////////////////////////////////////////////////////
  // 4. CALCULATIONS
  //////////////////////////////////////////////////////

  const greenKg =
    draft.parchmentKg * input.conversionRate;

  const pricing = calculateProducerPricing({

    scaScore: input.scaScore,
    altitude: farm.altitude,
    variety: draft.variety as any,
    process: draft.process as any,
    country: "COLOMBIA",

    ...(marketData && { marketData }),

  });

  //////////////////////////////////////////////////////
  // 4b. CLIENT B2B ROASTED PRICING (PRICING-B2B-3)
  //
  // Computes the same target-anchored adaptive price the
  // marketplace shows. We inject the producer engine as
  // a function so the B2B pricing module stays node --test
  // friendly and we don't double-call the engine.
  //
  // Best-effort: failure here MUST NOT break verification.
  // Producers should never be blocked from publishing a lot
  // because the marketplace pricing layer hiccupped.
  //////////////////////////////////////////////////////

  const resolvedRoastYield = resolveRoastYield({
    estimatedRoastYield: input.estimatedRoastYield ?? null,
    process: draft.process as any,
  })

  let b2bPricePerKg: number | null = null
  let b2bPricingVersion: string | null = null
  let b2bPricingMode: string | null = null
  let b2bPricingBreakdown: Prisma.InputJsonValue | null = null

  try {
    const b2b = calculateMarketplaceB2BPricing(
      {
        scaScore: input.scaScore,
        altitude: farm.altitude,
        variety: draft.variety,
        process: draft.process,
        country: "COLOMBIA",
        roastYield: resolvedRoastYield,
        currency: "EUR",
        marketplaceGreenKg: greenKg,
        marketData: marketData ?? null,
      },
      {
        producerPricingFn: ((engineInput: {
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
          })) as any,
      }
    )
    b2bPricePerKg = b2b.pricePerKgRoasted
    b2bPricingVersion = b2b.pricingVersion
    b2bPricingMode = b2b.pricingMode
    b2bPricingBreakdown = b2b.breakdown as unknown as Prisma.InputJsonValue
  } catch (err) {
    console.warn(
      "[VERIFY_LOT] B2B pricing failed — falling back to legacy green/yield at read time",
      err
    )
  }

  //////////////////////////////////////////////////////
  // 5. CREATE GREEN LOT
  //////////////////////////////////////////////////////

  const greenLot = await prisma.greenLot.create({
    data: {

      //////////////////////////////////////////////////////
      // 🔢 TRACEABILITY
      //////////////////////////////////////////////////////
      lotNumber: draft.lotNumber,

      //////////////////////////////////////////////////////
      // 🌱 PRODUCT INFO
      //////////////////////////////////////////////////////
      farmId: draft.farmId,
      name: draft.name,
      variety: draft.variety,
      process: draft.process,
      harvestYear: draft.harvestYear,

      //////////////////////////////////////////////////////
      // 📦 VOLUME
      //////////////////////////////////////////////////////
      totalKg: greenKg,
      availableKg: greenKg,

      //////////////////////////////////////////////////////
      // 📊 QUALITY
      //////////////////////////////////////////////////////
      scaScore: input.scaScore,

      //////////////////////////////////////////////////////
      // 🔥 ROAST YIELD ESTIMATE (green → roasted)
      //////////////////////////////////////////////////////
      ...(input.estimatedRoastYield != null && {
        estimatedRoastYield: input.estimatedRoastYield,
      }),

      //////////////////////////////////////////////////////
      // 💰 PRICING
      //////////////////////////////////////////////////////
      pricePerKg: pricing.finalPrice,

      //////////////////////////////////////////////////////
      // 📊 PRICING SNAPSHOT
      //////////////////////////////////////////////////////
      pricingSnapshot: {
        create: {
          producerPricePerKg: pricing.finalPrice,
          clientPricePerKg: pricing.finalPrice,
          marginPerKg: 0,
          pricingVersion: "v1",

          breakdown: pricing.breakdown,

          // PRICING-B2B-3 — persisted client B2B roasted price.
          // Nullable; the marketplace + contract path falls back
          // to legacy green/yield for any row where this is null.
          clientB2BPricePerKg: b2bPricePerKg,
          clientB2BPricingVersion: b2bPricingVersion,
          clientB2BPricingMode: b2bPricingMode,
          clientB2BPricingBreakdown: b2bPricingBreakdown ?? Prisma.JsonNull,
          clientB2BPriceComputedAt: b2bPricePerKg != null ? new Date() : null,

          context: {
            scaScore: input.scaScore,
            altitude: farm.altitude,
            variety: draft.variety,
            process: draft.process,
            ...(marketContext && { marketContext }),
          },
        },
      },
    },
  });

  //////////////////////////////////////////////////////
  // 5. UPDATE DRAFT
  //////////////////////////////////////////////////////

  await prisma.producerLotDraft.update({
    where: { id: input.lotId },
    data: {
      status: "VERIFIED",
      greenLotId: greenLot.id,
      conversionRate: input.conversionRate,
    },
  });

//////////////////////////////////////////////////////
// 📡 EVENT EMISSION
// Punto estructural del sistema
//////////////////////////////////////////////////////

eventBus.emit(EVENTS.LOT_VERIFIED, {

  greenLotId: greenLot.id,
  lotId: draft.id

})

  
  

  //////////////////////////////////////////////////////
  // OUTPUT
  //////////////////////////////////////////////////////

  return greenLot;
}