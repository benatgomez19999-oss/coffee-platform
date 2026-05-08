import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/src/database/prisma"
import { requireDevRoute } from "@/src/lib/dev/requireDevRoute"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

//////////////////////////////////////////////////////
// DEV — Force / advance Shipment status
//
// Body:
//   {}                           ← auto-advance to next
//   { status: "ARRIVED" }        ← force any valid status
//
// Auto-advance flow:
//   IN_TRANSIT  → ARRIVED
//   ARRIVED     → RECEIVED
//   RECEIVED    → RECEIVED   (no-op)
//   DISCREPANCY → DISCREPANCY (no-op; manual reset required)
//
// Manual force allows ANY of:
//   IN_TRANSIT  ARRIVED  RECEIVED  DISCREPANCY
//
// Timestamp rules (applied at write time):
//   IN_TRANSIT  → arrivedAt = null,            receivedAt = null
//   ARRIVED     → arrivedAt = existing OR now, receivedAt = null
//   RECEIVED    → arrivedAt = existing OR now, receivedAt = existing OR now
//   DISCREPANCY → arrivedAt = existing OR now, receivedAt = unchanged
//
// Does NOT call receiveShipment(): dev must be able to
// force DISCREPANCY and reset back to IN_TRANSIT.
//
// Does NOT emit events.
//
// Guarded by NODE_ENV === "development".
//////////////////////////////////////////////////////

const VALID_SHIPMENT_STATUSES = [
  "IN_TRANSIT",
  "ARRIVED",
  "RECEIVED",
  "DISCREPANCY",
] as const

type ShipmentStatusValue = (typeof VALID_SHIPMENT_STATUSES)[number]

function nextAuto(current: ShipmentStatusValue): ShipmentStatusValue {
  switch (current) {
    case "IN_TRANSIT":  return "ARRIVED"
    case "ARRIVED":     return "RECEIVED"
    case "RECEIVED":    return "RECEIVED"
    case "DISCREPANCY": return "DISCREPANCY"
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    //////////////////////////////////////////////////////
    // 🔐 DEV-ONLY GUARD
    //////////////////////////////////////////////////////

    const guard = await requireDevRoute()
    if (!guard.ok) return guard.response

    //////////////////////////////////////////////////////
    // 📥 INPUT
    //////////////////////////////////////////////////////

    if (!params.id || typeof params.id !== "string") {
      return NextResponse.json(
        { error: "Invalid shipment id" },
        { status: 400 }
      )
    }

    const body = (await req.json().catch(() => ({}))) as {
      status?: unknown
    }

    let requestedStatus: ShipmentStatusValue | null = null

    if (body.status !== undefined && body.status !== null) {
      if (
        typeof body.status !== "string" ||
        !VALID_SHIPMENT_STATUSES.includes(body.status as ShipmentStatusValue)
      ) {
        return NextResponse.json(
          { error: "Invalid shipment status" },
          { status: 400 }
        )
      }
      requestedStatus = body.status as ShipmentStatusValue
    }

    //////////////////////////////////////////////////////
    // 🚢 LOAD CURRENT
    //////////////////////////////////////////////////////

    const current = await prisma.shipment.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        status: true,
        arrivedAt: true,
        receivedAt: true,
      },
    })

    if (!current) {
      return NextResponse.json(
        { error: "Shipment not found" },
        { status: 404 }
      )
    }

    //////////////////////////////////////////////////////
    // 🎛️ RESOLVE TARGET STATUS
    //////////////////////////////////////////////////////

    const target: ShipmentStatusValue =
      requestedStatus ?? nextAuto(current.status as ShipmentStatusValue)

    //////////////////////////////////////////////////////
    // ⏱️ TIMESTAMP RULES
    //////////////////////////////////////////////////////

    const now = new Date()

    let arrivedAt: Date | null = current.arrivedAt
    let receivedAt: Date | null = current.receivedAt

    switch (target) {
      case "IN_TRANSIT":
        arrivedAt = null
        receivedAt = null
        break
      case "ARRIVED":
        arrivedAt = current.arrivedAt ?? now
        receivedAt = null
        break
      case "RECEIVED":
        arrivedAt = current.arrivedAt ?? now
        receivedAt = current.receivedAt ?? now
        break
      case "DISCREPANCY":
        arrivedAt = current.arrivedAt ?? now
        // receivedAt stays as-is (only set if it already was)
        break
    }

    //////////////////////////////////////////////////////
    // 💾 PERSIST
    //////////////////////////////////////////////////////

    const updated = await prisma.shipment.update({
      where: { id: current.id },
      data: {
        status: target,
        arrivedAt,
        receivedAt,
      },
      select: {
        id: true,
        reference: true,
        status: true,
        arrivedAt: true,
        receivedAt: true,
      },
    })

    return NextResponse.json({ shipment: updated })
  } catch (error) {
    console.error("[DEV_LOGISTICS_SHIPMENT_ADVANCE]", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
