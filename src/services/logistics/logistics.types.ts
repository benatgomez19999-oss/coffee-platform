export type LogisticsProviderName = "mock" | "envioclick"

export type SampleShipmentStatus =
  | "PICKUP_REQUESTED"
  | "PICKUP_SCHEDULED"
  | "IN_TRANSIT"
  | "DELIVERED"

export type CreateSamplePickupInput = {
  lotDraftId: string
  producerId: string
  farmId: string
  contactName?: string
  phone?: string
  originAddress?: string
  notes?: string
}

export type CreateSamplePickupResult = {
  success: boolean
  provider: LogisticsProviderName
  shipmentId: string
  status: SampleShipmentStatus
  trackingUrl?: string | null
  raw?: unknown
}