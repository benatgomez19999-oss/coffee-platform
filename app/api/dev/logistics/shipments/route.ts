import { NextRequest, NextResponse } from "next/server"
import { requireDevRoute } from "@/src/lib/dev/requireDevRoute"
import { listShipmentsForEuPartner } from "@/src/services/logistics/shipment.service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

//////////////////////////////////////////////////////
// DEV — List all shipments (no role restriction)
//
// Wraps the same hydration shape used by the EU Partner
// list endpoint so the dev tool can render the same
// cards without needing role="EU_PARTNER".
//
// Guarded by NODE_ENV === "development".
//////////////////////////////////////////////////////

export async function GET(_req: NextRequest) {
  try {
    //////////////////////////////////////////////////////
    // 🔐 DEV-ONLY GUARD
    //////////////////////////////////////////////////////

    const guard = await requireDevRoute()
    if (!guard.ok) return guard.response

    //////////////////////////////////////////////////////
    // 🚢 LIST
    //////////////////////////////////////////////////////

    const shipments = await listShipmentsForEuPartner()

    return NextResponse.json({ shipments })
  } catch (error) {
    console.error("[DEV_LOGISTICS_SHIPMENTS_LIST]", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
