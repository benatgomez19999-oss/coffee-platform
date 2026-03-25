"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"

export default function PaymentClient() {
  const searchParams = useSearchParams()
  const contractId = searchParams.get("contractId")

  const [status, setStatus] = useState<"loading" | "error">("loading")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!contractId) {
      setStatus("error")
      setError("Missing contract ID")
      return
    }

    const go = async () => {
      try {
        const res = await fetch("/api/contracts/create-payment-session", {
          method: "POST",
          body: JSON.stringify({ contractId }),
        })

        const data = await res.json()

        if (!res.ok) throw new Error(data.error)

        window.location.href = data.url
      } catch (err: any) {
        setStatus("error")
        setError(err.message)
      }
    }

    go()
  }, [contractId])

  // ============================================
  // UI (ÚNICO RETURN)
  // ============================================

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-950 text-white">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-10 w-full max-w-md text-center shadow-xl">
        
        {status === "loading" && (
          <>
            <div className="mb-6">
              <div className="w-12 h-12 border-4 border-neutral-700 border-t-white rounded-full animate-spin mx-auto" />
            </div>

            <h1 className="text-xl font-semibold mb-2">
              Redirecting to payment
            </h1>

            <p className="text-neutral-400 text-sm">
              You are being securely redirected to Stripe checkout...
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <h1 className="text-xl font-semibold text-red-400 mb-2">
              Payment error
            </h1>

            <p className="text-neutral-400 text-sm mb-4">
              {error}
            </p>

            <button
              onClick={() => window.history.back()}
              className="px-4 py-2 bg-white text-black rounded-lg text-sm"
            >
              Go back
            </button>
          </>
        )}
      </div>
    </div>
  )
}