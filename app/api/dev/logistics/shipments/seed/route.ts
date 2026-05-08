import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/src/database/prisma"
import { requireDevRoute } from "@/src/lib/dev/requireDevRoute"
import {
  createShipment,
  ShipmentServiceError,
} from "@/src/services/logistics/shipment.service"
import {
  isDestinationStage,
  type DestinationStage,
} from "@/src/lib/logistics/destinationTracking"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

//////////////////////////////////////////////////////
// DEV — Seed a Shipment with sensible defaults
//
// Reuses the real LOG-1 transaction:
//   - creates Shipment (IN_TRANSIT)
//   - links GreenLots
//   - flips GreenLot.status to RESERVED
//
// Body (all optional):
//   {
//     reference?:       string
//     greenLotIds?:     string[]
//     carrier?:         string
//     vesselOrFlight?:  string
//     etaAt?:           ISO date string
//   }
//
// Defaults:
//   reference        = "DEV-SHIP-" + Date.now()
//   carrier          = "Dev Carrier"
//   vesselOrFlight   = "Dev Vessel"
//   etaAt            = now + 14 days
//   greenLotIds      = first PUBLISHED GreenLot with shipmentId=null
//
// Guarded by NODE_ENV === "development".
//////////////////////////////////////////////////////

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000

export async function POST(req: NextRequest) {
  try {
    //////////////////////////////////////////////////////
    // 🔐 DEV-ONLY GUARD
    //////////////////////////////////////////////////////

    const guard = await requireDevRoute()
    if (!guard.ok) return guard.response

    //////////////////////////////////////////////////////
    // 📥 PARSE BODY (all optional)
    //////////////////////////////////////////////////////

    const body = (await req.json().catch(() => ({}))) as {
      reference?: unknown
      greenLotIds?: unknown
      carrier?: unknown
      vesselOrFlight?: unknown
      etaAt?: unknown
      destinationCountry?: unknown
      requiresDestinationCustoms?: unknown
      currentStage?: unknown
    }

    //////////////////////////////////////////////////////
    // 🌱 RESOLVE GREEN LOT IDS
    //////////////////////////////////////////////////////

    let greenLotIds: string[] = []

    if (Array.isArray(body.greenLotIds)) {
      greenLotIds = body.greenLotIds.filter(
        (id): id is string => typeof id === "string" && id.length > 0
      )
    }

    if (greenLotIds.length === 0) {
      const candidate = await prisma.greenLot.findFirst({
        where: {
          status: "PUBLISHED",
          shipmentId: null,
        },
        select: { id: true },
        orderBy: { createdAt: "asc" },
      })

      if (!candidate) {
        return NextResponse.json(
          { error: "No shippable published GreenLot found" },
          { status: 400 }
        )
      }

      greenLotIds = [candidate.id]
    }

    //////////////////////////////////////////////////////
    // 🌱 RESOLVE OPTIONAL DEFAULTS
    //////////////////////////////////////////////////////

    const reference =
      typeof body.reference === "string" && body.reference.trim().length > 0
        ? body.reference.trim()
        : `DEV-SHIP-${Date.now()}`

    const carrier =
      typeof body.carrier === "string" && body.carrier.trim().length > 0
        ? body.carrier.trim()
        : "Dev Carrier"

    const vesselOrFlight =
      typeof body.vesselOrFlight === "string" &&
      body.vesselOrFlight.trim().length > 0
        ? body.vesselOrFlight.trim()
        : "Dev Vessel"

    let etaAt: Date | null
    if (typeof body.etaAt === "string" && body.etaAt.length > 0) {
      const parsed = new Date(body.etaAt)
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json(
          { error: "Invalid etaAt" },
          { status: 400 }
        )
      }
      etaAt = parsed
    } else {
      etaAt = new Date(Date.now() + FOURTEEN_DAYS_MS)
    }

    //////////////////////////////////////////////////////
    // 📍 LOG-3A — destination defaults
    //
    // - destinationCountry: pass-through if string, else null
    // - requiresDestinationCustoms:
    //     explicit body wins; otherwise true iff country=Norway
    // - currentStage: null by default (shipment is still
    //   IN_TRANSIT macro). Body may override for testing.
    //////////////////////////////////////////////////////

    const destinationCountry =
      typeof body.destinationCountry === "string" &&
      body.destinationCountry.trim().length > 0
        ? body.destinationCountry.trim()
        : null

    let requiresDestinationCustoms: boolean
    if (typeof body.requiresDestinationCustoms === "boolean") {
      requiresDestinationCustoms = body.requiresDestinationCustoms
    } else {
      requiresDestinationCustoms =
        destinationCountry?.toLowerCase() === "norway"
    }

    let currentStage: DestinationStage | null = null
    if (body.currentStage !== undefined && body.currentStage !== null) {
      if (!isDestinationStage(body.currentStage)) {
        return NextResponse.json(
          { error: "Invalid currentStage" },
          { status: 400 }
        )
      }
      currentStage = body.currentStage
    }

    //////////////////////////////////////////////////////
    // 🚢 CREATE (real LOG-1 transaction)
    //////////////////////////////////////////////////////

    const shipment = await createShipment({
      reference,
      carrier,
      vesselOrFlight,
      etaAt,
      greenLotIds,
      destinationCountry,
      requiresDestinationCustoms,
      currentStage,
    })

    return NextResponse.json({ shipment })
  } catch (err) {
    if (err instanceof ShipmentServiceError) {
      const status =
        err.code === "DUPLICATE_REFERENCE"   ? 409 :
        err.code === "LOT_ALREADY_SHIPPED"   ? 409 :
        err.code === "LOT_NOT_FOUND"         ? 404 :
        400

      return NextResponse.json(
        { error: err.message, code: err.code },
        { status }
      )
    }

    console.error("[DEV_LOGISTICS_SHIPMENTS_SEED]", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
