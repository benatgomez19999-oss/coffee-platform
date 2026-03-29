import { prisma } from "@/database/prisma";

export async function GET() {
  try {
    const lots = await prisma.producerLotDraft.findMany({
      where: {
        status: "SENT_TO_LAB",
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return Response.json(lots);
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Failed" }, { status: 500 });
  }
}