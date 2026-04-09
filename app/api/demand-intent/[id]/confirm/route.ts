import { NextResponse } from "next/server"
import { requireAuth } from "@/src/lib/requireAuth"
import { confirmWaiting, IntentServiceError } from "@/src/services/clients/demandIntent.service"

// ======================================================
// CONFIRM WAITING — WAITING → OPEN
// ======================================================

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()

    if (!user.companyId) {
      return NextResponse.json({ error: "User has no company" }, { status: 403 })
    }

    const { id } = await params
    const intent = await confirmWaiting({ intentId: id, companyId: user.companyId })

    return NextResponse.json({ intent })

  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (error instanceof IntentServiceError) {
      const status = error.code === "FORBIDDEN" ? 403
        : error.code === "INSUFFICIENT_SUPPLY" ? 409
        : 400
      return NextResponse.json({ error: error.message, code: error.code }, { status })
    }
    console.error("CONFIRM WAITING ERROR:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
