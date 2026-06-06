import { NextResponse } from "next/server"
import { requireAuth } from "@/src/lib/requireAuth"
import {
  createDemandIntent,
  getIntentsByCompany,
  IntentServiceError,
} from "@/src/services/clients/demandIntent.service"
import { validateContractRequestInput } from "@/src/services/contract-request/contractRequest.pure"

// ======================================================
// DEMAND INTENT — CREATE (POST) / LIST (GET)
//
// CONTRACT-REQUEST-1 hardenings:
//   - role guard: only CLIENT can create or list intents
//   - payload validation via validateContractRequestInput
//   - duplicate-intent guard lives inside createDemandIntent
//     (Prisma transaction) and surfaces as a 409 here
// ======================================================

const ALLOWED_TYPES = new Set(["CREATE", "AMEND"])

export async function POST(req: Request) {
  try {
    const user = await requireAuth()

    if (user.role !== "CLIENT") {
      return NextResponse.json(
        { error: "Only client accounts can create supply requests.", code: "FORBIDDEN" },
        { status: 403 },
      )
    }

    if (!user.companyId) {
      return NextResponse.json(
        { error: "User has no company", code: "FORBIDDEN" },
        { status: 403 },
      )
    }

    const body = await req.json().catch(() => ({}))
    const validation = validateContractRequestInput({
      greenLotId: body?.greenLotId,
      requestedKg: body?.requestedKg,
      // CONTRACT-REQUEST-3 — accept both `durationMonths`
      // (modal sends this) and `requestedDurationMonths`
      // (matches the persisted field name).
      durationMonths:
        body?.durationMonths ?? body?.requestedDurationMonths,
      requestedStartDate: body?.requestedStartDate,
    })

    if (!validation.ok) {
      return NextResponse.json(
        { error: validation.error.message, code: validation.error.code },
        { status: 400 },
      )
    }

    // type / contractId — preserve the existing AMEND path. CREATE is
    // the default for the dashboard modal.
    const rawType = typeof body?.type === "string" ? body.type : "CREATE"
    if (!ALLOWED_TYPES.has(rawType)) {
      return NextResponse.json(
        { error: "Invalid request type.", code: "INVALID_TYPE" },
        { status: 400 },
      )
    }
    const contractId =
      typeof body?.contractId === "string" && body.contractId.trim() !== ""
        ? body.contractId.trim()
        : undefined

    const result = await createDemandIntent({
      companyId: user.companyId,
      greenLotId: validation.value.greenLotId,
      requestedKg: validation.value.requestedKg,
      type: rawType as "CREATE" | "AMEND",
      contractId,
      // CONTRACT-REQUEST-3 — persisted on the intent.
      requestedDurationMonths: validation.value.durationMonths,
      requestedStartDate: validation.value.requestedStartDate,
    })

    return NextResponse.json({
      intent: result.intent,
      semaphore: result.semaphore,
    })

  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (error instanceof IntentServiceError) {
      const status =
        error.code === "DUPLICATE_REQUEST" ? 409
          : error.code === "LOT_NOT_AVAILABLE" ? 404
            : 400
      const body: Record<string, unknown> = {
        error: error.message,
        code: error.code,
      }
      // Surface the existing intent id on 409 so the modal can offer
      // a "View pending request" affordance later if product wants it.
      const enriched = error as IntentServiceError & {
        existingIntentId?: string
        existingStatus?: string
      }
      if (enriched.existingIntentId) {
        body.existingIntentId = enriched.existingIntentId
        body.existingStatus = enriched.existingStatus
      }
      return NextResponse.json(body, { status })
    }
    console.error("CREATE DEMAND INTENT ERROR:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

export async function GET() {
  try {
    const user = await requireAuth()

    if (user.role !== "CLIENT") {
      return NextResponse.json(
        { error: "Forbidden", code: "FORBIDDEN" },
        { status: 403 },
      )
    }

    if (!user.companyId) {
      return NextResponse.json(
        { error: "User has no company", code: "FORBIDDEN" },
        { status: 403 },
      )
    }

    const intents = await getIntentsByCompany(user.companyId)

    return NextResponse.json({ intents })

  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("LIST DEMAND INTENTS ERROR:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
