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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    //////////////////////////////////////////////////////
    // 🧠 GENERATE LOT NUMBER (INSIDE HANDLER)
    //////////////////////////////////////////////////////

    const lotNumber = await generateLotNumber();

    //////////////////////////////////////////////////////
    // 🧠 BASIC CALCULATION
    //////////////////////////////////////////////////////

    const conversionRate = 0.8;
    const estimatedGreenKg =
      body.parchmentKg * conversionRate;

    //////////////////////////////////////////////////////
    // 🧠 ENSURE FARM EXISTS (CRITICAL FIX)
    //////////////////////////////////////////////////////

    // ⚠️ TEMP: hasta que conectemos auth real
    const producerId = "temp-producer";

    let farm = await prisma.farm.findFirst({
      where: {
        producerId,
      },
    });

    //////////////////////////////////////////////////////
    // 👉 CREATE DEFAULT FARM IF NONE EXISTS
    //////////////////////////////////////////////////////

    if (!farm) {
      farm = await prisma.farm.create({
        data: {
          name: "Default Farm",
          altitude: 1800, // requerido para pricing
          producerId,
        },
      });
    }

    //////////////////////////////////////////////////////
    // 🧠 CREATE DRAFT (SOURCE OF TRUTH)
    //////////////////////////////////////////////////////

    const draft = await prisma.producerLotDraft.create({
      data: {
        lotNumber,

        //////////////////////////////////////////////////////
        // 🔗 RELATIONS
        //////////////////////////////////////////////////////
        producerId,
        farmId: farm.id, // ✅ SIEMPRE válido

        //////////////////////////////////////////////////////
        // 🌱 PRODUCT DATA
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
    console.error(error);

    return NextResponse.json(
      { error: "Failed to create lot draft" },
      { status: 500 }
    );
  }
}