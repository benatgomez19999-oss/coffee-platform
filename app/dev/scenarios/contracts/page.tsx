import DevContractScenarioPanel from "@/src/components/dev/scenarios/DevContractScenarioPanel"

export const dynamic = "force-dynamic"

//////////////////////////////////////////////////////
// 🧪 /dev/scenarios/contracts
//
// Dev-only contract scenario factory for seeding /
// resetting Contract + DemandIntent rows owned by a
// dedicated dev client company. Page shell — all writes
// go through /api/dev/scenarios/contracts/*, which are
// guarded by requireDevRoute.
//////////////////////////////////////////////////////

export default function DevContractScenariosPage() {
  return <DevContractScenarioPanel />
}
