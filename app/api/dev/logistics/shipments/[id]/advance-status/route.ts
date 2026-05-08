import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/src/database/prisma"
import { requireDevRoute } from "@/src/lib/dev/requireDevRoute"
import {
  isDestinationStage,
  getNextDestinationStage,
  type DestinationStage,
} from "@/src/lib/logistics/destinationTracking"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

//////////////////////////////////////////////////////
// DEV — Force / advance Shipment status & destination
//        tracking stage  (LOG-2 + LOG-3A)
//
// Body shapes (any combination is valid, precedence
// listed below):
//
//   {}                                     → macro auto-advance
//   { status: "ARRIVED" }                  → force macro
//   { advanceStage: true }                 → next destination stage
//   { stage: "TO_CO_ROASTER" }             → force destination stage
//   { destinationCountry, requiresDestinationCustoms } → metadata
//
// Precedence (when multiple are passed):
//   1. destinationCountry / requiresDestinationCustoms
//      always applied to the update payload first
//   2. stage operations (advanceStage or stage) take
//      precedence over status — when present, they
//      drive the macro status indirectly
//   3. otherwise status (explicit or auto-advanced)
//
// Macro / stage cross-coupling:
//   - stage = ARRIVED_AT_ROTTERDAM_PORT
//       → macro = ARRIVED (unless RECEIVED/DISCREPANCY)
//       → arrivedAt = existing OR now
//   - stage = RECEIVED_BY_CLIENT
//       → macro = RECEIVED
//       → arrivedAt = existing OR now
//       → receivedAt = existing OR now
//   - any other destination stage
//       → if macro was IN_TRANSIT, bump to ARRIVED + arrivedAt
//       → otherwise leave macro as-is
//   - status = IN_TRANSIT (forced)
//       → reset arrivedAt = null, receivedAt = null,
//         currentStage = null
//
// Does NOT call receiveShipment(): dev must be able to
// force DISCREPANCY and reset back to IN_TRANSIT.
//
// Does NOT emit events.
//////////////////////////////////////////////////////

const VALID_SHIPMENT_STATUSES = [
  "IN_TRANSIT",
  "ARRIVED",
  "RECEIVED",
  "DISCREPANCY",
] as const

type ShipmentStatusValue = (typeof VALID_SHIPMENT_STATUSES)[number]

function isShipmentStatus(v: unknown): v is ShipmentStatusValue {
  return (
    typeof v === "string" &&
    (VALID_SHIPMENT_STATUSES as readonly string[]).includes(v)
  )
}

function nextAutoStatus(current: ShipmentStatusValue): ShipmentStatusValue {
  switch (current) {
    case "IN_TRANSIT":  return "ARRIVED"
    case "ARRIVED":     return "RECEIVED"
    case "RECEIVED":    return "RECEIVED"
    case "DISCREPANCY": return "DISCREPANCY"
  }
}

// =====================================================
// Update payload shape (kept narrow on purpose)
// =====================================================

type UpdatePayload = {
  status?: ShipmentStatusValue
  arrivedAt?: Date | null
  receivedAt?: Date | null
  currentStage?: DestinationStage | null
  destinationCountry?: string | null
  requiresDestinationCustoms?: boolean
}

// =====================================================
// Apply timestamp + macro rules for a STATUS transition
// =====================================================

function applyStatusRules(
  payload: UpdatePayload,
  current: { status: ShipmentStatusValue; arrivedAt: Date | null; receivedAt: Date | null },
  target: ShipmentStatusValue,
  now: Date
) {
  payload.status = target

  switch (target) {
    case "IN_TRANSIT":
      payload.arrivedAt = null
      payload.receivedAt = null
      payload.currentStage = null
      break
    case "ARRIVED":
      payload.arrivedAt = current.arrivedAt ?? now
      payload.receivedAt = null
      break
    case "RECEIVED":
      payload.arrivedAt = current.arrivedAt ?? now
      payload.receivedAt = current.receivedAt ?? now
      break
    case "DISCREPANCY":
      payload.arrivedAt = current.arrivedAt ?? now
      // receivedAt stays as-is
      break
  }
}

// =====================================================
// Apply timestamp + macro rules for a STAGE transition
// =====================================================

function applyStageRules(
  payload: UpdatePayload,
  current: {
    status: ShipmentStatusValue
    arrivedAt: Date | null
    receivedAt: Date | null
  },
  nextStage: DestinationStage,
  now: Date
) {
  payload.currentStage = nextStage

  if (nextStage === "ARRIVED_AT_ROTTERDAM_PORT") {
    if (current.status !== "RECEIVED" && current.status !== "DISCREPANCY") {
      payload.status = "ARRIVED"
      payload.arrivedAt = current.arrivedAt ?? now
    }
    return
  }

  if (nextStage === "RECEIVED_BY_CLIENT") {
    payload.status = "RECEIVED"
    payload.arrivedAt = current.arrivedAt ?? now
    payload.receivedAt = current.receivedAt ?? now
    return
  }

  // Any other destination stage: if still IN_TRANSIT, bump to ARRIVED
  if (current.status === "IN_TRANSIT") {
    payload.status = "ARRIVED"
    payload.arrivedAt = current.arrivedAt ?? now
  }
}

// =====================================================
// HANDLER
// =====================================================

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
      advanceStage?: unknown
      stage?: unknown
      destinationCountry?: unknown
      requiresDestinationCustoms?: unknown
    }

    // ----- Validate status (if present)
    let requestedStatus: ShipmentStatusValue | null = null
    if (body.status !== undefined && body.status !== null) {
      if (!isShipmentStatus(body.status)) {
        return NextResponse.json(
          { error: "Invalid shipment status" },
          { status: 400 }
        )
      }
      requestedStatus = body.status
    }

    // ----- Validate stage (if present)
    let requestedStage: DestinationStage | null = null
    if (body.stage !== undefined && body.stage !== null) {
      if (!isDestinationStage(body.stage)) {
        return NextResponse.json(
          { error: "Invalid destination stage" },
          { status: 400 }
        )
      }
      requestedStage = body.stage
    }

    // ----- Validate advanceStage (if present)
    const advanceStageRequested = body.advanceStage === true
    if (
      body.advanceStage !== undefined &&
      typeof body.advanceStage !== "boolean"
    ) {
      return NextResponse.json(
        { error: "advanceStage must be a boolean" },
        { status: 400 }
      )
    }

    // ----- Validate destinationCountry (if present)
    if (
      body.destinationCountry !== undefined &&
      body.destinationCountry !== null &&
      typeof body.destinationCountry !== "string"
    ) {
      return NextResponse.json(
        { error: "destinationCountry must be a string" },
        { status: 400 }
      )
    }

    // ----- Validate requiresDestinationCustoms (if present)
    if (
      body.requiresDestinationCustoms !== undefined &&
      typeof body.requiresDestinationCustoms !== "boolean"
    ) {
      return NextResponse.json(
        { error: "requiresDestinationCustoms must be a boolean" },
        { status: 400 }
      )
    }

    //////////////////////////////////////////////////////
    // 🚢 LOAD CURRENT
    //////////////////////////////////////////////////////

    const loaded = await prisma.shipment.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        status: true,
        arrivedAt: true,
        receivedAt: true,
        currentStage: true,
        destinationCountry: true,
        requiresDestinationCustoms: true,
      },
    })

    if (!loaded) {
      return NextResponse.json(
        { error: "Shipment not found" },
        { status: 404 }
      )
    }

    const current = {
      ...loaded,
      status: loaded.status as ShipmentStatusValue,
    }

    //////////////////////////////////////////////////////
    // 🎛️ BUILD UPDATE
    //////////////////////////////////////////////////////

    const now = new Date()
    const payload: UpdatePayload = {}

    // 1) Always-apply metadata fields
    if (body.destinationCountry !== undefined) {
      payload.destinationCountry =
        typeof body.destinationCountry === "string"
          ? body.destinationCountry.trim() || null
          : null
    }

    let effectiveRequiresCustoms = current.requiresDestinationCustoms
    if (typeof body.requiresDestinationCustoms === "boolean") {
      payload.requiresDestinationCustoms = body.requiresDestinationCustoms
      effectiveRequiresCustoms = body.requiresDestinationCustoms
    }

    // 2) Stage operations take precedence over status
    if (requestedStage !== null) {
      applyStageRules(payload, current, requestedStage, now)
    } else if (advanceStageRequested) {
      const nextStage = getNextDestinationStage(
        current.currentStage,
        effectiveRequiresCustoms
      )
      applyStageRules(payload, current, nextStage, now)
    } else if (requestedStatus !== null) {
      applyStatusRules(payload, current, requestedStatus, now)
    } else {
      // Empty body — keep LOG-2 macro auto-advance behavior
      const nextStatus = nextAutoStatus(current.status)
      applyStatusRules(payload, current, nextStatus, now)
    }

    //////////////////////////////////////////////////////
    // 💾 PERSIST
    //////////////////////////////////////////////////////

    const updated = await prisma.shipment.update({
      where: { id: current.id },
      data: payload,
      select: {
        id: true,
        reference: true,
        status: true,
        arrivedAt: true,
        receivedAt: true,
        currentStage: true,
        destinationCountry: true,
        requiresDestinationCustoms: true,
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
