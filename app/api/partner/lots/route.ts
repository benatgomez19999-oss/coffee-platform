// ======================================================
// GET — PARTNER LOTS (ONLY SENT TO LAB)
// ======================================================

import { NextResponse } from "next/server";
import { prisma } from "@/database/prisma";
import { getUserFromRequest } from "@/lib/getUserFromRequest";

export async function GET(req: Request) {
  try {

    // 🔐 auth
    const user = await getUserFromRequest();

    if (!user || user.role !== "PARTNER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    //////////////////////////////////////////////////////
    // 🧠 FETCH LOTS (ONLY SENT TO LAB)
    //////////////////////////////////////////////////////

    const lots = await prisma.producerLotDraft.findMany({
      where: {
        status: "SENT_TO_LAB",
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(lots);

  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}