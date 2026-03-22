"use client"

import { useState } from "react"

// =====================================================
// FORGOT PASSWORD PAGE
// =====================================================

export default function ForgotPasswordPage() {

  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    setLoading(true)
    setMessage(null)

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email })
      })

      if (!res.ok) {
        const err = await res.json()
        setMessage(err.error || "Something went wrong")
        return
      }

      // ✅ Mensaje genérico (security best practice)
      setMessage("If the email exists, a reset link has been sent")

    } catch (err) {
      console.error(err)
      setMessage("Network error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      background: "#0b0f0f",
      color: "white"
    }}>

      <form
        onSubmit={handleSubmit}
        style={{
          width: "360px",
          padding: "40px",
          borderRadius: "14px",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          flexDirection: "column",
          gap: "16px"
        }}
      >

        <h2 style={{ fontWeight: 300 }}>
          Reset password
        </h2>

        <input
          type="email"
          placeholder="Your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{
            padding: "10px",
            borderRadius: "6px",
            border: "none"
          }}
        />

        {message && (
          <div style={{
            fontSize: "0.85rem",
            color: "#9ca3af"
          }}>
            {message}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "12px",
            borderRadius: "999px",
            background: "#d4af37",
            color: "#111",
            border: "none",
            cursor: "pointer"
          }}
        >
          {loading ? "Sending..." : "Send reset link"}
        </button>

      </form>

    </div>
  )
}