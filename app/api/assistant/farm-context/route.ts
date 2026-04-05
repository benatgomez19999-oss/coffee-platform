
import { prisma } from "@/src/database/prisma"
import { getUserFromRequest } from "@/src/lib/getUserFromRequest"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  try {
    //////////////////////////////////////////////////////
    // 🔐 AUTH
    //////////////////////////////////////////////////////

    const user = await getUserFromRequest(req)

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    //////////////////////////////////////////////////////
    // 🌱 LOAD PRODUCER + FARMS
    //////////////////////////////////////////////////////

    const producer = await prisma.producer.findUnique({
      where: {
        userId: user.id,
      },
      include: {
        farms: {
          select: {
            id: true,
            name: true,
          },
          orderBy: {
            name: "asc",
          },
        },
      },
    })

    //////////////////////////////////////////////////////
    // 🧠 EDGE CASES
    //////////////////////////////////////////////////////

    // No producer profile yet
    if (!producer) {
      return NextResponse.json({
        farms: [],
        message:
          "No producer profile found. Please complete your onboarding first.",
      })
    }

    // No farms yet
    if (!producer.farms || producer.farms.length === 0) {
      return NextResponse.json({
        farms: [],
        message:
          "No farms found in your profile yet. You can create one or enter the Farm ID manually.",
      })
    }

    //////////////////////////////////////////////////////
    // ✅ SUCCESS
    //////////////////////////////////////////////////////

    return NextResponse.json({
      farms: producer.farms,
    })

  } catch (error) {
    console.error("❌ Farm context error:", error)

    return NextResponse.json(
      { error: "Failed to load farm context" },
      { status: 500 }
    )
  }
}