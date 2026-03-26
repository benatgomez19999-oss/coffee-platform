"use client"

import { useRouter } from "next/navigation"

export default function RoleSelectionPage() {
  const router = useRouter()

  async function selectRole(role: "BUYER" | "PRODUCER") {
    try {
      const res = await fetch("/api/user/set-role", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role }),
      })

      if (!res.ok) {
        throw new Error("Failed to set role")
      }

      // 🔥 REDIRECT SEGÚN ROLE
      if (role === "PRODUCER") {
        router.push("/producer/dashboard")
      } else {
        router.push("/platform")
      }

    } catch (err) {
      console.error(err)
      alert("Error setting role")
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="max-w-md w-full p-8 bg-neutral-900 rounded-xl text-center">

        <h1 className="text-2xl mb-6">
          Welcome 👋
        </h1>

        <p className="text-gray-400 mb-8">
          What best describes you?
        </p>

        <div className="flex flex-col gap-4">

          <button
            onClick={() => selectRole("BUYER")}
            className="p-4 rounded-lg bg-white text-black font-medium"
          >
            ☕ Buyer (Cafe / Hotel / Roaster)
          </button>

          <button
            onClick={() => selectRole("PRODUCER")}
            className="p-4 rounded-lg border border-white"
          >
            🌱 Producer (Farm / Exporter)
          </button>

        </div>

      </div>
    </div>
  )
}