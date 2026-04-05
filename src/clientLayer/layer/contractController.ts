import {
  getContracts,
  addContract,
  updateContract
} from "@/src/clientLayer/layer/contractStore"

import { SupplyContract } from "./contractTypes"

// =====================================================
// SELECTED CONTRACT
// =====================================================

let selectedContractId: string | null = null

export function selectContract(id: string) {

  selectedContractId = id



}

export function getSelectedContract(): SupplyContract | null {

  if (!selectedContractId) return null

  const contracts = getContracts()

  return contracts.find(c => c.id === selectedContractId) || null

}

export function clearSelectedContract() {
  selectedContractId = null
}

// =====================================================
// CREATE CONTRACT
// =====================================================

export function createContract(data: {

  monthlyVolumeKg: number
  durationMonths: number

}) {

  const contract: SupplyContract = {

    id: crypto.randomUUID(),

    product: "Coffee",

    monthlyVolumeKg: data.monthlyVolumeKg,

    durationMonths: data.durationMonths,

    remainingMonths: data.durationMonths,

    startDate: Date.now(),

    nextExecution: Date.now(),

    status: "active"

  }

  addContract(contract)

  selectedContractId = contract.id

}

// =====================================================
// AMEND CONTRACT
// =====================================================

export function amendContract(volume: number) {

  if (!selectedContractId) return

  updateContract(selectedContractId, volume)

}

