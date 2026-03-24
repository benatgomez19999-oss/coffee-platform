"use client"

import { useRouter } from "next/navigation"
import { useState, useRef } from "react"



// =====================================================
// COMPONENT
// =====================================================

export default function VerifyOtpClient({
  contractId
}: {
  contractId?: string
}) {
  const router = useRouter()


console.log("📍 VERIFY PAGE CONTRACT ID:", contractId)

  // =====================================================
  // STATE
  // =====================================================

  const [values, setValues] = useState(["", "", "", "", "", ""])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resending, setResending] = useState(false)

  const inputs = useRef<(HTMLInputElement | null)[]>([])

  // =====================================================
  // HANDLE INPUT
  // =====================================================

  const handleChange = (value: string, index: number) => {
    if (!/^\d?$/.test(value)) return

    const newValues = [...values]
    newValues[index] = value
    setValues(newValues)

    if (value && index < 5) {
      inputs.current[index + 1]?.focus()
    }

    // AUTO SUBMIT
    if (newValues.every((v) => v !== "")) {
      verify(newValues.join(""))
    }
  }

  // =====================================================
  // PASTE SUPPORT
  // =====================================================

  const handlePaste = (e: React.ClipboardEvent) => {
    const paste = e.clipboardData.getData("text").slice(0, 6)
    if (!/^\d+$/.test(paste)) return

    const newValues = paste.split("")
    setValues(newValues)

    verify(paste)
  }

  // =====================================================
  // VERIFY
  // =====================================================

  const verify = async (code: string) => {
    try {
      setLoading(true)
      setError(null)

      const res = await fetch("/api/contracts/verify-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contractId,
          code
        })
      })

      const data = await res.json()

      if (!data.success) {
        throw new Error("Invalid or expired code")
      }

      router.push("/platform")

    } catch (err: any) {
      setError(err.message)
      setValues(["", "", "", "", "", ""])
      inputs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  // =====================================================
// RESEND (SMS / EMAIL)
// =====================================================

const resend = async (channel: "sms" | "email") => {
  try {
    setResending(true)

    console.log("🔁 RESENDING OTP:", { contractId, channel })

    const res = await fetch("/api/contracts/send-otp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contractId,   // 🔥 CLAVE para recovery
        channel       // "sms" | "email"
      })
    })

    const data = await res.json()

    if (!res.ok) {
      console.error("❌ RESEND FAILED:", data)
      alert(data?.error || "Failed to resend OTP")
      return
    }

    console.log("✅ RESEND SUCCESS:", channel)

  } catch (err) {
    console.error("❌ RESEND ERROR:", err)
    alert("Unexpected error while resending OTP")
  } finally {
    setResending(false)
  }
}

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-black to-gray-900">
      <div className="w-full max-w-md text-center space-y-6 bg-white/5 p-8 rounded-xl backdrop-blur">

        {/* ===================================================== */}
        {/* HEADER */}
        {/* ===================================================== */}
        <h1 className="text-2xl font-semibold text-white">
          Verify your contract
        </h1>

        <p className="text-gray-400 text-sm">
          Enter the 6-digit code sent to your phone
        </p>

        {/* ===================================================== */}
        {/* OTP INPUT */}
        {/* ===================================================== */}
        <div className="flex justify-center gap-3">
          {values.map((v, i) => (
            <input
              key={i}
             ref={(el) => {
             inputs.current[i] = el
             }}
              value={v}
              onChange={(e) => handleChange(e.target.value, i)}
              onPaste={handlePaste}
              maxLength={1}
              className="w-12 h-14 text-center text-xl border border-gray-600 bg-black text-white rounded-md focus:outline-none focus:ring-2 focus:ring-white"
            />
          ))}
        </div>

        {/* ===================================================== */}
        {/* ERROR */}
        {/* ===================================================== */}
        {error && (
          <p className="text-red-400 text-sm">{error}</p>
        )}

        {/* ===================================================== */}
        {/* LOADING */}
        {/* ===================================================== */}
        {loading && (
          <p className="text-gray-400 text-sm">Verifying...</p>
        )}

        {/* ===================================================== */}
        {/* BUTTON */}
        {/* ===================================================== */}
        <button
          onClick={() => verify(values.join(""))}
          disabled={loading || values.some(v => v === "")}
          className="w-full bg-white text-black p-3 rounded-md font-medium disabled:opacity-50"
        >
          Confirm Contract
        </button>

        {/* ===================================================== */}
        {/* RESEND */}
        {/* ===================================================== */}
        <div className="text-sm text-gray-400 space-y-2">
          <p>Didn't receive the code?</p>

          <div className="flex justify-center gap-4">
            <button
              onClick={() => resend("sms")}
              disabled={resending}
              className="underline hover:text-white"
            >
              Resend SMS
            </button>

            <button
              onClick={() => resend("email")}
              disabled={resending}
              className="underline hover:text-white"
            >
              Send via Email
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}