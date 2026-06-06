import { NextRequest } from "next/server"
import { farmMediaItem } from "@/src/services/lot-media/lotMedia.routeHelpers"

export async function PATCH(
  req: NextRequest,
  { params }: { params: { farmId: string; mediaId: string } },
) {
  return farmMediaItem(req, params, "PRODUCER", "PATCH")
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { farmId: string; mediaId: string } },
) {
  return farmMediaItem(req, params, "PRODUCER", "DELETE")
}
