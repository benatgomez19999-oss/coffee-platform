import "@/src/events/server/registerEventHandlers"
import {
  verifyLotService,
  LotMediaNotReadyError,
} from "@/src/services/partner/lotVerification.service";

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
    const estimatedRoastYield = body.estimatedRoastYield != null
      ? Number(body.estimatedRoastYield)
      : undefined;

    //////////////////////////////////////////////////////
    // 🚀 DELEGATE TO SERVICE
    //////////////////////////////////////////////////////

    const greenLot = await verifyLotService({

      lotId: params.id,
      conversionRate,
      scaScore,
      estimatedRoastYield,

    });

    //////////////////////////////////////////////////////
    // RESPONSE
    //////////////////////////////////////////////////////

    return Response.json(greenLot);

  } catch (err: any) {

    //////////////////////////////////////////////////////
    // 🖼️ FARM-MEDIA-1 — STRUCTURED MEDIA-READINESS ERROR
    //////////////////////////////////////////////////////

    if (err instanceof LotMediaNotReadyError) {
      return Response.json(
        {
          code: err.code,
          error: err.message,
          reasons: err.reasons,
        },
        { status: err.status }
      );
    }

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