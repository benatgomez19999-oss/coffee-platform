"use client"

import { useState, useEffect } from "react"

type Client = {
  country: string
  businessName: string
  legalCompanyName: string
  vat: string
  address: string
  contactName: string
  email: string
  phone: string
}

type Props = {
  client: Client
  onNext: (data: Client) => void
}

export default function Step1Client({ client, onNext }: Props) {
  const [form, setForm] = useState<Client>(client)

  // 🔥 SYNC CON AUTOFILL
  useEffect(() => {
    setForm(client)
  }, [client])

  function update(field: keyof Client, value: string) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    onNext(form)
  }

  const sectionCardClassName =
    "rounded-2xl border border-[#d8c3a0]/28 bg-[linear-gradient(180deg,rgba(255,248,236,0.08),rgba(255,243,223,0.04))] p-6 md:p-7 shadow-[0_10px_28px_rgba(0,0,0,0.18)] space-y-6"

  const fieldWrapClassName = "space-y-2.5"
  const labelClassName = "text-sm font-medium tracking-[0.01em] text-[#f2e7d3]/88"
  const inputClassName =
    "w-full rounded-xl border border-[#d8c3a0]/28 bg-[rgba(27,19,14,0.5)] px-4 py-3 text-[15px] text-[#f8efe2] placeholder:text-[#c7b49b]/55 transition-all duration-200 focus:outline-none focus:border-[#d4af37]/75 focus:ring-4 focus:ring-[#d4af37]/18"

  return (
    <form
      onSubmit={submit}
      className="relative overflow-hidden rounded-[26px] border border-[#d8c3a0]/30 bg-[linear-gradient(165deg,rgba(34,24,18,0.74)_0%,rgba(28,20,15,0.82)_100%)] p-7 md:p-10 space-y-9 shadow-[0_24px_50px_rgba(0,0,0,0.22)] backdrop-blur"
    >
      {/* subtle atmospheric accents */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-[#d4af37]/8 blur-3xl" />
      <div className="pointer-events-none absolute -left-20 bottom-0 h-40 w-60 bg-[radial-gradient(ellipse_at_left,rgba(106,142,112,0.14),transparent_72%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(212,175,55,0.45),transparent)]" />

      {/* ======================================================
         WIZARD HEADER
      ====================================================== */}
      <div className="relative z-10 space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#d8c3a0]/35 bg-[#1d1712]/55 px-3 py-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[#d4af37]" />
          <span className="text-[11px] uppercase tracking-[0.18em] text-[#e7d4b5]/90">
            Step 1 · Client
          </span>
        </div>

        <h2 className="text-2xl md:text-[30px] font-semibold tracking-tight text-[#fbf3e5]">
          Client Information
        </h2>

        <p className="max-w-2xl text-sm leading-relaxed text-[#dbc8ae]/78">
          Add the legal and contact details of the contracting entity. Keep this
          information precise so contracts are generated cleanly.
        </p>

        <div className="pt-2">
          <div className="h-px bg-[linear-gradient(90deg,rgba(212,175,55,0.35),rgba(255,255,255,0.08),transparent)]" />
        </div>
      </div>

      {/* ======================================================
         COMPANY DETAILS CARD
      ====================================================== */}
      <div className={`${sectionCardClassName} relative z-10`}>
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d9c3a0]/78">
            Company Details
          </div>
          <span className="text-[11px] text-[#c7b49b]/65">Legal entity profile</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          {/* COUNTRY */}
          <div className={fieldWrapClassName}>
            <label className={labelClassName}>Country</label>
            <input
              className={inputClassName}
              value={form.country}
              onChange={(e) => update("country", e.target.value)}
            />
          </div>

          {/* BUSINESS NAME */}
          <div className={fieldWrapClassName}>
            <label className={labelClassName}>Business Name</label>
            <input
              className={inputClassName}
              value={form.businessName}
              onChange={(e) => update("businessName", e.target.value)}
            />
          </div>

          {/* LEGAL COMPANY NAME */}
          <div className={fieldWrapClassName}>
            <label className={labelClassName}>Legal Company Name</label>
            <input
              className={inputClassName}
              value={form.legalCompanyName}
              onChange={(e) => update("legalCompanyName", e.target.value)}
            />
          </div>

          {/* VAT */}
          <div className={fieldWrapClassName}>
            <label className={labelClassName}>CIF / VAT</label>
            <input
              className={inputClassName}
              value={form.vat}
              onChange={(e) => update("vat", e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* ======================================================
         CONTACT INFORMATION CARD
      ====================================================== */}
      <div className={`${sectionCardClassName} relative z-10`}>
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d9c3a0]/78">
            Contact Information
          </div>
          <span className="text-[11px] text-[#c7b49b]/65">Primary contract contact</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          {/* ADDRESS */}
          <div className={`${fieldWrapClassName} md:col-span-2`}>
            <label className={labelClassName}>Business Address</label>
            <input
              className={inputClassName}
              value={form.address}
              onChange={(e) => update("address", e.target.value)}
            />
          </div>

          {/* CONTACT NAME */}
          <div className={fieldWrapClassName}>
            <label className={labelClassName}>Contact Name</label>
            <input
              className={inputClassName}
              value={form.contactName}
              onChange={(e) => update("contactName", e.target.value)}
            />
          </div>

          {/* EMAIL */}
          <div className={fieldWrapClassName}>
            <label className={labelClassName}>Email</label>
            <input
              className={inputClassName}
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
            />
          </div>

          {/* PHONE */}
          <div className={fieldWrapClassName}>
            <label className={labelClassName}>Phone</label>
            <input
              className={inputClassName}
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* ======================================================
         ACTION
      ====================================================== */}
      <div className="relative z-10 flex justify-end pt-1">
        <button
          type="submit"
          className="group inline-flex items-center gap-2 rounded-full border border-[#d4af37]/60 bg-[linear-gradient(135deg,#1f3d2b_0%,#244732_100%)] px-8 md:px-10 py-3 text-sm font-semibold tracking-wide text-[#fff8ec] transition-all duration-250 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(212,175,55,0.25)] hover:border-[#d4af37]"
        >
          Continue
          <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
        </button>
      </div>
    </form>
  )
}