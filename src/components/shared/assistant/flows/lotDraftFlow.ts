export type LotDraftForm = {
  farmId: string
  name: string
  variety: string
  process: string
  harvestYear: string
  parchmentKg: string
}

export type LotStep = {
  key: keyof LotDraftForm
  question: string
  required?: boolean
  helper?: string
}

//////////////////////////////////////////////////////
// 🌿 LOT FLOW
//////////////////////////////////////////////////////

export const lotDraftSteps: LotStep[] = [
  {
    key: "farmId",
    question: "Let's start with the Farm ID. What is the farm identifier?",
    required: true,
    helper: "Example: FARM-001",
  },
  {
    key: "name",
    question:
      "What name would you like to use for this lot? You can also type skip.",
    helper: "Example: El Paraíso Lot A",
  },
  {
    key: "variety",
    question:
      "What is the variety for this lot? Example: Castillo, Caturra, Colombia, Typica, Bourbon, Pink Bourbon, Geisha, or Tabi.",
    required: true,
  },
  {
    key: "process",
    question:
      "What is the process? Example: Washed, Natural, Honey, or Anaerobic.",
    required: true,
  },
  {
    key: "harvestYear",
    question:
      "What is the harvest year? You can type a year like 2025 or type skip.",
    helper: "Example: 2025",
  },
  {
    key: "parchmentKg",
    question:
      "Finally, how many parchment kilograms does this lot have?",
    required: true,
    helper: "Example: 1200",
  },
]

//////////////////////////////////////////////////////
// 🧠 NORMALIZERS
//////////////////////////////////////////////////////

export const varietyMap: Record<string, string> = {
  castillo: "CASTILLO",
  caturra: "CATURRA",
  colombia: "COLOMBIA",
  typica: "TYPICA",
  bourbon: "BOURBON",
  "pink bourbon": "PINK_BOURBON",
  pink_bourbon: "PINK_BOURBON",
  pinkbourbon: "PINK_BOURBON",
  geisha: "GEISHA",
  tabi: "TABI",
}

export const processMap: Record<string, string> = {
  washed: "WASHED",
  natural: "NATURAL",
  honey: "HONEY",
  anaerobic: "ANAEROBIC",
}

//////////////////////////////////////////////////////
// 🔧 HELPERS
//////////////////////////////////////////////////////

export const requiredLotFields: (keyof LotDraftForm)[] = [
  "farmId",
  "variety",
  "process",
  "parchmentKg",
]

export const getFieldLabel = (key: keyof LotDraftForm) => {
  const labels: Record<keyof LotDraftForm, string> = {
    farmId: "Farm ID",
    name: "Lot Name",
    variety: "Variety",
    process: "Process",
    harvestYear: "Harvest Year",
    parchmentKg: "Parchment Kg",
  }

  return labels[key]
}

export const normalizeLotValue = (
  key: keyof LotDraftForm,
  rawValue: string
): string => {
  const cleanValue = rawValue.trim()
  const lowerValue = cleanValue.toLowerCase()

  if (lowerValue === "skip" && (key === "name" || key === "harvestYear")) {
    return ""
  }

  if (key === "variety") {
    return varietyMap[lowerValue] || cleanValue.toUpperCase().replace(/\s+/g, "_")
  }

  if (key === "process") {
    return processMap[lowerValue] || cleanValue.toUpperCase().replace(/\s+/g, "_")
  }

  if (key === "harvestYear" || key === "parchmentKg") {
    return cleanValue.replace(/[^\d.]/g, "")
  }

  return cleanValue
}

export const validateLotValue = (
  key: keyof LotDraftForm,
  value: string
) => {
  const cleanValue = value.trim()

  if (key === "farmId" && !cleanValue) {
    return "Farm ID is required."
  }

  if (key === "variety" && !cleanValue) {
    return "Variety is required."
  }

  if (key === "process" && !cleanValue) {
    return "Process is required."
  }

  if (key === "parchmentKg") {
    if (!cleanValue) {
      return "Parchment Kg is required."
    }

    if (Number.isNaN(Number(cleanValue)) || Number(cleanValue) <= 0) {
      return "Parchment Kg must be a valid number greater than 0."
    }
  }

  if (key === "harvestYear" && cleanValue) {
    if (Number.isNaN(Number(cleanValue))) {
      return "Harvest Year must be a valid year."
    }
  }

  return null
}