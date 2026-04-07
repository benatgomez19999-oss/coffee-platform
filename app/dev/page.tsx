"use client"

import { useState } from "react"

const DEV_SECRET = process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS_SECRET || ""

export default function DevAccessPage() {
  const [loadingRole, setLoadingRole] = useState<string | null>(null)
  const [error, setError] = useState("")

  const loginAs = async (role: "producer" | "partner" | "client") => {
    try {
      setLoadingRole(role)
      setError("")

      const res = await fetch("/api/dev/login-as", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          role,
          secret: DEV_SECRET,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error || "Failed to login as dev user")
      }

      if (role === "producer") {
        window.location.href = "/platform/producer"
        return
      }

      if (role === "partner") {
        window.location.href = "/platform/partner"
        return
      }

      if (role === "client") {
        window.location.href = "/platform/client"
        return
      }
    } catch (err: any) {
      setError(err?.message || "Something went wrong")
    } finally {
      setLoadingRole(null)
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f3eee6",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "540px",
          background: "#fffaf2",
          border: "1px solid #d9c7a7",
          borderRadius: "20px",
          padding: "28px",
          boxShadow: "0 20px 50px rgba(0,0,0,0.08)",
        }}
      >
        <div
          style={{
            fontSize: "13px",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#a08b6b",
            marginBottom: "10px",
          }}
        >
          Dev access
        </div>

        <h1
          style={{
            fontSize: "30px",
            lineHeight: 1.2,
            color: "#2f2418",
            marginBottom: "12px",
          }}
        >
          Quick role switch
        </h1>

        <p
          style={{
            fontSize: "15px",
            lineHeight: 1.6,
            color: "#6b5a45",
            marginBottom: "24px",
          }}
        >
          Use this page to enter the platform quickly as a producer, partner,
          or client test user.
        </p>

        <div
          style={{
            display: "grid",
            gap: "12px",
          }}
        >
          {[
            ["producer", "Enter as Producer"],
            ["partner", "Enter as Partner"],
            ["client", "Enter as Client"],
          ].map(([role, label]) => (
            <button
              key={role}
              onClick={() =>
                loginAs(role as "producer" | "partner" | "client")
              }
              disabled={loadingRole !== null}
              style={{
                border: "1px solid #b8925a",
                background: "#8b5e34",
                color: "#fff",
                borderRadius: "999px",
                padding: "14px 18px",
                fontSize: "14px",
                cursor: loadingRole ? "not-allowed" : "pointer",
                opacity: loadingRole && loadingRole !== role ? 0.6 : 1,
              }}
            >
              {loadingRole === role ? "Entering..." : label}
            </button>
          ))}
        </div>

        {error && (
          <div
            style={{
              marginTop: "16px",
              color: "#9b3d2f",
              fontSize: "14px",
            }}
          >
            {error}
          </div>
        )}
      </div>
    </main>
  )
}