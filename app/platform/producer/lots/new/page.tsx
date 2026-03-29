"use client"

import { useState } from "react"
import { ProcessType } from "@prisma/client"

export default function NewLotPage() {
  //////////////////////////////////////////////////////
  // 🧠 STATE
  //////////////////////////////////////////////////////

  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    farmId: "",
    name: "",
    variety: "",
    process: "" as ProcessType | "",
    harvestYear: "",
    parchmentKg: "",
  })

  //////////////////////////////////////////////////////
  // 🔧 HANDLERS
  //////////////////////////////////////////////////////

  const updateField = (key: string, value: any) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  const handleSubmit = async () => {
    if (!form.farmId || !form.variety || !form.process || !form.parchmentKg) {
      alert("Please fill all required fields")
      return
    }

    setLoading(true)

    try {
      const res = await fetch("/api/producer/lot-draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          farmId: form.farmId,
          name: form.name,
          variety: form.variety,
          process: form.process,
          harvestYear: Number(form.harvestYear),
          parchmentKg: Number(form.parchmentKg),
        }),
      })

      const data = await res.json()

      console.log("✅ Draft created:", data)

      // reset
      setForm({
        farmId: "",
        name: "",
        variety: "",
        process: "" as ProcessType | "",
        harvestYear: "",
        parchmentKg: "",
      })

      alert("Lot draft created successfully")

    } catch (err) {
      console.error(err)
      alert("Error creating lot")
    }

    setLoading(false)
  }

  //////////////////////////////////////////////////////
  // 🧩 UI
  //////////////////////////////////////////////////////

  return (
    <div className="min-h-screen bg-[#f5f1e6] px-6 py-12 pt-24">

      <div className="max-w-2xl mx-auto">

        {/* HEADER */}
        <div className="mb-10">
          <p className="text-xs uppercase tracking-widest text-[#7a6a52] mb-2">
            New Coffee Lot
          </p>

          <h1 className="text-3xl font-semibold">
            Create a new lot draft
          </h1>

          <p className="text-sm text-black/60 mt-2">
            This will be reviewed before entering the marketplace
          </p>
        </div>

        {/* FORM */}
        <div className="bg-white rounded-2xl border border-[#e5dccf] p-6 space-y-6">

          {/* FARM */}
          <div>
            <label className="text-sm font-medium">
              Farm ID *
            </label>
            <input
              type="text"
              value={form.farmId}
              onChange={(e) => updateField("farmId", e.target.value)}
              className="mt-2 w-full px-4 py-2 rounded-lg border border-[#e5dccf]"
              placeholder="Farm ID"
            />
          </div>

          {/* NAME */}
          <div>
            <label className="text-sm font-medium">
              Lot Name
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              className="mt-2 w-full px-4 py-2 rounded-lg border border-[#e5dccf]"
              placeholder="e.g. El Paraíso Lot A"
            />
          </div>

          {/* VARIETY */}
          <div>
            <label className="text-sm font-medium">
              Variety *
            </label>
            <select
              value={form.variety}
              onChange={(e) => updateField("variety", e.target.value)}
              className="mt-2 w-full px-4 py-2 rounded-lg border border-[#e5dccf]"
            >
              <option value="">Select variety</option>
              <option value="CASTILLO">Castillo</option>
              <option value="CATURRA">Caturra</option>
              <option value="COLOMBIA">Colombia</option>
              <option value="TYPICA">Typica</option>
              <option value="BOURBON">Bourbon</option>
              <option value="PINK_BOURBON">Pink Bourbon</option>
              <option value="GEISHA">Geisha</option>
              <option value="TABI">Tabi</option>
            </select>
          </div>

          {/* PROCESS */}
          <div>
            <label className="text-sm font-medium">
              Process *
            </label>
            <select
              value={form.process}
              onChange={(e) =>
                updateField("process", e.target.value as ProcessType)
              }
              className="mt-2 w-full px-4 py-2 rounded-lg border border-[#e5dccf]"
            >
              <option value="">Select process</option>
              <option value="WASHED">Washed</option>
              <option value="NATURAL">Natural</option>
              <option value="HONEY">Honey</option>
              <option value="ANAEROBIC">Anaerobic</option>
            </select>
          </div>

          {/* HARVEST */}
          <div>
            <label className="text-sm font-medium">
              Harvest Year
            </label>
            <input
              type="number"
              value={form.harvestYear}
              onChange={(e) => updateField("harvestYear", e.target.value)}
              className="mt-2 w-full px-4 py-2 rounded-lg border border-[#e5dccf]"
              placeholder="2025"
            />
          </div>

          {/* PARCHMENT */}
          <div>
            <label className="text-sm font-medium">
              Parchment Kg *
            </label>
            <input
              type="number"
              value={form.parchmentKg}
              onChange={(e) => updateField("parchmentKg", e.target.value)}
              className="mt-2 w-full px-4 py-2 rounded-lg border border-[#e5dccf]"
              placeholder="e.g. 1200"
            />
          </div>

        </div>

        {/* ACTION */}
        <div className="mt-8 flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-6 py-3 rounded-full bg-[#3f6b3f] text-white font-medium hover:bg-[#4f7d4f]"
          >
            {loading ? "Creating..." : "Create Draft"}
          </button>
        </div>

      </div>
    </div>
  )
}