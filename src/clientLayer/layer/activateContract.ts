import { getContracts, saveContracts }
from "./contractStore"

import { eventBus }
from "@/events/core/eventBus"

import { EVENTS }
from "@/events/core/eventTypes"


// =====================================================
// ACTIVATE CONTRACT
// =====================================================

export function activateContract(contractId: string) {

  const contracts = getContracts()

  const contract =
    contracts.find(c => c.id === contractId)

  if (!contract) return


  // =====================================================
  // UPDATE STATUS
  // =====================================================

  contract.status = "active"

  saveContracts(contracts)


  // =====================================================
  // EMIT EVENT
  // =====================================================

  eventBus.emit(
    EVENTS.CONTRACT_ACTIVATED,
    contract
  )

  eventBus.emit(
  EVENTS.CONTRACT_SYNC,
  contracts
)

}