import { CreateSamplePickupInput, CreateSamplePickupResult } from "../logistics.types"

export async function createMockSamplePickup(
  input: CreateSamplePickupInput,
): Promise<CreateSamplePickupResult> {
  return {
    success: true,
    provider: "mock",
    shipmentId: `mock_ship_${input.lotDraftId.slice(0, 8)}`,
    status: "PICKUP_REQUESTED",
    trackingUrl: null,
    raw: {
      simulated: true,
      createdAt: new Date().toISOString(),
    },
  }
}