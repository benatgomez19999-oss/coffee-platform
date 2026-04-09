import { NextResponse } from "next/server"
import { requireAuth } from "@/src/lib/requireAuth"
import {
  getIntentById,
  IntentServiceError,
} from "@/src/services/clients/demandIntent.service"

// ======================================================
// DEMAND INTENT — GET BY ID
// ======================================================

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()

    if (!user.companyId) {
      return NextResponse.json({ error: "User has no company" }, { status: 403 })
    }

    const { id } = await params
    const intent = await getIntentById(id, user.companyId)

    return NextResponse.json({ intent })

  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (error instanceof IntentServiceError) {
      const status = error.code === "FORBIDDEN" ? 403 : error.code === "NOT_FOUND" ? 404 : 400
      return NextResponse.json({ error: error.message, code: error.code }, { status })
    }
    console.error("GET DEMAND INTENT ERROR:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
