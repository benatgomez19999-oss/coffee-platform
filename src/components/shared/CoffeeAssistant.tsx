"use client"

import Image from "next/image"
import { useEffect, useRef, useState } from "react"

type CoffeeAssistantProps = {
  iconSize?: number
}

export default function CoffeeAssistant({
  iconSize = 54,
}: CoffeeAssistantProps) {
  //////////////////////////////////////////////////////
  // 🧠 STATE
  //////////////////////////////////////////////////////

  const [assistantOpen, setAssistantOpen] = useState(false)
  const [hasNotification] = useState(true)
  const [mode, setMode] = useState<"normal" | "story">("normal")
  const [step, setStep] = useState(0)
  const [messages, setMessages] = useState<any[]>([])
  const [input, setInput] = useState("")
  const [, setIsGeneratingStory] = useState(false)
  const [answers, setAnswers] = useState<any>({})
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  //////////////////////////////////////////////////////
  // 🪴 STORY FLOW
  //////////////////////////////////////////////////////

  const storySteps = [
    {
      key: "experience",
      question: "How many years have you been producing coffee?",
    },
    {
      key: "location",
      question: "Where is your farm located?",
    },
    {
      key: "uniqueness",
      question: "What makes your farm unique?",
    },
    {
      key: "values",
      question: "What values guide your work?",
    },
  ]

  const startStoryFlow = () => {
    setAssistantOpen(true)
    setMode("story")
    setStep(0)
    setMessages([
      {
        role: "assistant",
        content: "Great — let's build your farm story.",
      },
      {
        role: "assistant",
        content: storySteps[0].question,
      },
    ])
  }

  useEffect(() => {
    const handler = () => {
      startStoryFlow()
    }

    window.addEventListener("startStoryFlow", handler)

    return () => {
      window.removeEventListener("startStoryFlow", handler)
    }
  }, [])

  //////////////////////////////////////////////////////
  // ✉️ SEND MESSAGE
  //////////////////////////////////////////////////////

  const handleSend = async () => {
    if (!input.trim()) return

    const cleanInput = input.trim()

    const userMessage = {
      role: "user",
      content: cleanInput,
    }

    const currentKey = storySteps[step]?.key

    const updatedAnswers = {
      ...answers,
      [currentKey]: cleanInput,
    }

    setAnswers(updatedAnswers)

    const updatedMessages = [...messages, userMessage]

    const isLastStep = step === storySteps.length - 1

    // 🧠 LAST STEP → generate story
    if (mode === "story" && isLastStep) {
      setIsGeneratingStory(true)
      window.dispatchEvent(new Event("storyGenerating"))

      setMessages([
        ...updatedMessages,
        {
          role: "assistant",
          content: "Perfect — generating your farm story now...",
        },
      ])

      setInput("")

      fetch("/api/generate-story", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updatedAnswers),
      })
        .then((res) => res.json())
        .then((data) => {
          window.dispatchEvent(
            new CustomEvent("storyGenerated", {
              detail: data.story,
            })
          )
        })

      setTimeout(() => {
        setAssistantOpen(false)
      }, 3000)

      return
    }

    // ➡️ NEXT STEP
    const nextStep = step + 1

    setMessages([
      ...updatedMessages,
      {
        role: "assistant",
        content: storySteps[nextStep].question,
      },
    ])

    setStep(nextStep)
    setInput("")
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
  // 🎨 UI
  //////////////////////////////////////////////////////

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
            height: "500px",
            minHeight: 0,

            background: "#1f1a14",
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
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Image
                src="/images/chat_bot_leaf.png"
                alt="Assistant"
                width={18}
                height={18}
                style={{ opacity: 0.9 }}
              />

              <span
                style={{
                  fontSize: "14px",
                  color: "#e7d9c4",
                  fontWeight: 500,
                }}
              >
                Coffee Assistant
              </span>
            </div>

            <div
              onClick={() => setAssistantOpen(false)}
              style={{
                cursor: "pointer",
                fontSize: "14px",
                color: "#a08b6b",
                transition: "opacity 0.2s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.7")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              ✕
            </div>
          </div>

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
            {mode === "story" ? (
              <>
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    style={{
                      alignSelf:
                        msg.role === "assistant" ? "flex-start" : "flex-end",
                      background:
                        msg.role === "assistant"
                          ? "rgba(212,175,55,0.08)"
                          : "rgba(255,255,255,0.06)",
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
                      {msg.content}
                    </span>
                  </div>
                ))}

                <div ref={messagesEndRef} />
              </>
            ) : (
              <>
                {/* BOT MESSAGE */}
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
                    I can help you create your farm story or answer questions
                    about your coffee.
                  </span>
                </div>

                {/* QUICK ACTIONS */}
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "8px",
                    marginTop: "8px",
                  }}
                >
                  {[
                    "Create farm story",
                    "Add photos",
                    "How pricing works",
                  ].map((item) => (
                    <div
                      key={item}
                      onClick={() => {
                        if (item === "Create farm story") {
                          startStoryFlow()
                        }
                      }}
                      style={{
                        padding: "6px 10px",
                        borderRadius: "999px",
                        border: "1px solid rgba(212,175,55,0.2)",
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
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* ================= INPUT ================= */}
          <div
            style={{
              padding: "12px",
              borderTop: "1px solid rgba(212,175,55,0.12)",
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
                mode === "story"
                  ? "Type your answer..."
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
          </div>
        </div>
      )}
    </>
  )
}