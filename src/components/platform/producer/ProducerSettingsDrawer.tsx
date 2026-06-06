"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"

//////////////////////////////////////////////////////
// ⚙️ PRODUCER SETTINGS DRAWER (PRODUCER-SETTINGS-1)
//
// Right-side drawer opened from the platform header
// settings icon. Six soft cards:
//   1. Producer profile      (persisted: User + Producer)
//   2. Farm profile          (persisted: Farm)
//   3. Farm media readiness  (read-only, links to /platform/producer/media)
//   4. Notifications         (localStorage only — see route doc)
//   5. Operations            (localStorage only — see route doc)
//   6. Support               (static origin manager contact)
//
// Visual identity matches the rest of the producer
// dashboard: dark coffee gradient, gold accents, serif
// headings, soft cards, no admin-panel chrome.
//////////////////////////////////////////////////////

type ProducerProfile = {
  producerName: string
  contactName: string | null
  email: string
  phone: string | null
  country: string
  preferredLanguage: string | null
}

type FarmRef = {
  id: string
  name: string
  region: string | null
  altitude: number | null
}

type ReadinessRow = {
  code: string
  label: string
  description: string
  ready: boolean
}

type ReadinessSummary = {
  ready: boolean
  rows: ReadinessRow[]
  missingCount: number
  headline: string
}

type SettingsResponse = {
  producerProfile: ProducerProfile
  farms: FarmRef[]
  activeFarmId: string | null
  farmProfile: FarmRef | null
  farmMediaReadiness: ReadinessSummary | null
  support: { originManagerEmail: string }
}

// ----------------------------------------------------
// LOCAL PREFS (notifications + operations)
// ----------------------------------------------------

type NotificationPrefs = {
  sampleRequested: boolean
  reviewUpdates: boolean
  decisionUpdates: boolean
  salesUpdates: boolean
  channelEmail: boolean
  channelWhatsApp: boolean
}

type OperationalPrefs = {
  preferredContact: "EMAIL" | "WHATSAPP" | "PHONE"
  pickupAddress: string
  preferredPickupDays: string
  logisticsContact: string
}

const NOTIF_DEFAULT: NotificationPrefs = {
  sampleRequested: true,
  reviewUpdates: true,
  decisionUpdates: true,
  salesUpdates: true,
  channelEmail: true,
  channelWhatsApp: false,
}

const OPS_DEFAULT: OperationalPrefs = {
  preferredContact: "EMAIL",
  pickupAddress: "",
  preferredPickupDays: "",
  logisticsContact: "",
}

function lsKey(suffix: string) {
  return `producerSettings.${suffix}`
}

function readLocalPrefs<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  try {
    const raw = window.localStorage.getItem(lsKey(key))
    if (!raw) return fallback
    return { ...fallback, ...(JSON.parse(raw) as Partial<T>) }
  } catch {
    return fallback
  }
}

function writeLocalPrefs(key: string, value: unknown) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(lsKey(key), JSON.stringify(value))
  } catch {
    /* ignore */
  }
}

// ----------------------------------------------------
// COMPONENT
// ----------------------------------------------------

export default function ProducerSettingsDrawer({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<SettingsResponse | null>(null)
  const [activeFarmId, setActiveFarmId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  // Mirror of the editable producer + farm profile.
  const [producerForm, setProducerForm] = useState({
    producerName: "",
    contactName: "",
    phone: "",
    country: "",
  })
  const [farmForm, setFarmForm] = useState({
    name: "",
    region: "",
    altitude: "" as string,
  })

  // Local-only prefs.
  const [notif, setNotif] = useState<NotificationPrefs>(NOTIF_DEFAULT)
  const [ops, setOps] = useState<OperationalPrefs>(OPS_DEFAULT)

  // ─── LOAD ──────────────────────────────────────────
  const load = useCallback(async (farmId?: string | null) => {
    setLoading(true)
    setError(null)
    try {
      const url = farmId
        ? `/api/producer/settings?farmId=${encodeURIComponent(farmId)}`
        : "/api/producer/settings"
      const res = await fetch(url, { credentials: "include" })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || `Failed to load settings (${res.status})`)
      }
      const json = (await res.json()) as SettingsResponse
      setData(json)
      setActiveFarmId(json.activeFarmId)
      setProducerForm({
        producerName: json.producerProfile.producerName ?? "",
        contactName: json.producerProfile.contactName ?? "",
        phone: json.producerProfile.phone ?? "",
        country: json.producerProfile.country ?? "",
      })
      if (json.farmProfile) {
        setFarmForm({
          name: json.farmProfile.name ?? "",
          region: json.farmProfile.region ?? "",
          altitude:
            json.farmProfile.altitude != null
              ? String(json.farmProfile.altitude)
              : "",
        })
      } else {
        setFarmForm({ name: "", region: "", altitude: "" })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings.")
    } finally {
      setLoading(false)
    }
  }, [])

  // Load when the drawer opens.
  useEffect(() => {
    if (!open) return
    setNotif(readLocalPrefs("notifications", NOTIF_DEFAULT))
    setOps(readLocalPrefs("operations", OPS_DEFAULT))
    load(null)
  }, [open, load])

  // Reload when the user switches farm.
  const onFarmChange = (nextId: string) => {
    setActiveFarmId(nextId)
    load(nextId)
  }

  // ─── SAVE ──────────────────────────────────────────
  const onSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const payload: Record<string, unknown> = {}

      const producerProfile: Record<string, unknown> = {}
      if (producerForm.producerName.trim() !== "") {
        producerProfile.producerName = producerForm.producerName
      }
      producerProfile.contactName = producerForm.contactName
      producerProfile.phone = producerForm.phone
      if (producerForm.country.trim() !== "") {
        producerProfile.country = producerForm.country
      }
      payload.producerProfile = producerProfile

      if (activeFarmId) {
        const farmProfile: Record<string, unknown> = { farmId: activeFarmId }
        if (farmForm.name.trim() !== "") farmProfile.name = farmForm.name
        farmProfile.region = farmForm.region
        if (farmForm.altitude.trim() === "") {
          farmProfile.altitude = null
        } else {
          const n = Number(farmForm.altitude)
          if (Number.isFinite(n)) farmProfile.altitude = n
        }
        payload.farmProfile = farmProfile
      }

      const res = await fetch("/api/producer/settings", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(body?.error || `Save failed (${res.status})`)
      }

      // Persist local-only prefs.
      writeLocalPrefs("notifications", notif)
      writeLocalPrefs("operations", ops)

      // Use returned state so the drawer reflects what the DB persisted.
      setData(body as SettingsResponse)
      setSavedAt(Date.now())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.")
    } finally {
      setSaving(false)
    }
  }

  // Saved confirmation auto-clears.
  useEffect(() => {
    if (savedAt == null) return
    const t = setTimeout(() => setSavedAt(null), 2400)
    return () => clearTimeout(t)
  }, [savedAt])

  const farms = data?.farms ?? []
  const readiness = data?.farmMediaReadiness ?? null
  const showFarmSelector = farms.length > 1

  // ─── KEYBOARD: close on Escape ─────────────────────
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex">
      {/* Overlay */}
      <button
        type="button"
        aria-label="Close settings"
        onClick={onClose}
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
      />

      {/* Drawer */}
      <aside
        className="
          relative ml-auto h-full w-full max-w-[480px]
          overflow-y-auto
          bg-[linear-gradient(180deg,#2a1a12_0%,#1c130b_100%)]
          text-[#f4ead6]
          border-l border-[#d4af37]/20
          shadow-[0_24px_60px_rgba(0,0,0,0.45)]
        "
        role="dialog"
        aria-modal="true"
        aria-label="Producer settings"
      >
        {/* Header */}
        <header className="sticky top-0 z-10 bg-[linear-gradient(180deg,#2a1a12_0%,rgba(28,19,11,0.95)_90%,rgba(28,19,11,0))] px-7 pt-7 pb-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[10.5px] uppercase tracking-[0.22em] text-[#d4af37]">
                Producer settings
              </div>
              <h2
                className="mt-1 text-[26px] font-medium leading-tight text-[#f7efe2]"
                style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
              >
                Keep your farm profile up to date
              </h2>
              <p className="mt-2 max-w-[360px] text-[12.5px] leading-relaxed text-[#dcc9a4]">
                Your profile, contact details and publishing readiness in one place.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="
                grid h-9 w-9 place-items-center rounded-full
                border border-[#d4af37]/30 bg-black/30 text-[#f4ead6]
                hover:bg-[#d4af37]/15 hover:text-[#fff3db]
                transition-colors
              "
            >
              <CloseIcon />
            </button>
          </div>
        </header>

        <div className="px-7 pb-32">

          {error && (
            <div className="mb-4 rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-[12px] text-red-200">
              {error}
            </div>
          )}

          {loading && !data && (
            <div className="rounded-xl border border-[#d4af37]/15 bg-white/[0.03] p-5 text-[12px] text-[#dcc9a4]">
              Loading your settings…
            </div>
          )}

          {data && (
            <div className="flex flex-col gap-5">

              {/* Farm selector */}
              {showFarmSelector && (
                <SectionCard
                  eyebrow="Active farm"
                  title="Which farm are you editing?"
                  description="Settings update for the farm you select here."
                >
                  <select
                    value={activeFarmId ?? ""}
                    onChange={(e) => onFarmChange(e.target.value)}
                    className={selectClass}
                  >
                    {farms.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </SectionCard>
              )}

              {/* 1 — Producer profile */}
              <SectionCard
                eyebrow="Producer profile"
                title="Who we work with"
                description="Used across contracts and partner contact."
              >
                <Field label="Producer / company name">
                  <input
                    type="text"
                    value={producerForm.producerName}
                    onChange={(e) =>
                      setProducerForm((p) => ({ ...p, producerName: e.target.value }))
                    }
                    className={inputClass}
                    maxLength={120}
                  />
                </Field>
                <Field label="Contact person">
                  <input
                    type="text"
                    value={producerForm.contactName}
                    onChange={(e) =>
                      setProducerForm((p) => ({ ...p, contactName: e.target.value }))
                    }
                    className={inputClass}
                    maxLength={120}
                    placeholder="Full name"
                  />
                </Field>
                <Field label="Email" hint="Email is managed in your account — contact support to change it.">
                  <input
                    type="email"
                    value={data.producerProfile.email}
                    readOnly
                    disabled
                    className={inputClass + " opacity-70"}
                  />
                </Field>
                <Field label="Phone / WhatsApp">
                  <input
                    type="tel"
                    value={producerForm.phone}
                    onChange={(e) =>
                      setProducerForm((p) => ({ ...p, phone: e.target.value }))
                    }
                    className={inputClass}
                    placeholder="+57 …"
                    maxLength={40}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Country">
                    <input
                      type="text"
                      value={producerForm.country}
                      onChange={(e) =>
                        setProducerForm((p) => ({ ...p, country: e.target.value }))
                      }
                      className={inputClass}
                      maxLength={64}
                    />
                  </Field>
                  <Field label="Preferred language" hint="More languages coming soon.">
                    <select disabled className={selectClass + " opacity-70"}>
                      <option>English</option>
                    </select>
                  </Field>
                </div>
              </SectionCard>

              {/* 2 — Farm profile */}
              <SectionCard
                eyebrow="Farm profile"
                title="Tell us about your farm"
                description="These fields appear on every lot you publish."
              >
                <Field label="Farm name">
                  <input
                    type="text"
                    value={farmForm.name}
                    onChange={(e) =>
                      setFarmForm((p) => ({ ...p, name: e.target.value }))
                    }
                    className={inputClass}
                    maxLength={120}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Region">
                    <input
                      type="text"
                      value={farmForm.region}
                      onChange={(e) =>
                        setFarmForm((p) => ({ ...p, region: e.target.value }))
                      }
                      className={inputClass}
                      placeholder="Huila, Antioquia, …"
                      maxLength={120}
                    />
                  </Field>
                  <Field label="Altitude (m)" hint="0 – 3500 metres above sea level.">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={3500}
                      value={farmForm.altitude}
                      onChange={(e) =>
                        setFarmForm((p) => ({ ...p, altitude: e.target.value }))
                      }
                      className={inputClass}
                      placeholder="1850"
                    />
                  </Field>
                </div>
                <Hint>
                  Farm story, main varieties and process profiles still live in the
                  lot wizard. Bring those into settings in a future update.
                </Hint>
              </SectionCard>

              {/* 3 — Farm media readiness */}
              <SectionCard
                eyebrow="Farm media"
                title="Publishing readiness"
                description={readiness?.headline ?? "Add farm and process photos to publish lots."}
                tone={readiness?.ready ? "ok" : "warn"}
              >
                {readiness ? (
                  <div className="flex flex-col gap-2">
                    {readiness.rows.map((r) => (
                      <div key={r.code} className="flex items-start gap-3">
                        <span
                          aria-hidden
                          className={
                            "mt-1 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-[10px] " +
                            (r.ready
                              ? "bg-[#86c69b]/25 text-[#86c69b]"
                              : "bg-[#e2b65c]/25 text-[#e2b65c]")
                          }
                        >
                          {r.ready ? "✓" : "·"}
                        </span>
                        <div>
                          <div className="text-[13px] text-[#f4efe3]">{r.label}</div>
                          <div className="text-[11px] text-[#cdc0a4]">{r.description}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[12px] text-[#dcc9a4]">
                    Complete farm onboarding to manage publishing readiness.
                  </p>
                )}
                <a
                  href="/platform/producer/media"
                  className="
                    mt-3 inline-flex items-center gap-2
                    rounded-md border border-[#d4af37]/40 bg-[#d4af37]/10
                    px-3 py-1.5 text-[12px] font-medium text-[#f3d27a]
                    hover:bg-[#d4af37]/20
                  "
                >
                  Manage farm media →
                </a>
              </SectionCard>

              {/* 4 — Notifications (local) */}
              <SectionCard
                eyebrow="Notifications"
                title="What you want to hear about"
                description="Saved in your browser for now. Server-side delivery is coming soon."
              >
                <Toggle
                  label="Sample requests on a draft lot"
                  checked={notif.sampleRequested}
                  onChange={(v) => setNotif((p) => ({ ...p, sampleRequested: v }))}
                />
                <Toggle
                  label="Lab / review updates"
                  checked={notif.reviewUpdates}
                  onChange={(v) => setNotif((p) => ({ ...p, reviewUpdates: v }))}
                />
                <Toggle
                  label="Lot approved or rejected"
                  checked={notif.decisionUpdates}
                  onChange={(v) => setNotif((p) => ({ ...p, decisionUpdates: v }))}
                />
                <Toggle
                  label="Lot sold or contracted"
                  checked={notif.salesUpdates}
                  onChange={(v) => setNotif((p) => ({ ...p, salesUpdates: v }))}
                />
                <div className="mt-3 border-t border-white/10 pt-3 grid grid-cols-2 gap-3">
                  <Toggle
                    label="Email"
                    checked={notif.channelEmail}
                    onChange={(v) => setNotif((p) => ({ ...p, channelEmail: v }))}
                  />
                  <Toggle
                    label="WhatsApp / phone"
                    checked={notif.channelWhatsApp}
                    onChange={(v) => setNotif((p) => ({ ...p, channelWhatsApp: v }))}
                  />
                </div>
              </SectionCard>

              {/* 5 — Operations (local) */}
              <SectionCard
                eyebrow="Operations"
                title="How we coordinate logistics"
                description="Saved in your browser for now."
              >
                <Field label="Preferred contact method">
                  <select
                    value={ops.preferredContact}
                    onChange={(e) =>
                      setOps((p) => ({
                        ...p,
                        preferredContact: e.target.value as OperationalPrefs["preferredContact"],
                      }))
                    }
                    className={selectClass}
                  >
                    <option value="EMAIL">Email</option>
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="PHONE">Phone call</option>
                  </select>
                </Field>
                <Field label="Sample pickup address">
                  <input
                    type="text"
                    value={ops.pickupAddress}
                    onChange={(e) =>
                      setOps((p) => ({ ...p, pickupAddress: e.target.value }))
                    }
                    className={inputClass}
                    placeholder="Street, city, postal code"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Preferred pickup days">
                    <input
                      type="text"
                      value={ops.preferredPickupDays}
                      onChange={(e) =>
                        setOps((p) => ({ ...p, preferredPickupDays: e.target.value }))
                      }
                      className={inputClass}
                      placeholder="Mon, Wed, Fri"
                    />
                  </Field>
                  <Field label="Logistics / export contact">
                    <input
                      type="text"
                      value={ops.logisticsContact}
                      onChange={(e) =>
                        setOps((p) => ({ ...p, logisticsContact: e.target.value }))
                      }
                      className={inputClass}
                      placeholder="Name + phone"
                    />
                  </Field>
                </div>
              </SectionCard>

              {/* 6 — Support */}
              <SectionCard
                eyebrow="Support"
                title="Need help?"
                description="Your origin manager can help with onboarding, pricing, sample pickup, anything."
              >
                <a
                  href={`mailto:${data.support.originManagerEmail}?subject=${encodeURIComponent("Producer support request")}`}
                  className="
                    inline-flex items-center gap-2
                    rounded-md border border-[#d4af37]/40 bg-[#d4af37]/10
                    px-3 py-2 text-[12px] font-medium text-[#f3d27a]
                    hover:bg-[#d4af37]/20
                  "
                >
                  Contact your origin manager
                </a>
              </SectionCard>
            </div>
          )}
        </div>

        {/* Save bar */}
        {data && (
          <div className="
            absolute bottom-0 left-0 right-0 z-20
            border-t border-[#d4af37]/15
            bg-[linear-gradient(180deg,rgba(28,19,11,0.85)_0%,rgba(28,19,11,1)_60%)]
            px-7 py-4 flex items-center justify-between gap-3
            backdrop-blur-md
          ">
            <div className="text-[11px] text-[#cdc0a4]">
              {savedAt
                ? "Saved · settings up to date"
                : "Changes are saved when you click Save."}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="
                  rounded-md border border-white/15 px-3 py-2
                  text-[12px] text-[#dcc9a4] hover:bg-white/5
                "
              >
                Close
              </button>
              <button
                type="button"
                onClick={onSave}
                disabled={saving || loading}
                className="
                  rounded-md bg-[#d4af37] px-4 py-2
                  text-[12.5px] font-semibold text-[#1a0f08]
                  disabled:opacity-40 hover:bg-[#e3c376]
                "
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        )}
      </aside>
    </div>
  )
}

// ----------------------------------------------------
// SHARED CONTROLS
// ----------------------------------------------------

const inputClass =
  "w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-[13px] text-[#f4ead6] " +
  "focus:border-[#d4af37] focus:outline-none focus:ring-2 focus:ring-[#d4af37]/30 placeholder:text-[#cdc0a4]/45"

const selectClass = inputClass + " appearance-none pr-8"

function SectionCard({
  eyebrow,
  title,
  description,
  children,
  tone,
}: {
  eyebrow: string
  title: string
  description?: string
  children: React.ReactNode
  tone?: "ok" | "warn"
}) {
  const accent =
    tone === "ok"
      ? "border-[#86c69b]/30 bg-[#86c69b]/[0.04]"
      : tone === "warn"
        ? "border-[#e2b65c]/35 bg-[#e2b65c]/[0.05]"
        : "border-[#d4af37]/15 bg-white/[0.03]"
  return (
    <section className={"rounded-2xl border " + accent + " px-5 py-5 flex flex-col gap-3"}>
      <header>
        <div className="text-[10px] uppercase tracking-[0.22em] text-[#d4af37]">
          {eyebrow}
        </div>
        <h3
          className="mt-1 text-[15.5px] font-medium text-[#f7efe2]"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          {title}
        </h3>
        {description && (
          <p className="mt-1 text-[11.5px] leading-relaxed text-[#cdc0a4]">{description}</p>
        )}
      </header>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-[0.18em] text-[#dcc9a4]/85">
        {label}
      </span>
      {children}
      {hint && (
        <span className="text-[10.5px] text-[#cdc0a4]/80">{hint}</span>
      )}
    </label>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md bg-black/25 border border-white/5 px-3 py-2 text-[11px] text-[#cdc0a4]/85">
      {children}
    </p>
  )
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <label className="flex items-center justify-between gap-3 py-1.5 cursor-pointer">
      <span className="text-[12.5px] text-[#f4ead6]">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={
          "relative inline-flex h-5 w-9 items-center rounded-full transition-colors " +
          (checked ? "bg-[#d4af37]" : "bg-white/15")
        }
      >
        <span
          className={
            "inline-block h-4 w-4 rounded-full bg-white transition-transform " +
            (checked ? "translate-x-[18px]" : "translate-x-[2px]")
          }
        />
      </button>
    </label>
  )
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}
