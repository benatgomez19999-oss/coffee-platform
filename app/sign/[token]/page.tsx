"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"


// =====================================================
// TYPES
// =====================================================

type Props = {
  params: Promise<{
    token: string
  }>
}


// =====================================================
// COMPONENT
// =====================================================

export default function SignPage({ params }: Props) {

  const router = useRouter()

  const { token } = use(params)

  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [signed, setSigned] = useState(false)
  const [submitting, setSubmitting] = useState(false)


  // =====================================================
  // VERIFY TOKEN
  // =====================================================

  useEffect(() => {

    async function verify() {

      try {

        const res = await fetch(
          `/api/signature/verify?token=${token}`
        )

        let json: any = null

        try {
          json = await res.json()
        } catch {
          throw new Error("Invalid server response")
        }

        if (!res.ok) {
          setError(json?.error || "Invalid link")
          return
        }

        setData(json)

      } catch (err) {

        console.error("VERIFY ERROR:", err)
        setError("Network or server error")

      } finally {

        setLoading(false)

      }

    }

    verify()

  }, [token])


  // =====================================================
  // SIGN CONTRACT
  // =====================================================

  async function signContract() {

    if (submitting) return

    setSubmitting(true)

    try {

      const res = await fetch(
        "/api/signature/sign",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ token })
        }
      )

      let json: any = null

      try {
        json = await res.json()
      } catch {
        throw new Error("Invalid JSON response")
      }

      if (!res.ok) {

        console.error("SIGN ERROR:", json)
        alert(json?.error || "Error signing")
        setSubmitting(false)
        return

      }

      setSigned(true)

      // redirect suave
      setTimeout(() => {
        router.replace("/platform")
      }, 1500)

    } catch (err) {

      console.error("SIGN FETCH ERROR:", err)
      alert("Unexpected error during signing")
      setSubmitting(false)

    }

  }


  // =====================================================
  // STATES
  // =====================================================

  if (loading) {
    return (
      <div style={{ padding: 40 }}>
        Loading...
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 40 }}>
        <h2>{error}</h2>
      </div>
    )
  }

  if (!data) {
    return (
      <div style={{ padding: 40 }}>
        No data
      </div>
    )
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
      background: "#ffffff",
      color: "#000",
      position: "relative",
      zIndex: 9999
    }}>

      <div style={{
        background: "#fff",
        padding: 32,
        borderRadius: 12,
        boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
        width: "100%",
        maxWidth: 400
      }}>

        <h2 style={{ fontSize: 24, marginBottom: 20 }}>
          Contract Signature
        </h2>

        <p style={{ marginBottom: 10 }}>
          Contract ID:
        </p>

        <p style={{
          fontFamily: "monospace",
          fontSize: 12,
          marginBottom: 20
        }}>
          {data.contractId}
        </p>

        {!signed && (
          <button
            onClick={signContract}
            disabled={submitting}
            style={{
              width: "100%",
              padding: "12px",
              background: submitting ? "#666" : "black",
              color: "white",
              borderRadius: 8,
              cursor: submitting ? "not-allowed" : "pointer"
            }}
          >
            {submitting ? "Signing..." : "Sign Contract"}
          </button>
        )}

        {signed && (
          <div style={{
            color: "green",
            marginTop: 10,
            fontWeight: "bold"
          }}>
            ✅ Contract Signed Successfully
          </div>
        )}

      </div>
    </div>
  )
}