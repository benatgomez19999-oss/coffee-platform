import { gateDevPage } from "@/src/lib/dev/gateDevPage"
import TestSetupPanel from "@/src/components/dev/test-setup/TestSetupPanel"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

//////////////////////////////////////////////////////
// 🧪 /dev/test-setup
// DEV-TEST-SETUP-1
//
// Pre-round setup surface for UI test automation.
// Lets a Chrome agent reset intents/contracts and
// switch role with clicks — no DevTools cookie
// injection, no curl, no env secrets in the bundle.
//
// Server-side guard via gateDevPage(): renders 404
// when VERCEL_ENV === "production" OR when
// INTERNAL_DEV_TOOLS_ENABLED !== "true".
//
// The page is a Server Component shell; all clicks
// flow through the dev-only API wrappers under
// /api/dev/test-setup/*, which read the dev secret
// server-side so it never enters the bundle.
//////////////////////////////////////////////////////

export default function DevTestSetupPage() {
  gateDevPage()
  return <TestSetupPanel />
}
