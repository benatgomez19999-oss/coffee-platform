"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { useState } from "react"

// =====================================================
// INNER COMPONENT (usa searchParams)
// =====================================================

function SuccessContent() {

  const searchParams = useSearchParams()
  const email = searchParams.get("email")

  // =====================================================
  // STATE
  // =====================================================

  const [message, setMessage] = useState<{
    text: string
    type: "success" | "error"
  } | null>(null)

  const [loading, setLoading] = useState(false)

  return (
    <div className="max-w-md w-full bg-neutral-900 p-8 rounded-xl shadow-lg text-center">

      <h1 className="text-2xl font-semibold mb-4 text-white">
        📩 Check your email
      </h1>

      <p className="text-gray-300">
        We’ve sent you a verification link to activate your account.
      </p>

      <p className="text-gray-500 mt-4 text-sm">
        The link expires in 1 hour.
      </p>

      <div className="mt-6 flex flex-col gap-3">

        {/* =====================================================
            MESSAGE (SUCCESS / ERROR)
        ===================================================== */}

        {message && (
          <div
            className={`mb-2 text-sm ${
              message.type === "error"
                ? "text-red-400"
                : "text-green-400"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* =====================================================
            LOGIN BUTTON
        ===================================================== */}

        <a
          href="/login"
          className="bg-white text-black py-2 rounded-md font-medium"
        >
          Go to login
        </a>

        {/* =====================================================
            RESEND BUTTON
        ===================================================== */}

        {email && (
          <button
            disabled={loading}
            onClick={async () => {

              setLoading(true)

              try {
                const res = await fetch("/api/auth/resend-verification", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({ email }),
                });

                if (!res.ok) {
                  const err = await res.json()

                  setMessage({
                    text: err.error || "Failed to resend email",
                    type: "error",
                  })

                  setTimeout(() => setMessage(null), 3000)
                  return
                }

                // =====================================================
                // SUCCESS
                // =====================================================

                setMessage({
                  text: "Verification email sent again",
                  type: "success",
                })

                setTimeout(() => setMessage(null), 3000)

              } catch (err) {
                console.error(err)

                setMessage({
                  text: "Network error",
                  type: "error",
                })

                setTimeout(() => setMessage(null), 3000)
              } finally {
                setLoading(false)
              }
            }}
            className={`text-sm ${
              loading
                ? "text-gray-600 cursor-not-allowed"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {loading ? "Sending..." : "Resend verification email"}
          </button>
        )}

      </div>
    </div>
  )
}

// =====================================================
// PAGE WRAPPER (Suspense)
// =====================================================

export default function SignupSuccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-4">

      <Suspense fallback={<p className="text-white">Loading...</p>}>
        <SuccessContent />
      </Suspense>

    </div>
  )
}