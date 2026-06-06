import { NextRequest } from "next/server"
import { farmMediaCollection } from "@/src/services/lot-media/lotMedia.routeHelpers"

export async function GET(
  req: NextRequest,
  { params }: { params: { farmId: string } },
) {
  return farmMediaCollection(req, params, "PRODUCER", "GET")
}

export async function POST(
  req: NextRequest,
  { params }: { params: { farmId: string } },
) {
  return farmMediaCollection(req, params, "PRODUCER", "POST")
}
