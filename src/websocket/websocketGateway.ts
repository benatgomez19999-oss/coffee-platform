// =====================================================
// WEBSOCKET GATEWAY
// =====================================================

import { WebSocketServer } from "ws"

import { eventBus }
from "@/events/core/eventBus"

import { EVENTS }
from "@/events/core/eventTypes"


// =====================================================
// INIT GATEWAY
// =====================================================

export function initWebsocketGateway(
  wss: WebSocketServer
) {

  // =====================================================
  // CONTRACT ACTIVATED
  // =====================================================

  eventBus.on(
    EVENTS.CONTRACT_ACTIVATED,
    (contract) => {

      broadcast(wss, {
        type: "contractActivated",
        contractId: contract.id
      })

    }
  )


  // =====================================================
  // CONTRACT SYNC
  // Broadcast full contract list to clients
  // =====================================================

  eventBus.on(
    EVENTS.CONTRACT_SYNC,
    (contracts) => {

      broadcast(wss, {
        type: "contracts_update",
        contracts
      })

    }
  )

}


// =====================================================
// BROADCAST
// =====================================================

function broadcast(
  wss: WebSocketServer,
  message: any
) {

  const payload =
    JSON.stringify(message)

  wss.clients.forEach(client => {

    if (client.readyState === 1) {

      client.send(payload)

    }

  })

}