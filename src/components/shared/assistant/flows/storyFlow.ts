export type StoryForm = {
  experience: string
  location: string
  uniqueness: string
  values: string
}

export type StoryStep = {
  key: keyof StoryForm
  question: string
  helper?: string
}

export const storySteps: StoryStep[] = [
  {
    key: "experience",
    question:
      "How many years have you been producing coffee, and what kind of experience defines your work today?",
    helper:
      "Example: Our family has produced coffee for three generations, and I have been leading quality and lot separation for the last 8 years.",
  },
  {
    key: "location",
    question:
      "Where is your farm located, and what makes that place important for your coffee?",
    helper:
      "Example: Our farm is located in the highlands of Huila, where altitude, cool nights, and steady rainfall support slow cherry maturation.",
  },
  {
    key: "uniqueness",
    question:
      "What makes your farm, process, or coffee identity distinctive?",
    helper:
      "Example: We focus on careful cherry selection, small separated lots, and consistent washed profiles with clarity and sweetness.",
  },
  {
    key: "values",
    question:
      "What values or principles guide the way you produce coffee?",
    helper:
      "Example: We care about consistency, transparency, long-term relationships, and producing coffee with discipline and intention.",
  },
]

export const createEmptyStoryForm = (): StoryForm => ({
  experience: "",
  location: "",
  uniqueness: "",
  values: "",
})

export const getStoryFieldLabel = (key: keyof StoryForm) => {
  switch (key) {
    case "experience":
      return "Experience"
    case "location":
      return "Location"
    case "uniqueness":
      return "Uniqueness"
    case "values":
      return "Values"
    default:
      return key
  }
}

export const normalizeStoryValue = (value: string) => {
  return value.replace(/\s+/g, " ").trim()
}

export const validateStoryValue = (value: string) => {
  const cleanValue = normalizeStoryValue(value)

  if (!cleanValue) {
    return "Please add a short answer before continuing."
  }

  if (cleanValue.length < 6) {
    return "Please add a bit more detail so I can generate a strong farm story."
  }

  return null
}