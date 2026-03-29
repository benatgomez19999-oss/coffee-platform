import { prisma } from "@/database/prisma";
import { calculateProducerPricing } from "@/engine/pricing/producer/calculatePricing";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();

    //////////////////////////////////////////////////////
    // 🧠 INPUT NORMALIZATION
    //////////////////////////////////////////////////////

    const conversionRate = Number(body.conversionRate);
    const scaScore = Number(body.scaScore);

    if (!conversionRate || !scaScore) {
      return Response.json(
        { error: "Missing or invalid data" },
        { status: 400 }
      );
    }

    //////////////////////////////////////////////////////
    // 1. GET DRAFT
    //////////////////////////////////////////////////////

    const draft = await prisma.producerLotDraft.findUnique({
      where: { id: params.id },
    });

    if (!draft) {
      return Response.json(
        { error: "Draft not found" },
        { status: 404 }
      );
    }

    //////////////////////////////////////////////////////
    // 2. GET FARM (for altitude)
    //////////////////////////////////////////////////////

    const farm = await prisma.farm.findUnique({
      where: { id: draft.farmId },
    });

    //////////////////////////////////////////////////////
    // 3. CALCULATIONS
    //////////////////////////////////////////////////////

    const greenKg = draft.parchmentKg * conversionRate;

    const pricing = calculateProducerPricing({
      scaScore,
      altitude: farm?.altitude || 1700, // fallback seguro
      variety: draft.variety as any,
      process: draft.process as any,
      country: "COLOMBIA",
    });

    //////////////////////////////////////////////////////
    // 4. CREATE GREEN LOT
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
        scaScore,

        //////////////////////////////////////////////////////
        // 💰 PRICING (REAL)
        //////////////////////////////////////////////////////
        pricePerKg: pricing.finalPrice,

        //////////////////////////////////////////////////////
        // 📊 PRICING SNAPSHOT (CLAVE)
        //////////////////////////////////////////////////////
        pricingSnapshot: {
          create: {
            producerPricePerKg: pricing.finalPrice,
            clientPricePerKg: pricing.finalPrice, // 🔥 luego lo ajustamos con client engine
            marginPerKg: 0,
            pricingVersion: "v1",

            breakdown: pricing.breakdown,

            context: {
              scaScore,
              altitude: farm?.altitude || 1700,
              variety: draft.variety,
              process: draft.process,
            },
          },
        },
      },
    });

    //////////////////////////////////////////////////////
    // 5. UPDATE DRAFT
    //////////////////////////////////////////////////////

    await prisma.producerLotDraft.update({
      where: { id: params.id },
      data: {
        status: "VERIFIED",
        greenLotId: greenLot.id,
        conversionRate,
      },
    });

    //////////////////////////////////////////////////////
    // 6. DONE
    //////////////////////////////////////////////////////

    return Response.json(greenLot);

  } catch (err) {
    console.error("VERIFY LOT ERROR:", err);

    return Response.json(
      { error: "Failed to verify lot" },
      { status: 500 }
    );
  }
}