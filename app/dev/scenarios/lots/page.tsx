import DevLotScenarioPanel from "@/src/components/dev/scenarios/DevLotScenarioPanel"

export const dynamic = "force-dynamic"

//////////////////////////////////////////////////////
// 🧪 /dev/scenarios/lots
//
// Dev-only scenario factory for seeding real DB lots.
// All mutations go through /api/dev/scenarios/lots/*,
// which are themselves guarded by requireDevRoute. The
// page itself is just the UI shell.
//////////////////////////////////////////////////////

export default function DevScenarioLotsPage() {
  return <DevLotScenarioPanel />
}
