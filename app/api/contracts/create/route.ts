import { NextResponse } from "next/server"
import { prisma } from "@/database/prisma"
import { requireAuth } from "@/lib/requireAuth"

// ======================================================
// CREATE CONTRACT — USER SCOPED (MULTI-TENANT SAFE)
// FIXED: soporta contractDraft (nuevo flow)
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
      contractDraft
    } = body

    // ======================================================
    // VALIDATION (FIXED)
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
    // CREATE CONTRACT (MULTI-TENANT SAFE)
    // ======================================================

    const contract = await prisma.contract.create({
      data: {
        // 🔥 id auto generado por prisma (no lo pasamos manualmente)

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
        // STATUS (IMPORTANTE)
        // ======================================================

        status: "AWAITING_SIGNATURE",
      }
    })

    console.log("🟢 CONTRACT CREATED:", contract)

    // ======================================================
    // SUCCESS (IMPORTANTE: devolvemos contractId)
    // ======================================================

    return NextResponse.json({
      success: true,
      contractId: contract.id
    })

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