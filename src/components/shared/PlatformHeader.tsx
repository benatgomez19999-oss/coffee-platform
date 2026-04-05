"use client"
import { useRouter, usePathname,  } from "next/navigation"
import Image from "next/image"
import OnboardingWizard from "@/src/components/shared/OnboardingWizard"
import { useEffect } from "react"
import "@/styles/themes/producer.css"
import CoffeeAssistant from "@/src/components/shared/assistant/CoffeeAssistant"

export default function PlatformHeader({ user }: { user: any }) {
  const router = useRouter()
  const pathname = usePathname()
  const isProducer = user?.role === "PRODUCER"


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
{/* // 🌿 AI ASSISTANT */}
{/* ////////////////////////////////////////////////////// */}

<CoffeeAssistant iconSize={54} />

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