import { prisma } from "@/src/database/prisma"

// =====================================================
// SHIPMENT SERVICE — LOG-1 (Origin → EU bridge)
//
// Single source of truth for:
//   - createShipment   (Origin Partner)
//   - receiveShipment  (EU Partner)
//   - listShipmentsForEuPartner
//
// State machine:
//   IN_TRANSIT  → ARRIVED   (manual, optional)
//   IN_TRANSIT  → RECEIVED
//   ARRIVED     → RECEIVED
//   *           → DISCREPANCY (manual; blocks RECEIVED)
//
// Out of scope for LOG-1:
//   - carrier integration
//   - tracking webhooks
//   - RoastBatch / RoastedBatch creation
//   - contract allocation
//   - GreenLot.SOLD transition
// =====================================================

// ------------------------------------------------------
// ERROR TYPE
// ------------------------------------------------------

export class ShipmentServiceError extends Error {
  code: string
  constructor(message: string, code: string) {
    super(message)
    this.name = "ShipmentServiceError"
    this.code = code
  }
}

// ------------------------------------------------------
// INPUT / OUTPUT TYPES
// ------------------------------------------------------

export type CreateShipmentInput = {
  reference: string
  carrier?: string | null
  vesselOrFlight?: string | null
  etaAt?: Date | null
  greenLotIds: string[]
}

export type ReceiveShipmentInput = {
  shipmentId: string
}

// ------------------------------------------------------
// CREATE SHIPMENT
//
// Transactional:
//   1. Validate reference uniqueness
//   2. Validate every lot exists, is PUBLISHED, and is
//      not already in another shipment
//   3. Create Shipment with status IN_TRANSIT
//   4. Update lots: shipmentId = shipment.id, status = RESERVED
// ------------------------------------------------------

export async function createShipment(input: CreateShipmentInput) {

  const reference = (input.reference ?? "").trim()
  const carrier = input.carrier?.trim() || null
  const vesselOrFlight = input.vesselOrFlight?.trim() || null
  const etaAt = input.etaAt ?? null

  // ---------------------------------------------------
  // PRE-VALIDATION
  // ---------------------------------------------------

  if (!reference) {
    throw new ShipmentServiceError(
      "Reference is required",
      "INVALID_REFERENCE"
    )
  }

  if (!Array.isArray(input.greenLotIds) || input.greenLotIds.length === 0) {
    throw new ShipmentServiceError(
      "At least one greenLotId is required",
      "INVALID_LOTS"
    )
  }

  const uniqueIds = Array.from(new Set(input.greenLotIds.filter(Boolean)))

  if (uniqueIds.length === 0) {
    throw new ShipmentServiceError(
      "At least one valid greenLotId is required",
      "INVALID_LOTS"
    )
  }

  // ---------------------------------------------------
  // TRANSACTION
  // ---------------------------------------------------

  const shipment = await prisma.$transaction(async (tx) => {

    //////////////////////////////////////////////////////
    // 1. UNIQUENESS GUARD ON REFERENCE
    //////////////////////////////////////////////////////

    const existing = await tx.shipment.findUnique({
      where: { reference },
      select: { id: true },
    })

    if (existing) {
      throw new ShipmentServiceError(
        `Shipment reference already exists: ${reference}`,
        "DUPLICATE_REFERENCE"
      )
    }

    //////////////////////////////////////////////////////
    // 2. LOAD + VALIDATE LOTS
    //////////////////////////////////////////////////////

    const lots = await tx.greenLot.findMany({
      where: { id: { in: uniqueIds } },
      select: {
        id: true,
        lotNumber: true,
        status: true,
        shipmentId: true,
      },
    })

    if (lots.length !== uniqueIds.length) {
      const found = new Set(lots.map((l) => l.id))
      const missing = uniqueIds.filter((id) => !found.has(id))
      throw new ShipmentServiceError(
        `GreenLot not found: ${missing.join(", ")}`,
        "LOT_NOT_FOUND"
      )
    }

    const notPublished = lots.filter((l) => l.status !== "PUBLISHED")
    if (notPublished.length > 0) {
      throw new ShipmentServiceError(
        `GreenLot not in PUBLISHED status: ${notPublished
          .map((l) => l.lotNumber)
          .join(", ")}`,
        "LOT_NOT_PUBLISHED"
      )
    }

    const alreadyShipped = lots.filter((l) => l.shipmentId !== null)
    if (alreadyShipped.length > 0) {
      throw new ShipmentServiceError(
        `GreenLot already in another shipment: ${alreadyShipped
          .map((l) => l.lotNumber)
          .join(", ")}`,
        "LOT_ALREADY_SHIPPED"
      )
    }

    //////////////////////////////////////////////////////
    // 3. CREATE SHIPMENT
    //////////////////////////////////////////////////////

    const created = await tx.shipment.create({
      data: {
        reference,
        carrier,
        vesselOrFlight,
        etaAt,
        status: "IN_TRANSIT",
      },
    })

    //////////////////////////////////////////////////////
    // 4. RESERVE LOTS
    //////////////////////////////////////////////////////

    await tx.greenLot.updateMany({
      where: { id: { in: uniqueIds } },
      data: {
        shipmentId: created.id,
        status: "RESERVED",
      },
    })

    //////////////////////////////////////////////////////
    // 5. RETURN HYDRATED SHIPMENT
    //////////////////////////////////////////////////////

    return tx.shipment.findUnique({
      where: { id: created.id },
      include: {
        greenLots: {
          select: {
            id: true,
            lotNumber: true,
            variety: true,
            process: true,
            harvestYear: true,
            totalKg: true,
            availableKg: true,
            status: true,
            farm: {
              select: {
                name: true,
                region: true,
                producer: {
                  select: { name: true, country: true },
                },
              },
            },
          },
        },
      },
    })
  })

  // tx returned a non-null record because we just created it
  if (!shipment) {
    throw new ShipmentServiceError(
      "Shipment hydration failed",
      "HYDRATION_FAILED"
    )
  }

  return shipment
}

// ------------------------------------------------------
// RECEIVE SHIPMENT
//
//   - idempotent: if already RECEIVED, return as-is
//   - rejects DISCREPANCY (no auto-receive)
//   - GreenLots remain RESERVED for now
// ------------------------------------------------------

export async function receiveShipment(input: ReceiveShipmentInput) {

  const shipment = await prisma.shipment.findUnique({
    where: { id: input.shipmentId },
  })

  if (!shipment) {
    throw new ShipmentServiceError("Shipment not found", "NOT_FOUND")
  }

  if (shipment.status === "RECEIVED") {
    return shipment
  }

  if (shipment.status === "DISCREPANCY") {
    throw new ShipmentServiceError(
      "Cannot receive a shipment in DISCREPANCY status without explicit override",
      "DISCREPANCY_BLOCKED"
    )
  }

  return prisma.shipment.update({
    where: { id: shipment.id },
    data: {
      status: "RECEIVED",
      receivedAt: new Date(),
    },
  })
}

// ------------------------------------------------------
// LIST SHIPMENTS — EU PARTNER VIEW
// ------------------------------------------------------

export async function listShipmentsForEuPartner() {
  return prisma.shipment.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      greenLots: {
        select: {
          id: true,
          lotNumber: true,
          variety: true,
          process: true,
          harvestYear: true,
          totalKg: true,
          availableKg: true,
          status: true,
          farm: {
            select: {
              name: true,
              region: true,
              producer: {
                select: { name: true, country: true },
              },
            },
          },
        },
      },
    },
  })
}
