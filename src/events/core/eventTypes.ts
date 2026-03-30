// =====================================================
// EVENT TYPES
// =====================================================

export const EVENTS = {

  // =====================================================
  // CONTRACT DOMAIN (CRUD / SYSTEM ACTIONS)
  // =====================================================

  CONTRACT_CREATED: "contract_created",
  CONTRACT_ACTIVATED: "contract_activated",
  CONTRACT_SYNC: "contract_sync",

  // =====================================================
  // CONTRACT FLOW (EVENT-DRIVEN CORE)
  // =====================================================

  CONTRACT_DRAFT_CREATED: "contract_draft_created",
  CONTRACT_SIGNED: "contract_signed",
  CONTRACT_AMENDED: "contract_amended",

  // =====================================================
  // LOT LIFECYCLE
  // =====================================================

  LOT_VERIFIED: "lot_verified",

  // =====================================================
  // ROASTING
  // =====================================================

  ROAST_BATCH_CREATED: "roast_batch_created",
  ROAST_BATCH_COMPLETED: "roast_batch_completed",

  // =====================================================
  // INVENTORY
  // =====================================================

  INVENTORY_UPDATED: "inventory_updated",

  // =====================================================
  // ORDERS
  // =====================================================

  ORDER_CREATED: "order_created",

} as const