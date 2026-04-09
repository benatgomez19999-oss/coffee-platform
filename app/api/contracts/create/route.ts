import { NextResponse } from "next/server"
import { requireAuth } from "@/src/lib/requireAuth"
import {
  createContractWithSupplyValidation,
  ContractServiceError
} from "@/src/services/clients/contracts.service"

// ======================================================
// CREATE CONTRACT — USER SCOPED (MULTI-TENANT SAFE)
//
// Phase 1: requires greenLotId in contractDraft.supply
// to resolve real pricing from PricingSnapshot.
// Does NOT require demandIntentId yet (Phase 2+).
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

    const monthlyVolumeKg = contractDraft.supply.monthlyVolume
    const durationMonths = contractDraft.supply.duration
    const greenLotId = contractDraft.supply.greenLotId
    const demandIntentId = contractDraft.demandIntentId ?? undefined

    if (!monthlyVolumeKg || !durationMonths) {
      return NextResponse.json(
        { error: "Missing supply fields (monthlyVolume, duration)" },
        { status: 400 }
      )
    }

    if (!greenLotId) {
      return NextResponse.json(
        { error: "Missing greenLotId — a target coffee lot is required" },
        { status: 400 }
      )
    }

    // ======================================================
    // CREATE VIA SERVICE (supply validation + pricing)
    // ======================================================

    const contract = await createContractWithSupplyValidation({
      companyId: user.companyId,
      monthlyVolumeKg,
      durationMonths,
      greenLotId,
      demandIntentId,
    })

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

    if (error instanceof ContractServiceError) {
      const status = error.code === "FORBIDDEN" ? 403
        : error.code === "INSUFFICIENT_SUPPLY" ? 409
        : 400
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status }
      )
    }

    console.error("CREATE CONTRACT ERROR:", error)

    return NextResponse.json(
      { error: "Internal error", message: error?.message },
      { status: 500 }
    )
  }
}
