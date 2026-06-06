import { NextRequest } from "next/server"
import { farmMediaSignedUpload } from "@/src/services/lot-media/lotMedia.routeHelpers"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(
  req: NextRequest,
  { params }: { params: { farmId: string } },
) {
  return farmMediaSignedUpload(req, params, "PRODUCER")
}
