// =====================================================
// CONTRACT EVENT BRIDGE
// =====================================================

import { eventBus }
from "@/events/core/eventBus"

import { EVENTS }
from "@/events/core/eventTypes"

import { registerEngineContract }
from "@/engine/core/runtime"


// =====================================================
// CONTRACT ACTIVATED → ENGINE
// =====================================================

eventBus.on(

  EVENTS.CONTRACT_ACTIVATED,

  (contract) => {

    registerEngineContract(contract)

  }

)