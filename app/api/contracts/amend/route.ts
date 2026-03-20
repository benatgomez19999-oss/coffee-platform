import { NextResponse } from "next/server"
import { prisma } from "@/database/prisma"
import { requireAuth } from "@/lib/requireAuth"

// ======================================================
// AMEND CONTRACT — SECURE + MULTI-TENANT
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

    const { contractId, monthlyVolumeKg } = await req.json()

    if (!contractId || !monthlyVolumeKg) {
      return NextResponse.json(
        { error: "Missing fields" },
        { status: 400 }
      )
    }

    // ======================================================
    // FETCH CONTRACT
    // ======================================================

    const contract = await prisma.contract.findUnique({
      where: { id: contractId }
    })

    if (!contract) {
      return NextResponse.json(
        { error: "Contract not found" },
        { status: 404 }
      )
    }

    // ======================================================
    // 🔥 CRITICAL: OWNERSHIP CHECK
    // ======================================================

    if (contract.companyId !== user.companyId) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    // ======================================================
    // UPDATE CONTRACT
    // ======================================================

    const updated = await prisma.contract.update({
      where: { id: contractId },
      data: {
        monthlyVolumeKg,
        bagsPerDelivery: Math.round(monthlyVolumeKg / 20)
      }
    })

    return NextResponse.json(updated)

  } catch (error: any) {

    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    console.error("❌ AMEND ERROR:", error)

    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    )
  }
}