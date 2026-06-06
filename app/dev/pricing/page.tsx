import PricingInspectorPanel from "@/src/components/dev/pricing/PricingInspectorPanel"

export const dynamic = "force-dynamic"

//////////////////////////////////////////////////////
// 🔬 /dev/pricing
//
// Dev-only pricing inspector. UI is the shell; all
// reads + writes go through /api/internal/pricing/*
// which are guarded by requireDevRoute.
//////////////////////////////////////////////////////

export default function DevPricingInspectorPage() {
  return <PricingInspectorPanel />
}
