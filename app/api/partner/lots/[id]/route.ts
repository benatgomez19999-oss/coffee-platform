import { prisma } from "@/database/prisma";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {

    const lot = await prisma.producerLotDraft.findUnique({
      where: { id: params.id },
    });

    if (!lot) {
      return Response.json({ error: "Lot not found" }, { status: 404 });
    }

    return Response.json(lot);

  } catch (err) {
    console.error(err);
    return Response.json({ error: "Failed to fetch lot" }, { status: 500 });
  }
}