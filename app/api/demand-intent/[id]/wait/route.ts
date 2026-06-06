import { NextResponse } from "next/server"
import { requireAuth } from "@/src/lib/requireAuth"
import { waitForSupply, IntentServiceError } from "@/src/services/clients/demandIntent.service"

// ======================================================
// WAIT FOR SUPPLY — REJECTED → WAITING
// ======================================================

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()

    // CONTRACT-REQUEST-1 — only clients can act on demand intents.
    if (user.role !== "CLIENT") {
      return NextResponse.json({ error: "Forbidden", code: "FORBIDDEN" }, { status: 403 })
    }

    if (!user.companyId) {
      return NextResponse.json({ error: "User has no company" }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json().catch(() => ({}))

    // Default autoExecute to false so the buyer must explicitly
    // confirm before WAITING → OPEN flips supply into commitment.
    const intent = await waitForSupply({
      intentId: id,
      companyId: user.companyId,
      autoExecute: body?.autoExecute === true,
    })

    return NextResponse.json({ intent })

  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (error instanceof IntentServiceError) {
      const status = error.code === "FORBIDDEN" ? 403 : 400
      return NextResponse.json({ error: error.message, code: error.code }, { status })
    }
    console.error("WAIT FOR SUPPLY ERROR:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
