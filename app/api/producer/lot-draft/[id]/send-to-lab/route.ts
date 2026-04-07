import { prisma } from "@/database/prisma";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const updated = await prisma.producerLotDraft.update({
      where: { id: params.id },
      data: {
  status: "SAMPLE_REQUESTED",
  sampleShippingStatus: "PICKUP_REQUESTED",
  // opcional futuro:
  // sampleRequestedAt: new Date(),
},
    });

    return Response.json(updated);
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Failed to send to lab" }, { status: 500 });
  }
}