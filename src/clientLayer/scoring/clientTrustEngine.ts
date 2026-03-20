// =====================================================
// CLIENT TRUST ENGINE
//
// Memoria dinámica de confianza del cliente.
//
// Ajusta el trustScore basado en eventos reales:
// - pagos
// - cancelaciones
// - cumplimiento de contratos
// - compras especiales
//
// El trustScore se usa como input del ClientScore.
// =====================================================

export type ClientTrustState = {

  clientId: string

  // confianza base acumulada
  trustScore: number

  // historial de eventos
  successfulOrders: number
  cancelledOrders: number
  latePayments: number
  microLotPurchases: number

}

// =====================================================
// INITIAL TRUST STATE
// =====================================================

export function createInitialTrustState(
  clientId: string
): ClientTrustState {

  return {

    clientId,

    trustScore: 0.5,

    successfulOrders: 0,
    cancelledOrders: 0,
    latePayments: 0,
    microLotPurchases: 0

  }

}

// =====================================================
// UPDATE TRUST FROM EVENT
// =====================================================

export function updateClientTrust(

  trust: ClientTrustState,

  event:
    | "successful_order"
    | "cancelled_order"
    | "late_payment"
    | "microlot_purchase"

): ClientTrustState {

  let nextTrust = trust.trustScore

  switch (event) {

    case "successful_order":

      trust.successfulOrders++

      nextTrust += 0.02

      break


    case "cancelled_order":

      trust.cancelledOrders++

      nextTrust -= 0.08

      break


    case "late_payment":

      trust.latePayments++

      nextTrust -= 0.1

      break


    case "microlot_purchase":

      trust.microLotPurchases++

      nextTrust += 0.03

      break

  }

  nextTrust = Math.max(0, Math.min(1, nextTrust))

  return {

    ...trust,

    trustScore: nextTrust

  }

}