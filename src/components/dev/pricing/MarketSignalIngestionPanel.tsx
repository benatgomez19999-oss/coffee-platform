"use client"

import { useEffect, useMemo, useState } from "react"
import {
  buildMarketSignalTickSeries,
  type MarketSignalTickSeries,
  type MarketSignalTickSeriesPoint,
} from "@/src/services/pricing/marketSignalTickSeries.pure"

//////////////////////////////////////////////////////
// 📡 MARKET SIGNAL INGESTION PANEL
//
// Two-step workflow:
//   1. Preview → /api/internal/pricing/market-signal POST {apply:false}
//   2. Apply   → /api/internal/pricing/market-signal POST
//                {apply:true, confirm:"APPLY_MARKET_SIGNAL"}
//
// This panel NEVER triggers B2B price refresh. After apply,
// the operator is sent to /dev/pricing to inspect drift.
//////////////////////////////////////////////////////

const APPLY_CONFIRM_TOKEN = "APPLY_MARKET_SIGNAL"

const SOURCES = ["MANUAL", "API_FEED", "INTERNAL_COMPUTE", "AI_SYSTEM"] as const
type SourceOption = (typeof SOURCES)[number]

const CONFIDENCES = ["LOW", "MEDIUM", "HIGH", "OPERATOR_VERIFIED"] as const
type ConfidenceOption = (typeof CONFIDENCES)[number]

type RecentSnapshot = {
  id: string
  cPrice: number
  demandIndex: number
  source: string
  validFrom: string
  expiresAt: string | null
  isActive: boolean
  note: string | null
  createdAt: string
}

type Diagnostic = {
  code: string
  severity: "info" | "warning" | "error"
  message: string
}

type ProviderSummary = {
  id: string
  label: string
  kind: "MOCK" | "MANUAL" | "EXTERNAL_HTTP"
  description: string
  requiresApiKey: boolean
  configured: boolean
}

type ProviderCandidate = {
  cPrice: number
  demandIndex: number
  source: SourceOption
  note?: string | null
  provenance?: {
    provider?: string | null
    sourceName?: string | null
    sourceUrl?: string | null
    retrievedAt?: string | null
    rawValue?: number | null
    rawUnit?: string | null
    confidence?: ConfidenceOption | null
  } | null
}

type ProviderResult =
  | {
      ok: true
      providerId: string
      providerKind: string
      fetchedAt: string
      candidate: ProviderCandidate
      raw: unknown
      diagnostics: Diagnostic[]
    }
  | {
      ok: false
      providerId: string
      providerKind: string
      fetchedAt: string
      raw: unknown
      diagnostics: Diagnostic[]
    }

type TickInspectionPayload =
  | {
      ok: true
      generatedAt: string
      tick: {
        id: string
        providerId: string
        providerKind: string
        source: string
        cPrice: number
        demandIndex: number | null
        confidence: string | null
        rawUnit: string | null
        rawValue: number | null
        symbol: string | null
        contractMonth: string | null
        capturedAt: string
        validFrom: string | null
        expiresAt: string | null
        createdAt: string
        sourceName: string | null
        sourceUrl: string | null
        note: string | null
        diagnostics: unknown
        rawPayload: unknown
      }
      safety: {
        rawPayloadSanitised: boolean
        sourceUrlSanitised: boolean
        containsKnownSecretKeys: boolean
      }
    }
  | {
      ok: false
      generatedAt: string
      error: { code: string; message: string }
    }

type TickListItem = {
  id: string
  providerId: string
  providerKind: string
  source: string
  cPrice: number
  demandIndex: number | null
  confidence: string | null
  symbol: string | null
  contractMonth: string | null
  capturedAt: string
  validFrom: string | null
  expiresAt: string | null
  sourceName: string | null
  sourceUrl: string | null
  note: string | null
}

type ProviderPreview = {
  generatedAt: string
  provider: ProviderSummary | null
  providerResult: ProviderResult | null
  validation:
    | { ok: true; candidate: { cPrice: number; demandIndex: number; source: SourceOption } }
    | { ok: false; diagnostics: Diagnostic[] }
    | null
  previewCandidate: ProviderCandidate | null
  diagnostics: Diagnostic[]
  canApply: boolean
}

type Preview = {
  generatedAt: string
  ok: boolean
  diagnostics: Diagnostic[]
  candidate: {
    cPrice: number
    demandIndex: number
    source: SourceOption
    validFrom: string | Date
    expiresAt: string | Date | null
    provenance: {
      provider: string | null
      sourceName: string | null
      confidence: ConfidenceOption
      rawUnit: string
      retrievedAt: string | Date | null
    }
    note: string | null
  } | null
  activeBefore: {
    id: string | null
    cPrice: number | null
    demandIndex: number | null
    source: string | null
    validFrom: string | null
    expiresAt: string | null
    createdAt: string | null
    note: string | null
  }
  wouldDeactivateActive: boolean
  applied?: boolean
  createdSnapshot?: {
    id: string
    cPrice: number
    demandIndex: number
    isActive: boolean
  } | null
}

export default function MarketSignalIngestionPanel() {

  const [recent, setRecent] = useState<RecentSnapshot[]>([])
  const [active, setActive] = useState<RecentSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // form state
  const [cPriceStr, setCPriceStr] = useState<string>("290")
  const [demandStr, setDemandStr] = useState<string>("1.10")
  const [source, setSource] = useState<SourceOption>("MANUAL")
  const [note, setNote] = useState<string>("")
  const [validFrom, setValidFrom] = useState<string>("")
  const [expiresAt, setExpiresAt] = useState<string>("")
  const [provider, setProvider] = useState<string>("manual")
  const [sourceName, setSourceName] = useState<string>("Operator dashboard")
  const [sourceUrl, setSourceUrl] = useState<string>("")
  const [confidence, setConfidence] = useState<ConfidenceOption>("OPERATOR_VERIFIED")

  // result state
  const [preview, setPreview] = useState<Preview | null>(null)
  const [working, setWorking] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)

  // ── External provider preview (PRICING-FEED-2A) ──
  const [providerSummaries, setProviderSummaries] = useState<ProviderSummary[]>([])
  const [selectedProviderId, setSelectedProviderId] = useState<string>("mock-delayed-ice")
  const [providerScenario, setProviderScenario] =
    useState<"low" | "neutral" | "high">("neutral")
  const [providerPreview, setProviderPreview] =
    useState<ProviderPreview | null>(null)
  const [providerWorking, setProviderWorking] = useState<boolean>(false)
  const [providerErrorMsg, setProviderErrorMsg] = useState<string | null>(null)

  // ── Recent provider ticks (PRICING-FEED-3A) ──
  const [ticks, setTicks] = useState<TickListItem[]>([])
  const [ticksLoading, setTicksLoading] = useState<boolean>(true)
  const [ticksErrorMsg, setTicksErrorMsg] = useState<string | null>(null)
  const [recordingTick, setRecordingTick] = useState<boolean>(false)
  const [tickBanner, setTickBanner] = useState<string | null>(null)

  // PRICING-FEED-3B — derive intraday vs settlement audit series.
  const tickSeries = useMemo(
    () => buildMarketSignalTickSeries(ticks),
    [ticks],
  )

  // PRICING-FEED-3C — read-only tick inspector (modal).
  const [inspectingTickId, setInspectingTickId] = useState<string | null>(null)
  const [inspectionData, setInspectionData] = useState<TickInspectionPayload | null>(null)
  const [inspectionLoading, setInspectionLoading] = useState<boolean>(false)
  const [inspectionError, setInspectionError] = useState<string | null>(null)

  const loadRecent = async () => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const res = await fetch("/api/internal/pricing/market-signal", {
        credentials: "include",
        cache: "no-store",
      })
      if (!res.ok) throw new Error(`Load failed (${res.status})`)
      const body = await res.json() as { active: RecentSnapshot | null; recent: RecentSnapshot[] }
      setActive(body.active ?? null)
      setRecent(body.recent ?? [])
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Load failed")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRecent()
  }, [])

  // ─── External provider preview ──────────────────
  useEffect(() => {
    let cancelled = false
    const loadProviders = async () => {
      try {
        const res = await fetch("/api/internal/pricing/market-signal/providers", {
          credentials: "include",
          cache: "no-store",
        })
        if (!res.ok) return
        const body = await res.json() as { providers?: ProviderSummary[] }
        if (!cancelled && Array.isArray(body.providers)) {
          setProviderSummaries(body.providers)
        }
      } catch (err) {
        console.warn("[provider list] failed", err)
      }
    }
    loadProviders()
    return () => { cancelled = true }
  }, [])

  const onFetchProviderPreview = async () => {
    setProviderErrorMsg(null)
    setProviderPreview(null)
    try {
      setProviderWorking(true)
      const summary = providerSummaries.find((p) => p.id === selectedProviderId)
      const body: Record<string, unknown> = { providerId: selectedProviderId }
      if (summary?.kind === "MOCK") body.scenario = providerScenario
      const res = await fetch("/api/internal/pricing/market-signal/provider-preview", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json() as ProviderPreview & { error?: string }
      if (!res.ok && !(data as ProviderPreview)?.diagnostics?.length) {
        throw new Error(data?.error ?? `Provider preview failed (${res.status})`)
      }
      setProviderPreview(data as ProviderPreview)
    } catch (err) {
      setProviderErrorMsg(err instanceof Error ? err.message : "Provider preview failed")
    } finally {
      setProviderWorking(false)
    }
  }

  const loadTicks = async () => {
    setTicksErrorMsg(null)
    try {
      const res = await fetch("/api/internal/pricing/market-signal/ticks?limit=20", {
        credentials: "include",
        cache: "no-store",
      })
      if (!res.ok) throw new Error(`Tick list failed (${res.status})`)
      const body = await res.json() as { ticks?: TickListItem[] }
      setTicks(Array.isArray(body.ticks) ? body.ticks : [])
    } catch (err) {
      setTicksErrorMsg(err instanceof Error ? err.message : "Tick list failed")
    } finally {
      setTicksLoading(false)
    }
  }

  useEffect(() => {
    loadTicks()
  }, [])

  const openInspector = (id: string) => {
    setInspectingTickId(id)
    setInspectionData(null)
    setInspectionError(null)
  }

  const closeInspector = () => {
    setInspectingTickId(null)
    setInspectionData(null)
    setInspectionError(null)
  }

  useEffect(() => {
    if (!inspectingTickId) return
    let cancelled = false
    const load = async () => {
      setInspectionLoading(true)
      setInspectionError(null)
      try {
        const res = await fetch(
          `/api/internal/pricing/market-signal/ticks/${encodeURIComponent(inspectingTickId)}`,
          { credentials: "include", cache: "no-store" },
        )
        const body = (await res.json()) as TickInspectionPayload
        if (cancelled) return
        if (!res.ok || (!body.ok && body.error)) {
          setInspectionError(
            !body.ok ? body.error?.message ?? `Inspector failed (${res.status})`
                     : `Inspector failed (${res.status})`,
          )
          if (!body.ok) setInspectionData(body)
        } else {
          setInspectionData(body)
        }
      } catch (err) {
        if (!cancelled) {
          setInspectionError(err instanceof Error ? err.message : "Inspector failed")
        }
      } finally {
        if (!cancelled) setInspectionLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [inspectingTickId])

  const recordTick = async () => {
    setTickBanner(null)
    if (!providerPreview || !providerPreview.canApply) return
    try {
      setRecordingTick(true)
      const res = await fetch("/api/internal/pricing/market-signal/ticks", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preview: providerPreview }),
      })
      const body = await res.json() as {
        ok?: boolean
        applied?: boolean
        tick?: { providerId: string; cPrice: number } | null
        error?: string
      }
      if (!res.ok || !body.applied || !body.tick) {
        throw new Error(body?.error ?? `Tick record failed (${res.status})`)
      }
      setTickBanner(
        `Recorded tick: ${body.tick.providerId} cPrice ${body.tick.cPrice}.`,
      )
      await loadTicks()
    } catch (err) {
      setTickBanner(err instanceof Error ? err.message : "Tick record failed")
    } finally {
      setRecordingTick(false)
    }
  }

  const useCandidateInForm = () => {
    const candidate = providerPreview?.previewCandidate ?? providerPreview?.providerResult?.ok
      ? (providerPreview?.providerResult as Extract<ProviderResult, { ok: true }>)?.candidate
      : null
    const c = providerPreview?.previewCandidate ?? candidate
    if (!c) return
    setCPriceStr(String(c.cPrice))
    setDemandStr(String(c.demandIndex))
    setSource(c.source)
    if (c.note != null) setNote(c.note)
    const prov = c.provenance ?? null
    if (prov?.provider != null) setProvider(prov.provider)
    if (prov?.sourceName != null) setSourceName(prov.sourceName)
    if (prov?.sourceUrl != null) setSourceUrl(prov.sourceUrl)
    if (prov?.confidence != null) setConfidence(prov.confidence)
    setBanner("Candidate copied into the manual form. Run Preview signal → Apply signal to persist.")
  }

  function buildBody(): Record<string, unknown> {
    return {
      cPrice: Number(cPriceStr),
      demandIndex: Number(demandStr),
      source,
      note: note.trim().length > 0 ? note.trim() : undefined,
      validFrom: validFrom.length > 0 ? validFrom : undefined,
      expiresAt: expiresAt.length > 0 ? expiresAt : undefined,
      provenance: {
        provider: provider.trim() || null,
        sourceName: sourceName.trim() || null,
        sourceUrl: sourceUrl.trim() || null,
        retrievedAt: new Date().toISOString(),
        rawValue: Number(cPriceStr),
        rawUnit: "US_CENTS_PER_LB",
        confidence,
      },
    }
  }

  const onPreview = async () => {
    setBanner(null)
    setErrorMsg(null)
    try {
      setWorking(true)
      const res = await fetch("/api/internal/pricing/market-signal", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...buildBody(), apply: false }),
      })
      const body = await res.json() as Preview & { error?: string }
      setPreview(body as Preview)
      if (!res.ok && !body?.diagnostics?.length) {
        setErrorMsg(body?.error ?? `Preview failed (${res.status})`)
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Preview failed")
    } finally {
      setWorking(false)
    }
  }

  const onApply = async () => {
    setBanner(null)
    setErrorMsg(null)
    if (!confirm(
      "Apply this market signal?\n\n" +
      "It will deactivate the current active MarketSignalSnapshot and create a new one.\n" +
      "PricingSnapshot.clientB2BPricePerKg, contracts and demand intents will NOT change."
    )) {
      return
    }
    try {
      setWorking(true)
      const res = await fetch("/api/internal/pricing/market-signal", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...buildBody(),
          apply: true,
          confirm: APPLY_CONFIRM_TOKEN,
        }),
      })
      const body = await res.json() as Preview & { error?: string }
      setPreview(body as Preview)
      if (!res.ok) {
        setErrorMsg(body?.error ?? `Apply failed (${res.status})`)
      } else if (body.applied) {
        setBanner(
          `Applied. New active cPrice=${body.createdSnapshot?.cPrice} / demand=${body.createdSnapshot?.demandIndex}. ` +
          "Open /dev/pricing to preview B2B drift before applying any price refresh."
        )
        await loadRecent()
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Apply failed")
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f1e8] px-8 py-10">
      <div className="mx-auto max-w-7xl">

        {/* HEADER */}
        <div className="mb-8">
          <p className="text-[12px] uppercase tracking-[0.22em] text-[#9a7b55]">Dev Tools · Pricing</p>
          <h1 className="mt-2 text-3xl font-semibold text-[#2f2418]">Market signal ingestion</h1>
          <p className="mt-3 max-w-3xl text-sm text-[#6b5a45]">
            Controlled write path for{" "}
            <code className="rounded bg-[#ede4d4] px-1.5 py-0.5 font-mono text-[12px]">MarketSignalSnapshot</code>.
            Preview validates the candidate; apply replaces the current active snapshot.{" "}
            <strong>Does not</strong> recompute B2B prices — visit{" "}
            <a className="underline" href="/dev/pricing">/dev/pricing</a> after apply to preview drift and refresh
            persisted prices explicitly.
          </p>
        </div>

        {/* ACTIVE */}
        <Section emoji="📡" title="Active market signal">
          <ActiveCard active={active} loading={loading} />
        </Section>

        {/* RECENT */}
        <Section emoji="🗂️" title="Recent snapshots">
          <RecentTable rows={recent} loading={loading} />
        </Section>

        {/* EXTERNAL PROVIDER PREVIEW (PRICING-FEED-2A) */}
        <Section emoji="🛰️" title="External provider preview">
          <div className="rounded-2xl border-2 border-[#d8c5a8] bg-[#fbf7f0] p-6 shadow-[0_8px_24px_rgba(0,0,0,0.05)]">
            <p className="mb-4 text-[12.5px] text-[#7b6851]">
              Fetch a candidate from a registered provider. Preview-only — no DB writes,
              no B2B refresh. To persist, click <strong>Use this candidate in manual form</strong> and
              run the existing Preview signal → Apply signal flow below.
              <br />
              <span className="text-[11px] text-[#9a8b73]">
                Barchart preview fetch is read-only. Applying still requires the manual form confirmation.
              </span>
            </p>
            <div className="grid gap-5 lg:grid-cols-3">
              <Field label="Provider">
                <select
                  value={selectedProviderId}
                  onChange={(e) => setSelectedProviderId(e.target.value)}
                  className="w-full rounded-lg border border-[#cfb48a] bg-[#fffaf2] px-3 py-2 text-sm text-[#2f2418]"
                >
                  {providerSummaries.length === 0 && (
                    <option value="mock-delayed-ice">mock-delayed-ice</option>
                  )}
                  {providerSummaries.map((p) => (
                    <option key={p.id} value={p.id} disabled={!p.configured}>
                      {p.label} {p.configured ? "" : "(not configured)"}
                    </option>
                  ))}
                </select>
                {providerSummaries.find((p) => p.id === selectedProviderId)?.description && (
                  <p className="mt-1 text-[11px] text-[#9a8b73]">
                    {providerSummaries.find((p) => p.id === selectedProviderId)?.description}
                  </p>
                )}
              </Field>

              {providerSummaries.find((p) => p.id === selectedProviderId)?.kind === "MOCK" && (
                <Field label="Mock scenario">
                  <select
                    value={providerScenario}
                    onChange={(e) => setProviderScenario(e.target.value as "low" | "neutral" | "high")}
                    className="w-full rounded-lg border border-[#cfb48a] bg-[#fffaf2] px-3 py-2 text-sm text-[#2f2418]"
                  >
                    <option value="low">low (easing market)</option>
                    <option value="neutral">neutral (default)</option>
                    <option value="high">high (tight market)</option>
                  </select>
                </Field>
              )}

              <Field label=" ">
                <button
                  type="button"
                  onClick={onFetchProviderPreview}
                  disabled={providerWorking}
                  className="rounded-xl border border-[#cfb48a] bg-white px-4 py-3 text-sm font-medium text-[#5f472f] transition hover:bg-[#f7f2ea] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {providerWorking ? "Fetching…" : "Fetch provider preview"}
                </button>
              </Field>
            </div>

            {providerErrorMsg && (
              <p className="mt-3 rounded-lg border border-[#d8a89a] bg-[#fbf0eb] px-3 py-2 text-sm text-[#8a3a25]">
                {providerErrorMsg}
              </p>
            )}

            {providerPreview && (
              <ProviderPreviewBlock
                preview={providerPreview}
                onUseCandidate={useCandidateInForm}
              />
            )}

            {providerPreview && (
              <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[#e2d6bd] pt-4">
                <button
                  type="button"
                  onClick={recordTick}
                  disabled={
                    recordingTick ||
                    !providerPreview.canApply ||
                    !providerPreview.previewCandidate
                  }
                  title="Append-only audit row. Does NOT change the active MarketSignalSnapshot or refresh B2B prices."
                  className="rounded-xl border border-[#cfb48a] bg-[#fcf8f0] px-4 py-2.5 text-sm font-medium text-[#5f472f] transition hover:bg-[#f7efdf] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {recordingTick ? "Recording…" : "Record tick"}
                </button>
                <span className="text-[11px] text-[#9a8b73]">
                  Append-only audit. Does not change the active snapshot or B2B prices.
                </span>
                {tickBanner && (
                  <span className="rounded-md border border-[#b7cbb0] bg-[#f4f8f2] px-2.5 py-1 text-[12px] text-[#3a6b35]">
                    {tickBanner}
                  </span>
                )}
              </div>
            )}
          </div>
        </Section>

        {/* MARKET SIGNAL AUDIT (PRICING-FEED-3B) */}
        <Section emoji="🩺" title="Market signal audit">
          <MarketSignalAuditPanel
            series={tickSeries}
            loading={ticksLoading}
          />
        </Section>

        {/* RECENT TICKS (PRICING-FEED-3A) */}
        <Section emoji="📈" title="Recent provider ticks">
          <RecentTicksTable
            ticks={ticks}
            loading={ticksLoading}
            errorMsg={ticksErrorMsg}
            onInspect={openInspector}
          />
        </Section>

        {/* INSPECTOR MODAL (PRICING-FEED-3C) */}
        {inspectingTickId && (
          <TickInspectorModal
            data={inspectionData}
            loading={inspectionLoading}
            errorMsg={inspectionError}
            onClose={closeInspector}
          />
        )}

        {/* FORM */}
        <Section emoji="✍️" title="New signal">
          <div className="rounded-2xl border-2 border-[#d8c5a8] bg-[#fbf7f0] p-6 shadow-[0_8px_24px_rgba(0,0,0,0.05)]">
            <div className="grid gap-5 lg:grid-cols-2">
              <Field label="cPrice (US cents/lb · 50–600)">
                <input
                  type="number"
                  step="0.01"
                  value={cPriceStr}
                  onChange={(e) => setCPriceStr(e.target.value)}
                  className="w-full rounded-lg border border-[#cfb48a] bg-[#fffaf2] px-3 py-2 text-sm tabular-nums text-[#2f2418]"
                />
              </Field>
              <Field label="Demand index (0.8–1.2)">
                <input
                  type="number"
                  step="0.01"
                  value={demandStr}
                  onChange={(e) => setDemandStr(e.target.value)}
                  className="w-full rounded-lg border border-[#cfb48a] bg-[#fffaf2] px-3 py-2 text-sm tabular-nums text-[#2f2418]"
                />
              </Field>
              <Field label="Source">
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value as SourceOption)}
                  className="w-full rounded-lg border border-[#cfb48a] bg-[#fffaf2] px-3 py-2 text-sm text-[#2f2418]"
                >
                  {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Confidence">
                <select
                  value={confidence}
                  onChange={(e) => setConfidence(e.target.value as ConfidenceOption)}
                  className="w-full rounded-lg border border-[#cfb48a] bg-[#fffaf2] px-3 py-2 text-sm text-[#2f2418]"
                >
                  {CONFIDENCES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>

              <Field label="Provider (optional)">
                <input type="text" value={provider} onChange={(e) => setProvider(e.target.value)}
                  className="w-full rounded-lg border border-[#cfb48a] bg-[#fffaf2] px-3 py-2 text-sm text-[#2f2418]" />
              </Field>
              <Field label="Source name (optional)">
                <input type="text" value={sourceName} onChange={(e) => setSourceName(e.target.value)}
                  className="w-full rounded-lg border border-[#cfb48a] bg-[#fffaf2] px-3 py-2 text-sm text-[#2f2418]" />
              </Field>
              <Field label="Source URL (optional)">
                <input type="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)}
                  placeholder="https://…"
                  className="w-full rounded-lg border border-[#cfb48a] bg-[#fffaf2] px-3 py-2 text-sm text-[#2f2418]" />
              </Field>
              <Field label="User note (optional)">
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
                  placeholder="Operator context — embedded into PricingSnapshot.note for audit"
                  className="w-full rounded-lg border border-[#cfb48a] bg-[#fffaf2] px-3 py-2 text-sm text-[#2f2418]" />
              </Field>

              <Field label="Valid from (optional · datetime-local)">
                <input type="datetime-local" value={validFrom} onChange={(e) => setValidFrom(e.target.value)}
                  className="w-full rounded-lg border border-[#cfb48a] bg-[#fffaf2] px-3 py-2 text-sm text-[#2f2418]" />
              </Field>
              <Field label="Expires at (optional · datetime-local)">
                <input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)}
                  className="w-full rounded-lg border border-[#cfb48a] bg-[#fffaf2] px-3 py-2 text-sm text-[#2f2418]" />
              </Field>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onPreview}
                disabled={working}
                className="rounded-xl border border-[#cfb48a] bg-white px-4 py-3 text-sm font-medium text-[#5f472f] transition hover:bg-[#f7f2ea] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {working ? "Working…" : "Preview signal"}
              </button>
              <button
                type="button"
                onClick={onApply}
                disabled={working}
                className="rounded-xl border border-[#8d6641] bg-[#7a5230] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#6f4726] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {working ? "Applying…" : "Apply signal"}
              </button>
              <span className="self-center text-[11px] text-[#9a8b73]">
                Confirm token: <code className="rounded bg-[#ede4d4] px-1.5 py-0.5 font-mono">{APPLY_CONFIRM_TOKEN}</code>
              </span>
            </div>

            {banner && (
              <p className="mt-4 rounded-lg border border-[#b7cbb0] bg-[#f4f8f2] px-3 py-2 text-sm text-[#3a6b35]">
                {banner}
              </p>
            )}
            {errorMsg && (
              <p className="mt-3 rounded-lg border border-[#d8a89a] bg-[#fbf0eb] px-3 py-2 text-sm text-[#8a3a25]">
                {errorMsg}
              </p>
            )}
          </div>
        </Section>

        {/* DIAGNOSTICS */}
        {preview && (
          <Section emoji="🩺" title="Diagnostics">
            <DiagnosticsBlock preview={preview} />
          </Section>
        )}

        {/* NEXT STEP */}
        <Section emoji="➡️" title="Next step">
          <div className="rounded-2xl border border-dashed border-[#cdb89a] bg-[#fcfaf6] p-6 text-sm text-[#7b6851]">
            Apply only updates the active <code className="rounded bg-[#ede4d4] px-1.5 py-0.5 font-mono">MarketSignalSnapshot</code>.
            To preview B2B price drift and (optionally) refresh persisted prices, open{" "}
            <a className="font-medium text-[#7a5230] underline" href="/dev/pricing">/dev/pricing</a>.
          </div>
        </Section>
      </div>
    </div>
  )
}

// ------------------------------------------------------
// SUBCOMPONENTS
// ------------------------------------------------------

function Section({ emoji, title, children }: { emoji: string; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-12">
      <div className="mb-3 flex items-center gap-3">
        <span className="text-[15px]">{emoji}</span>
        <h2 className="text-[16px] font-semibold text-[#2f2418]">{title}</h2>
        <div className="ml-2 h-[1px] flex-1 bg-[#bfae92]/40" />
      </div>
      {children}
    </div>
  )
}

function ActiveCard({ active, loading }: { active: RecentSnapshot | null; loading: boolean }) {
  if (loading) return <p className="text-sm text-[#6b5a45]">Loading…</p>
  if (!active) {
    return (
      <div className="rounded-2xl border border-dashed border-[#cdb89a] bg-[#fcfaf6] p-6 text-sm text-[#7b6851]">
        No active <code className="rounded bg-[#ede4d4] px-1.5 py-0.5 font-mono">MarketSignalSnapshot</code>.
        The pricing engine is running deterministic (no cPrice / demand modifiers).
      </div>
    )
  }
  return (
    <div className="rounded-2xl border-2 border-[#d8c5a8] bg-[#fbf7f0] p-6 shadow-[0_8px_24px_rgba(0,0,0,0.05)]">
      <div className="grid gap-4 sm:grid-cols-3">
        <Cell label="cPrice (¢/lb)" value={active.cPrice.toFixed(1)} mono />
        <Cell label="Demand index"  value={active.demandIndex.toFixed(3)} mono />
        <Cell label="Source"        value={active.source} mono />
        <Cell label="Valid from"    value={fmtDate(active.validFrom)} mono />
        <Cell label="Expires at"    value={fmtDate(active.expiresAt)} mono />
        <Cell label="Created at"    value={fmtDate(active.createdAt)} mono />
      </div>
      {active.note && (
        <details className="mt-4 rounded-lg border border-[#e2d6bd] bg-[#fcfaf6] p-3">
          <summary className="cursor-pointer text-[11.5px] uppercase tracking-[0.18em] text-[#7a5230]">Note / provenance</summary>
          <pre className="mt-2 overflow-auto text-[11.5px] leading-relaxed text-[#2f2418]">{active.note}</pre>
        </details>
      )}
    </div>
  )
}

function RecentTable({ rows, loading }: { rows: RecentSnapshot[]; loading: boolean }) {
  if (loading) return <p className="text-sm text-[#6b5a45]">Loading…</p>
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#cdb89a] bg-[#fcfaf6] p-6 text-sm text-[#7b6851]">
        No snapshots yet. Use the form below to apply your first signal.
      </div>
    )
  }
  return (
    <div className="overflow-x-auto rounded-2xl border border-[#d8c5a8] bg-[#fbf7f0] shadow-[0_8px_24px_rgba(0,0,0,0.05)]">
      <table className="w-full text-left text-[12.5px]">
        <thead className="bg-[#f3e9d7] text-[10.5px] uppercase tracking-[0.16em] text-[#7a5230]">
          <tr>
            <Th>State</Th>
            <Th align="right">cPrice (¢/lb)</Th>
            <Th align="right">Demand</Th>
            <Th>Source</Th>
            <Th>Valid from</Th>
            <Th>Expires</Th>
            <Th>Created</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-[#e2d6bd] text-[#2f2418]">
              <Td>
                {r.isActive
                  ? <span className="rounded-full border border-[#b7cbb0] bg-[#e8f0e6] px-2 py-0.5 text-[10.5px] font-medium text-[#3a6b35]">active</span>
                  : <span className="rounded-full border border-[#cfb48a] bg-[#f3e9d7] px-2 py-0.5 text-[10.5px] font-medium text-[#7a5230]">inactive</span>}
              </Td>
              <Td align="right" mono>{r.cPrice.toFixed(1)}</Td>
              <Td align="right" mono>{r.demandIndex.toFixed(3)}</Td>
              <Td mono>{r.source}</Td>
              <Td mono>{fmtDate(r.validFrom)}</Td>
              <Td mono>{fmtDate(r.expiresAt)}</Td>
              <Td mono>{fmtDate(r.createdAt)}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DiagnosticsBlock({ preview }: { preview: Preview }) {
  return (
    <div className="space-y-3">
      <div
        className={`rounded-lg border px-4 py-3 text-sm ${
          preview.applied
            ? "border-[#b7cbb0] bg-[#f4f8f2] text-[#3a6b35]"
            : preview.ok
              ? "border-[#cfb48a] bg-[#fcfaf6] text-[#5f472f]"
              : "border-[#d8a89a] bg-[#fbf0eb] text-[#8a3a25]"
        }`}
      >
        {preview.applied
          ? `Applied at ${fmtDate(preview.generatedAt)}. New active snapshot id: ${preview.createdSnapshot?.id ?? "—"}.`
          : preview.ok
            ? `Preview OK (no DB writes). Would deactivate active: ${preview.wouldDeactivateActive ? "yes" : "no"}.`
            : `Validation failed (no DB writes).`}
      </div>
      {preview.diagnostics.length > 0 && (
        <ul className="space-y-1.5">
          {preview.diagnostics.map((d, i) => (
            <li
              key={i}
              className={`rounded-lg border px-3 py-2 text-[12.5px] ${
                d.severity === "error"
                  ? "border-[#d8a89a] bg-[#fbf0eb] text-[#8a3a25]"
                  : d.severity === "warning"
                    ? "border-[#d8c89a] bg-[#fef3d7] text-[#7a5c0a]"
                    : "border-[#b7cbb0] bg-[#f4f8f2] text-[#3a6b35]"
              }`}
            >
              <span className="font-mono text-[11px] mr-2">{d.code}</span>
              {d.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm text-[#5f472f]">
      <span className="text-[10px] uppercase tracking-[0.18em] text-[#9a8b73]">{label}</span>
      {children}
    </label>
  )
}

function Cell({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9a8b73]">{label}</div>
      <div className={`mt-1 text-[14px] text-[#2f2418] ${mono ? "tabular-nums font-mono text-[12.5px]" : "font-medium"}`}>
        {value}
      </div>
    </div>
  )
}

function Th({ children, align }: { children?: React.ReactNode; align?: "right" }) {
  return (
    <th className={`px-3 py-2 ${align === "right" ? "text-right" : "text-left"}`}>{children}</th>
  )
}

function Td({ children, align, mono }: { children: React.ReactNode; align?: "right"; mono?: boolean }) {
  return (
    <td className={[
      "px-3 py-2",
      align === "right" ? "text-right" : "",
      mono ? "tabular-nums font-mono text-[12px]" : "",
    ].join(" ").trim()}>
      {children}
    </td>
  )
}

// ------------------------------------------------------
// MARKET SIGNAL AUDIT (PRICING-FEED-3B)
// ------------------------------------------------------

function MarketSignalAuditPanel({
  series, loading,
}: {
  series: MarketSignalTickSeries
  loading: boolean
}) {
  if (loading) return <p className="text-sm text-[#6b5a45]">Loading audit data…</p>

  const hasAnything = series.points.length > 0
  if (!hasAnything) {
    return (
      <div className="rounded-2xl border border-dashed border-[#cdb89a] bg-[#fcfaf6] p-6 text-sm text-[#7b6851]">
        Audit chart appears once at least one provider tick is recorded. Use the
        Record tick button above (intraday or settlement) to populate it.
      </div>
    )
  }

  const intraday = series.latestIntraday
  const settlement = series.latestSettlement
  const delta = series.deltaIntradayVsSettlement

  return (
    <div className="rounded-2xl border-2 border-[#d8c5a8] bg-[#fbf7f0] p-6 shadow-[0_8px_24px_rgba(0,0,0,0.05)]">
      {/* SUMMARY GRID */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AuditCell
          label="Latest intraday"
          value={intraday ? `${intraday.cPrice.toFixed(2)} ¢/lb` : "—"}
          sub={intraday ? fmtDate(intraday.capturedAt) : "No intraday tick yet"}
          accent="amber"
        />
        <AuditCell
          label="Latest settlement"
          value={settlement ? `${settlement.cPrice.toFixed(2)} ¢/lb` : "—"}
          sub={settlement ? fmtDate(settlement.capturedAt) : "No settlement tick yet"}
          accent="emerald"
        />
        <AuditCell
          label="Δ intraday − settlement"
          value={
            delta
              ? `${delta.absolute > 0 ? "+" : ""}${delta.absolute.toFixed(2)} ¢/lb`
              : "—"
          }
          sub={
            delta
              ? `${delta.percent > 0 ? "+" : ""}${delta.percent.toFixed(2)}%`
              : "Need both providers"
          }
          accent={delta == null ? "muted" : delta.absolute >= 0 ? "amber" : "emerald"}
        />
        <AuditCell
          label="Latest confidence"
          value={settlement?.confidence ?? intraday?.confidence ?? "—"}
          sub={`${series.points.length} tick${series.points.length === 1 ? "" : "s"} in window`}
          accent="muted"
        />
      </div>

      {/* CHART */}
      <div className="mt-6">
        <TickSparkline series={series} />
      </div>

      <p className="mt-4 text-[11.5px] text-[#9a8b73]">
        Read-only audit. Recording or charting ticks does not change the active
        MarketSignalSnapshot, persisted B2B prices, contracts or demand intents.
      </p>
    </div>
  )
}

function AuditCell({
  label, value, sub, accent,
}: {
  label: string
  value: string
  sub: string
  accent: "amber" | "emerald" | "muted"
}) {
  const valueColor =
    accent === "amber"   ? "#7a5230" :
    accent === "emerald" ? "#3a6b35" :
                           "#2f2418"
  return (
    <div className="rounded-xl border border-[#e2d6bd] bg-[#fcfaf6] p-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9a8b73]">
        {label}
      </div>
      <div
        className="mt-1 text-[18px] font-semibold tabular-nums"
        style={{ color: valueColor, letterSpacing: "-0.01em" }}
        title={value}
      >
        {value}
      </div>
      <div className="mt-1 text-[11px] text-[#7b6851]">{sub}</div>
    </div>
  )
}

// Tiny SVG sparkline. No deps. Two polylines + dots. Mock points
// rendered muted. Uses real-time scaling along the x axis so an
// irregular sample window still reads correctly.
function TickSparkline({ series }: { series: MarketSignalTickSeries }) {

  const VIEW_W = 700
  const VIEW_H = 180
  const PAD_X = 28
  const PAD_TOP = 14
  const PAD_BOTTOM = 22

  // No usable points → empty state.
  if (series.points.length === 0 || series.cPriceMin == null || series.cPriceMax == null) {
    return (
      <div className="rounded-lg border border-dashed border-[#d8c5a8] bg-[#fcfaf6] p-4 text-[12px] text-[#7b6851]">
        No tick data yet. Record at least one provider tick to populate the chart.
      </div>
    )
  }

  // Time range
  const tMin = Date.parse(series.points[0].capturedAt)
  const tMax = Date.parse(series.points[series.points.length - 1].capturedAt)
  const tSpan = Math.max(1, tMax - tMin) // avoid div-by-zero with 1 point

  // Price range with 5% padding so flat lines don't sit on the axis.
  const yMinRaw = series.cPriceMin
  const yMaxRaw = series.cPriceMax
  const yPad = Math.max(0.5, (yMaxRaw - yMinRaw) * 0.05)
  const yMin = yMinRaw - yPad
  const yMax = yMaxRaw + yPad
  const ySpan = Math.max(1e-6, yMax - yMin)

  function xOf(iso: string): number {
    if (series.points.length === 1) return VIEW_W / 2
    const t = Date.parse(iso)
    const ratio = (t - tMin) / tSpan
    return PAD_X + ratio * (VIEW_W - 2 * PAD_X)
  }

  function yOf(price: number): number {
    const ratio = (price - yMin) / ySpan
    // SVG y grows downward — invert.
    return PAD_TOP + (1 - ratio) * (VIEW_H - PAD_TOP - PAD_BOTTOM)
  }

  function pointsAttr(pts: MarketSignalTickSeriesPoint[]): string {
    return pts.map((p) => `${xOf(p.capturedAt).toFixed(2)},${yOf(p.cPrice).toFixed(2)}`).join(" ")
  }

  const intradayPts = series.intradayPoints
  const settlementPts = series.settlementPoints
  const mockPts = series.mockPoints

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="none"
        className="block w-full"
        style={{ maxHeight: 220 }}
      >
        {/* Background frame */}
        <rect
          x={0.5} y={0.5}
          width={VIEW_W - 1} height={VIEW_H - 1}
          fill="#fcfaf6"
          stroke="#e2d6bd"
          strokeWidth={1}
          rx={8}
        />
        {/* Y range labels */}
        <text x={6} y={PAD_TOP + 2}
              fontSize={9} fill="#9a8b73" fontFamily="ui-monospace, monospace">
          {yMaxRaw.toFixed(1)}
        </text>
        <text x={6} y={VIEW_H - PAD_BOTTOM + 10}
              fontSize={9} fill="#9a8b73" fontFamily="ui-monospace, monospace">
          {yMinRaw.toFixed(1)}
        </text>

        {/* Mock points first so they sit behind the real series */}
        {mockPts.length >= 2 && (
          <polyline
            fill="none"
            stroke="#bfae92"
            strokeOpacity={0.5}
            strokeWidth={1.25}
            strokeDasharray="3 3"
            points={pointsAttr(mockPts)}
          />
        )}
        {mockPts.map((p) => (
          <circle
            key={p.id}
            cx={xOf(p.capturedAt)}
            cy={yOf(p.cPrice)}
            r={2.5}
            fill="#bfae92"
            opacity={0.6}
          />
        ))}

        {/* Intraday line + dots */}
        {intradayPts.length >= 2 && (
          <polyline
            fill="none"
            stroke="#d6a04b"
            strokeWidth={1.6}
            points={pointsAttr(intradayPts)}
          />
        )}
        {intradayPts.map((p) => (
          <circle
            key={p.id}
            cx={xOf(p.capturedAt)}
            cy={yOf(p.cPrice)}
            r={3}
            fill="#d6a04b"
          />
        ))}

        {/* Settlement line + dots */}
        {settlementPts.length >= 2 && (
          <polyline
            fill="none"
            stroke="#3a6b35"
            strokeWidth={1.6}
            points={pointsAttr(settlementPts)}
          />
        )}
        {settlementPts.map((p) => (
          <circle
            key={p.id}
            cx={xOf(p.capturedAt)}
            cy={yOf(p.cPrice)}
            r={3}
            fill="#3a6b35"
          />
        ))}

        {/* Time range labels */}
        <text x={PAD_X} y={VIEW_H - 4}
              fontSize={9} fill="#9a8b73" fontFamily="ui-monospace, monospace">
          {fmtDate(series.points[0].capturedAt)}
        </text>
        <text x={VIEW_W - PAD_X} y={VIEW_H - 4}
              fontSize={9} fill="#9a8b73" fontFamily="ui-monospace, monospace"
              textAnchor="end">
          {fmtDate(series.points[series.points.length - 1].capturedAt)}
        </text>
      </svg>

      {/* Legend */}
      <div className="mt-2 flex flex-wrap gap-4 text-[11px] text-[#7b6851]">
        <LegendDot color="#d6a04b" label="intraday" />
        <LegendDot color="#3a6b35" label="settlement" />
        <LegendDot color="#bfae92" label="mock (muted)" />
        <span className="text-[#9a8b73]">
          y axis: cPrice (¢/lb) · x axis: capturedAt
        </span>
      </div>
    </div>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  )
}

function RecentTicksTable({
  ticks, loading, errorMsg, onInspect,
}: {
  ticks: TickListItem[]
  loading: boolean
  errorMsg: string | null
  onInspect: (id: string) => void
}) {
  if (loading) return <p className="text-sm text-[#6b5a45]">Loading ticks…</p>
  if (errorMsg) {
    return (
      <p className="rounded-lg border border-[#d8a89a] bg-[#fbf0eb] px-3 py-2 text-sm text-[#8a3a25]">
        {errorMsg}
      </p>
    )
  }
  if (ticks.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#cdb89a] bg-[#fcfaf6] p-6 text-sm text-[#7b6851]">
        No ticks recorded yet. Fetch a provider preview above and click{" "}
        <strong>Record tick</strong> to append one.
      </div>
    )
  }
  return (
    <div className="overflow-x-auto rounded-2xl border border-[#d8c5a8] bg-[#fbf7f0] shadow-[0_8px_24px_rgba(0,0,0,0.05)]">
      <table className="w-full text-left text-[12.5px]">
        <thead className="bg-[#f3e9d7] text-[10.5px] uppercase tracking-[0.16em] text-[#7a5230]">
          <tr>
            <Th>Captured</Th>
            <Th>Provider</Th>
            <Th>Source</Th>
            <Th align="right">cPrice (¢/lb)</Th>
            <Th align="right">Demand</Th>
            <Th>Confidence</Th>
            <Th>Symbol</Th>
            <Th>Note</Th>
            <Th></Th>
          </tr>
        </thead>
        <tbody>
          {ticks.map((t) => (
            <tr key={t.id} className="border-t border-[#e2d6bd] text-[#2f2418]">
              <Td mono>{fmtDate(t.capturedAt)}</Td>
              <Td mono>
                <span title={t.providerId}>{t.providerId}</span>
                <span className="ml-1 inline-block rounded-full border border-[#cfb48a] bg-[#f3e9d7] px-1.5 py-0 text-[9.5px] uppercase tracking-[0.06em] text-[#7a5230]">
                  {kindBadgeLabel(t.providerId, t.providerKind)}
                </span>
              </Td>
              <Td mono>{t.source}</Td>
              <Td align="right" mono>{t.cPrice.toFixed(2)}</Td>
              <Td align="right" mono>
                {t.demandIndex != null ? t.demandIndex.toFixed(3) : "—"}
              </Td>
              <Td mono>{t.confidence ?? "—"}</Td>
              <Td mono>{t.symbol ?? "—"}</Td>
              <Td>
                <span
                  className="block max-w-[420px] truncate text-[#7b6851]"
                  title={t.note ?? ""}
                >
                  {t.note ?? ""}
                </span>
              </Td>
              <Td>
                <button
                  type="button"
                  onClick={() => onInspect(t.id)}
                  className="rounded-md border border-[#cfb48a] bg-white px-2.5 py-1 text-[11px] font-medium text-[#5f472f] transition hover:bg-[#f7f2ea]"
                >
                  Inspect
                </button>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ------------------------------------------------------
// TICK INSPECTOR MODAL (PRICING-FEED-3C)
// ------------------------------------------------------

function TickInspectorModal({
  data, loading, errorMsg, onClose,
}: {
  data: TickInspectionPayload | null
  loading: boolean
  errorMsg: string | null
  onClose: () => void
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "rgba(15, 12, 8, 0.55)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        overflowY: "auto",
        padding: "40px 16px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 880,
          background: "#fbf7f0",
          border: "2px solid #d8c5a8",
          borderRadius: 16,
          boxShadow: "0 24px 60px rgba(0,0,0,0.25)",
          padding: 24,
        }}
      >
        {/* HEADER */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-[#9a7b55]">
              Dev Tools · Tick inspector
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[#2f2418]">
              MarketSignalTick · read-only
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close inspector"
            className="rounded-lg border border-[#cfb48a] bg-white px-3 py-1.5 text-sm font-medium text-[#5f472f] hover:bg-[#f7f2ea]"
          >
            Close
          </button>
        </div>

        {/* BODY */}
        {loading && (
          <p className="text-sm text-[#6b5a45]">Loading…</p>
        )}

        {!loading && errorMsg && (
          <div className="rounded-lg border border-[#d8a89a] bg-[#fbf0eb] p-4">
            <div className="text-sm font-semibold text-[#8a3a25]">
              {data && !data.ok ? data.error.code : "Inspector error"}
            </div>
            <p className="mt-1 text-[12.5px] text-[#7b6851]">{errorMsg}</p>
          </div>
        )}

        {!loading && !errorMsg && data?.ok && (
          <TickInspectorBody data={data} />
        )}
      </div>
    </div>
  )
}

function TickInspectorBody({
  data,
}: {
  data: Extract<TickInspectionPayload, { ok: true }>
}) {

  const t = data.tick
  const s = data.safety

  return (
    <>
      {/* SAFETY BANNER */}
      <div
        className={`mb-4 rounded-lg border px-3 py-2 text-[12.5px] ${
          s.rawPayloadSanitised || s.sourceUrlSanitised || s.containsKnownSecretKeys
            ? "border-[#d8c89a] bg-[#fef3d7] text-[#7a5c0a]"
            : "border-[#b7cbb0] bg-[#f4f8f2] text-[#3a6b35]"
        }`}
      >
        {s.rawPayloadSanitised || s.sourceUrlSanitised || s.containsKnownSecretKeys ? (
          <span>
            Payload was sanitised before display
            {s.containsKnownSecretKeys ? " (known secret-looking keys redacted)" : ""}
            {s.sourceUrlSanitised ? " · sourceUrl scrubbed" : ""}
            .
          </span>
        ) : (
          <span>No known secret keys detected. Payload preserved as stored.</span>
        )}
      </div>

      {/* IDENTITY GRID */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Cell label="Tick id"          value={t.id} mono />
        <Cell label="Provider"         value={`${t.providerId} (${t.providerKind})`} mono />
        <Cell label="Source"           value={t.source} mono />
        <Cell label="cPrice (¢/lb)"    value={t.cPrice.toFixed(2)} mono />
        <Cell label="Demand index"     value={t.demandIndex != null ? t.demandIndex.toFixed(3) : "—"} mono />
        <Cell label="Confidence"       value={t.confidence ?? "—"} mono />
        <Cell label="Symbol"           value={t.symbol ?? "—"} mono />
        <Cell label="Contract month"   value={t.contractMonth ?? "—"} mono />
        <Cell label="Raw value"        value={t.rawValue != null ? String(t.rawValue) : "—"} mono />
        <Cell label="Raw unit"         value={t.rawUnit ?? "—"} mono />
        <Cell label="Captured at"      value={fmtDate(t.capturedAt)} mono />
        <Cell label="Created at"       value={fmtDate(t.createdAt)} mono />
        <Cell label="Valid from"       value={fmtDate(t.validFrom)} mono />
        <Cell label="Expires at"       value={fmtDate(t.expiresAt)} mono />
        <Cell label="Source name"      value={t.sourceName ?? "—"} mono />
      </div>

      {/* SOURCE URL + NOTE */}
      {t.sourceUrl && (
        <div className="mt-4 rounded-lg border border-[#e2d6bd] bg-[#fcfaf6] px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9a8b73]">Source URL</div>
          <div className="mt-1 break-all font-mono text-[11.5px] text-[#2f2418]">{t.sourceUrl}</div>
        </div>
      )}
      {t.note && (
        <div className="mt-3 rounded-lg border border-[#e2d6bd] bg-[#fcfaf6] px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9a8b73]">Note</div>
          <pre className="mt-1 whitespace-pre-wrap text-[12px] text-[#2f2418]">{t.note}</pre>
        </div>
      )}

      {/* DIAGNOSTICS */}
      <div className="mt-4">
        <DiagnosticsView value={t.diagnostics} />
      </div>

      {/* RAW PAYLOAD */}
      <details className="mt-4 rounded-lg border border-[#e2d6bd] bg-[#fcfaf6]">
        <summary className="cursor-pointer px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-[#7a5230]">
          Raw provider payload (read-only)
        </summary>
        <pre className="max-h-[420px] overflow-auto px-3 pb-3 text-[11.5px] leading-relaxed text-[#2f2418]">
          {t.rawPayload == null
            ? "— null —"
            : JSON.stringify(t.rawPayload, null, 2)}
        </pre>
      </details>

      <p className="mt-3 text-[11px] text-[#9a8b73]">
        Read-only inspector. Does not change the active MarketSignalSnapshot,
        persisted B2B prices, contracts or demand intents.
      </p>
    </>
  )
}

function DiagnosticsView({ value }: { value: unknown }) {
  if (value == null) {
    return (
      <div className="rounded-lg border border-dashed border-[#cdb89a] bg-[#fcfaf6] px-3 py-2 text-[12px] text-[#7b6851]">
        No diagnostics recorded for this tick.
      </div>
    )
  }
  // If diagnostics is an array of { code, severity, message } items render a tidy list.
  if (Array.isArray(value) && value.length > 0 && value.every(isDiagnosticItem)) {
    return (
      <ul className="space-y-1.5">
        {value.map((d, i) => (
          <li
            key={i}
            className={`rounded-lg border px-3 py-2 text-[12px] ${
              d.severity === "error"
                ? "border-[#d8a89a] bg-[#fbf0eb] text-[#8a3a25]"
                : d.severity === "warning"
                  ? "border-[#d8c89a] bg-[#fef3d7] text-[#7a5c0a]"
                  : "border-[#b7cbb0] bg-[#f4f8f2] text-[#3a6b35]"
            }`}
          >
            <span className="font-mono text-[10.5px] mr-2">{String(d.code)}</span>
            {String(d.message)}
          </li>
        ))}
      </ul>
    )
  }
  // Fallback: pretty JSON.
  return (
    <details className="rounded-lg border border-[#e2d6bd] bg-[#fcfaf6]" open>
      <summary className="cursor-pointer px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-[#7a5230]">
        Diagnostics (raw)
      </summary>
      <pre className="max-h-[260px] overflow-auto px-3 pb-3 text-[11.5px] leading-relaxed text-[#2f2418]">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  )
}

function isDiagnosticItem(value: unknown): value is { code: unknown; severity: string; message: unknown } {
  if (value === null || typeof value !== "object") return false
  const obj = value as Record<string, unknown>
  return (
    "code" in obj &&
    typeof obj.severity === "string" &&
    "message" in obj
  )
}

function kindBadgeLabel(providerId: string, providerKind: string): string {
  if (providerId === "barchart-settlement-preview") return "settlement"
  if (providerId === "barchart-preview") return "intraday"
  return providerKind.toLowerCase()
}

function ProviderPreviewBlock({
  preview, onUseCandidate,
}: {
  preview: ProviderPreview
  onUseCandidate: () => void
}) {
  const candidate = preview.previewCandidate ??
    (preview.providerResult?.ok ? preview.providerResult.candidate : null)
  const providerOk = preview.providerResult?.ok === true
  const validationOk = preview.validation?.ok === true

  return (
    <div className="mt-5 space-y-4">
      <div
        className={`rounded-lg border px-4 py-3 text-sm ${
          preview.canApply
            ? "border-[#b7cbb0] bg-[#f4f8f2] text-[#3a6b35]"
            : providerOk
              ? "border-[#d8c89a] bg-[#fef3d7] text-[#7a5c0a]"
              : "border-[#d8a89a] bg-[#fbf0eb] text-[#8a3a25]"
        }`}
      >
        Provider: <strong>{preview.provider?.label ?? "—"}</strong>
        {preview.providerResult?.fetchedAt && (
          <> · fetched {fmtDate(preview.providerResult.fetchedAt)}</>
        )}
        <> · {preview.canApply ? "Validated — ready to copy into the manual form." :
          providerOk ? "Provider returned a candidate but validation reported issues." :
          "Provider could not produce a candidate."}</>
      </div>

      {candidate && (
        <div className="grid gap-4 sm:grid-cols-3 rounded-lg border border-[#e2d6bd] bg-[#fcfaf6] p-4">
          <Cell label="cPrice (¢/lb)" value={candidate.cPrice.toFixed(2)} mono />
          <Cell label="Demand index"  value={candidate.demandIndex.toFixed(3)} mono />
          <Cell label="Source"        value={candidate.source} mono />
          <Cell label="Provider"      value={candidate.provenance?.provider ?? "—"} mono />
          <Cell label="Source name"   value={candidate.provenance?.sourceName ?? "—"} mono />
          <Cell label="Confidence"    value={candidate.provenance?.confidence ?? "—"} mono />
        </div>
      )}

      {preview.diagnostics.length > 0 && (
        <ul className="space-y-1.5">
          {preview.diagnostics.map((d, i) => (
            <li
              key={i}
              className={`rounded-lg border px-3 py-2 text-[12px] ${
                d.severity === "error"
                  ? "border-[#d8a89a] bg-[#fbf0eb] text-[#8a3a25]"
                  : d.severity === "warning"
                    ? "border-[#d8c89a] bg-[#fef3d7] text-[#7a5c0a]"
                    : "border-[#b7cbb0] bg-[#f4f8f2] text-[#3a6b35]"
              }`}
            >
              <span className="font-mono text-[10.5px] mr-2">{d.code}</span>
              {d.message}
            </li>
          ))}
        </ul>
      )}

      {preview.providerResult?.raw != null && (
        <details className="rounded-lg border border-[#e2d6bd] bg-[#fcfaf6] p-3">
          <summary className="cursor-pointer text-[11px] uppercase tracking-[0.18em] text-[#7a5230]">
            Raw provider payload
          </summary>
          <pre className="mt-2 max-h-[280px] overflow-auto text-[11.5px] leading-relaxed text-[#2f2418]">
            {JSON.stringify(preview.providerResult.raw, null, 2)}
          </pre>
        </details>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onUseCandidate}
          disabled={!candidate}
          className="rounded-xl border border-[#8d6641] bg-[#7a5230] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#6f4726] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Use this candidate in manual form
        </button>
        <span className="self-center text-[11px] text-[#9a8b73]">
          Apply still requires confirm token in the manual form below.
        </span>
      </div>
    </div>
  )
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return "—"
  return new Date(t).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}
