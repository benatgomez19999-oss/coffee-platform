import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/database/prisma";
import { generateLotNumber } from "@/lib/generateLotNumber";

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

const lotNumber = await generateLotNumber();

//////////////////////////////////////////////////////
// ✅ POST 
//////////////////////////////////////////////////////

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const conversionRate = 0.8;
    const estimatedGreenKg = body.parchmentKg * conversionRate;

    const draft = await prisma.producerLotDraft.create({
      data: {
        lotNumber,
        producerId: "temp-producer", 
        farmId: body.farmId,
        name: body.name,
        variety: body.variety,
        process: body.process,
        harvestYear: body.harvestYear,
        parchmentKg: body.parchmentKg,
        estimatedGreenKg,
        conversionRate,
        status: "PENDING",
      },
    });

    return NextResponse.json(draft);

  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Failed to create lot draft" },
      { status: 500 }
    );
  }
}