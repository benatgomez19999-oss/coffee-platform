import { prisma } from "@/database/prisma";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();

    //////////////////////////////////////////////////////
    // 1. GET DRAFT
    //////////////////////////////////////////////////////

    const draft = await prisma.producerLotDraft.findUnique({
      where: { id: params.id },
    });

    if (!draft) {
      return Response.json({ error: "Draft not found" }, { status: 404 });
    }

    //////////////////////////////////////////////////////
    // 2. CREATE GREEN LOT
    //////////////////////////////////////////////////////

    const greenLot = await prisma.greenLot.create({
      data: {
        farmId: draft.farmId,
        name: draft.name,
        variety: draft.variety,
        process: draft.process,
        harvestYear: draft.harvestYear,

        // 🔥 volumen real
        totalKg: draft.parchmentKg * Number(body.conversionRate),
        availableKg: draft.parchmentKg * Number(body.conversionRate),

        // 📊 calidad
        scaScore: Number(body.scaScore),

        // 💰 pricing (temporal)
        pricePerKg: 10,
      },
    });

    //////////////////////////////////////////////////////
    // 3. UPDATE DRAFT
    //////////////////////////////////////////////////////

    await prisma.producerLotDraft.update({
      where: { id: params.id },
      data: {
        status: "VERIFIED",
        greenLotId: greenLot.id,
        conversionRate: Number(body.conversionRate),
      },
    });

    //////////////////////////////////////////////////////
    // 4. DONE
    //////////////////////////////////////////////////////

    return Response.json(greenLot);

  } catch (err) {
    console.error(err);
    return Response.json({ error: "Failed to verify lot" }, { status: 500 });
  }
}