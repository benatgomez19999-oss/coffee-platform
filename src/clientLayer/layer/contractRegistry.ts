// =====================================================
// CONTRACT TYPES
// =====================================================

export type Contract = {
  id: string
  title: string
  monthlyVolumeKg: number
  durationMonths: number
}


// =====================================================
// CONTRACT REGISTRY
// =====================================================

const registry: Contract[] = []


// =====================================================
// ADD CONTRACT
// =====================================================

export function registerContract(contract: Contract) {

  const exists =
    registry.find(c => c.id === contract.id)

  if (exists) return

  registry.push(contract)

}


// =====================================================
// GET CONTRACTS
// =====================================================

export function getRegisteredContracts() {

  return registry

}


// =====================================================
// SEED CONTRACTS (OPTIONAL)
// =====================================================

export function seedContracts() {

  registerContract({

    id: "pilot-supply",
    title: "Pilot Coffee Supply Agreement",
    monthlyVolumeKg: 400,
    durationMonths: 9

  })

}