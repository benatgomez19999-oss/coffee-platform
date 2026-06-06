"use client"

import React, { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  COLORS,
  RADII,
  formatKg,
  formatPrice,
} from "./dashboardTokens"
import LotMediaCarousel from "@/src/components/platform/media/LotMediaCarousel"
import {
  ALLOWED_DURATION_MONTHS,
  formatDemandIntentOutcome,
  getDefaultContractRequestDurationMonths,
  MAX_MONTHLY_ROASTED_KG,
  validateContractRequestInput,
  type ContractRequestDuration,
  type DemandIntentOutcome,
} from "@/src/services/contract-request/contractRequest.pure"
import type {
  LotMediaItem,
  LotMediaSummary,
} from "@/src/services/lot-media/lotMedia.types"

//////////////////////////////////////////////////////
// 🤝 CONFIGURE MONTHLY SUPPLY MODAL (CONTRACT-REQUEST-1)
//
// Triggered from SupplyDeskPanel + ClientContractCatalogPanel
// CTAs. Sends a DemandIntent (NOT a Contract) and reacts to
// the green / yellow / red semaphore the service returns:
//
//   green  → "Continue to contract" → /contract/create
//   yellow → counter offer with Accept / Cancel buttons
//   red    → waitlist with "Notify me" button
//
// Pricing + volume rules live in contractRequest.pure;
// the modal is purely UI + network glue.
//////////////////////////////////////////////////////

export type ContractRequestLot = {
  id: string
  name: string
  producerName?: string | null
  region?: string | null
  country?: string | null
  variety?: string | null
  process?: string | null
  scaScore?: number | null
  altitude?: number | null
  pricePerKgRoasted: number | null
  contractAssignableRoastedKg?: number | null
  currency?: string | null
  media?: LotMediaItem[] | null
  primaryMedia?: LotMediaItem | null
  mediaSummary?: LotMediaSummary | null
}

type ConfigureMonthlySupplyModalProps = {
  lot: ContractRequestLot | null
  open: boolean
  onClose: () => void
  onRequestCreated?: () => void
}

type Phase =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "outcome"; outcome: DemandIntentOutcome }
  | { kind: "error"; message: string; existingIntentId?: string }
  | { kind: "follow-up-busy" }
  | { kind: "follow-up-done"; message: string }

export default function ConfigureMonthlySupplyModal({
  lot,
  open,
  onClose,
  onRequestCreated,
}: ConfigureMonthlySupplyModalProps) {
  const router = useRouter()

  // ─── FORM STATE ────────────────────────────────────
  const [volumeInput, setVolumeInput] = useState<string>("")
  const [duration, setDuration] = useState<ContractRequestDuration>(
    getDefaultContractRequestDurationMonths(),
  )
  const [phase, setPhase] = useState<Phase>({ kind: "idle" })

  // Reset state every time the modal reopens with a (possibly new) lot.
  useEffect(() => {
    if (!open) return
    setVolumeInput("")
    setDuration(getDefaultContractRequestDurationMonths())
    setPhase({ kind: "idle" })
  }, [open, lot?.id])

  // ─── DERIVED ───────────────────────────────────────
  const price = lot?.pricePerKgRoasted ?? null
  const assignable = lot?.contractAssignableRoastedKg ?? null
  const currency = lot?.currency ?? "EUR"

  const parsedVolume = useMemo(() => {
    const n = Number(volumeInput)
    return Number.isFinite(n) ? n : null
  }, [volumeInput])

  const estimatedMonthlyTotal =
    parsedVolume != null && price != null && parsedVolume > 0
      ? parsedVolume * price
      : null

  const clientSideValidation = useMemo(() => {
    if (!lot) return null
    return validateContractRequestInput({
      greenLotId: lot.id,
      requestedKg: parsedVolume,
      durationMonths: duration,
    })
  }, [lot, parsedVolume, duration])

  // Pulled out so the JSX never compares phase.kind twice in a
  // way that drags TypeScript through an impossible narrowing path
  // (canSubmit already encodes idle/error states).
  const isSubmitting = phase.kind === "submitting"
  const canSubmit =
    clientSideValidation?.ok === true &&
    (phase.kind === "idle" || phase.kind === "error")

  // ─── KEYBOARD ──────────────────────────────────────
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open || !lot) return null

  // ─── HANDLERS ──────────────────────────────────────

  const submit = async () => {
    if (!clientSideValidation || !clientSideValidation.ok) return
    setPhase({ kind: "submitting" })
    try {
      const res = await fetch("/api/demand-intent", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          greenLotId: clientSideValidation.value.greenLotId,
          requestedKg: clientSideValidation.value.requestedKg,
          // CONTRACT-REQUEST-3 — persisted on the intent so
          // the contract wizard hydrates from it rather than
          // a URL param. The modal still appends `duration`
          // to the next-step URL as a backwards-compat hint
          // for old wizard sessions.
          requestedDurationMonths: clientSideValidation.value.durationMonths,
          type: "CREATE",
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setPhase({
          kind: "error",
          message:
            body?.error ||
            (res.status === 409
              ? "You already have a request open for this lot."
              : `Could not send the request (${res.status}).`),
          existingIntentId: body?.existingIntentId,
        })
        return
      }
      const outcome = formatDemandIntentOutcome(body)
      if (!outcome) {
        setPhase({
          kind: "error",
          message: "Request sent but the response was unexpected — refresh the page.",
        })
        return
      }
      setPhase({ kind: "outcome", outcome })
      onRequestCreated?.()
    } catch (err) {
      setPhase({
        kind: "error",
        message: err instanceof Error ? err.message : "Network error.",
      })
    }
  }

  const continueToContract = (intentId: string) => {
    onClose()
    // CONTRACT-REQUEST-2 — pass the modal's chosen duration as a
    // query param so the wizard pre-selects it (display-only;
    // not persisted on the intent).
    const url =
      `/contract/create?intentId=${encodeURIComponent(intentId)}` +
      `&duration=${duration}`
    router.push(url)
  }

  const acceptCounter = async (intentId: string) => {
    setPhase({ kind: "follow-up-busy" })
    try {
      const res = await fetch(
        `/api/demand-intent/${encodeURIComponent(intentId)}/accept`,
        { method: "POST", credentials: "include" },
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || `Could not accept (${res.status}).`)
      }
      onRequestCreated?.()
      continueToContract(intentId)
    } catch (err) {
      setPhase({
        kind: "error",
        message: err instanceof Error ? err.message : "Could not accept.",
      })
    }
  }

  const joinWaitlist = async (intentId: string) => {
    setPhase({ kind: "follow-up-busy" })
    try {
      const res = await fetch(
        `/api/demand-intent/${encodeURIComponent(intentId)}/wait`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ autoExecute: false }),
        },
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || `Could not join the waitlist (${res.status}).`)
      }
      onRequestCreated?.()
      setPhase({
        kind: "follow-up-done",
        message:
          "We'll notify you as soon as supply opens on this lot. You can close this window.",
      })
    } catch (err) {
      setPhase({
        kind: "error",
        message: err instanceof Error ? err.message : "Could not join the waitlist.",
      })
    }
  }

  const cancelRequest = async (intentId: string) => {
    setPhase({ kind: "follow-up-busy" })
    try {
      await fetch(
        `/api/demand-intent/${encodeURIComponent(intentId)}/cancel`,
        { method: "POST", credentials: "include" },
      )
    } catch {
      /* best-effort */
    }
    onRequestCreated?.()
    onClose()
  }

  // ─── RENDER ────────────────────────────────────────

  const inputValidationMessage =
    clientSideValidation && !clientSideValidation.ok
      ? clientSideValidation.error.message
      : null

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end md:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Configure monthly supply"
    >
      {/* Overlay */}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/65 backdrop-blur-[2px]"
      />

      {/* Modal */}
      <div
        className="
          relative w-full md:max-w-[640px]
          rounded-t-3xl md:rounded-3xl
          overflow-hidden
          shadow-[0_30px_60px_rgba(0,0,0,0.45)]
          border border-[#d6b04f]/20
          flex flex-col
          max-h-[92vh]
        "
        style={{
          background: "linear-gradient(180deg,#1a120b 0%,#0c0805 100%)",
          color: COLORS.textPrimary,
        }}
      >
        {/* IMAGE / LOT HERO */}
        <div className="relative h-[180px]">
          <LotMediaCarousel
            media={lot.media ?? undefined}
            primaryMedia={lot.primaryMedia ?? undefined}
            mediaSummary={lot.mediaSummary ?? undefined}
            fallbackKey={lot.id}
            title={lot.name}
            aspect="card"
            className="absolute inset-0 h-full w-full"
            showTrustBadge={false}
            showArrows={false}
            showDots={false}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2"
            style={{
              background: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.7) 100%)",
            }}
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3 right-3 z-10 grid h-8 w-8 place-items-center rounded-full bg-black/55 text-white/95 hover:bg-black/75"
          >
            <CloseIcon />
          </button>
          <div className="absolute inset-x-0 bottom-0 z-10 px-6 pb-4">
            <div className="text-[10.5px] uppercase tracking-[0.22em] text-[#d6b04f]">
              Configure monthly supply
            </div>
            <h2
              className="mt-1 text-[22px] leading-tight font-medium text-[#f7efe2]"
              style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
            >
              {lot.name}
            </h2>
            <p className="mt-1 text-[12px] text-[#cdc0a4]">
              {[lot.producerName, lot.region, lot.country].filter(Boolean).join(" · ") ||
                "Origin pending"}
            </p>
          </div>
        </div>

        {/* BODY */}
        <div className="px-6 py-5 flex flex-col gap-4 overflow-y-auto">

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Price" value={
              price != null
                ? `${formatPrice(price, currency)}/kg`
                : "—"
            } accent />
            <Stat
              label="Variety"
              value={lot.variety || "—"}
            />
            <Stat
              label="Available"
              value={assignable != null ? `${formatKg(assignable)} kg/mo` : "—"}
            />
          </div>

          {/* FORM */}
          {phase.kind !== "outcome" && phase.kind !== "follow-up-done" && (
            <>
              <Field label="Monthly volume (kg roasted)">
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={MAX_MONTHLY_ROASTED_KG}
                  step={1}
                  placeholder="e.g. 200"
                  value={volumeInput}
                  onChange={(e) => setVolumeInput(e.target.value)}
                  disabled={phase.kind === "submitting"}
                  className={inputClass}
                />
                {assignable != null && (
                  <span className="mt-1 text-[11px] text-[#cdc0a4]">
                    Up to {formatKg(assignable)} kg roasted available for monthly contracts.
                  </span>
                )}
              </Field>

              <Field label="Contract duration">
                <div className="flex gap-2 flex-wrap">
                  {ALLOWED_DURATION_MONTHS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDuration(d)}
                      disabled={phase.kind === "submitting"}
                      className={
                        "rounded-full border px-3.5 py-1.5 text-[12px] transition-colors " +
                        (duration === d
                          ? "border-[#d6b04f] bg-[#d6b04f] text-[#1a0f08] font-semibold"
                          : "border-[#d6b04f]/30 text-[#cdc0a4] hover:bg-[#d6b04f]/10")
                      }
                    >
                      {d} months
                    </button>
                  ))}
                </div>
                <span className="mt-1 text-[11px] text-[#cdc0a4]">
                  Used for the contract wizard — saved at signature, not yet.
                </span>
              </Field>

              {estimatedMonthlyTotal != null && (
                <div
                  className="rounded-xl border px-4 py-3 flex items-center justify-between"
                  style={{ border: COLORS.borderInner, background: COLORS.panelInner }}
                >
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-[#cdc0a4]">
                      Estimated monthly total
                    </div>
                    <div className="text-[11px] text-[#aea38a]">
                      {parsedVolume?.toLocaleString()} kg × {formatPrice(price!, currency)}/kg
                    </div>
                  </div>
                  <div
                    className="text-[18px] font-semibold tabular-nums"
                    style={{ color: COLORS.gold }}
                  >
                    {formatPrice(estimatedMonthlyTotal, currency)}
                  </div>
                </div>
              )}

              {inputValidationMessage && volumeInput.trim() !== "" && (
                <div className="rounded-md border border-[#e2b65c]/40 bg-[#e2b65c]/[0.08] px-3 py-2 text-[11.5px] text-[#e6c97a]">
                  {inputValidationMessage}
                </div>
              )}

              {phase.kind === "error" && (
                <div className="rounded-md border border-red-400/40 bg-red-500/10 px-3 py-2 text-[12px] text-red-200">
                  {phase.message}
                </div>
              )}

              <p className="text-[10.5px] text-[#aea38a]">
                Sending the request reserves supply but does not create a contract yet.
                The contract wizard runs after a supply manager confirms.
              </p>
            </>
          )}

          {/* OUTCOMES */}
          {phase.kind === "outcome" && (
            <OutcomeView
              outcome={phase.outcome}
              busy={false}
              onContinue={() => continueToContract(phase.outcome.intentId)}
              onAccept={() =>
                phase.outcome.kind === "counter" && acceptCounter(phase.outcome.intentId)
              }
              onCancel={() => cancelRequest(phase.outcome.intentId)}
              onWait={() =>
                phase.outcome.kind === "rejected" && joinWaitlist(phase.outcome.intentId)
              }
            />
          )}

          {phase.kind === "follow-up-busy" && (
            <p className="text-[12px] text-[#cdc0a4]">Working on it…</p>
          )}

          {phase.kind === "follow-up-done" && (
            <div className="rounded-md border border-[#86c69b]/35 bg-[#86c69b]/[0.08] px-3 py-3 text-[12px] text-[#a4dbb4]">
              {phase.message}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div
          className="px-6 py-4 border-t border-[#d6b04f]/15 flex items-center justify-between gap-3"
          style={{
            background: "linear-gradient(180deg,rgba(28,19,11,0.5) 0%,rgba(12,8,5,0.9) 100%)",
          }}
        >
          {phase.kind === "outcome" || phase.kind === "follow-up-done" ? (
            <>
              <span className="text-[11px] text-[#cdc0a4]">
                You can manage requests from the dashboard.
              </span>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-white/15 px-3 py-2 text-[12px] text-[#dcc9a4] hover:bg-white/5"
              >
                Close
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-white/15 px-3 py-2 text-[12px] text-[#dcc9a4] hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={!canSubmit || isSubmitting}
                className="
                  rounded-md bg-[#d6b04f] px-4 py-2
                  text-[12.5px] font-semibold text-[#1a0f08]
                  disabled:opacity-40 hover:bg-[#e3c376]
                "
              >
                {isSubmitting ? "Sending…" : "Send supply request"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------
// SUBCOMPONENTS
// ------------------------------------------------------

function OutcomeView({
  outcome,
  busy,
  onContinue,
  onAccept,
  onCancel,
  onWait,
}: {
  outcome: DemandIntentOutcome
  busy: boolean
  onContinue: () => void
  onAccept: () => void
  onCancel: () => void
  onWait: () => void
}) {
  const toneClass =
    outcome.tone === "success"
      ? "border-[#86c69b]/40 bg-[#86c69b]/[0.08] text-[#a4dbb4]"
      : outcome.tone === "warning"
        ? "border-[#e2b65c]/40 bg-[#e2b65c]/[0.08] text-[#e6c97a]"
        : "border-red-400/40 bg-red-500/[0.08] text-red-200"

  return (
    <div className="flex flex-col gap-3">
      <div className={"rounded-xl border px-4 py-3 text-[13px] " + toneClass}>
        {outcome.headline}
      </div>

      {outcome.kind === "approved" && (
        <button
          type="button"
          onClick={onContinue}
          disabled={busy}
          className="
            rounded-md bg-[#d6b04f] px-4 py-2
            text-[12.5px] font-semibold text-[#1a0f08]
            disabled:opacity-40 hover:bg-[#e3c376]
            self-start
          "
        >
          Continue to contract →
        </button>
      )}

      {outcome.kind === "counter" && (
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={onAccept}
            disabled={busy}
            className="
              rounded-md bg-[#d6b04f] px-4 py-2
              text-[12.5px] font-semibold text-[#1a0f08]
              disabled:opacity-40 hover:bg-[#e3c376]
            "
          >
            Accept {outcome.offeredKg.toLocaleString()} kg/month →
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-md border border-white/15 px-3 py-2 text-[12px] text-[#dcc9a4] hover:bg-white/5"
          >
            Cancel
          </button>
        </div>
      )}

      {outcome.kind === "rejected" && (
        <button
          type="button"
          onClick={onWait}
          disabled={busy}
          className="
            rounded-md border border-[#d6b04f]/45 bg-[#d6b04f]/10
            px-4 py-2 text-[12.5px] font-medium text-[#f3d27a]
            hover:bg-[#d6b04f]/20 self-start
          "
        >
          Notify me when supply opens
        </button>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div className="rounded-xl border px-3 py-2.5"
      style={{ borderColor: "rgba(214,176,79,0.18)", background: "rgba(255,255,255,0.025)" }}
    >
      <div className="text-[9.5px] uppercase tracking-[0.18em] text-[#cdc0a4]">{label}</div>
      <div
        className={
          "mt-1 text-[14px] font-medium tabular-nums " +
          (accent ? "text-[#d6b04f]" : "text-[#f4efe3]")
        }
      >
        {value}
      </div>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-[0.18em] text-[#cdc0a4]">{label}</span>
      {children}
    </label>
  )
}

const inputClass =
  "w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-[14px] text-[#f4ead6] " +
  "focus:border-[#d6b04f] focus:outline-none focus:ring-2 focus:ring-[#d6b04f]/30 " +
  "placeholder:text-[#cdc0a4]/50 disabled:opacity-50"

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}
