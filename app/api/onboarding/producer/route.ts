import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/database/prisma"
import { getUserFromRequest } from "@/lib/getUserFromRequest"

//////////////////////////////////////////////////////
// 🧠 CREATE PRODUCER + FARMS
//////////////////////////////////////////////////////

export async function POST(req: NextRequest) {
  try {

    const user = await getUserFromRequest()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (user.role !== "PRODUCER") {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 })
    }

    const body = await req.json()

    //////////////////////////////////////////////////////
    // 🧠 CREATE PRODUCER (1:1)
    //////////////////////////////////////////////////////

    const producer = await prisma.producer.create({
      data: {
        userId: user.id,
        name: user.name || "Unnamed Producer",
        country: body.country || "COLOMBIA",
      },
    })

    //////////////////////////////////////////////////////
    // 🧠 CREATE FARMS (MULTI-FARM READY)
    //////////////////////////////////////////////////////

    const farms = body.farms || [
      {
        name: body.businessName, // 👈 aquí usas Farm Name del form
        altitude: 1800,
      }
    ]

    for (const farm of farms) {
      await prisma.farm.create({
        data: {
          name: farm.name,
          altitude: farm.altitude || 1800,
          producerId: producer.id,
        },
      })
    }

    //////////////////////////////////////////////////////
    // 🧠 COMPLETE ONBOARDING
    //////////////////////////////////////////////////////

    await prisma.user.update({
      where: { id: user.id },
      data: {
        onboardingCompleted: true,
      },
    })

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error("ONBOARDING PRODUCER ERROR:", error)

    return NextResponse.json(
      { error: "Failed to create producer" },
      { status: 500 }
    )
  }
}