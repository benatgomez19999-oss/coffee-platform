"use client"

import { useState } from "react"
import { useRouter, useParams } from "next/navigation"

// =====================================================
// COMPONENT
// =====================================================

export default function SignPage() {

  const router = useRouter()
  const params = useParams()

  const token = params.token as string

  const [otp, setOtp] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // =====================================================
  // VERIFY OTP
  // =====================================================

  async function handleVerify() {

    if (!otp) {
      setError("Introduce el código")
      return
    }

    setLoading(true)
    setError(null)

    try {

      const res = await fetch(
        "/api/contracts/verify-otp",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ otp }) // 🔥 aquí usamos OTP real
        }
      )

      const json = await res.json()

      if (!res.ok) {
        setError(json?.error || "Error verificando código")
        setLoading(false)
        return
      }

      setSuccess(true)

      // redirect suave
      setTimeout(() => {
        router.replace("/platform")
      }, 1500)

    } catch (err) {

      console.error("VERIFY ERROR:", err)
      setError("Error de red")
      setLoading(false)

    }

  }

  // =====================================================
  // RESEND OTP (placeholder)
  // =====================================================

  async function handleResend() {

    try {

      await fetch("/api/contracts/send-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          token // ⚠️ luego mejoramos esto
        })
      })

      alert("Código reenviado")

    } catch (err) {
      alert("Error reenviando código")
    }

  }

  // =====================================================
  // UI
  // =====================================================

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#f7f7f7"
    }}>

      <div style={{
        background: "#fff",
        padding: 32,
        borderRadius: 16,
        boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
        width: "100%",
        maxWidth: 400,
        textAlign: "center"
      }}>

        <h2 style={{ fontSize: 22, marginBottom: 10 }}>
          Verificación OTP
        </h2>

        <p style={{ marginBottom: 20, color: "#666" }}>
          Introduce el código enviado a tu móvil
        </p>

        <input
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          placeholder="123456"
          maxLength={6}
          style={{
            width: "100%",
            padding: 12,
            fontSize: 20,
            textAlign: "center",
            letterSpacing: 6,
            borderRadius: 8,
            border: "1px solid #ccc",
            marginBottom: 16
          }}
        />

        <button
          onClick={handleVerify}
          disabled={loading}
          style={{
            width: "100%",
            padding: "12px",
            background: loading ? "#999" : "black",
            color: "white",
            borderRadius: 8,
            cursor: loading ? "not-allowed" : "pointer"
          }}
        >
          {loading ? "Verificando..." : "Confirmar"}
        </button>

        {error && (
          <p style={{ color: "red", marginTop: 10 }}>
            {error}
          </p>
        )}

        {success && (
          <p style={{ color: "green", marginTop: 10 }}>
            ✅ Código verificado
          </p>
        )}

        <div style={{ marginTop: 20 }}>
          <button
            onClick={handleResend}
            style={{
              background: "none",
              border: "none",
              color: "#666",
              cursor: "pointer"
            }}
          >
            ¿did you receice the code?
          </button>
        </div>

      </div>
    </div>
  )
}