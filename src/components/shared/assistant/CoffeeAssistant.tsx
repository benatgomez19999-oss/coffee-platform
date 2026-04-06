"use client"

import Image from "next/image"
import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  getFieldLabel,
  lotDraftSteps,
  LotDraftForm,
  normalizeLotValue,
  requiredLotFields,
  validateLotValue,
} from "@/src/components/shared/assistant/flows/lotDraftFlow"

type CoffeeAssistantProps = {
  iconSize?: number
  form?: LotDraftForm
  updateField?: (key: keyof LotDraftForm, value: string) => void
  context?: "lot-wizard" | "dashboard"
}

type AssistantMessage = {
  id: string
  role: "assistant" | "user"
  content: string
}

type AssistantMode = "normal" | "lot"

export default function CoffeeAssistant({
  iconSize = 54,
  form,
  updateField,
  context = "dashboard",
}: CoffeeAssistantProps) {
  const createMessage = (
    role: "assistant" | "user",
    content: string,
  ): AssistantMessage => ({
    id: crypto.randomUUID(),
    role,
    content,
  })

  //////////////////////////////////////////////////////
  // 🧠 STATE / ESTADO
  //////////////////////////////////////////////////////

  const [assistantOpen, setAssistantOpen] = useState(false)
  const [hasNotification] = useState(true)
  const [mode, setMode] = useState<AssistantMode>("normal")
  const [step, setStep] = useState(0)
  const [messages, setMessages] = useState<AssistantMessage[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  //////////////////////////////////////////////////////
  // 🏷️ LOT NAME SUBFLOW (mini flujo guiado)
  //////////////////////////////////////////////////////

  const [lotNameSuggestion, setLotNameSuggestion] = useState("")
  const [lotNameFlowState, setLotNameFlowState] = useState<
    "idle" | "suggested" | "manual"
  >("idle")
  const [selectedFarmName, setSelectedFarmName] = useState("")

  //////////////////////////////////////////////////////
  // 🌿 FARM CONTEXT (smart autofill)
  //////////////////////////////////////////////////////

  const [farmOptions, setFarmOptions] = useState<
    { id: string; name: string }[]
  >([])
  const [hasCheckedFarms, setHasCheckedFarms] = useState(false)

  //////////////////////////////////////////////////////
  // 🧠 REFS (DOM anchors)
  //////////////////////////////////////////////////////

  const lotFlowRunRef = useRef(0)
  const lastExternalSyncRef = useRef("")
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const autoCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  //////////////////////////////////////////////////////
  // 🧠 FLAGS / banderas internas
  //////////////////////////////////////////////////////

  const hasLotIntegration = Boolean(form && updateField)
  const isLotWizard = context === "lot-wizard"

  //////////////////////////////////////////////////////
  // 🧠 DERIVED STATE / estado derivado
  //////////////////////////////////////////////////////

  const missingRequiredFields = useMemo(() => {
    if (!form) return requiredLotFields

    return requiredLotFields.filter(
      (field) => !String(form[field] || "").trim(),
    )
  }, [form])

  //////////////////////////////////////////////////////
  // 🔧 HELPERS (pure helpers / utilidades)
  //////////////////////////////////////////////////////

  const buildLotSummary = () => {
    if (!form) return ""

    const summaryLines = [
      `• Farm ID: ${form.farmId || "—"}`,
      `• Lot Name: ${form.name || "—"}`,
      `• Variety: ${form.variety || "—"}`,
      `• Process: ${form.process || "—"}`,
      `• Harvest Year: ${form.harvestYear || "—"}`,
      `• Parchment Kg: ${form.parchmentKg || "—"}`,
    ]

    return summaryLines.join("\n")
  }

  const normalizeCommand = (value: string) => {
    return value.trim().toLowerCase()
  }

  const isAffirmativeCommand = (value: string) => {
    const clean = normalizeCommand(value)

    return [
      "yes",
      "si",
      "sí",
      "use it",
      "use this",
      "usar",
      "usar este",
    ].includes(clean)
  }

  const isSuggestCommand = (value: string) => {
    const clean = normalizeCommand(value)

    return ["suggest", "sugiere", "suggest one", "name suggestion"].includes(
      clean,
    )
  }

  const isAnotherCommand = (value: string) => {
    const clean = normalizeCommand(value)

    return ["another", "otro", "otra", "different"].includes(clean)
  }

  const isManualCommand = (value: string) => {
    const clean = normalizeCommand(value)

    return [
      "manual",
      "write my own",
      "i'll write it myself",
      "yo escribo",
    ].includes(clean)
  }

  const isSkipCommand = (value: string) => {
    const clean = normalizeCommand(value)

    return ["skip", "omitir", "omit"].includes(clean)
  }

  const buildSuggestedLotName = () => {
    const farmLabel =
      selectedFarmName?.trim() || (form?.farmId ? "Farm" : "Coffee")

    const processLabel =
      form?.process
        ?.toLowerCase()
        .replace(/_/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase()) || ""

    const varietyLabel =
      form?.variety
        ?.toLowerCase()
        .replace(/_/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase()) || ""

    const harvestLabel = form?.harvestYear?.trim() || ""

    if (farmLabel && processLabel && varietyLabel) {
      return `${farmLabel} ${processLabel} ${varietyLabel} Lot`
    }

    if (farmLabel && processLabel) {
      return `${farmLabel} ${processLabel} Lot`
    }

    if (farmLabel && varietyLabel) {
      return `${farmLabel} ${varietyLabel} Lot`
    }

    if (farmLabel && harvestLabel) {
      return `${farmLabel} Harvest ${harvestLabel} Lot`
    }

    return `${farmLabel} Lot 1`
  }

  const appendMessages = (...nextMessages: AssistantMessage[]) => {
    if (!nextMessages.length) return

    setMessages((prev) => [...prev, ...nextMessages])
  }

  const getLotNameEntryMessages = (): AssistantMessage[] => {
    return [
      createMessage(
        "assistant",
        "What name would you like to use for this lot? You can write your own name, skip it, or I can suggest one based on your farm and process.",
      ),
    ]
  }

  const pushLotNameEntryMessage = () => {
    appendMessages(...getLotNameEntryMessages())
  }

  const getLotNameInvalidOptionMessages = (): AssistantMessage[] => {
    return [
      createMessage(
        "assistant",
        "Please choose one of the available options below, or type your own lot name.",
      ),
    ]
  }

  const pushLotNameInvalidOptionMessage = () => {
    appendMessages(...getLotNameInvalidOptionMessages())
  }

  const getLotNameSuggestionMessages = (
    suggestion: string,
  ): AssistantMessage[] => {
    return [
      createMessage("assistant", `I suggest: ${suggestion}`),
      createMessage(
        "assistant",
        "You can use this name, ask for another option, write your own, or skip.",
      ),
    ]
  }

  const pushLotNameSuggestionMessage = (suggestion: string) => {
    appendMessages(...getLotNameSuggestionMessages(suggestion))
  }

  const finishLotFlow = (...msgs: AssistantMessage[]) => {
    setStep(lotDraftSteps.length)
    appendMessages(
      ...msgs,
      createMessage(
        "assistant",
        "Everything looks good. Please review your form before submitting the lot. If you need anything else, I’m here.",
      ),
    )
  }

  const goToNextLotStep = (nextStep: number, ...msgs: AssistantMessage[]) => {
    if (nextStep >= lotDraftSteps.length) {
      finishLotFlow(...msgs)
      return
    }

    setStep(nextStep)

    if (lotDraftSteps[nextStep]?.key === "name") {
      setLotNameFlowState("idle")
      setLotNameSuggestion("")
      appendMessages(...msgs, ...getLotNameEntryMessages())
      return
    }

    appendMessages(
      ...msgs,
      createMessage("assistant", lotDraftSteps[nextStep].question),
    )
  }

  const scrollFormToStep = (targetStep: number) => {
    try {
      const sections = document.querySelectorAll("section")

      if (!sections || sections.length === 0) return

      //////////////////////////////////////////////////////
      // 🧠 STEP → SECTION MAPPING
      //////////////////////////////////////////////////////
      let sectionIndex = 0

      if (targetStep <= 1) sectionIndex = 0
      else if (targetStep <= 3) sectionIndex = 1
      else sectionIndex = 2

      const target = sections[sectionIndex] as HTMLElement

      if (!target) return

      target.scrollIntoView({
        behavior: "smooth",
        block: "center",
      })
    } catch (err) {
      console.warn("Scroll form error:", err)
    }
  }

 const resetToNormalMode = () => {
  //////////////////////////////////////////////////////
  // 🧹 CLEAR AUTO CLOSE
  //////////////////////////////////////////////////////

  if (autoCloseTimeoutRef.current) {
    clearTimeout(autoCloseTimeoutRef.current)
    autoCloseTimeoutRef.current = null
  }

  lotFlowRunRef.current = 0
  lastExternalSyncRef.current = ""

  setMode("normal")
  setStep(0)
  setInput("")
  setMessages([])
  setIsLoading(false)
  setFarmOptions([])
  setHasCheckedFarms(false)
  setSelectedFarmName("")
  setLotNameSuggestion("")
  setLotNameFlowState("idle")
}

  //////////////////////////////////////////////////////
  // 🚀 START LOT FLOW (entry point / inicio guiado)
  //////////////////////////////////////////////////////

  const startLotFlow = () => {
    const runId = Date.now()
    lotFlowRunRef.current = runId

    setAssistantOpen(true)
    setMode("lot")
    setStep(0)
    setMessages([
      createMessage(
        "assistant",
        "Great — I can help you complete this lot draft step by step.",
      ),
    ])
    setInput("")

    //////////////////////////////////////////////////////
    // 🔥 SMART AUTOFILL TRIGGER
    //////////////////////////////////////////////////////

    setTimeout(() => {
      if (lotFlowRunRef.current !== runId) return
      loadFarmContext(runId)
    }, 200)
  }

  //////////////////////////////////////////////////////
  // 🤖 AUTOLOAD FARM CONTEXT (smart autofill bootstrap)
  //////////////////////////////////////////////////////

  const loadFarmContext = async (runId?: number) => {
    try {
      const res = await fetch("/api/assistant/farm-context")
      const data = await res.json()

      if (runId && lotFlowRunRef.current !== runId) return
      if (!res.ok) return

      const farms = data.farms || []

      //////////////////////////////////////////////////////
      // 🧠 CASE 1: NO FARMS
      //////////////////////////////////////////////////////

      if (farms.length === 0) {
        if (runId && lotFlowRunRef.current !== runId) return

        appendMessages(
          createMessage(
            "assistant",
            "Let's start with the Farm ID. This identifies your farm inside the platform.",
          ),
          createMessage("assistant", lotDraftSteps[0].question),
        )
        return
      }

      //////////////////////////////////////////////////////
      // 🧠 CASE 2: ONE FARM → AUTO FILL
      //////////////////////////////////////////////////////

      if (farms.length === 1) {
        const farm = farms[0]

        if (updateField) {
          updateField("farmId", farm.id)
        }

        setSelectedFarmName(farm.name)
        goToNextLotStep(1, createMessage("assistant", `Using "${farm.name}".`))
        return
      }

      //////////////////////////////////////////////////////
      // 🧠 CASE 3: MULTIPLE FARMS
      //////////////////////////////////////////////////////

      setFarmOptions(farms)
    } catch (err) {
      console.error("Autofill farm error:", err)

      appendMessages(
        createMessage(
          "assistant",
          "I could not load your farms right now. Let's continue manually.",
        ),
        createMessage("assistant", lotDraftSteps[0].question),
      )
    } finally {
      setHasCheckedFarms(true)
    }
  }

  //////////////////////////////////////////////////////
  // 🧠 CLIENT MOUNT GUARD
  //////////////////////////////////////////////////////

 useEffect(() => {
  setIsMounted(true)

  return () => {

    //////////////////////////////////////////////////////
    // 🧹 CLEANUP AUTO CLOSE
    //////////////////////////////////////////////////////

    if (autoCloseTimeoutRef.current) {
      clearTimeout(autoCloseTimeoutRef.current)
      autoCloseTimeoutRef.current = null
    }

    setIsMounted(false)
  }
}, [])

  //////////////////////////////////////////////////////
  // 🎧 EVENTS / lifecycle
  //////////////////////////////////////////////////////

  useEffect(() => {
    const lotHandler = () => {
      startLotFlow()
    }

    window.addEventListener("startLotFlow", lotHandler)

    return () => {
      window.removeEventListener("startLotFlow", lotHandler)
    }
  }, [])

  //////////////////////////////////////////////////////
  // 🔄 SYNC EXTERNAL FORM CHANGES WITH CHAT STEP
  //////////////////////////////////////////////////////

  useEffect(() => {
    if (mode !== "lot") return
    if (!assistantOpen) return
    if (!form) return

    const currentStep = lotDraftSteps[step]
    if (!currentStep) return
    if (currentStep.key === "name") return
    if (currentStep.key === "farmId") return

    const externalValue = String(form[currentStep.key] || "").trim()
    if (!externalValue) return

    const normalizedExternalValue = normalizeLotValue(
      currentStep.key,
      externalValue,
    )

    const validationError = validateLotValue(
      currentStep.key,
      normalizedExternalValue,
    )

    if (validationError) return

    const syncKey = `${step}:${currentStep.key}:${normalizedExternalValue}`

    if (lastExternalSyncRef.current === syncKey) return

    lastExternalSyncRef.current = syncKey

    const confirmationMessage =
      normalizedExternalValue === ""
        ? `${getFieldLabel(currentStep.key)} skipped.`
        : `${getFieldLabel(currentStep.key)} updated.`

    const rafId = window.requestAnimationFrame(() => {
      goToNextLotStep(
        step + 1,
        createMessage("assistant", confirmationMessage),
      )
    })

    return () => {
      window.cancelAnimationFrame(rafId)
    }
  }, [form, step, mode, assistantOpen])

  //////////////////////////////////////////////////////
// ⏳ AUTO CLOSE WHEN LOT FLOW IS FULLY COMPLETE
//////////////////////////////////////////////////////

useEffect(() => {
  const lotFlowCompleted = step >= lotDraftSteps.length
  const formCompleted =
    Boolean(form) && missingRequiredFields.length === 0

  if (!assistantOpen || mode !== "lot" || !lotFlowCompleted || !formCompleted) {
    if (autoCloseTimeoutRef.current) {
      clearTimeout(autoCloseTimeoutRef.current)
      autoCloseTimeoutRef.current = null
    }
    return
  }

  if (autoCloseTimeoutRef.current) {
    clearTimeout(autoCloseTimeoutRef.current)
  }

  autoCloseTimeoutRef.current = setTimeout(() => {
    setAssistantOpen(false)
    autoCloseTimeoutRef.current = null
  }, 3000)

  return () => {
    if (autoCloseTimeoutRef.current) {
      clearTimeout(autoCloseTimeoutRef.current)
      autoCloseTimeoutRef.current = null
    }
  }
}, [assistantOpen, mode, step, form, missingRequiredFields.length])

  //////////////////////////////////////////////////////
  // ✉️ LOT MODE (guided lot flow)
  //////////////////////////////////////////////////////

  const handleLotSend = () => {
    if (!input.trim()) return

    const cleanInput = input.trim()
    const currentStep = lotDraftSteps[step]

    if (!currentStep) return

    const userMessage = createMessage("user", cleanInput)

    //////////////////////////////////////////////////////
    // 🏷️ LOT NAME SPECIAL SUBFLOW
    //////////////////////////////////////////////////////

    if (currentStep.key === "name") {
      if (isSkipCommand(cleanInput)) {
        if (updateField) {
          updateField("name", "")
        }

        setLotNameSuggestion("")
        setLotNameFlowState("idle")
        setInput("")

        goToNextLotStep(
          step + 1,
          userMessage,
          createMessage("assistant", "Lot Name skipped."),
        )
        return
      }

      if (lotNameFlowState === "suggested") {
        if (isAffirmativeCommand(cleanInput)) {
          if (updateField) {
            updateField("name", lotNameSuggestion)
          }

          setLotNameFlowState("idle")
          setInput("")

          goToNextLotStep(
            step + 1,
            userMessage,
            createMessage(
              "assistant",
              `Lot Name updated: ${lotNameSuggestion}`,
            ),
          )
          return
        }

        if (isAnotherCommand(cleanInput) || isSuggestCommand(cleanInput)) {
          const suggestion = buildSuggestedLotName()
          const retrySuggestion =
            suggestion === lotNameSuggestion
              ? `${suggestion} Reserve`
              : suggestion

          setLotNameSuggestion(retrySuggestion)
          setInput("")

          appendMessages(
            userMessage,
            ...getLotNameSuggestionMessages(retrySuggestion),
          )
          return
        }

        if (isManualCommand(cleanInput)) {
          setLotNameFlowState("manual")
          setInput("")

          appendMessages(
            userMessage,
            createMessage(
              "assistant",
              "Perfect — type the lot name you want to use.",
            ),
          )
          return
        }

        appendMessages(userMessage, ...getLotNameInvalidOptionMessages())
        setInput("")
        return
      }

      if (lotNameFlowState === "idle") {
        if (isSuggestCommand(cleanInput) || isAffirmativeCommand(cleanInput)) {
          const suggestion = buildSuggestedLotName()

          setLotNameSuggestion(suggestion)
          setLotNameFlowState("suggested")
          setInput("")

          appendMessages(
            userMessage,
            ...getLotNameSuggestionMessages(suggestion),
          )
          return
        }

        if (isManualCommand(cleanInput)) {
          setLotNameFlowState("manual")
          setInput("")

          appendMessages(
            userMessage,
            createMessage(
              "assistant",
              "Go ahead — type the lot name you want to use.",
            ),
          )
          return
        }

        if (cleanInput.length < 2) {
          appendMessages(userMessage, ...getLotNameInvalidOptionMessages())
          setInput("")
          return
        }

        if (updateField) {
          updateField("name", cleanInput)
        }

        setLotNameFlowState("idle")
        setLotNameSuggestion("")
        setInput("")

        goToNextLotStep(
          step + 1,
          userMessage,
          createMessage("assistant", `Lot Name updated: ${cleanInput}`),
        )
        return
      }

      if (lotNameFlowState === "manual") {
        if (cleanInput.length < 2) {
          appendMessages(userMessage, ...getLotNameInvalidOptionMessages())
          setInput("")
          return
        }

        if (updateField) {
          updateField("name", cleanInput)
        }

        setLotNameFlowState("idle")
        setLotNameSuggestion("")
        setInput("")

        goToNextLotStep(
          step + 1,
          userMessage,
          createMessage("assistant", `Lot Name updated: ${cleanInput}`),
        )
        return
      }
    }

    //////////////////////////////////////////////////////
    // 🌿 STANDARD LOT STEPS (validación + avance)
    //////////////////////////////////////////////////////

    const normalizedValue = normalizeLotValue(currentStep.key, cleanInput)
    const validationError = validateLotValue(currentStep.key, normalizedValue)

    if (validationError) {
      appendMessages(
        userMessage,
        createMessage(
          "assistant",
          `${validationError} ${currentStep.helper ? currentStep.helper : ""}`.trim(),
        ),
      )
      setInput("")
      return
    }

    if (updateField) {
      updateField(currentStep.key, normalizedValue)
    }

    const nextStep = step + 1

    const confirmationMessage =
      normalizedValue === ""
        ? `${getFieldLabel(currentStep.key)} skipped.`
        : `${getFieldLabel(currentStep.key)} updated.`

    setInput("")

    goToNextLotStep(
      nextStep,
      userMessage,
      createMessage("assistant", confirmationMessage),
    )
  }

  //////////////////////////////////////////////////////
  // 🤖 NORMAL MODE (chat general)
  //////////////////////////////////////////////////////

  const handleNormalSend = async () => {
    if (!input.trim()) return

    const cleanInput = input.trim()
    const userMessage = createMessage("user", cleanInput)

    appendMessages(userMessage)
    setInput("")
    setIsLoading(true)

    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: cleanInput,
          context,
          form,
        }),
      })

      const data = await res.json()

      appendMessages(
        createMessage(
          "assistant",
          data.reply ||
            "I could not generate a response right now. Please try again.",
        ),
      )
    } catch (error) {
      console.error("Assistant chat error:", error)

      appendMessages(
        createMessage(
          "assistant",
          "There was an error connecting with the assistant. Please try again.",
        ),
      )
    } finally {
      setIsLoading(false)
    }
  }

  //////////////////////////////////////////////////////
  // ✉️ SEND MESSAGE (mode router)
  //////////////////////////////////////////////////////

  const handleSend = async () => {
    if (mode === "lot") {
      handleLotSend()
      return
    }

    await handleNormalSend()
  }

  //////////////////////////////////////////////////////
  // 🧠 AUTO SCROLL (UX polish suave)
  //////////////////////////////////////////////////////

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior })
    })
  }

  useEffect(() => {
    scrollToBottom("smooth")
  }, [messages])

  useEffect(() => {
    scrollToBottom("auto")
  }, [assistantOpen])

  useEffect(() => {
    if (mode !== "lot") return
    if (!assistantOpen) return

    const timer = setTimeout(() => {
      scrollFormToStep(step)
    }, 220)

    return () => {
      clearTimeout(timer)
    }
  }, [step, mode, assistantOpen])

  //////////////////////////////////////////////////////
  // 🎨 UI HELPERS (presentational only)
  //////////////////////////////////////////////////////

  const renderMessageBubble = (msg: AssistantMessage) => {
    return (
      <div
        style={{
          alignSelf: msg.role === "assistant" ? "flex-start" : "flex-end",
          background:
            msg.role === "assistant"
              ? "rgba(212,175,55,0.08)"
              : "rgba(255,255,255,0.06)",
          border: "1px solid rgba(212,175,55,0.15)",
          padding: "10px 14px",
          borderRadius: "12px",
          maxWidth: "80%",
          whiteSpace: "pre-line",
        }}
      >
        <span
          style={{
            fontSize: "13px",
            color: "#e7d9c4",
            lineHeight: "1.5",
          }}
        >
          {msg.content}
        </span>
      </div>
    )
  }

  //////////////////////////////////////////////////////
  // 🎨 UI
  //////////////////////////////////////////////////////

  const totalLotSteps = lotDraftSteps.length
  const currentLotStep = mode === "lot" ? lotDraftSteps[step] : null
  const currentStepNumber =
    mode === "lot" ? Math.min(step + 1, totalLotSteps) : 0

  const completedLotSteps = form
    ? lotDraftSteps.filter((item) => String(form[item.key] || "").trim()).length
    : 0

  const progressPercent =
    totalLotSteps > 0
      ? Math.min((completedLotSteps / totalLotSteps) * 100, 100)
      : 0

  //////////////////////////////////////////////////////
  // 💬 ASSISTANT PANEL
  //////////////////////////////////////////////////////

  const assistantPanel =
    assistantOpen && isMounted ? (
      <div
        style={{
          position: "fixed",
          top: "80px",
          right: "24px",
          width: "380px",
          height: "540px",
          minHeight: 0,
          background:
            "linear-gradient(180deg, rgba(31,26,20,0.98) 0%, rgba(24,20,15,0.99) 100%)",
          borderRadius: "18px",
          boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
          border: "1px solid rgba(212,175,55,0.18)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          zIndex: 9999,
          transformOrigin: "top right",
          animation: "chatOpen 0.25s cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        <div
          style={{
            padding: "14px 18px",
            borderBottom: "1px solid rgba(212,175,55,0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "rgba(255,255,255,0.015)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "30px",
                height: "30px",
                borderRadius: "999px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(212,175,55,0.08)",
                border: "1px solid rgba(212,175,55,0.18)",
              }}
            >
              <Image
                src="/images/chat_bot_leaf.png"
                alt="Assistant"
                width={16}
                height={16}
                style={{ opacity: 0.9 }}
              />
            </div>

            <div>
              <div
                style={{
                  fontSize: "14px",
                  color: "#e7d9c4",
                  fontWeight: 600,
                  lineHeight: 1.2,
                }}
              >
                Coffee Assistant
              </div>

              <div
                style={{
                  marginTop: "2px",
                  fontSize: "11px",
                  color: "#aa9776",
                  letterSpacing: "0.04em",
                }}
              >
                {mode === "lot"
                  ? "Guided lot creation"
                  : isLotWizard
                    ? "Lot help and coffee guidance"
                    : "Coffee workflow support"}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {mode !== "normal" && (
              <div
                onClick={resetToNormalMode}
                style={{
                  cursor: "pointer",
                  fontSize: "12px",
                  color: "#cbb892",
                  transition: "opacity 0.2s ease",
                  userSelect: "none",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.7")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                Reset
              </div>
            )}

            <div
              onClick={() => setAssistantOpen(false)}
              style={{
                cursor: "pointer",
                fontSize: "14px",
                color: "#a08b6b",
                transition: "opacity 0.2s ease",
                userSelect: "none",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.7")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              ✕
            </div>
          </div>
        </div>

        {mode === "lot" && (
          <div
            style={{
              padding: "12px 18px",
              borderBottom: "1px solid rgba(212,175,55,0.08)",
              background: "rgba(255,255,255,0.02)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: "12px",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "11px",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "#bda884",
                    marginBottom: "6px",
                  }}
                >
                  Lot draft assistant
                </div>

                <div
                  style={{
                    fontSize: "13px",
                    color: "#e7d9c4",
                    lineHeight: "1.45",
                  }}
                >
                  Step {currentStepNumber} of {totalLotSteps}
                  {currentLotStep ? ` · ${getFieldLabel(currentLotStep.key)}` : ""}
                </div>

                <div
                  style={{
                    marginTop: "4px",
                    fontSize: "12px",
                    color: "#cbb892",
                  }}
                >
                  {missingRequiredFields.length} required field
                  {missingRequiredFields.length === 1 ? "" : "s"} pending
                </div>
              </div>

              {form?.farmId && (
                <div
                  style={{
                    flexShrink: 0,
                    border: "1px solid rgba(212,175,55,0.15)",
                    background: "rgba(212,175,55,0.06)",
                    color: "#e7d9c4",
                    borderRadius: "999px",
                    padding: "7px 10px",
                    fontSize: "11px",
                    maxWidth: "120px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={form.farmId}
                >
                  Farm linked
                </div>
              )}
            </div>

            <div
              style={{
                marginTop: "10px",
                height: "6px",
                width: "100%",
                borderRadius: "999px",
                background: "rgba(255,255,255,0.06)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${progressPercent}%`,
                  background:
                    "linear-gradient(90deg, rgba(212,175,55,0.75) 0%, rgba(230,199,103,0.95) 100%)",
                  borderRadius: "999px",
                  transition: "width 0.3s ease",
                }}
              />
            </div>

            {farmOptions.length > 0 && step === 0 && (
              <div
                style={{
                  marginTop: "12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                }}
              >
                <div
                  style={{
                    fontSize: "11px",
                    color: "#bda884",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                  }}
                >
                  Select farm
                </div>

                <select
                  onChange={(e) => {
                    const selected = farmOptions.find(
                      (farm) => farm.id === e.target.value,
                    )

                    if (!selected) return

                    if (updateField) {
                      updateField("farmId", selected.id)
                    }

                    setSelectedFarmName(selected.name)
                    setFarmOptions([])

                    goToNextLotStep(
                      1,
                      createMessage("assistant", `Using "${selected.name}".`),
                    )
                  }}
                  defaultValue=""
                  style={{
                    width: "100%",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(212,175,55,0.25)",
                    borderRadius: "8px",
                    padding: "8px 10px",
                    fontSize: "12px",
                    color: "#e7d9c4",
                    outline: "none",
                  }}
                >
                  <option value="" disabled>
                    Choose your farm...
                  </option>

                  {farmOptions.map((farm) => (
                    <option key={farm.id} value={farm.id}>
                      {farm.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        <div
          ref={containerRef}
          style={{
            flex: 1,
            minHeight: 0,
            padding: "18px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          {mode === "lot" ? (
            <>
              {messages.map((msg, index) => (
                <div key={msg.id || `lot-msg-${index}`}>
                  {renderMessageBubble(msg)}
                </div>
              ))}

              {currentLotStep?.key === "name" && (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "8px",
                    marginTop: "2px",
                  }}
                >
                  {lotNameFlowState === "idle" && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          const suggestion = buildSuggestedLotName()
                          setLotNameSuggestion(suggestion)
                          setLotNameFlowState("suggested")
                          pushLotNameSuggestionMessage(suggestion)
                        }}
                        style={{
                          padding: "7px 11px",
                          borderRadius: "999px",
                          border: "1px solid rgba(212,175,55,0.2)",
                          background: "rgba(212,175,55,0.08)",
                          fontSize: "12px",
                          color: "#d9c39c",
                          cursor: "pointer",
                        }}
                      >
                        Suggest a lot name
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setLotNameFlowState("manual")
                          appendMessages(
                            createMessage(
                              "assistant",
                              "Go ahead — type the lot name you want to use.",
                            ),
                          )
                        }}
                        style={{
                          padding: "7px 11px",
                          borderRadius: "999px",
                          border: "1px solid rgba(212,175,55,0.2)",
                          background: "transparent",
                          fontSize: "12px",
                          color: "#cbb892",
                          cursor: "pointer",
                        }}
                      >
                        I’ll write it myself
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (updateField) {
                            updateField("name", "")
                          }

                          setLotNameSuggestion("")
                          setLotNameFlowState("idle")
                          goToNextLotStep(
                            step + 1,
                            createMessage("assistant", "Lot Name skipped."),
                          )
                        }}
                        style={{
                          padding: "7px 11px",
                          borderRadius: "999px",
                          border: "1px solid rgba(212,175,55,0.2)",
                          background: "transparent",
                          fontSize: "12px",
                          color: "#cbb892",
                          cursor: "pointer",
                        }}
                      >
                        Skip
                      </button>
                    </>
                  )}

                  {lotNameFlowState === "suggested" && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          if (updateField) {
                            updateField("name", lotNameSuggestion)
                          }

                          setLotNameFlowState("idle")
                          goToNextLotStep(
                            step + 1,
                            createMessage(
                              "assistant",
                              `Lot Name updated: ${lotNameSuggestion}`,
                            ),
                          )
                        }}
                        style={{
                          padding: "7px 11px",
                          borderRadius: "999px",
                          border: "1px solid rgba(212,175,55,0.2)",
                          background: "rgba(212,175,55,0.08)",
                          fontSize: "12px",
                          color: "#d9c39c",
                          cursor: "pointer",
                        }}
                      >
                        Use this name
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const suggestion = buildSuggestedLotName()
                          const retrySuggestion =
                            suggestion === lotNameSuggestion
                              ? `${suggestion} Reserve`
                              : suggestion

                          setLotNameSuggestion(retrySuggestion)
                          pushLotNameSuggestionMessage(retrySuggestion)
                        }}
                        style={{
                          padding: "7px 11px",
                          borderRadius: "999px",
                          border: "1px solid rgba(212,175,55,0.2)",
                          background: "transparent",
                          fontSize: "12px",
                          color: "#cbb892",
                          cursor: "pointer",
                        }}
                      >
                        Suggest another
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setLotNameFlowState("manual")
                          appendMessages(
                            createMessage(
                              "assistant",
                              "Perfect — type the lot name you want to use.",
                            ),
                          )
                        }}
                        style={{
                          padding: "7px 11px",
                          borderRadius: "999px",
                          border: "1px solid rgba(212,175,55,0.2)",
                          background: "transparent",
                          fontSize: "12px",
                          color: "#cbb892",
                          cursor: "pointer",
                        }}
                      >
                        Write my own
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (updateField) {
                            updateField("name", "")
                          }

                          setLotNameSuggestion("")
                          setLotNameFlowState("idle")
                          goToNextLotStep(
                            step + 1,
                            createMessage("assistant", "Lot Name skipped."),
                          )
                        }}
                        style={{
                          padding: "7px 11px",
                          borderRadius: "999px",
                          border: "1px solid rgba(212,175,55,0.2)",
                          background: "transparent",
                          fontSize: "12px",
                          color: "#cbb892",
                          cursor: "pointer",
                        }}
                      >
                        Skip
                      </button>
                    </>
                  )}

                  {lotNameFlowState === "manual" && (
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#bda884",
                        lineHeight: "1.5",
                      }}
                    >
                      Type your preferred lot name in the input below.
                    </div>
                  )}
                </div>
              )}

              <div ref={messagesEndRef} />
            </>
          ) : (
            <>
              <div
                style={{
                  alignSelf: "flex-start",
                  background: "rgba(212,175,55,0.08)",
                  border: "1px solid rgba(212,175,55,0.15)",
                  padding: "12px 14px",
                  borderRadius: "12px",
                  maxWidth: "85%",
                }}
              >
                <span
                  style={{
                    fontSize: "13px",
                    color: "#e7d9c4",
                    lineHeight: "1.55",
                    whiteSpace: "pre-line",
                  }}
                >
                  {isLotWizard
                    ? "I can help you complete this lot draft or answer questions about coffee, varieties, process, pricing, and export logic."
                    : "I can help you answer questions about coffee, your profile, and platform workflows."}
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "8px",
                  marginTop: "2px",
                }}
              >
                {[
                  ...(hasLotIntegration ? ["Complete this lot"] : []),
                  "How pricing works",
                  "What is washed coffee?",
                ].map((item) => (
                  <button
                    key={item}
                    onClick={() => {
                      if (item === "Complete this lot") {
                        startLotFlow()
                        return
                      }

                      setInput(item)
                    }}
                    style={{
                      padding: "7px 11px",
                      borderRadius: "999px",
                      border: "1px solid rgba(212,175,55,0.2)",
                      background: "transparent",
                      fontSize: "12px",
                      color: "#cbb892",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background =
                        "rgba(212,175,55,0.1)"
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent"
                    }}
                  >
                    {item}
                  </button>
                ))}
              </div>

              {form && (
                <div
                  style={{
                    marginTop: "4px",
                    alignSelf: "stretch",
                    background: "rgba(255,255,255,0.025)",
                    border: "1px solid rgba(212,175,55,0.10)",
                    borderRadius: "14px",
                    padding: "12px 14px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "11px",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "#bda884",
                      marginBottom: "8px",
                    }}
                  >
                    Current lot draft
                  </div>

                  <div
                    style={{
                      fontSize: "12px",
                      color: "#e7d9c4",
                      lineHeight: "1.6",
                      whiteSpace: "pre-line",
                    }}
                  >
                    {buildLotSummary()}
                  </div>
                </div>
              )}

              {messages.map((msg, index) => (
                <div key={msg.id || `normal-msg-${index}`}>
                  {renderMessageBubble(msg)}
                </div>
              ))}

              {isLoading && (
                <div
                  style={{
                    alignSelf: "flex-start",
                    background: "rgba(212,175,55,0.08)",
                    border: "1px solid rgba(212,175,55,0.15)",
                    padding: "10px 14px",
                    borderRadius: "12px",
                    maxWidth: "80%",
                  }}
                >
                  <span
                    style={{
                      fontSize: "13px",
                      color: "#e7d9c4",
                      lineHeight: "1.5",
                    }}
                  >
                    Thinking...
                  </span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        <div
          style={{
            padding: "12px",
            borderTop: "1px solid rgba(212,175,55,0.12)",
            background: "rgba(255,255,255,0.015)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder={
                mode === "lot"
                  ? currentLotStep?.key === "name"
                    ? lotNameFlowState === "suggested"
                      ? "Use the buttons below, or type a valid option..."
                      : "Type your preferred lot name..."
                    : currentLotStep
                      ? `Reply for ${getFieldLabel(currentLotStep.key)}...`
                      : "Type your answer..."
                  : "Ask something about your coffee..."
              }
              style={{
                width: "100%",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(212,175,55,0.2)",
                borderRadius: "999px",
                padding: "10px 14px",
                fontSize: "13px",
                color: "#e7d9c4",
                outline: "none",
              }}
            />

            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              style={{
                border: "1px solid rgba(212,175,55,0.22)",
                background: input.trim()
                  ? "rgba(212,175,55,0.12)"
                  : "rgba(255,255,255,0.03)",
                color: input.trim() ? "#f2e6cf" : "#8f7b5b",
                borderRadius: "999px",
                padding: "10px 13px",
                fontSize: "12px",
                cursor:
                  isLoading || !input.trim() ? "not-allowed" : "pointer",
                transition: "all 0.2s ease",
                flexShrink: 0,
              }}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    ) : null

  return (
    <>
      <div
        title="Assistant"
        onClick={() => setAssistantOpen(true)}
        className={`leaf-hover ${hasNotification ? "leaf-notification" : ""}`}
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          background: "rgba(212,175,55,0.08)",
          border: "1px solid rgba(212,175,55,0.35)",
          transition: "all 0.25s cubic-bezier(0.22,1,0.36,1)",
          backdropFilter: "blur(6px)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = "0 0 20px rgba(212,175,55,0.18)"
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = "none"
        }}
      >
        <Image
          src="/images/chat_bot_leaf.png"
          alt="Assistant"
          width={iconSize}
          height={iconSize}
          className="leaf-icon"
        />
      </div>

      {isMounted && assistantPanel
        ? createPortal(assistantPanel, document.body)
        : null}
    </>
  )
}