import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/src/database/prisma"
import { requireDevRoute } from "@/src/lib/dev/requireDevRoute"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

//////////////////////////////////////////////////////
// DEV — Unified read-only tracking endpoint
//
// Returns the data needed to render LOG-3 tracking
// panel: every ProducerLotDraft (regardless of status,
// across all producers) with its hydrated GreenLot +
// linked Shipment, plus every Shipment with hydrated
// lots.
//
// READ ONLY · NO writes · NO events.
// Guarded by NODE_ENV === "development".
//
// Caps:
//   take 100 sample lots, 100 shipments — enough for
//   any dev environment, prevents accidental dumps.
//////////////////////////////////////////////////////

const TAKE_LIMIT = 100

export async function GET(_req: NextRequest) {
  try {
    //////////////////////////////////////////////////////
    // 🔐 DEV-ONLY GUARD
    //////////////////////////////////////////////////////

    const guard = await requireDevRoute()
    if (!guard.ok) return guard.response

    //////////////////////////////////////////////////////
    // 📋 SAMPLE LOTS — full ProducerLotDraft history
    //////////////////////////////////////////////////////

    const sampleLots = await prisma.producerLotDraft.findMany({
      orderBy: { createdAt: "desc" },
      take: TAKE_LIMIT,
      select: {
        id: true,
        lotNumber: true,
        name: true,
        variety: true,
        process: true,
        harvestYear: true,
        status: true,
        sampleShippingStatus: true,
        createdAt: true,
        greenLot: {
          select: {
            id: true,
            status: true,
            scaScore: true,
            totalKg: true,
            availableKg: true,
            shipmentId: true,
            farm: {
              select: {
                name: true,
                region: true,
                producer: {
                  select: { name: true, country: true },
                },
              },
            },
            shipment: {
              select: {
                id: true,
                reference: true,
                status: true,
              },
            },
          },
        },
      },
    })

    //////////////////////////////////////////////////////
    // 🚢 SHIPMENTS — full hydration (mirror of EU list)
    //////////////////////////////////////////////////////

    const shipments = await prisma.shipment.findMany({
      orderBy: { createdAt: "desc" },
      take: TAKE_LIMIT,
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

    return NextResponse.json({ sampleLots, shipments })
  } catch (error) {
    console.error("[DEV_LOGISTICS_TRACKING]", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
