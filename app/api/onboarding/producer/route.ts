import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/database/prisma"
import { getUserFromRequest } from "@/lib/getUserFromRequest"

//////////////////////////////////////////////////////
// 🧠 CREATE PRODUCER + FARMS (SAFE + IDEMPOTENT)
//////////////////////////////////////////////////////

export async function POST(req: NextRequest) {
  try {

    //////////////////////////////////////////////////////
    // 🔐 AUTH (FIX 🔥)
    //////////////////////////////////////////////////////

    const user = await getUserFromRequest(req)

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (user.role !== "PRODUCER") {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 })
    }

    const body = await req.json()

    //////////////////////////////////////////////////////
    // 🧠 VALIDATION
    //////////////////////////////////////////////////////

    if (!body.businessName && !body.farms) {
      return NextResponse.json(
        { error: "Farm name is required" },
        { status: 400 }
      )
    }

    //////////////////////////////////////////////////////
    // 🚀 TRANSACTION
    //////////////////////////////////////////////////////

    const result = await prisma.$transaction(async (tx) => {

      //////////////////////////////////////////////////////
      // 1. CREATE OR GET PRODUCER
      //////////////////////////////////////////////////////

      let producer = await tx.producer.findUnique({
        where: { userId: user.id },
      })

      if (!producer) {
        producer = await tx.producer.create({
          data: {
            userId: user.id,
            name: user.name || "Unnamed Producer",
            country: body.country || "COLOMBIA",
          },
        })
      }

      //////////////////////////////////////////////////////
      // 2. PREPARE FARMS
      //////////////////////////////////////////////////////

      const farmsInput = body.farms || [
        {
          name: body.businessName,
          altitude: 1800,
        }
      ]

      //////////////////////////////////////////////////////
      // 3. CREATE FARMS (IDEMPOTENT 🔥)
      //////////////////////////////////////////////////////

      const createdFarms = []

      for (const farm of farmsInput) {

        if (!farm.name) continue

        // 🔥 CHECK DUPLICATE
        const existingFarm = await tx.farm.findFirst({
          where: {
            producerId: producer.id,
            name: farm.name,
          },
        })

        if (existingFarm) {
          createdFarms.push(existingFarm)
          continue
        }

        const newFarm = await tx.farm.create({
          data: {
            name: farm.name,
            altitude: farm.altitude || 1800,
            producerId: producer.id,
          },
        })

        createdFarms.push(newFarm)
      }

      //////////////////////////////////////////////////////
      // 4. COMPLETE ONBOARDING
      //////////////////////////////////////////////////////

      await tx.user.update({
        where: { id: user.id },
        data: {
          onboardingCompleted: true,
        },
      })

      return { producer, farms: createdFarms }
    })

    //////////////////////////////////////////////////////
    // ✅ SUCCESS
    //////////////////////////////////////////////////////

    return NextResponse.json({
      success: true,
      producerId: result.producer.id,
      farmsCreated: result.farms.length,
    })

  } catch (error) {
    console.error("❌ ONBOARDING PRODUCER ERROR:", error)

    return NextResponse.json(
      { error: "Failed to create producer" },
      { status: 500 }
    )
  }
}