// =====================================================
// WEBSOCKET CLIENT
// =====================================================

let socket: WebSocket | null = null


// =====================================================
// INIT CLIENT
// =====================================================

export function initWebsocketClient() {

  if (socket) return

  socket = new WebSocket("ws://localhost:3001")


  socket.onopen = () => {

    console.log("WS connected")

  }


  socket.onmessage = (event) => {

    const data =
      JSON.parse(event.data)


    // =====================================================
    // CONTRACT ACTIVATED
    // =====================================================

    if (data.type === "contractActivated") {

      window.dispatchEvent(
        new CustomEvent(
          "contract_activated",
          { detail: data.contractId }
        )
      )

    }


    // =====================================================
    // CONTRACTS UPDATE
    // =====================================================

    if (data.type === "contracts_update") {

      window.dispatchEvent(
        new CustomEvent(
          "contracts_update",
          { detail: data.contracts }
        )
      )

    }

  }


  socket.onclose = () => {

    console.log("WS disconnected")

    socket = null

  }

}