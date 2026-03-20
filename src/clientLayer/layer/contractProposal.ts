import { getContracts, updateContract } from "./contractStore"

export function createUpgradeProposal(newVolume: number) {

  const contracts = getContracts()

  if (contracts.length === 0) return

  const contract = contracts[0]

  const previous = contract.monthlyVolumeKg
  const delta = newVolume - previous

  if (delta <= 0) return

  console.log("Contract Upgrade Proposal")

  
  updateContract(contract.id, newVolume)

}