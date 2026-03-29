"use client"

import { useState, useEffect } from "react"
import { useEngineRuntime } from "@/hooks/useEngineRuntime"

// 🔥 TEMP MOCK (luego conectamos real)
import { calculateContractPricing } from "@/clientLayer/layer/contractPricing"

type Supply = {
  origin: string
  monthlyVolume: number
  duration: number
}

type Props = {
  supply: Supply
  onNext: (data: Supply) => void
}

export default function Step2Supply({ supply, onNext }: Props) {

  const { state: engineState, updateContext } = useEngineRuntime()

  const [form, setForm] = useState<Supply>(supply)

  //////////////////////////////////////////////////////
  // 🔥 SYNC
  //////////////////////////////////////////////////////

  useEffect(() => {
    setForm(supply)
  }, [supply])

  //////////////////////////////////////////////////////
  // 📦 VOLUME
  //////////////////////////////////////////////////////

  function updateVolume(v: number) {
    setForm(prev => ({
      ...prev,
      monthlyVolume: v
    }))

    updateContext({
      requestedVolume: v
    })
  }

  //////////////////////////////////////////////////////
  // 📊 HELPERS
  //////////////////////////////////////////////////////

  const bags = form.monthlyVolume / 20

  //////////////////////////////////////////////////////
  // 💰 CONTRACT PRICING (MOCK)
  //////////////////////////////////////////////////////

  const pricing = calculateContractPricing({
    pricingInput: {
      scaScore: 87,
      altitude: 1600,
      variety: "PINK_BOURBON",
      process: "WASHED",
      country: "COLOMBIA",
      marketData: {
        cPrice: 180,
        demandIndex: 1
      },
      region: "VALLE_DEL_CAUCA",
      port: "BUENAVENTURA",
      freightType: "LCL",
      marginTarget: 0.2
    },
    volumeKg: form.monthlyVolume
  })

  //////////////////////////////////////////////////////
  // 🚦 SEMAPHORE
  //////////////////////////////////////////////////////

  function getSemaphoreColor() {
    const sem = engineState?.liveDecision?.semaphore

    if (sem === "green") return "bg-green-500"
    if (sem === "yellow") return "bg-yellow-500"
    if (sem === "red") return "bg-red-500"

    return "bg-gray-400"
  }

  //////////////////////////////////////////////////////
  // 🚀 SUBMIT
  //////////////////////////////////////////////////////

  function submit() {

    const semaphore =
      engineState?.liveDecision?.semaphore

    if (semaphore === "red") {
      alert("Requested volume exceeds network capacity")
      return
    }

    onNext(form)
  }

  //////////////////////////////////////////////////////
  // 🎨 RENDER
  //////////////////////////////////////////////////////

  return (

    <div className="space-y-10 p-12 rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur">

      {/* HEADER */}

      <div>
        <h2 className="text-2xl font-semibold">
          Supply Configuration
        </h2>
        <p className="text-sm text-white/60">
          Configure your contract terms
        </p>
      </div>

      {/* GRID */}

      <div className="grid md:grid-cols-2 gap-10">

        {/* LEFT SIDE */}

        <div className="space-y-8">

          {/* ORIGIN */}

          <div className="space-y-3">
            <div className="text-xs uppercase text-white/50">
              Coffee Origin
            </div>

            <select
              className="w-full bg-black/40 border border-white/10 px-4 py-2.5 rounded-md"
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

          {/* VOLUME */}

          <div className="space-y-4">

            <div className="flex justify-between items-center">
              <span className="text-xs uppercase text-white/50">
                Monthly Volume
              </span>

              <span className="text-lg font-semibold text-yellow-400">
                {form.monthlyVolume} kg • {bags} bags
              </span>
            </div>

            <input
              type="range"
              min="200"
              max="2000"
              step="20"
              value={form.monthlyVolume}
              onChange={(e) =>
                updateVolume(Number(e.target.value))
              }
              className="w-full"
            />

            <p className="text-xs text-white/40">
              Each bag = 20 kg
            </p>

            {/* SEMAPHORE */}

            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${getSemaphoreColor()}`} />
                <span className="text-sm text-white/70">
                  Network status
                </span>
              </div>

              <span className="text-sm uppercase">
                {engineState?.liveDecision?.semaphore ?? "loading"}
              </span>
            </div>

          </div>

          {/* DURATION */}

          <div className="space-y-3">
            <div className="text-xs uppercase text-white/50">
              Contract Duration
            </div>

            <input
              type="number"
              value={form.duration}
              onChange={(e) =>
                setForm(prev => ({
                  ...prev,
                  duration: Number(e.target.value)
                }))
              }
              className="w-full bg-black/40 border border-white/10 px-4 py-2.5 rounded-md"
            />
          </div>

        </div>

        {/* RIGHT SIDE */}

        <div className="space-y-6">

          {/* PRICING */}

          <div className="p-6 rounded-xl border border-white/10 bg-black/30 space-y-4">

            <h3 className="text-sm uppercase text-white/50">
              Contract Pricing
            </h3>

            <div className="flex justify-between text-sm">
              <span>Base price</span>
              <span>{pricing.clientPrice} €/kg</span>
            </div>

            <div className="flex justify-between text-sm text-yellow-400">
              <span>Volume advantage</span>
              <span>
                -{(pricing.clientPrice - pricing.contractPrice).toFixed(2)} €/kg
              </span>
            </div>

            <div className="h-px bg-white/10" />

            <div className="flex justify-between text-lg font-semibold">
              <span>Final price</span>
              <span>{pricing.contractPrice} €/kg</span>
            </div>

          </div>

          {/* PERKS */}

          <div className="p-6 rounded-xl border border-white/10 bg-black/30 space-y-3">

            <h3 className="text-sm uppercase text-white/50">
              Benefits
            </h3>

            <ul className="text-sm space-y-1 text-white/80">
              {pricing.volume >= 500 && <li>✔ Free shipping</li>}
              {pricing.volume >= 1500 && <li>✔ Priority lot access</li>}
              {pricing.volume >= 1500 && <li>✔ Future contracts access</li>}
            </ul>

          </div>

        </div>

      </div>

      {/* CTA */}

      <div className="flex justify-end">
        <button
          onClick={submit}
          className="px-10 py-3 rounded-full bg-yellow-500 text-black font-semibold"
        >
          Continue →
        </button>
      </div>

    </div>
  )
}