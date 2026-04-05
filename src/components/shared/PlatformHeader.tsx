"use client"
import { useRouter, usePathname,  } from "next/navigation"
import Image from "next/image"
import OnboardingWizard from "@/src/components/shared/OnboardingWizard"
import { useState, useEffect, useRef } from "react"
import "@/styles/themes/producer.css"

export default function PlatformHeader({ user }: { user: any }) {
  const router = useRouter()
  const pathname = usePathname()
  const isProducer = user?.role === "PRODUCER"
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [hasNotification, setHasNotification] = useState(true) 
  const [mode, setMode] = useState<"normal" | "story">("normal")
  const [step, setStep] = useState(0)
  const [messages, setMessages] = useState<any[]>([])
  const [input, setInput] = useState("")
  const [isGeneratingStory, setIsGeneratingStory] = useState(false)
  const [answers, setAnswers] = useState<any>({})
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // ✨ NAV ITEM BASE STYLE (unified + premium feel)

const navItemStyle = {
  position: "relative" as const,
  cursor: "pointer",
  paddingBottom: "4px",

  fontSize: "15px",          // ✅ tamaño consistente
  fontWeight: 500,           // ✅ más presencia
  letterSpacing: "0.6px",    // ✨ toque premium
  textTransform: "none",     // limpio, no agresivo

  transition: "color 0.25s ease, opacity 0.25s ease",

  opacity: 0.9               // ligero suavizado base
}

  // 🎨 THEME DINÁMICO (refinado)
  const theme = isProducer
    ? {
        text: "#5b4a36",
        textSoft: "#8a7a63",
        textStrong: "#2a1f14",
        border: "rgba(180,150,90,0.25)",
        bg: "linear-gradient(180deg, rgba(42,26,18,0.85), rgba(27,18,12,0.85))",
        glow: "rgba(212,175,55,0.15)",
        accent: "#d4af37",
        accentStrong: "#f3d27a"
      }
    : {
        text: "#aaa",
        textSoft: "#ccc",
        textStrong: "white",
        border: "rgba(255,255,255,0.08)",
        bg: "rgba(11,15,15,0.85)",
        glow: "rgba(255,255,255,0.06)"
      }

  // BOT STORYTELLING CONECTED WITH FARM CARD

  const storySteps = [
  { key: "experience", question: "How many years have you been producing coffee?" },
  { key: "location", question: "Where is your farm located?" },
  { key: "uniqueness", question: "What makes your farm unique?" },
  { key: "values", question: "What values guide your work?" }
]

  const startStoryFlow = () => {
  setAssistantOpen(true)
  setMode("story")
  setStep(0)

  setMessages(prev => [
    ...prev,
    {
      role: "assistant",
      content: "Great — let's build your farm story."
    },
    {
      role: "assistant",
      content: storySteps[0].question
    }
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

const handleSend = async () => {
  if (!input.trim()) return
  const cleanInput = input.trim() 

  
  
  const userMessage = {
    role: "user",
    content: cleanInput
  }

  const currentKey = storySteps[step]?.key

  const updatedAnswers = {
    ...answers,
    [currentKey]: cleanInput
  }

  setAnswers(updatedAnswers)

  const updatedMessages = [...messages, userMessage]

  const isLastStep = step === storySteps.length - 1

  // 🧠 ÚLTIMO STEP
  if (mode === "story" && isLastStep) {
    setIsGeneratingStory(true)
    window.dispatchEvent(new Event("storyGenerating"))

    setMessages([
      ...updatedMessages,
      {
        role: "assistant",
        content: "Perfect — generating your farm story now..."
      }
    ])

    setInput("") // ✅ IMPORTANTE

    fetch("/api/generate-story", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(updatedAnswers)
    })
      .then(res => res.json())
      .then(data => {
        window.dispatchEvent(
          new CustomEvent("storyGenerated", {
            detail: data.story
          })
        )
      })

    setTimeout(() => {
      setAssistantOpen(false)
    }, 3000)

    return
  }

  // ➡️ SIGUIENTE STEP
  const nextStep = step + 1

  setMessages([
    ...updatedMessages,
    {
      role: "assistant",
      content: storySteps[nextStep].question
    }
  ])

  setStep(nextStep)
  setInput("") // ✅ SIEMPRE limpiar input
}

{/* ////////////////////////////////////////////////////// */}
{/* // 🧠 AUTO SCROLL (PRO LEVEL) */}
{/* ////////////////////////////////////////////////////// */}

const isNearBottom = () => {
  const el = containerRef.current
  if (!el) return true

  return el.scrollHeight - el.scrollTop - el.clientHeight < 100
}

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

  

  return (
    <>
      {/* ONBOARDING */}
      {!user.onboardingCompleted && (
        <OnboardingWizard 
          role={user.role}
          onComplete={() => window.location.reload()}
        />
      )}

      {/* HEADER */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: "70px",

          background: theme.bg,
          borderBottom: `1px solid ${theme.border}`,

          color: theme.textStrong,
          backdropFilter: "blur(16px) saturate(140%)",

          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 40px",

          zIndex: 1000,

          // ✨ NUEVO: profundidad premium
          boxShadow: isProducer
            ? `0 8px 30px rgba(0,0,0,0.08),
               inset 0 -1px 0 ${theme.glow}`
            : `0 10px 40px rgba(0,0,0,0.4)`
        }}
      >

        {/* LIGHT GLOW TOP (muy sutil) */}
        {isProducer && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "1px",
              background: "linear-gradient(90deg, transparent, #d4af37, transparent)",
              opacity: 0.5
            }}
          />
        )}

        {/* LEFT */}
        <div style={{ display: "flex", alignItems: "center", gap: "30px" }}>
          
          {/* LOGO */}
          <div style={{ display: "flex", alignItems: "center" }}>
            <Image
              src="/images/logo-altura-gold-final.png"
              alt="Altura Collective"
              width={140}
              height={40}
              style={{ objectFit: "contain" }}
            />
          </div>

          {/* NAV */}
          <div style={{ display: "flex", gap: "20px", fontSize: "14px" }}>
            
            {/* DASHBOARD */}
            <span
              onClick={() => router.push("/platform")}
              style={{
                ...navItemStyle,
                color: pathname === "/platform"
                   ? theme.accentStrong
                   : theme.accent
              }}
              // ✨ NAV INTERACTION (underline + subtle opacity feedback)
onMouseEnter={(e) => {
  e.currentTarget.style.opacity = "1"

  const underline = e.currentTarget.querySelector("span")
  if (underline) {
    underline.style.width = "100%"
    underline.style.left = "0"
  }
}}
onMouseLeave={(e) => {
  e.currentTarget.style.opacity = "0.9"

  const underline = e.currentTarget.querySelector("span")
  if (underline) {
    underline.style.width = "0%"
    underline.style.left = "50%"
  }
}}
            >
              Dashboard
              <span
                style={{
                  position: "absolute",
                  bottom: "0",
                  left: "50%",
                  width: "0%",
                  height: "1px",
                  background: "linear-gradient(90deg, #d4af37, #f3d27a, #d4af37)",
                  transition: "width 0.3s ease, left 0.3s ease"
                }}
              />
            </span>

            {/* CONTRACTS */}
            <span
              onClick={() => router.push("/platform/contracts")}
              style={{
                ...navItemStyle,
                color: pathname === "/platform/contracts"
                   ? theme.accentStrong
                   : theme.accent
              }}
              // ✨ NAV INTERACTION (underline + subtle opacity feedback)
onMouseEnter={(e) => {
  e.currentTarget.style.opacity = "1"

  const underline = e.currentTarget.querySelector("span")
  if (underline) {
    underline.style.width = "100%"
    underline.style.left = "0"
  }
}}
onMouseLeave={(e) => {
  e.currentTarget.style.opacity = "0.9"

  const underline = e.currentTarget.querySelector("span")
  if (underline) {
    underline.style.width = "0%"
    underline.style.left = "50%"
  }
}}
            >
              Contracts
              <span
                style={{
                  position: "absolute",
                  bottom: "0",
                  left: "50%",
                  width: "0%",
                  height: "1px",
                  background: "linear-gradient(90deg, #d4af37, #f3d27a, #d4af37)",
                  transition: "width 0.3s ease, left 0.3s ease"
                }}
              />
            </span>
          </div>

          {/* MARKETPLACE */}
          <span
            onClick={() => router.push("/")}
            style={{
              ...navItemStyle,
              color: pathname === "/"
                 ? theme.accentStrong
                 : theme.accent
            }}
           // ✨ NAV INTERACTION (underline + subtle opacity feedback)
onMouseEnter={(e) => {
  e.currentTarget.style.opacity = "1"

  const underline = e.currentTarget.querySelector("span")
  if (underline) {
    underline.style.width = "100%"
    underline.style.left = "0"
  }
}}
onMouseLeave={(e) => {
  e.currentTarget.style.opacity = "0.9"

  const underline = e.currentTarget.querySelector("span")
  if (underline) {
    underline.style.width = "0%"
    underline.style.left = "50%"
  }
}}
          >
            Marketplace
            <span
              style={{
                position: "absolute",
                bottom: "0",
                left: "50%",
                width: "0%",
                height: "1px",
                background: "linear-gradient(90deg, #d4af37, #f3d27a, #d4af37)",
                transition: "width 0.3s ease, left 0.3s ease"
              }}
            />
          </span>

        </div>

        {/* RIGHT */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>


          
         {/* USER NAME / EMAIL (clean fallback + short email + hover) */}
<div
  style={{ 
    fontSize: "14px", 
    color: theme.accent,
    fontWeight: 500,
    cursor: "pointer",
    opacity: 0.9,
    transition: "opacity 0.25s ease"
  }}
  onMouseEnter={(e) => {
    e.currentTarget.style.opacity = "1"
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.opacity = "0.9"
  }}
>
  {
    user?.name
      ? user.name
      : user?.email
        ? user.email.split("@")[0]
        : "User"
  }
</div>

  

          <div style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "#3FAF73",
            boxShadow: "0 0 6px rgba(63,175,115,0.6)",
            border: "1px solid rgba(255,255,255,0.2)"
          }} />

          <div style={{
  width: "1px",
  height: "16px",
  background: "rgba(255,255,255,0.1)",
  margin: "0 4px"
}} />

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
    backdropFilter: "blur(6px)"
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
    width={54}
    height={54}
    className="leaf-icon"
  />
</div>

  

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

  // 👇 CLAVE
  transformOrigin: "top right",
  animation: "chatOpen 0.25s cubic-bezier(0.22,1,0.36,1)"
}}
  >

    {/* ================= HEADER ================= */}
    <div
      style={{
        padding: "14px 18px",
        borderBottom: "1px solid rgba(212,175,55,0.12)",

        display: "flex",
        alignItems: "center",
        justifyContent: "space-between"
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
            fontWeight: 500
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
          transition: "opacity 0.2s ease"
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
    gap: "12px"
  }}
>

  {/* 🧠 MODO STORY → mensajes dinámicos */}
 {mode === "story" ? (
  <>
    {messages.map((msg, i) => (
      <div
        key={i}
        style={{
          alignSelf: msg.role === "assistant" ? "flex-start" : "flex-end",
          background:
            msg.role === "assistant"
              ? "rgba(212,175,55,0.08)"
              : "rgba(255,255,255,0.06)",
          border: "1px solid rgba(212,175,55,0.15)",
          padding: "10px 14px",
          borderRadius: "12px",
          maxWidth: "80%"
        }}
      >
        <span
          style={{
            fontSize: "13px",
            color: "#e7d9c4",
            lineHeight: "1.5"
          }}
        >
          {msg.content}
        </span>
      </div>
    ))}

    {/* 👇 SIEMPRE AL FINAL */}
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
          maxWidth: "80%"
        }}
      >
        <span
          style={{
            fontSize: "13px",
            color: "#e7d9c4",
            lineHeight: "1.5"
          }}
        >
          I can help you create your farm story or answer questions about your coffee.
        </span>
      </div>

      {/* QUICK ACTIONS */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
          marginTop: "8px"
        }}
      >
        {["Create farm story", "Add photos", "How pricing works"].map((item) => (
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
              transition: "all 0.2s ease"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(212,175,55,0.1)"
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
    borderTop: "1px solid rgba(212,175,55,0.12)"
  }}
>
 <input
  value={input}
  onChange={(e) => setInput(e.target.value)}
 onKeyDown={(e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault() // 👈 evita doble submit
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
    outline: "none"
  }}
/>
</div>
  </div>
)}

    {/* SETTINGS ICON — premium interaction */}
<div
  title="Settings"
  style={{
    width: 33,
    height: 33,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",

    // 🎨 base más limpia
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(212,175,55,0.25)",

    transition: "all 0.25s cubic-bezier(0.22,1,0.36,1)",
    backdropFilter: "blur(6px)"
  }}
  onMouseEnter={(e) => {
    e.currentTarget.style.background = "rgba(212,175,55,0.12)"
    e.currentTarget.style.boxShadow = "0 0 14px rgba(212,175,55,0.25)"
    e.currentTarget.style.transform = "translateY(-1px) scale(1.05)"
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.background = "rgba(255,255,255,0.02)"
    e.currentTarget.style.boxShadow = "none"
    e.currentTarget.style.transform = "translateY(0) scale(1)"

  
}}

  
>
  {/* COFFEE SETTINGS ICON — refined */}
  <svg
    width="21"
    height="21"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{
      transition: "transform 0.25s ease",
      transform: "translateY(0px) translateX(0.5px)"
    }}
  >
    <path
      d="M12 2.5C7.5 2.5 5 6.5 5 12C5 17.5 7.5 21.5 12 21.5C16.5 21.5 19 17.5 19 12C19 6.5 16.5 2.5 12 2.5Z"
      stroke="#d4af37"
      strokeWidth="1.2"
    />
    <path
      d="M13 5.5C10.5 7.5 10.5 10 12 12C13.5 14 13.5 16.5 11 18.5"
      stroke="#d4af37"
      strokeWidth="1.2"
      strokeLinecap="round"
    />
    <circle
      cx="12"
      cy="12"
      r="0.8"
      fill="#d4af37"
      opacity="0.9"
    />
  </svg>
</div>



{/* LOGOUT → uses landing CTA behavior */}
<button
  onClick={async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include"
    })
    window.location.href = "/"
  }}
  style={{
    padding: "8px 18px",
    borderRadius: "999px",
    border: "1px solid rgba(212,175,55,0.6)",
    backgroundColor: "rgba(31,61,43,0.85)",
    color: "#fff",
    fontSize: "0.8rem",
    letterSpacing: "0.5px",
    transition: "all 0.35s ease",
    backdropFilter: "blur(6px)",
    cursor: "pointer"
  }}
  onMouseEnter={(e) => {
    e.currentTarget.style.backgroundColor = "rgba(212,175,55,0.85)";
    e.currentTarget.style.color = "#111";
    e.currentTarget.style.transform = "translateY(-2px)";
    e.currentTarget.style.boxShadow = "0 10px 25px rgba(212,175,55,0.25)";
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.backgroundColor = "rgba(31,61,43,0.85)";
    e.currentTarget.style.color = "#fff";
    e.currentTarget.style.transform = "translateY(0)";
    e.currentTarget.style.boxShadow = "none";
  }}
>
  Logout
</button>

</div>

        </div>
        
        
    </>
  )
}