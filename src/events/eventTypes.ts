// =====================================================
// EVENT TYPES
// =====================================================

export const EVENTS = {

  // CONTRACTS
  CONTRACT_CREATED: "contract_created",
  CONTRACT_ACTIVATED: "contract_activated",
  CONTRACT_SYNC: "contract_sync",
  CONTRACT_AMENDED: "contract_amended",

  // ROASTING
  ROAST_BATCH_CREATED: "roast_batch_created",
  ROAST_BATCH_COMPLETED: "roast_batch_completed",

  // INVENTORY
  INVENTORY_UPDATED: "inventory_updated",

  // ORDERS
  ORDER_CREATED: "order_created"

} as const