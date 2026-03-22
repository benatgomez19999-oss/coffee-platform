"use client"

import { useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"

// =====================================================
// RESET PASSWORD PAGE
// =====================================================

export default function ResetPasswordPage() {

  const searchParams = useSearchParams()
  const router = useRouter()

  const token = searchParams.get("token")

  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{
    text: string
    type: "error" | "success"
  } | null>(null)

  // =====================================================
  // SUBMIT
  // =====================================================

  const handleReset = async () => {

    if (!token) {
      setMessage({ text: "Invalid link", type: "error" })
      return
    }

    if (password.length < 8) {
      setMessage({ text: "Password must be at least 8 characters", type: "error" })
      return
    }

    setLoading(true)
    setMessage(null)

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          token,
          password
        })
      })

      const data = await res.json()

      if (!res.ok) {
        setMessage({
          text: data.error || "Failed to reset password",
          type: "error"
        })
        return
      }

      // =====================================================
      // SUCCESS
      // =====================================================

      setMessage({
        text: "Password updated successfully",
        type: "success"
      })

      setTimeout(() => {
        router.push("/login")
      }, 1500)

    } catch (err) {
      console.error(err)
      setMessage({
        text: "Network error",
        type: "error"
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-4">

      <div className="max-w-md w-full bg-neutral-900 p-8 rounded-xl text-center">

        <h1 className="text-xl text-white mb-4">
          Set new password
        </h1>

        <input
          type="password"
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-2 rounded mb-4"
          disabled={loading}
        />

        {message && (
          <p className={`text-sm mb-3 ${
            message.type === "error"
              ? "text-red-400"
              : "text-green-400"
          }`}>
            {message.text}
          </p>
        )}

        <button
          onClick={handleReset}
          disabled={loading}
          className="bg-white text-black px-4 py-2 rounded"
        >
          {loading ? "Updating..." : "Update password"}
        </button>

      </div>

    </div>
  )
}