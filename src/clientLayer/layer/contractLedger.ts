// =====================================================
// CONTRACT LEDGER
// Historial de versiones de contratos
// =====================================================

type ContractVersion = {

  contractId: string
  version: number

  monthlyVolumeKg: number
  remainingMonths: number

  createdAt: number

  type:
    | "create"
    | "amendment"
    | "renewal"
    | "termination"

  pdfUrl?: string

}

const STORAGE_KEY = "coffee_contract_ledger"


function loadLedger(): ContractVersion[] {

  if (typeof window === "undefined") return []

  const raw = localStorage.getItem(STORAGE_KEY)

  if (!raw) return []

  try {

    return JSON.parse(raw)

  } catch {

    return []

  }

}

let ledger: ContractVersion[] = loadLedger()


function saveLedger() {

  if (typeof window === "undefined") return

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(ledger)
  )

}


// =====================================================
// RECORD VERSION
// =====================================================

export function recordContractVersion(entry: ContractVersion) {

  ledger.push(entry)

  saveLedger()

}


// =====================================================
// GET CONTRACT HISTORY
// =====================================================

export function getContractHistory(contractId: string) {

  return ledger.filter(
    v => v.contractId === contractId
  )

}


// =====================================================
// GET ALL LEDGER
// =====================================================

export function getLedger() {

  return ledger

}