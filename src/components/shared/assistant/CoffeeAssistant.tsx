"use client"

import Image from "next/image"
import { useEffect, useMemo, useRef, useState } from "react"
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

  //////////////////////////////////////////////////////
  // 🧠 STATE
  //////////////////////////////////////////////////////

  const [assistantOpen, setAssistantOpen] = useState(false)
  const [hasNotification] = useState(true)
  const [mode, setMode] = useState<AssistantMode>("normal")
  const [step, setStep] = useState(0)
  const [messages, setMessages] = useState<AssistantMessage[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  //////////////////////////////////////////////////////
  // 🌿 FARM CONTEXT (SMART AUTOFILL)
  //////////////////////////////////////////////////////

  const [farmOptions, setFarmOptions] = useState<
    { id: string; name: string }[]
  >([])
  const [hasCheckedFarms, setHasCheckedFarms] = useState(false)

  //////////////////////////////////////////////////////
  // 🧠 REFS
  //////////////////////////////////////////////////////

  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  //////////////////////////////////////////////////////
  // 🧠 FLAGS
  //////////////////////////////////////////////////////

  const hasLotIntegration = Boolean(form && updateField)
  const isLotWizard = context === "lot-wizard"

  //////////////////////////////////////////////////////
  // 🧠 DERIVED STATE
  //////////////////////////////////////////////////////

  const missingRequiredFields = useMemo(() => {
    if (!form) return requiredLotFields

    return requiredLotFields.filter((field) => !String(form[field] || "").trim())
  }, [form])

  //////////////////////////////////////////////////////
  // 🔧 HELPERS
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

  const resetToNormalMode = () => {
    setMode("normal")
    setStep(0)
    setInput("")
    setMessages([])
    setIsLoading(false)
    setFarmOptions([])
    setHasCheckedFarms(false)
  }

  //////////////////////////////////////////////////////
  // 🚀 START LOT FLOW
  //////////////////////////////////////////////////////

  const startLotFlow = () => {
    setAssistantOpen(true)
    setMode("lot")
    setStep(0)
    setMessages([
      {
        role: "assistant",
        content:
          "Great — I can help you complete this lot draft step by step.",
      },
    ])
    setInput("")

    //////////////////////////////////////////////////////
    // 🔥 SMART AUTOFILL TRIGGER
    //////////////////////////////////////////////////////

    setTimeout(() => {
      loadFarmContext()
    }, 200)
  }
  //////////////////////////////////////////////////////
  // 🤖 AUTOLOAD FARM CONTEXT
  //////////////////////////////////////////////////////

  const loadFarmContext = async () => {
    try {
      const res = await fetch("/api/assistant/farm-context")
      const data = await res.json()

      if (!res.ok) return

      const farms = data.farms || []

      //////////////////////////////////////////////////////
      // 🧠 CASE 1: NO FARMS
      //////////////////////////////////////////////////////

      if (farms.length === 0) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "Let's start with the Farm ID. This identifies your farm inside the platform.",
          },
          {
            role: "assistant",
            content: lotDraftSteps[0].question,
          },
        ])
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

        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `I found your farm "${farm.name}" and linked it automatically.`,
          },
          {
            role: "assistant",
            content: lotDraftSteps[1].question,
          },
        ])

        setStep(1)
        return
      }

      //////////////////////////////////////////////////////
      // 🧠 CASE 3: MULTIPLE FARMS
      //////////////////////////////////////////////////////

      setFarmOptions(farms)
    } catch (err) {
      console.error("Autofill farm error:", err)

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "I could not load your farms right now. Let's continue manually.",
        },
        {
          role: "assistant",
          content: lotDraftSteps[0].question,
        },
      ])
    } finally {
      setHasCheckedFarms(true)
    }
  }
    

  //////////////////////////////////////////////////////
  // 🎧 EVENTS
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
  // ✉️ LOT MODE
  //////////////////////////////////////////////////////

  const handleLotSend = () => {
    if (!input.trim()) return

    const cleanInput = input.trim()
    const currentStep = lotDraftSteps[step]

    if (!currentStep) return

    const userMessage: AssistantMessage = {
      role: "user",
      content: cleanInput,
    }

    const normalizedValue = normalizeLotValue(currentStep.key, cleanInput)
    const validationError = validateLotValue(currentStep.key, normalizedValue)

    if (validationError) {
      setMessages((prev) => [
        ...prev,
        userMessage,
        {
          role: "assistant",
          content: `${validationError} ${
            currentStep.helper ? currentStep.helper : ""
          }`.trim(),
        },
      ])
      setInput("")
      return
    }

    if (updateField) {
      updateField(currentStep.key, normalizedValue)
    }

    const nextStep = step + 1
    const isLastStep = nextStep >= lotDraftSteps.length

    if (isLastStep) {
      setMessages((prev) => [
        ...prev,
        userMessage,
        {
          role: "assistant",
          content:
            "Perfect — I updated the lot draft. Review the form and click Save Lot for Analysis when you're ready.",
        },
      ])

      setStep(nextStep)
      setInput("")
      return
    }

    const confirmationMessage =
      normalizedValue === ""
        ? `${getFieldLabel(currentStep.key)} skipped.`
        : `${getFieldLabel(currentStep.key)} updated.`

    setMessages((prev) => [
      ...prev,
      userMessage,
      {
        role: "assistant",
        content: confirmationMessage,
      },
      {
        role: "assistant",
        content: lotDraftSteps[nextStep].question,
      },
    ])

    setStep(nextStep)
    setInput("")
  }

  //////////////////////////////////////////////////////
  // 🤖 NORMAL MODE
  //////////////////////////////////////////////////////

  const handleNormalSend = async () => {
    if (!input.trim()) return

    const cleanInput = input.trim()

    const userMessage: AssistantMessage = {
      role: "user",
      content: cleanInput,
    }

    setMessages((prev) => [...prev, userMessage])
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

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            data.reply ||
            "I could not generate a response right now. Please try again.",
        },
      ])
    } catch (error) {
      console.error("Assistant chat error:", error)

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "There was an error connecting with the assistant. Please try again.",
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  //////////////////////////////////////////////////////
  // ✉️ SEND MESSAGE
  //////////////////////////////////////////////////////

  const handleSend = async () => {
    if (mode === "lot") {
      handleLotSend()
      return
    }

    await handleNormalSend()
  }

  //////////////////////////////////////////////////////
  // 🧠 AUTO SCROLL
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

  //////////////////////////////////////////////////////
  // 🎨 UI HELPERS
  //////////////////////////////////////////////////////

  const renderMessageBubble = (msg: AssistantMessage, index: number) => {
    return (
      <div
        key={index}
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
    totalLotSteps > 0 ? Math.min((completedLotSteps / totalLotSteps) * 100, 100) : 0

  return (
    <>
      {/* ////////////////////////////////////////////////////// */}
      {/* // 🌿 AI ASSISTANT TRIGGER */}
      {/* ////////////////////////////////////////////////////// */}

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

      {/* ////////////////////////////////////////////////////// */}
      {/* // 💬 ASSISTANT PANEL */}
      {/* ////////////////////////////////////////////////////// */}

      {assistantOpen && (
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

            zIndex: 2000,

            transformOrigin: "top right",
            animation: "chatOpen 0.25s cubic-bezier(0.22,1,0.36,1)",
          }}
        >
          {/* ================= HEADER ================= */}
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

                    {/* ================= LOT STATUS BAR ================= */}
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

              {/* ////////////////////////////////////////////////////// */}
              {/* // 🌿 FARM SELECTOR (PRO UI) */}
              {/* ////////////////////////////////////////////////////// */}
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
                        (farm) => farm.id === e.target.value
                      )

                      if (!selected) return

                      if (updateField) {
                        updateField("farmId", selected.id)
                      }

                      setFarmOptions([])

                      setMessages((prev) => [
                        ...prev,
                        {
                          role: "assistant",
                          content: `Using "${selected.name}".`,
                        },
                        {
                          role: "assistant",
                          content: lotDraftSteps[1].question,
                        },
                      ])

                      setStep(1)
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


          {/* ================= BODY ================= */}
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
                {/* INTRO / STATE CARD */}
                {form && (
                  <div
                    style={{
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
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "8px 12px",
                      }}
                    >
                      {[
                        ["Farm ID", form.farmId || "—"],
                        ["Lot Name", form.name || "—"],
                        ["Variety", form.variety || "—"],
                        ["Process", form.process || "—"],
                        ["Harvest Year", form.harvestYear || "—"],
                        ["Parchment Kg", form.parchmentKg || "—"],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <div
                            style={{
                              fontSize: "10px",
                              color: "#9f8a68",
                              textTransform: "uppercase",
                              letterSpacing: "0.06em",
                              marginBottom: "3px",
                            }}
                          >
                            {label}
                          </div>

                          <div
                            style={{
                              fontSize: "12px",
                              color: "#e7d9c4",
                              lineHeight: "1.4",
                              wordBreak: "break-word",
                            }}
                          >
                            {value}
                          </div>
                        </div>
                      ))}
                    </div>

                    {missingRequiredFields.length > 0 && (
                      <div
                        style={{
                          marginTop: "10px",
                          fontSize: "12px",
                          color: "#d9bf93",
                          lineHeight: "1.5",
                        }}
                      >
                        Missing required:{" "}
                        {missingRequiredFields.map(getFieldLabel).join(", ")}
                      </div>
                    )}
                  </div>
                )}

                {/* CHAT MESSAGES */}
                {messages.map((msg, i) => renderMessageBubble(msg, i))}

               
                <div ref={messagesEndRef} />
              </>
            ) : (
              <>
                {/* DEFAULT INTRO MESSAGE */}
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

                {/* QUICK ACTIONS */}
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

                {/* LOT CONTEXT CARD */}
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

                {/* NORMAL CHAT MESSAGES */}
                {messages.map((msg, i) => renderMessageBubble(msg, i))}

                {/* LOADING */}
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

          {/* ================= INPUT ================= */}
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
                    ? currentLotStep
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
      )}
    </>
  )
}