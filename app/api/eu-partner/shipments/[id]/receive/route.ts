import { NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/src/lib/getUserFromRequest"
import {
  receiveShipment,
  ShipmentServiceError,
} from "@/src/services/logistics/shipment.service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

//////////////////////////////////////////////////////
// POST — EU Partner marks a shipment as received
//
// Idempotent:
//   - if status is already RECEIVED, returns the
//     current shipment as-is
//   - DISCREPANCY blocks the transition
//
// Out of scope (LOG-1):
//   - RoastBatch creation
//   - RoastedBatch creation
//   - Contract allocation
//   - GreenLot status changes
//////////////////////////////////////////////////////

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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
    // 📥 PARAM
    //////////////////////////////////////////////////////

    if (!params.id || typeof params.id !== "string") {
      return NextResponse.json(
        { error: "Invalid shipment id" },
        { status: 400 }
      )
    }

    //////////////////////////////////////////////////////
    // 🚢 RECEIVE
    //////////////////////////////////////////////////////

    const shipment = await receiveShipment({ shipmentId: params.id })

    return NextResponse.json({
      shipment: {
        id: shipment.id,
        status: shipment.status,
        receivedAt: shipment.receivedAt,
      },
    })

  } catch (err) {

    if (err instanceof ShipmentServiceError) {
      const status =
        err.code === "NOT_FOUND"            ? 404 :
        err.code === "DISCREPANCY_BLOCKED"  ? 409 :
        400

      return NextResponse.json(
        { error: err.message, code: err.code },
        { status }
      )
    }

    console.error("[EU_PARTNER_SHIPMENT_RECEIVE]", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
