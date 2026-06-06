import { NextRequest } from "next/server"
import { lotMediaSignedUpload } from "@/src/services/lot-media/lotMedia.routeHelpers"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  return lotMediaSignedUpload(req, { lotId: params.id }, "PARTNER")
}
