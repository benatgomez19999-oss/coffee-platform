// =====================================================
// CONTRACT STATUS
// =====================================================

export type ContractStatus =
  | "draft"
  | "pending_signature"
  | "active"
  | "completed"


// =====================================================
// SUPPLY CONTRACT
// =====================================================

export type SupplyContract = {

  id: string

  product: string

  monthlyVolumeKg: number

  durationMonths: number

  remainingMonths: number

  startDate: number

  nextExecution: number

  status: ContractStatus

}