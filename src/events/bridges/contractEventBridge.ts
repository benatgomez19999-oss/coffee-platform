// =====================================================
// CONTRACT EVENT BRIDGE
// =====================================================

import { eventBus }
from "@/src/events/core/eventBus"

import { EVENTS }
from "@/src/events/core/eventTypes"

import { registerEngineContract }
from "@/src/engine/core/runtime"


// =====================================================
// CONTRACT ACTIVATED → ENGINE
// =====================================================

eventBus.on(

  EVENTS.CONTRACT_ACTIVATED,

  (contract) => {

    registerEngineContract(contract)

  }

)