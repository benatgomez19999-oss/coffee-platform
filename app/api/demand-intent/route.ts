import { NextResponse } from "next/server"
import { requireAuth } from "@/src/lib/requireAuth"
import {
  createDemandIntent,
  getIntentsByCompany,
  IntentServiceError,
} from "@/src/services/clients/demandIntent.service"

// ======================================================
// DEMAND INTENT — CREATE (POST) / LIST (GET)
// ======================================================

export async function POST(req: Request) {
  try {
    const user = await requireAuth()

    if (!user.companyId) {
      return NextResponse.json({ error: "User has no company" }, { status: 403 })
    }

    const body = await req.json()
    const { greenLotId, requestedKg, type, contractId } = body

    if (!greenLotId || !requestedKg) {
      return NextResponse.json(
        { error: "Missing required fields: greenLotId, requestedKg" },
        { status: 400 }
      )
    }

    const result = await createDemandIntent({
      companyId: user.companyId,
      greenLotId,
      requestedKg,
      type: type ?? "CREATE",
      contractId,
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
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 }
      )
    }
    console.error("CREATE DEMAND INTENT ERROR:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

export async function GET() {
  try {
    const user = await requireAuth()

    if (!user.companyId) {
      return NextResponse.json({ error: "User has no company" }, { status: 403 })
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
