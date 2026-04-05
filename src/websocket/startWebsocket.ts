// =====================================================
// START WEBSOCKET
// =====================================================

import "@/events/bridges/contractEventBridge"

import { initWebsocketServer }
from "@/src/websocket/websocketServer"

initWebsocketServer()