import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/database/prisma"; // ajusta si tu path es distinto

export async function GET(req: NextRequest) {
  try {
   const drafts = await prisma.producerLotDraft.findMany({
  orderBy: {
    createdAt: "desc",
  },
});

    return NextResponse.json(drafts);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Failed to fetch lot drafts" },
      { status: 500 }
    );
  }
}