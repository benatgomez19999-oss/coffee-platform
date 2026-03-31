import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/database/prisma";
import { generateLotNumber } from "@/lib/generateLotNumber";

//////////////////////////////////////////////////////
// 📥 GET LOT DRAFTS
//////////////////////////////////////////////////////

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

//////////////////////////////////////////////////////
// 📤 POST CREATE LOT DRAFT
//////////////////////////////////////////////////////

import { getUserFromRequest } from "@/lib/getUserFromRequest";

export async function POST(req: NextRequest) {
  try {
    //////////////////////////////////////////////////////
    // 🔐 AUTH
    //////////////////////////////////////////////////////

    const user = await getUserFromRequest();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== "PRODUCER") {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    //////////////////////////////////////////////////////
    // 🧠 GET PRODUCER
    //////////////////////////////////////////////////////

    const producer = await prisma.producer.findUnique({
      where: { userId: user.id },
    });

    if (!producer) {
      return NextResponse.json(
        { error: "Producer not found. Complete onboarding." },
        { status: 400 }
      );
    }

    //////////////////////////////////////////////////////
    // 🧠 GET FARM
    //////////////////////////////////////////////////////

    const farm = await prisma.farm.findFirst({
      where: { producerId: producer.id },
    });

    if (!farm) {
      return NextResponse.json(
        { error: "Farm not found. Complete onboarding." },
        { status: 400 }
      );
    }

    //////////////////////////////////////////////////////
    // 🧠 BODY
    //////////////////////////////////////////////////////

    const body = await req.json();

    //////////////////////////////////////////////////////
    // 🧠 CALCULATIONS
    //////////////////////////////////////////////////////

    const conversionRate = 0.8;
    const estimatedGreenKg = body.parchmentKg * conversionRate;

    //////////////////////////////////////////////////////
    // 🧠 GENERATE LOT NUMBER
    //////////////////////////////////////////////////////

    const lotNumber = await generateLotNumber();

    //////////////////////////////////////////////////////
    // 🧠 CREATE DRAFT
    //////////////////////////////////////////////////////

    const draft = await prisma.producerLotDraft.create({
      data: {
        lotNumber,

        //////////////////////////////////////////////////////
        // 🔗 RELATIONS
        //////////////////////////////////////////////////////
        producerId: producer.id,
        farmId: farm.id,

        //////////////////////////////////////////////////////
        // 🌱 PRODUCT
        //////////////////////////////////////////////////////
        name: body.name,
        variety: body.variety,
        process: body.process,
        harvestYear: body.harvestYear,

        //////////////////////////////////////////////////////
        // 📦 VOLUME
        //////////////////////////////////////////////////////
        parchmentKg: body.parchmentKg,
        estimatedGreenKg,
        conversionRate,

        //////////////////////////////////////////////////////
        // 📊 STATUS
        //////////////////////////////////////////////////////
        status: "PENDING",
      },
    });

    return NextResponse.json(draft);

  } catch (error) {
    console.error("❌ LOT DRAFT ERROR:", error);

    return NextResponse.json(
      { error: "Failed to create lot draft" },
      { status: 500 }
    );
  }
}