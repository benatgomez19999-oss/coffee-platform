import { NextResponse } from "next/server"
import { prisma } from "@/database/prisma"
import { requireAuth } from "@/lib/requireAuth"

// ======================================================
// CREATE CONTRACT — USER SCOPED (MULTI-TENANT SAFE)
// ======================================================

export async function POST(req: Request) {

  try {

    // ======================================================
    // AUTH (GLOBAL GUARD)
    // ======================================================

    const user = await requireAuth()

    if (!user.companyId) {
      return NextResponse.json(
        { error: "User has no company" },
        { status: 403 }
      )
    }

    // ======================================================
    // BODY
    // ======================================================

    const body = await req.json()

    const {
      id,
      monthlyVolumeKg,
      durationMonths
    } = body

    // ======================================================
    // VALIDATION
    // ======================================================

    if (!id || !monthlyVolumeKg || !durationMonths) {
      return NextResponse.json(
        { error: "Missing fields" },
        { status: 400 }
      )
    }

    console.log("🟡 CREATE INPUT:", body)

    // ======================================================
    // CREATE CONTRACT (MULTI-TENANT SAFE)
    // ======================================================

    const contract = await prisma.contract.create({
      data: {
        id,

        // 🔥 clave: aislamiento por empresa
        companyId: user.companyId,

        // ======================================================
        // BUSINESS LOGIC
        // ======================================================

        monthlyVolumeKg,
        durationMonths,
        remainingMonths: durationMonths,

        // ======================================================
        // PRICING / DELIVERY
        // ======================================================

        bagsPerDelivery: Math.round(monthlyVolumeKg / 20),
        pricePerBag: 10,

        // ======================================================
        // TIMELINE
        // ======================================================

        startDate: new Date(),

        // ======================================================
        // STATUS
        // ======================================================

        status: "PENDING",
      }
    })

    console.log("🟢 CONTRACT CREATED:", contract)

    return NextResponse.json(contract)

  } catch (error: any) {

    // ======================================================
    // AUTH ERROR
    // ======================================================

    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    console.error("❌ CREATE CONTRACT ERROR:", error)

    return NextResponse.json(
      {
        error: "Internal error",
        message: error?.message
      },
      { status: 500 }
    )
  }
}