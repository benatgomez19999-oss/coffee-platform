// =====================================================
// CONTRACT EVENT BRIDGE
// =====================================================

import { eventBus }
from "@/events/eventBus"

import { EVENTS }
from "@/events/eventTypes"

import { registerEngineContract }
from "@/engine/runtime"


// =====================================================
// CONTRACT ACTIVATED → ENGINE
// =====================================================

eventBus.on(

  EVENTS.CONTRACT_ACTIVATED,

  (contract) => {

    registerEngineContract(contract)

  }

)