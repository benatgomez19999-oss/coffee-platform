import { prisma } from "@/database/prisma";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const updated = await prisma.producerLotDraft.update({
      where: { id: params.id },
      data: {
        status: "SENT_TO_LAB",
        // opcional futuro:
        // labRequestedAt: new Date(),
      },
    });

    return Response.json(updated);
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Failed to send to lab" }, { status: 500 });
  }
}