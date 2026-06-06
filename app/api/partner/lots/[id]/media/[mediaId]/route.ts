import { NextRequest } from "next/server"
import { lotMediaItem } from "@/src/services/lot-media/lotMedia.routeHelpers"

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; mediaId: string } },
) {
  return lotMediaItem(
    req,
    { lotId: params.id, mediaId: params.mediaId },
    "PARTNER",
    "PATCH",
  )
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; mediaId: string } },
) {
  return lotMediaItem(
    req,
    { lotId: params.id, mediaId: params.mediaId },
    "PARTNER",
    "DELETE",
  )
}
