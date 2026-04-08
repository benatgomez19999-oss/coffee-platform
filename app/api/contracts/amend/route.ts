import { NextResponse } from "next/server"
import { requireAuth } from "@/src/lib/requireAuth"
import {
  amendContractWithSupplyValidation,
  ContractServiceError
} from "@/src/services/clients/contracts.service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// ======================================================
// AMEND CONTRACT — SECURE + MULTI-TENANT
//
// Supports three cases:
//   A) Same-coffee increase: validates supply delta, keeps locked price
//   B) Same-coffee decrease: no supply validation, keeps locked price
//   C) Switch coffee: validates full volume on new lot, reprices
//
// Phase 1: does NOT require demandIntentId yet.
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

    const { contractId, monthlyVolumeKg, greenLotId } = await req.json()

    if (!contractId || !monthlyVolumeKg) {
      return NextResponse.json(
        { error: "Missing fields (contractId, monthlyVolumeKg)" },
        { status: 400 }
      )
    }

    // ======================================================
    // AMEND VIA SERVICE (supply validation + pricing logic)
    // ======================================================

    const updated = await amendContractWithSupplyValidation({
      contractId,
      companyId: user.companyId,
      monthlyVolumeKg,
      greenLotId: greenLotId ?? null,
    })

    return NextResponse.json(updated)

  } catch (error: any) {

    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    if (error instanceof ContractServiceError) {
      const status = error.code === "FORBIDDEN" ? 403
        : error.code === "CONTRACT_NOT_FOUND" ? 404
        : error.code === "INSUFFICIENT_SUPPLY" ? 409
        : 400
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status }
      )
    }

    console.error("AMEND ERROR:", error)

    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    )
  }
}
