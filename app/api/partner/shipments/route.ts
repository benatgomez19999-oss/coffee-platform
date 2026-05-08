import { NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/src/lib/getUserFromRequest"
import {
  createShipment,
  ShipmentServiceError,
} from "@/src/services/logistics/shipment.service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

//////////////////////////////////////////////////////
// POST — Origin Partner creates a shipment
//
// Body:
//   {
//     reference:       string  (required, unique)
//     carrier:         string? (optional)
//     vesselOrFlight:  string? (optional)
//     etaAt:           string? (ISO date, optional)
//     greenLotIds:     string[] (required, non-empty)
//   }
//
// All selected lots must be:
//   - existing
//   - status PUBLISHED
//   - not already in another shipment
//
// On success:
//   - Shipment is created with status IN_TRANSIT
//   - all lots flip to status RESERVED with shipmentId set
//////////////////////////////////////////////////////

export async function POST(req: NextRequest) {
  try {

    //////////////////////////////////////////////////////
    // 🔐 AUTH
    //////////////////////////////////////////////////////

    const user = await getUserFromRequest(req)

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (user.role !== "PARTNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    //////////////////////////////////////////////////////
    // 📥 BODY
    //////////////////////////////////////////////////////

    const body = await req.json().catch(() => null)

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      )
    }

    const {
      reference,
      carrier,
      vesselOrFlight,
      etaAt,
      greenLotIds,
    } = body as Record<string, unknown>

    //////////////////////////////////////////////////////
    // 🛡️ INPUT VALIDATION
    //////////////////////////////////////////////////////

    if (typeof reference !== "string" || reference.trim().length === 0) {
      return NextResponse.json(
        { error: "reference is required" },
        { status: 400 }
      )
    }

    if (
      !Array.isArray(greenLotIds) ||
      greenLotIds.length === 0 ||
      !greenLotIds.every((id) => typeof id === "string" && id.length > 0)
    ) {
      return NextResponse.json(
        { error: "greenLotIds must be a non-empty array of strings" },
        { status: 400 }
      )
    }

    let parsedEta: Date | null = null
    if (etaAt !== undefined && etaAt !== null && etaAt !== "") {
      if (typeof etaAt !== "string") {
        return NextResponse.json(
          { error: "etaAt must be an ISO date string" },
          { status: 400 }
        )
      }
      const d = new Date(etaAt)
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json(
          { error: "etaAt is not a valid date" },
          { status: 400 }
        )
      }
      parsedEta = d
    }

    if (carrier !== undefined && carrier !== null && typeof carrier !== "string") {
      return NextResponse.json(
        { error: "carrier must be a string" },
        { status: 400 }
      )
    }

    if (
      vesselOrFlight !== undefined &&
      vesselOrFlight !== null &&
      typeof vesselOrFlight !== "string"
    ) {
      return NextResponse.json(
        { error: "vesselOrFlight must be a string" },
        { status: 400 }
      )
    }

    //////////////////////////////////////////////////////
    // 🚢 CREATE
    //////////////////////////////////////////////////////

    const shipment = await createShipment({
      reference,
      carrier: (carrier as string | undefined) ?? null,
      vesselOrFlight: (vesselOrFlight as string | undefined) ?? null,
      etaAt: parsedEta,
      greenLotIds: greenLotIds as string[],
    })

    return NextResponse.json({ shipment })

  } catch (err) {

    if (err instanceof ShipmentServiceError) {
      const status =
        err.code === "DUPLICATE_REFERENCE" ? 409 :
        err.code === "LOT_ALREADY_SHIPPED" ? 409 :
        err.code === "LOT_NOT_FOUND"       ? 404 :
        400

      return NextResponse.json(
        { error: err.message, code: err.code },
        { status }
      )
    }

    console.error("[PARTNER_SHIPMENT_CREATE]", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
