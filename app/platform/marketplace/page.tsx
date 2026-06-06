import { redirect } from "next/navigation"
import { getUserFromRequest } from "@/src/lib/getUserFromRequest"
import MarketplacePage from "@/src/components/platform/marketplace/MarketplacePage"
import { getMarketplaceLotsView } from "@/src/services/allocation/marketplace/marketplaceView.service"
import type { MarketplaceLotsResponse } from "@/src/services/allocation/marketplace/marketplaceLot.mapper"

export const dynamic = "force-dynamic"

//////////////////////////////////////////////////////
// 🛍️ /platform/marketplace
//
// Server component:
//   - auth + onboarding guard
//   - calls the allocation-engine-driven view service
//     (no /api round-trip from same-server render)
//   - passes the response into MarketplacePage
//
// Auth required, no role restriction — all authenticated
// platform roles can browse the marketplace.
//////////////////////////////////////////////////////

export default async function MarketplaceRoute() {

  //////////////////////////////////////////////////////
  // 🔐 AUTH
  //////////////////////////////////////////////////////

  const user = await getUserFromRequest()

  if (!user) {
    redirect("/signup")
  }

  //////////////////////////////////////////////////////
  // 🚨 ONBOARDING GUARD
  //////////////////////////////////////////////////////

  if (!user.onboardingCompleted) {
    redirect("/onboarding/role")
  }

  //////////////////////////////////////////////////////
  // 📦 LOAD MARKETPLACE VIEW
  //
  // Failure to load is rendered as an in-page error
  // state — the page itself still renders.
  //////////////////////////////////////////////////////

  let view: MarketplaceLotsResponse | null = null
  let loadError = false

  try {
    view = await getMarketplaceLotsView()
  } catch (error) {
    console.error("[MARKETPLACE_ROUTE] Failed to load view:", error)
    loadError = true
  }

  //////////////////////////////////////////////////////
  // ✅ RENDER
  //////////////////////////////////////////////////////

  return <MarketplacePage user={user} view={view} loadError={loadError} />
}
