// =====================================================
// WEBSOCKET SERVER
// =====================================================

import { WebSocketServer }
from "ws"

import { initWebsocketGateway }
from "@/src/websocket/websocketGateway"


// =====================================================
// WEBSOCKET INSTANCE
// =====================================================

let wss: WebSocketServer | null = null


// =====================================================
// INIT SERVER
// =====================================================

export function initWebsocketServer() {

  if (wss) return wss

  wss = new WebSocketServer({

    port: 3001

  })


  // =====================================================
  // INIT GATEWAY
  // =====================================================

  initWebsocketGateway(wss)


  // =====================================================
  // CONNECTION
  // =====================================================

  wss.on("connection", (socket) => {

    console.log("WS client connected")

  })


  return wss

}