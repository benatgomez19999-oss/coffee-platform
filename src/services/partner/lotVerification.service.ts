import { prisma } from "@/src/database/prisma";
import { calculateProducerPricing } from "@/src/engine/pricing/producer/calculatePricing";
import { eventBus } from "@/src/events/core/eventBus"
import { EVENTS } from "@/src/events/core/eventTypes"

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