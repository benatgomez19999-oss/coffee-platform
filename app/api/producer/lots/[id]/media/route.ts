import { NextRequest } from "next/server"
import { lotMediaCollection } from "@/src/services/lot-media/lotMedia.routeHelpers"

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  return lotMediaCollection(req, { lotId: params.id }, "PRODUCER", "GET")
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  return lotMediaCollection(req, { lotId: params.id }, "PRODUCER", "POST")
}
