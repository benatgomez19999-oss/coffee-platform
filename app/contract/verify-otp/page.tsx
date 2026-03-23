"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { useState } from "react"
export const dynamic = "force-dynamic"

export default function VerifyOtpPage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const contractId = searchParams.get("contractId")

  const [code, setCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleVerify = async () => {
    try {
      setLoading(true)
      setError(null)

      const res = await fetch("/api/contracts/verify-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contractId,
          code,
        }),
      })

      const data = await res.json()

      if (!data.success) {
        throw new Error("Invalid or expired code")
      }

      // ✅ SOLO aquí vas al dashboard
      router.push("/platform")

    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md space-y-4">
        <h1 className="text-xl font-semibold">Verify Contract</h1>

        <input
          className="w-full border p-2"
          placeholder="Enter OTP"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          onClick={handleVerify}
          disabled={loading}
          className="w-full bg-black text-white p-2"
        >
          {loading ? "Verifying..." : "Confirm Contract"}
        </button>
      </div>
    </div>
  )
}