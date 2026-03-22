"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function LoginPage() {

  const router = useRouter()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // =====================================================
  // LOGIN HANDLER
  // =====================================================

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()

    if (loading) return // 🛑 evitar doble submit

    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({
          email,
          password
        })
      })

      if (!res.ok) {
        setError("Invalid email or password")
        return
      }

      // =====================================================
      // 🔄 REFRESH + REDIRECT
      // =====================================================

      router.refresh()
      router.replace("/platform")

    } catch (err) {
      console.error(err)
      setError("Network error, please try again")
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
        onSubmit={handleLogin}
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
          Login
        </h2>

        {/* EMAIL */}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
          style={{
            padding: "10px",
            borderRadius: "6px",
            border: "none",
            opacity: loading ? 0.6 : 1
          }}
        />

        {/* PASSWORD */}
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={loading}
          style={{
            padding: "10px",
            borderRadius: "6px",
            border: "none",
            opacity: loading ? 0.6 : 1
          }}
        />

        {/* ERROR */}
        {error && (
          <div style={{
            color: "#f87171",
            fontSize: "0.85rem"
          }}>
            {error}
          </div>
        )}

        {/* BUTTON */}
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "12px",
            borderRadius: "999px",
            background: "#d4af37",
            color: "#111",
            border: "none",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1
          }}
        >
          {loading ? "Logging in..." : "Login"}
        </button>

      </form>

    </div>
  )
}