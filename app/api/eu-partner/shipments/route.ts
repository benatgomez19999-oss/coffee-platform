import { NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/src/lib/getUserFromRequest"
import { listShipmentsForEuPartner } from "@/src/services/logistics/shipment.service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

//////////////////////////////////////////////////////
// GET — EU Partner lists shipments
//
// Returns all shipments ordered by createdAt desc,
// with their hydrated greenLots (lot info + farm +
// producer name/country).
//
// LOG-1: no pagination, no filtering. The set is small
// during the bridge phase. We can add filters later
// (status, ETA range, carrier) when traffic justifies it.
//////////////////////////////////////////////////////

export async function GET(req: NextRequest) {
  try {

    //////////////////////////////////////////////////////
    // 🔐 AUTH
    //////////////////////////////////////////////////////

    const user = await getUserFromRequest(req)

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (user.role !== "EU_PARTNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    //////////////////////////////////////////////////////
    // 🚢 LIST
    //////////////////////////////////////////////////////

    const shipments = await listShipmentsForEuPartner()

    return NextResponse.json({ shipments })

  } catch (err) {
    console.error("[EU_PARTNER_SHIPMENTS_LIST]", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
