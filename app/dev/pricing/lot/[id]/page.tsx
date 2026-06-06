import PricingLotInspector from "@/src/components/dev/pricing/PricingLotInspector"

export const dynamic = "force-dynamic"

//////////////////////////////////////////////////////
// 🔬 /dev/pricing/lot/[id]
//
// Dev-only per-lot pricing inspector. Auth + data live on
// /api/internal/pricing/lot/[id]; this page is just the shell.
//////////////////////////////////////////////////////

export default function DevPricingLotPage({
  params,
}: {
  params: { id: string }
}) {
  return <PricingLotInspector greenLotId={params.id} />
}
