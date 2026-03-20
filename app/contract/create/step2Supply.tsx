"use client"

import { useState } from "react"

import { useEngineRuntime } from "@/hooks/useEngineRuntime"

import { getContracts } from "@/clientLayer/layer/contractStore"


// =====================================================
// STEP 2 — SUPPLY CONFIGURATION
// =====================================================

type Supply = {
  origin: string
  monthlyVolume: number
  duration: number
}

type Props = {
  supply: Supply
  onNext: (data: Supply) => void
}

// =====================================================
// COMPONENT
// =====================================================

export default function Step2Supply({ supply, onNext }: Props) {

  const { state: engineState, updateContext } = useEngineRuntime()

  const [form, setForm] = useState<Supply>(supply)

 // =====================================================
// UPDATE VOLUME
// =====================================================

function updateVolume(v: number) {

  // -------------------------------------------------
  // UPDATE LOCAL FORM
  // -------------------------------------------------

  setForm(prev => ({
    ...prev,
    monthlyVolume: v
  }))

  // -------------------------------------------------
  // ENGINE SIGNAL
  // -------------------------------------------------

  updateContext({
    requestedVolume: v
  })

}

  // =====================================================
  // SEMAPHORE COLOR
  // =====================================================

  function getSemaphoreColor() {

    const sem = engineState?.liveDecision?.semaphore

    if (sem === "green") return "bg-green-500"
    if (sem === "yellow") return "bg-yellow-500"
    if (sem === "red") return "bg-red-500"

    return "bg-gray-400"

  }

  // =====================================================
  // SUBMIT
  // =====================================================

  function submit() {

    const semaphore =
      engineState?.liveDecision?.semaphore

    if (semaphore === "red") {

      alert(
        "Requested volume exceeds network capacity"
      )

      return
    }

    onNext(form)

  }

  // =====================================================
  // RENDER
  // =====================================================

  return (

  <div className="space-y-10 p-12 rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur">

    {/* ======================================================
       HEADER
    ====================================================== */}

    <div className="space-y-2">

      <h2 className="text-2xl font-semibold tracking-tight">
        Supply Configuration
      </h2>

      <p className="text-sm text-white/60">
        Configure the supply origin and contract volume
      </p>

      <div className="h-px bg-white/10 mt-4"/>

    </div>


    {/* ======================================================
       ORIGIN SELECTION
    ====================================================== */}

    <div className="p-6 rounded-xl border border-white/10 bg-black/30 space-y-4">

      <div className="text-xs uppercase tracking-widest text-white/50">
        Coffee Origin
      </div>

      <select
        className="w-full bg-black/40 border border-white/10 px-4 py-2.5 rounded-md focus:outline-none focus:border-yellow-400 transition"
        value={form.origin}
        onChange={(e) =>
          setForm(prev => ({
            ...prev,
            origin: e.target.value
          }))
        }
      >

        <option>Brazil</option>
        <option>Colombia</option>
        <option>Ethiopia</option>
        <option>Guatemala</option>

      </select>

    </div>


    {/* ======================================================
       VOLUME CONFIGURATION
    ====================================================== */}

    <div className="p-6 rounded-xl border border-white/10 bg-black/30 space-y-6">

      <div className="flex items-center justify-between">

        <div className="text-xs uppercase tracking-widest text-white/50">
          Monthly Volume
        </div>

        <div className="text-lg font-semibold text-yellow-400">
          {form.monthlyVolume} kg
        </div>

      </div>

      {/* SLIDER */}

      <input
        type="range"
        min="100"
        max="2000"
        step="50"
        value={form.monthlyVolume}
        onChange={(e) =>
          updateVolume(Number(e.target.value))
        }
        className="w-full"
      />

      {/* NETWORK STATUS */}

      <div className="flex items-center justify-between">

        <div className="flex items-center gap-3">

          <div
            className={`w-3 h-3 rounded-full ${getSemaphoreColor()}`}
          />

          <span className="text-sm text-white/70">
            Network Status
          </span>

        </div>

        <span className="text-sm font-medium uppercase tracking-wide">

          {engineState?.liveDecision?.semaphore ?? "loading"}

        </span>

      </div>

    </div>


    {/* ======================================================
       CONTRACT DURATION
    ====================================================== */}

    <div className="p-6 rounded-xl border border-white/10 bg-black/30 space-y-4">

      <div className="text-xs uppercase tracking-widest text-white/50">
        Contract Duration
      </div>

      <input
        type="number"
        className="w-full bg-black/40 border border-white/10 px-4 py-2.5 rounded-md focus:outline-none focus:border-yellow-400 transition"
        value={form.duration}
        onChange={(e) =>
          setForm(prev => ({
            ...prev,
            duration: Number(e.target.value)
          }))
        }
      />

      <div className="text-xs text-white/50">
        Duration of the supply agreement in months
      </div>

    </div>


    {/* ======================================================
       CONTINUE ACTION
    ====================================================== */}

    <div className="flex justify-end pt-2">

      <button
        onClick={submit}
        className="
        group
        px-12
        py-3
        rounded-full
        bg-gradient-to-r
        from-yellow-500
        to-yellow-300
        text-black
        font-semibold
        tracking-wide
        flex
        items-center
        gap-2
        hover:scale-[1.03]
        transition
        duration-200
        shadow-lg
        shadow-yellow-500/30
        "
      >

        Continue

        <span className="transition group-hover:translate-x-1">
          →
        </span>

      </button>

    </div>

  </div>

)

}