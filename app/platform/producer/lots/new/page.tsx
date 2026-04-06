"use client"

import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react"
import { ProcessType } from "@prisma/client"
import { useRouter } from "next/navigation"
import CoffeeAssistant from "@/src/components/shared/assistant/CoffeeAssistant"

export default function NewLotPage() {
  //////////////////////////////////////////////////////
  // 🧠 STATE
  //////////////////////////////////////////////////////

  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const [form, setForm] = useState({

    
    farmId: "",
    name: "",
    variety: "",
    process: "" as ProcessType | "",
    harvestYear: "2026",
    parchmentKg: "",
  })

  //////////////////////////////////////////////////////
  // 🧠 DRAFT STATE (prevent premature assistant sync)
  //////////////////////////////////////////////////////

  const [draftParchmentKg, setDraftParchmentKg] = useState("")
 

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

    if (form.harvestYear !== "2026") {
      alert("Please enter a valid harvest year. Only 2026 is allowed.")
      return
    }

    if (!isParchmentKgValid) {
      alert("Please enter a valid parchment kg value.")
      return
    }

    setLoading(true)

    try {
      //////////////////////////////////////////////////////
      // 1️⃣ CREATE LOT DRAFT
      //////////////////////////////////////////////////////

      const createRes = await fetch("/api/producer/lot-draft", {
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

      const createData = await createRes.json()

      if (!createRes.ok) {
        throw new Error(createData?.error || "Failed to create lot draft")
      }

      const draftId =
        createData?.id || createData?.draft?.id || createData?.lotDraft?.id

      if (!draftId) {
        throw new Error("Lot draft created but no draft id was returned")
      }

      //////////////////////////////////////////////////////
      // 2️⃣ SEND SAMPLE TO LAB / PARTNER
      //////////////////////////////////////////////////////

      const sendRes = await fetch(
        `/api/producer/lot-draft/${draftId}/send-to-lab`,
        {
          method: "PATCH",
        },
      )

      const sendData = await sendRes.json().catch(() => null)

      if (!sendRes.ok) {
        throw new Error(sendData?.error || "Failed to send sample to lab")
      }

      //////////////////////////////////////////////////////
      // 3️⃣ RESET LOCAL STATE
      //////////////////////////////////////////////////////

      setForm({
        farmId: "",
        name: "",
        variety: "",
        process: "" as ProcessType | "",
        harvestYear: "2026",
        parchmentKg: "",
      })

      setDraftParchmentKg("")

      //////////////////////////////////////////////////////
      // 4️⃣ GO BACK TO PRODUCER DASHBOARD
      //////////////////////////////////////////////////////

      router.push("/platform/producer")
    } catch (err) {
      console.error(err)
      alert("Error sending this lot for analysis")
    } finally {
      setLoading(false)
    }
  }

    //////////////////////////////////////////////////////
  // 🛡️ VALIDATION / INPUT GUARDS
  //////////////////////////////////////////////////////

  const isHarvestYearValid = form.harvestYear === "2026"

  const isParchmentKgValid = useMemo(() => {
    const numericValue = Number(draftParchmentKg)
    return Number.isFinite(numericValue) && numericValue > 0
  }, [draftParchmentKg])

    //////////////////////////////////////////////////////
  // 🧠 SMART UI STATE (responsive to assistant panel)
  //////////////////////////////////////////////////////

  const isAssistantMidLayout =
    Boolean(form.farmId) && (!form.variety || !form.process)

  const isAssistantLateLayout =
    Boolean(form.variety) &&
    Boolean(form.process) &&
    form.harvestYear === "2026" &&
    !form.parchmentKg

  const isParchmentConfirmTight =
    isAssistantLateLayout && form.harvestYear === "2026" && !form.parchmentKg

  //////////////////////////////////////////////////////
  // 🧠 CUSTOM POPBOX POSITIONING
  //////////////////////////////////////////////////////

  const shouldOpenVarietyUp = isAssistantMidLayout
  const isProcessCompact = isAssistantMidLayout



  //////////////////////////////////////////////////////
  // 🔄 SYNC DRAFT WITH FORM (chat → UI)
  //////////////////////////////////////////////////////

  useEffect(() => {
    setDraftParchmentKg(form.parchmentKg || "")
  }, [form.parchmentKg])

  //////////////////////////////////////////////////////
  // ✅ CONFIRM PARCHMENT KG (manual commit)
  //////////////////////////////////////////////////////

  const confirmParchmentKg = () => {
    const cleanValue = draftParchmentKg.trim()
    const numericValue = Number(cleanValue)

    if (!cleanValue || !Number.isFinite(numericValue) || numericValue <= 0) {
      return
    }

    updateField("parchmentKg", cleanValue)
  }

  const handleCommitFieldOnEnter =
    (key: keyof typeof form) => (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== "Enter") return

      e.preventDefault()

      //////////////////////////////////////////////////////
      // 📅 HARVEST YEAR STRICT GUARD
      //////////////////////////////////////////////////////

      if (key === "harvestYear") {
        const cleanValue = e.currentTarget.value.trim()

        if (cleanValue !== "2026") {
          updateField("harvestYear", cleanValue)
          e.currentTarget.blur()
          return
        }

        updateField("harvestYear", "2026")
        e.currentTarget.blur()
        return
      }

      //////////////////////////////////////////////////////
      // 🧾 STANDARD TEXT INPUTS
      //////////////////////////////////////////////////////

      updateField(key, e.currentTarget.value)
      e.currentTarget.blur()
    }

    //////////////////////////////////////////////////////
  // 🧠 CUSTOM POPBOX / DROPDOWN STATE
  //////////////////////////////////////////////////////

  const [openDropdown, setOpenDropdown] = useState<"variety" | "process" | null>(
    null,
  )

  const varietyDropdownRef = useRef<HTMLDivElement | null>(null)
  const processDropdownRef = useRef<HTMLDivElement | null>(null)

  const varietyOptions = [
    { value: "CASTILLO", label: "Castillo" },
    { value: "CATURRA", label: "Caturra" },
    { value: "COLOMBIA", label: "Colombia" },
    { value: "TYPICA", label: "Typica" },
    { value: "BOURBON", label: "Bourbon" },
    { value: "PINK_BOURBON", label: "Pink Bourbon" },
    { value: "GEISHA", label: "Geisha" },
    { value: "TABI", label: "Tabi" },
  ] as const

  const processOptions = [
    { value: "WASHED", label: "Washed" },
    { value: "NATURAL", label: "Natural" },
    { value: "HONEY", label: "Honey" },
    { value: "ANAEROBIC", label: "Anaerobic" },
  ] as const

  const getVarietyLabel = (value: string) => {
    return varietyOptions.find((item) => item.value === value)?.label || ""
  }

  const getProcessLabel = (value: string) => {
    return processOptions.find((item) => item.value === value)?.label || ""
  }

  //////////////////////////////////////////////////////
  // 🧹 CLOSE CUSTOM DROPDOWN ON OUTSIDE CLICK / ESC
  //////////////////////////////////////////////////////

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node

      const clickedInsideVariety =
        varietyDropdownRef.current?.contains(target) ?? false
      const clickedInsideProcess =
        processDropdownRef.current?.contains(target) ?? false

      if (!clickedInsideVariety && !clickedInsideProcess) {
        setOpenDropdown(null)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenDropdown(null)
      }
    }

    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown as unknown as EventListener)

    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener(
        "keydown",
        handleKeyDown as unknown as EventListener,
      )
    }
  }, [])

  //////////////////////////////////////////////////////
  // 🎨 UI TOKENS
  //////////////////////////////////////////////////////

  const labelClassName = "text-sm font-medium text-[#3b2d1f]"
  const helperClassName = "mt-2 text-xs leading-relaxed text-[#705f4a]"
  const inputClassName =
    "mt-2 w-full rounded-xl border border-[#d8c8af] bg-[#fffdf8] px-4 py-3 text-[15px] text-[#2f2419] shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] transition-all duration-200 placeholder:text-[#9a876f] focus:border-[#8d6a43] focus:outline-none focus:ring-4 focus:ring-[#cfb48a]/35"
  const selectClassName =
    "mt-2 w-full appearance-none rounded-xl border border-[#7e6243] bg-[linear-gradient(180deg,#5a422d_0%,#4a3524_100%)] px-4 py-3 pr-11 text-[15px] text-[#f6eee0] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_6px_14px_rgba(34,22,12,0.28)] transition-all duration-200 focus:border-[#d4af37] focus:outline-none focus:ring-4 focus:ring-[#d4af37]/25"
    const popboxTriggerClassName =
    "mt-2 flex w-full items-center justify-between rounded-xl border border-[#7e6243] bg-[linear-gradient(180deg,#5a422d_0%,#4a3524_100%)] px-4 py-3 text-left text-[15px] text-[#f6eee0] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_6px_14px_rgba(34,22,12,0.28)] transition-all duration-200 focus:border-[#d4af37] focus:outline-none focus:ring-4 focus:ring-[#d4af37]/25"

  const popboxMenuClassName =
    "absolute left-0 right-0 z-30 overflow-hidden rounded-xl border border-[#8a6a44] bg-[linear-gradient(180deg,#5a422d_0%,#4a3524_100%)] shadow-[0_18px_36px_rgba(18,11,7,0.36)]"

  const popboxMenuDownClassName = "mt-2"
  const popboxMenuUpClassName = "bottom-full mb-2"

  const popboxOptionClassName =
    "flex w-full items-center justify-between px-4 py-3 text-left text-[15px] text-[#f6eee0] transition-colors duration-150 hover:bg-[#6c5036]"

  const popboxOptionCompactClassName =
    "flex w-full items-center justify-between px-4 py-2.5 text-left text-[15px] text-[#f6eee0] transition-colors duration-150 hover:bg-[#6c5036]"

  const popboxOptionActiveClassName =
    "bg-[#6a4c31] text-[#fff3db]"
  //////////////////////////////////////////////////////
  // 🧩 UI
  //////////////////////////////////////////////////////

  return (
    <div className="min-h-screen bg-[radial-gradient(1200px_650px_at_8%_-12%,#8a6847_0%,transparent_56%),radial-gradient(1200px_720px_at_100%_0%,#6e5239_0%,transparent_58%),linear-gradient(180deg,#5a4331_0%,#4a3729_100%)] px-5 pb-14 pt-24 md:px-6 md:pb-20">
      <div className="mx-auto max-w-5xl">
        {/* HERO */}
         <div className="relative overflow-hidden rounded-[30px] border border-[#a98355]/55 bg-[linear-gradient(165deg,rgba(153,122,92,0.95)_0%,rgba(140,109,82,0.96)_62%,rgba(126,98,74,0.97)_100%)] p-6 shadow-[0_24px_54px_rgba(0,0,0,0.26),inset_0_1px_0_rgba(212,175,55,0.22)] md:p-10">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(212,175,55,0.6),transparent)]" />
          <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[#d4af37]/10 blur-3xl" />
          <div className="pointer-events-none absolute -left-16 bottom-0 h-48 w-64 bg-[radial-gradient(ellipse_at_left,rgba(91,128,95,0.2),transparent_72%)]" />

          <div className="relative z-10">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-[11px] uppercase tracking-[0.22em] text-[#ecd7b7]">
                Producer Lot Intake
              </p>

              {/* 🌿 REAL ASSISTANT */}
              <div className="flex items-center justify-center rounded-2xl border border-[#d4af37]/45 bg-[linear-gradient(180deg,rgba(86,65,46,0.62)_0%,rgba(64,47,33,0.7)_100%)] p-2 shadow-[0_8px_20px_rgba(20,12,7,0.3),inset_0_1px_0_rgba(255,241,210,0.18)] backdrop-blur-[2px]">
                                <CoffeeAssistant
                  iconSize={86}
                  form={form}
                  updateField={updateField}
                  context="lot-wizard"
                />
              </div>
            </div>

            <h1 className="text-3xl font-semibold tracking-tight text-[#f7efe2] md:text-[38px]">
              Create a new lot draft
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[#e2cfaf] md:text-[15px]">
              Enter this lot with the same care you give to production. This
              workflow captures origin, process, and volume in a structured
              sequence before laboratory review.
            </p>

            {/* Step Language */}
            <div className="mt-7 grid grid-cols-1 gap-3 md:grid-cols-3">
               <div className="rounded-xl border border-[#8ca888]/60 bg-[linear-gradient(180deg,rgba(82,109,86,0.9),rgba(69,94,73,0.92))] px-4 py-3">
                <div className="mb-1 flex items-center gap-2">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#d4af37]" />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#edd9b8]">
                    01 · Origin
                  </p>
                </div>
                <p className="text-sm text-[#d7c3a3]">
                  Farm reference and lot identity
                </p>
              </div>

              <div className="rounded-xl border border-[#8ca888]/60 bg-[linear-gradient(180deg,rgba(82,109,86,0.9),rgba(69,94,73,0.92))] px-4 py-3">
                <div className="mb-1 flex items-center gap-2">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#d4af37]" />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#edd9b8]">
                    02 · Processing
                  </p>
                </div>
                <p className="text-sm text-[#d7c3a3]">
                  Variety and process profile
                </p>
              </div>

              <div className="rounded-xl border border-[#8ca888]/60 bg-[linear-gradient(180deg,rgba(82,109,86,0.9),rgba(69,94,73,0.92))] px-4 py-3">
                <div className="mb-1 flex items-center gap-2">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#7ca07d]" />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#edd9b8]">
                    03 · Harvest & Volume
                  </p>
                </div>
                <p className="text-sm text-[#d7c3a3]">
                  Crop year and parchment quantity
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* WORKFLOW BODY */}
        <div className="mt-7 space-y-5">
          {/* SECTION 1 */}
          <section className="rounded-2xl border border-[#dfcfb7] bg-[linear-gradient(180deg,#fdf9f1_0%,#f8f1e4_100%)] px-5 py-6 shadow-[0_14px_32px_rgba(18,11,7,0.18)] md:px-6 md:py-7">
            <div className="mb-5 flex items-start gap-4">
              <div className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#c9a677] bg-[#f6ecd9] text-xs font-semibold text-[#6e4e2d]">
                1
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-[#8a6f4d]">
                  Origin
                </p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-[#2d2218]">
                  Lot identity
                </h2>
                <p className="mt-1 text-sm text-[#66533f]">
                  Define where this lot comes from and how it should be
                  recognized in operations.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <label className={labelClassName}>Farm ID *</label>
                <input
                  type="text"
                  value={form.farmId}
                  onChange={(e) => updateField("farmId", e.target.value)}
                  onKeyDown={handleCommitFieldOnEnter("farmId")}
                  className={inputClassName}
                  placeholder="Farm ID"
                />
                <p className={helperClassName}>
                  Use the unique farm identifier from your producer profile.
                </p>
              </div>

              <div>
                <label className={labelClassName}>Lot Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  onKeyDown={handleCommitFieldOnEnter("name")}
                  className={inputClassName}
                  placeholder="e.g. El Paraíso Lot A"
                />
                <p className={helperClassName}>
                  Optional internal reference for team communication and buyer
                  clarity.
                </p>
              </div>
            </div>
          </section>

          {/* SECTION 2 */}
          <section className="rounded-2xl border border-[#dfcfb7] bg-[linear-gradient(180deg,#fdf9f1_0%,#f8f1e4_100%)] px-5 py-6 shadow-[0_14px_32px_rgba(18,11,7,0.18)] md:px-6 md:py-7">
            <div className="mb-5 flex items-start gap-4">
              <div className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#c9a677] bg-[#f6ecd9] text-xs font-semibold text-[#6e4e2d]">
                2
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-[#8a6f4d]">
                  Processing
                </p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-[#2d2218]">
                  Cup profile inputs
                </h2>
                <p className="mt-1 text-sm text-[#66533f]">
                  Capture processing details to support quality review and
                  marketplace positioning.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                            <div className={isAssistantMidLayout ? "md:pr-14" : ""}>
                <label className={labelClassName}>Variety *</label>

                <div ref={varietyDropdownRef} className="relative">
                  <button
                    type="button"
                    className={popboxTriggerClassName}
                    onClick={() =>
                      setOpenDropdown((prev) =>
                        prev === "variety" ? null : "variety",
                      )
                    }
                  >
                    <span>
                      {form.variety
                        ? getVarietyLabel(form.variety)
                        : "Select variety"}
                    </span>

                    <span className="ml-3 shrink-0 text-[#d4af37]">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden="true"
                        style={{
                          transform:
                            openDropdown === "variety"
                              ? "rotate(180deg)"
                              : "rotate(0deg)",
                          transition: "transform 0.2s ease",
                        }}
                      >
                        <path
                          d="M6 9L12 15L18 9"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  </button>

                  {openDropdown === "variety" && (
                    <div
                      className={`${popboxMenuClassName} ${
                        shouldOpenVarietyUp
                          ? popboxMenuUpClassName
                          : popboxMenuDownClassName
                      }`}
                    >
                      <div className="max-h-[280px] overflow-y-auto">
                        <button
                          type="button"
                          onClick={() => {
                            updateField("variety", "")
                            setOpenDropdown(null)
                          }}
                          className={popboxOptionCompactClassName}
                        >
                          Select variety
                        </button>

                        {varietyOptions.map((item) => (
                          <button
                            key={item.value}
                            type="button"
                            onClick={() => {
                              updateField("variety", item.value)
                              setOpenDropdown(null)
                            }}
                            className={`${popboxOptionCompactClassName} ${
                              form.variety === item.value
                                ? popboxOptionActiveClassName
                                : ""
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

                            <div
                className={
                  isAssistantMidLayout ? "md:pr-24 md:max-w-[380px]" : ""
                }
              >
                <label className={labelClassName}>Process *</label>

                <div ref={processDropdownRef} className="relative">
                  <button
                    type="button"
                    className={popboxTriggerClassName}
                    onClick={() =>
                      setOpenDropdown((prev) =>
                        prev === "process" ? null : "process",
                      )
                    }
                  >
                    <span>
                      {form.process
                        ? getProcessLabel(form.process)
                        : "Select process"}
                    </span>

                    <span className="ml-3 shrink-0 text-[#d4af37]">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden="true"
                        style={{
                          transform:
                            openDropdown === "process"
                              ? "rotate(180deg)"
                              : "rotate(0deg)",
                          transition: "transform 0.2s ease",
                        }}
                      >
                        <path
                          d="M6 9L12 15L18 9"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  </button>

                  {openDropdown === "process" && (
                    <div
                      className={`${popboxMenuClassName} ${popboxMenuDownClassName}`}
                    >
                      <div
                        className={`overflow-y-auto ${
                          isProcessCompact ? "max-h-[220px]" : "max-h-[280px]"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            updateField("process", "" as ProcessType | "")
                            setOpenDropdown(null)
                          }}
                          className={`${
                            isProcessCompact
                              ? popboxOptionCompactClassName
                              : popboxOptionClassName
                          }`}
                        >
                          Select process
                        </button>

                        {processOptions.map((item) => (
                          <button
                            key={item.value}
                            type="button"
                            onClick={() => {
                              updateField("process", item.value as ProcessType)
                              setOpenDropdown(null)
                            }}
                            className={`${
                              isProcessCompact
                                ? popboxOptionCompactClassName
                                : popboxOptionClassName
                            } ${
                              form.process === item.value
                                ? popboxOptionActiveClassName
                                : ""
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 3 */}
          <section className="rounded-2xl border border-[#dfcfb7] bg-[linear-gradient(180deg,#fdf9f1_0%,#f8f1e4_100%)] px-5 py-6 shadow-[0_14px_32px_rgba(18,11,7,0.18)] md:px-6 md:py-7">
            <div className="mb-5 flex items-start gap-4">
              <div className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#7ca07d] bg-[#edf5ee] text-xs font-semibold text-[#35533a]">
                3
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-[#8a6f4d]">
                  Harvest & Volume
                </p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-[#2d2218]">
                  Submission sizing
                </h2>
                <p className="mt-1 text-sm text-[#66533f]">
                  Record harvest timing and total parchment for sample planning
                  and logistics.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <label className={labelClassName}>Harvest Year</label>
                <input
                  type="number"
                  value={form.harvestYear}
                  onChange={(e) => updateField("harvestYear", e.target.value)}
                  onKeyDown={handleCommitFieldOnEnter("harvestYear")}
                  onWheel={(e) => e.currentTarget.blur()}
                  min={2026}
                  max={2026}
                  step={1}
                  className={inputClassName}
                  placeholder="2026"
                />

                {!isHarvestYearValid && (
                  <p className="mt-2 text-xs leading-relaxed text-[#9f4d3f]">
                    Please enter a valid harvest year. Only 2026 is allowed.
                  </p>
                )}
              </div>

                <div className={isParchmentConfirmTight ? "md:pr-12" : ""}>
                <label className={labelClassName}>Parchment Kg *</label>
                <div className="relative">
  <input
    type="number"
    value={draftParchmentKg}
    onChange={(e) => setDraftParchmentKg(e.target.value)}
    onKeyDown={(e) => {
      if (e.key === "Enter") {
        e.preventDefault()
        confirmParchmentKg()
        e.currentTarget.blur()
      }
    }}
    onWheel={(e) => e.currentTarget.blur()}
    min={1}
    step="any"
    className={
            inputClassName +
      (isParchmentConfirmTight ? " pr-44 md:max-w-[360px]" : " pr-24")
    }
    placeholder="e.g. 1200"
  />

  {/* ✅ CONFIRM BUTTON */}
  <button
    type="button"
    onClick={confirmParchmentKg}
    className={`absolute top-1/2 -translate-y-1/2 rounded-full border border-[#d4af37]/40 bg-[#1f3d2b]/90 py-1 text-xs text-white transition-all hover:bg-[#d4af37] hover:text-black ${
      isParchmentConfirmTight
        ? "right-28 px-2.5"
        : "right-2 px-3"
    }`}
  >
    {isParchmentConfirmTight ? "OK" : "Confirm"}
  </button>
</div>

                {draftParchmentKg && !isParchmentKgValid && (
                  <p className="mt-2 text-xs leading-relaxed text-[#9f4d3f]">
                    Please enter a valid parchment amount greater than 0.
                  </p>
                )}
              </div>
            </div>

            <p className="mt-4 rounded-xl border border-[#dfcfb7] bg-[#f7efde] px-4 py-3 text-xs leading-relaxed text-[#685540]">
              Use harvest year 2026 for this intake. Parchment kg should reflect
              the full available volume. A small sample (~300g) will be sent for
              lab analysis.
            </p>
          </section>
        </div>

        {/* CTA FOOTER */}
        <div className="mt-6 rounded-2xl border border-[#d5be96] bg-[linear-gradient(180deg,#f6ecdb_0%,#efdfc7_100%)] px-5 py-5 shadow-[0_12px_28px_rgba(26,15,8,0.2)] md:px-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium text-[#3a2d1f]">
                Final check before sending this sample for partner review
              </p>
              <p className="mt-1 text-xs text-[#6f5c46]">
                Required fields: Farm ID, Variety, Process, and Parchment Kg.
              </p>
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="inline-flex min-w-[230px] items-center justify-center rounded-full border border-[#d4af37]/60 bg-[#1f3d2b]/90 px-7 py-3 text-sm font-semibold tracking-wide text-white transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-70"
              style={{
                backdropFilter: "blur(6px)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(212,175,55,0.88)"
                e.currentTarget.style.color = "#111"
                e.currentTarget.style.transform = "translateY(-2px)"
                e.currentTarget.style.boxShadow =
                  "0 10px 25px rgba(212,175,55,0.25)"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(31,61,43,0.9)"
                e.currentTarget.style.color = "#fff"
                e.currentTarget.style.transform = "translateY(0)"
                e.currentTarget.style.boxShadow = "none"
              }}
            >
              {loading ? "Sending sample..." : "Send Sample for Analysis"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}