import { NextResponse } from "next/server"
import { prisma } from "@/database/prisma"
import { requireAuth } from "@/lib/requireAuth"

// ======================================================
// CREATE CONTRACT — USER SCOPED (MULTI-TENANT SAFE)
// ======================================================

export async function POST(req: Request) {
  try {
    // ======================================================
    // AUTH
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
    const { contractDraft } = body

    // ======================================================
    // VALIDATION
    // ======================================================

    if (!contractDraft?.supply) {
      return NextResponse.json(
        { error: "Invalid contract draft" },
        { status: 400 }
      )
    }

    console.log("🟡 CREATE INPUT:", contractDraft)

    const monthlyVolumeKg = contractDraft.supply.monthlyVolume
    const durationMonths = contractDraft.supply.duration

    if (!monthlyVolumeKg || !durationMonths) {
      return NextResponse.json(
        { error: "Missing supply fields" },
        { status: 400 }
      )
    }

    // ======================================================
    // 💰 CALCULATE MONTHLY PRICE (🔥 NUEVO)
    // ======================================================

    const pricePerBag = 10
    const bagSizeKg = 20

    const bagsPerDelivery = Math.round(monthlyVolumeKg / bagSizeKg)
    const monthlyPrice = bagsPerDelivery * pricePerBag

    // ======================================================
    // CREATE CONTRACT
    // ======================================================

    const contract = await prisma.contract.create({
      data: {
        companyId: user.companyId,

        // BUSINESS
        monthlyVolumeKg,
        durationMonths,
        remainingMonths: durationMonths,

        // PRICING
        pricePerBag,
        bagSizeKg,
        bagsPerDelivery,
        monthlyPrice, // 🔥 FIX CLAVE

        // TIMELINE
        startDate: new Date(),

        // STATUS
        status: "AWAITING_SIGNATURE",
      }
    })

    console.log("🟢 CONTRACT CREATED:", contract)

    return NextResponse.json({
      success: true,
      contractId: contract.id
    })

  } catch (error: any) {

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