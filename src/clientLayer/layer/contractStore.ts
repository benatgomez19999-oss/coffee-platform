import { SupplyContract } from "./contractTypes"

const STORAGE_KEY = "coffee_contracts"

// =====================================================
// LOAD CONTRACTS
// =====================================================

function load(): SupplyContract[] {

  if (typeof window === "undefined") return []

  const raw = localStorage.getItem(STORAGE_KEY)

  if (!raw) return []

  try {
    return JSON.parse(raw)
  } catch {
    return []
  }

}

// =====================================================
// SAVE CONTRACTS
// =====================================================

export function saveContracts(contracts: SupplyContract[]) {

  if (typeof window === "undefined") return

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(contracts)
  )

}

// =====================================================
// GET CONTRACTS
// =====================================================
// SIEMPRE recarga desde localStorage para sincronizar
// entre dispositivos

export function getContracts(): SupplyContract[] {

  return load()

}

// =====================================================
// GET CONTRACT
// =====================================================

export function getContract(id: string) {

  const contracts = load()

  return contracts.find(c => c.id === id)

}

// =====================================================
// ADD CONTRACT (NO DUPLICATES)
// =====================================================

export function addContract(contract: SupplyContract) {

  const contracts = load()

  const exists =
    contracts.find(c => c.id === contract.id)

  if (exists) return

  contracts.push(contract)

  saveContracts(contracts)

}

// =====================================================
// UPDATE CONTRACT
// =====================================================

export function updateContract(
  id: string,
  volume: number
) {

  const contracts = load()

  const contract =
    contracts.find(c => c.id === id)

  if (!contract) return

  contract.monthlyVolumeKg = volume

  saveContracts(contracts)

}

// =====================================================
// UPDATE STATUS
// =====================================================

export function updateContractStatus(
  id: string,
  status: SupplyContract["status"]
) {

  const contracts = load()

  const contract =
    contracts.find(c => c.id === id)

  if (!contract) return

  contract.status = status

  saveContracts(contracts)

}

// =====================================================
// CLEAR CONTRACTS (DEV TOOL)
// =====================================================

export function clearContracts() {

  if (typeof window === "undefined") return

  localStorage.removeItem(STORAGE_KEY)

}