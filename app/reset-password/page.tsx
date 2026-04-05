"use client"

import { Suspense, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"


// =====================================================
// INNER COMPONENT
// =====================================================

function ResetContent() {

  const searchParams = useSearchParams()
  const router = useRouter()

  const token = searchParams.get("token")

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{
    text: string
    type: "error" | "success"
  } | null>(null)

  // =====================================================
  // VALIDATION
  // =====================================================

  const validate = () => {
    if (!token) {
      return "Invalid or expired link"
    }

    if (password.length < 8) {
      return "Password must be at least 8 characters"
    }

    if (password !== confirmPassword) {
      return "Passwords do not match"
    }

    return null
  }

  // =====================================================
  // HANDLE RESET
  // =====================================================

  const handleReset = async () => {

    const error = validate()

    if (error) {
      setMessage({ text: error, type: "error" })
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

      setMessage({
        text: "Password updated successfully",
        type: "success"
      })

      // UX PRO → pequeño delay + redirect
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

  // =====================================================
  // UI
  // =====================================================

  return (
    <div className="max-w-md w-full bg-neutral-900 p-8 rounded-xl text-center shadow-lg">

      <h1 className="text-xl text-white mb-6">
        Set new password
      </h1>

      {/* PASSWORD */}
      <input
        type="password"
        placeholder="New password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full p-3 rounded-md mb-3 bg-black border border-gray-700 text-white placeholder-gray-500"
        disabled={loading}
      />

      {/* CONFIRM PASSWORD */}
      <input
        type="password"
        placeholder="Confirm new password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        className="w-full p-3 rounded-md mb-4 bg-black border border-gray-700 text-white placeholder-gray-500"
        disabled={loading}
      />

      {/* MESSAGE */}
      {message && (
        <p className={`text-sm mb-4 ${
          message.type === "error"
            ? "text-red-400"
            : "text-green-400"
        }`}>
          {message.text}
        </p>
      )}

      {/* BUTTON */}
      <button
        onClick={handleReset}
        disabled={loading}
        className="w-full bg-white text-black py-2 rounded-md font-medium hover:opacity-90 transition"
      >
        {loading ? "Updating..." : "Update password"}
      </button>

    </div>
  )
}

// =====================================================
// WRAPPER (SUSPENSE)
// =====================================================

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-4">

      <Suspense fallback={<p className="text-white">Loading...</p>}>
        <ResetContent />
      </Suspense>

    </div>
  )
}