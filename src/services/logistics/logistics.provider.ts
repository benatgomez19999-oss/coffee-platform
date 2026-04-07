import { createMockSamplePickup } from "@/services/logistics/providers/mock.provider"
import { createEnvioclickSamplePickup } from "@/services/logistics/providers/envioclick.provider"
import { CreateSamplePickupInput, CreateSamplePickupResult } from "./logistics.types"

export async function createSamplePickup(
  input: CreateSamplePickupInput,
): Promise<CreateSamplePickupResult> {
  const provider = process.env.LOGISTICS_PROVIDER || "mock"

  if (provider === "envioclick") {
    return createEnvioclickSamplePickup(input)
  }

  return createMockSamplePickup(input)
}