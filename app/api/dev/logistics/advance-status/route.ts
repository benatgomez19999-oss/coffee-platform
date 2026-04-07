import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/src/database/prisma"

export async function POST(req: NextRequest) {
  try {
    const { lotDraftId } = await req.json()

    if (!lotDraftId) {
      return NextResponse.json(
        { error: "Missing lotDraftId" },
        { status: 400 }
      )
    }

    const lotDraft = await prisma.producerLotDraft.findUnique({
      where: { id: lotDraftId },
    })

    if (!lotDraft) {
      return NextResponse.json(
        { error: "Lot draft not found" },
        { status: 404 }
      )
    }

    if (lotDraft.status === "IN_REVIEW") {
      return NextResponse.json({
        success: true,
        message: "Lot already in review",
        lotDraft,
      })
    }

    let nextShippingStatus = lotDraft.sampleShippingStatus
    let nextLotStatus = lotDraft.status

    if (lotDraft.sampleShippingStatus === "PICKUP_REQUESTED") {
      nextShippingStatus = "PICKUP_SCHEDULED"
    } else if (lotDraft.sampleShippingStatus === "PICKUP_SCHEDULED") {
      nextShippingStatus = "IN_TRANSIT"
    } else if (lotDraft.sampleShippingStatus === "IN_TRANSIT") {
      nextShippingStatus = "DELIVERED"
      nextLotStatus = "IN_REVIEW"
    }

    const updated = await prisma.producerLotDraft.update({
      where: { id: lotDraftId },
      data: {
        status: nextLotStatus,
        sampleShippingStatus: nextShippingStatus,
      },
    })

    return NextResponse.json({
      success: true,
      lotDraft: updated,
    })
  } catch (error) {
    console.error("ADVANCE LOGISTICS STATUS ERROR:", error)

    return NextResponse.json(
      { error: "Failed to advance logistics status" },
      { status: 500 }
    )
  }
}