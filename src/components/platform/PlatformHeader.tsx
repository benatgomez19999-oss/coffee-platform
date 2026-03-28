"use client"
import { useRouter, usePathname } from "next/navigation"
import Image from "next/image"
import OnboardingWizard from "@/components/platform/OnboardingWizard"

export default function PlatformHeader({ user }: { user: any }) {
  const router = useRouter()
  const pathname = usePathname()
  const isProducer = user?.role === "PRODUCER"

  const navItemStyle = {
    position: "relative" as const,
    cursor: "pointer",
    paddingBottom: "4px"
  }

  // 🎨 THEME DINÁMICO
  const theme = isProducer
    ? {
        text: "#3e2f1c",
        textSoft: "#6b5e4a",
        textStrong: "#2a1f14",
        border: "rgba(0,0,0,0.08)",
        bg: "rgba(245,241,230,0.85)"
      }
    : {
        text: "#aaa",
        textSoft: "#ccc",
        textStrong: "white",
        border: "rgba(255,255,255,0.08)",
        bg: "rgba(11,15,15,0.85)"
      }

  return (
    <>
      {/* ONBOARDING */}
      {!user.onboardingCompleted && (
        <OnboardingWizard 
          user={user}
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
          backdropFilter: "blur(10px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 40px",
          zIndex: 1000
        }}
      >

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
                  ? theme.textStrong
                  : theme.text
              }}
              onMouseEnter={(e) => {
                const underline = e.currentTarget.querySelector("span")
                if (underline) {
                  underline.style.width = "100%"
                  underline.style.left = "0"
                }
              }}
              onMouseLeave={(e) => {
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
                  ? theme.textStrong
                  : theme.text
              }}
              onMouseEnter={(e) => {
                const underline = e.currentTarget.querySelector("span")
                if (underline) {
                  underline.style.width = "100%"
                  underline.style.left = "0"
                }
              }}
              onMouseLeave={(e) => {
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
                  transition: "all 0.3s ease"
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
                ? theme.textStrong
                : theme.text
            }}
            onMouseEnter={(e) => {
              const underline = e.currentTarget.querySelector("span")
              if (underline) {
                underline.style.width = "100%"
                underline.style.left = "0"
              }
            }}
            onMouseLeave={(e) => {
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
                transition: "all 0.3s ease"
              }}
            />
          </span>

        </div>

        {/* RIGHT */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          
          <div style={{ fontSize: "14px", color: theme.textSoft }}>
            {user?.email}
          </div>

          <div style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "#4ade80"
          }} />

          <button
            onClick={async () => {
              await fetch("/api/auth/logout", {
                method: "POST",
                credentials: "include"
              })
              window.location.href = "/"
            }}
            style={{
              padding: "6px 12px",
              borderRadius: "999px",
              border: `1px solid ${theme.border}`,
              background: "transparent",
              color: theme.textStrong,
              cursor: "pointer"
            }}
          >
            Logout
          </button>

        </div>

      </div>
    </>
  )
}