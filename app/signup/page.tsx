"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function SignupPage() {

  const router = useRouter()

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    companyName: ""
  })

  const [loading, setLoading] = useState(false)

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: any) => {
    e.preventDefault()

    setLoading(true)

    try {

      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(form)
      })

      if (!res.ok) {
        const err = await res.json()
        alert(err.error || "Signup failed")
        return
      }

      // =====================================================
      // ✅ REDIRECT TO SUCCESS PAGE (PRO UX)
      // =====================================================

      router.push(`/signup/success?email=${encodeURIComponent(form.email)}`)

    } catch (err) {
      console.error(err)
      alert("Network error")
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
          width: "380px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          padding: "30px",
          borderRadius: "16px",
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)"
        }}
      >

        <h2 style={{ fontWeight: 300 }}>
          Create account
        </h2>

        {/* NAME */}
        <input
          placeholder="Name"
          value={form.name}
          onChange={e => handleChange("name", e.target.value)}
        />

        {/* EMAIL */}
        <input
          placeholder="Email"
          type="email"
          value={form.email}
          onChange={e => handleChange("email", e.target.value)}
        />

        {/* PASSWORD */}
        <input
          placeholder="Password"
          type="password"
          value={form.password}
          onChange={e => handleChange("password", e.target.value)}
        />

        {/* COMPANY */}
        <input
          placeholder="Company name"
          value={form.companyName}
          onChange={e => handleChange("companyName", e.target.value)}
        />

        {/* SUBMIT */}
        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: "10px",
            padding: "12px",
            borderRadius: "999px",
            border: "none",
            background: "linear-gradient(90deg,#d4af37,#f3d27a)",
            color: "#111",
            fontWeight: 500,
            cursor: "pointer",
            opacity: loading ? 0.7 : 1
          }}
        >
          {loading ? "Creating..." : "Create account"}
        </button>

      </form>

    </div>
  )
}