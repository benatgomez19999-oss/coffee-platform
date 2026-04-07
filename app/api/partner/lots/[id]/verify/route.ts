import "@/src/events/server/registerEventHandlers"
import { verifyLotService } from "@/src/services/partner/lotVerification.service";

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

    //////////////////////////////////////////////////////
    // 🚀 DELEGATE TO SERVICE
    //////////////////////////////////////////////////////

    const greenLot = await verifyLotService({

      lotId: params.id,
      conversionRate,
      scaScore,

    });

    //////////////////////////////////////////////////////
    // RESPONSE
    //////////////////////////////////////////////////////

    return Response.json(greenLot);

  } catch (err: any) {

    console.error("VERIFY LOT ERROR:", err);

    //////////////////////////////////////////////////////
    // ⚠️ CONTROLLED ERROR RESPONSE
    //////////////////////////////////////////////////////

    return Response.json(
      { error: err.message || "Failed to verify lot" },
      { status: 500 }
    );
  }
}