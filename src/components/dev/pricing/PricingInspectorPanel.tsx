"use client"

import { useEffect, useState } from "react"

//////////////////////////////////////////////////////
// 🔬 PRICING INSPECTOR PANEL — dev only
//
// Calls /api/internal/pricing/client-b2b-refresh (GET)
// for the dry-run preview, and POSTs with apply=true +
// confirm token when the user explicitly confirms.
//
// Visual style mirrors /dev/scenarios/lots — calm cream
// + amber, no marketing chrome.
//////////////////////////////////////////////////////

const APPLY_CONFIRM_TOKEN = "REFRESH_CLIENT_B2B_PRICES"

type MarketSignal = {
  id: string | null
  cPrice: number | null
  demandIndex: number | null
  source: string | null
  validFrom: string | null
  expiresAt: string | null
}

type PricingSource =
  | "PERSISTED_CLIENT_B2B"
  | "RECOMPUTED_CLIENT_B2B"
  | "LEGACY_GREEN_EQUIVALENT"
  | "NO_PRICE"

type RefreshRow = {
  greenLotId: string
  lotNumber: string
  lotName: string | null
  status: string
  variety: string
  process: string
  scaScore: number | null
  altitude: number | null
  country: string | null
  roastYield: number
  persistedClientB2BPricePerKg: number | null
  recomputedClientB2BPricePerKg: number | null
  legacyGreenEquivalentPricePerKg: number | null
  deltaAbsolute: number | null
  deltaPercent: number | null
  pricingSourceBefore: PricingSource
  pricingSourceAfter: PricingSource
  recomputedPricingVersion: string | null
  recomputedPricingMode: string | null
  applied: boolean
  skipped: boolean
  skipReason?: string
  warnings: string[]
}

type RefreshSummary = {
  generatedAt: string
  mode: "dry_run" | "apply"
  applied: boolean
  count: number
  updatedCount: number
  skippedCount: number
  averageDeltaPercent: number | null
  maxDeltaPercent: number | null
  marketSignal: MarketSignal
  results: RefreshRow[]
}

export default function PricingInspectorPanel() {

  const [summary, setSummary] = useState<RefreshSummary | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [working, setWorking] = useState<boolean>(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [banner, setBanner] = useState<string | null>(null)

  const loadPreview = async () => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const res = await fetch("/api/internal/pricing/client-b2b-refresh", {
        credentials: "include",
        cache: "no-store",
      })
      if (!res.ok) throw new Error(`Preview failed (${res.status})`)
      const body = (await res.json()) as RefreshSummary
      setSummary(body)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Preview failed")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPreview()
  }, [])

  const onPreview = async () => {
    setBanner(null)
    await loadPreview()
  }

  const onApply = async () => {
    setBanner(null)
    setErrorMsg(null)
    if (!confirm(
      "Apply refresh and update PricingSnapshot.clientB2BPricePerKg for every eligible lot?\n\n" +
      "Existing contracts and demand intents will NOT change."
    )) {
      return
    }

    try {
      setWorking(true)
      const res = await fetch("/api/internal/pricing/client-b2b-refresh", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apply: true,
          confirm: APPLY_CONFIRM_TOKEN,
        }),
      })
      const body = await res.json()
      if (!res.ok) {
        const msg = (body && typeof body.error === "string") ? body.error : `Apply failed (${res.status})`
        throw new Error(msg)
      }
      const sum = body as RefreshSummary
      setSummary(sum)
      setBanner(
        `Apply complete — updated ${sum.updatedCount} / ${sum.count}, skipped ${sum.skippedCount}.`
      )
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
          <p className="text-[12px] uppercase tracking-[0.22em] text-[#9a7b55]">
            Dev Tools
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-[#2f2418]">
            Pricing Inspector
          </h1>
          <p className="mt-3 max-w-3xl text-sm text-[#6b5a45]">
            Read-only audit of <code className="rounded bg-[#ede4d4] px-1.5 py-0.5 font-mono text-[12px]">PricingSnapshot.clientB2BPricePerKg</code>
            {" "}vs the recomputed target-anchored adaptive B2B price. Apply mode
            updates only the B2B fields — existing contracts and demand intents
            stay historical.
          </p>
        </div>

        {/* MARKET SIGNAL */}
        <Section emoji="📡" title="Active market signal">
          <MarketSignalCard signal={summary?.marketSignal ?? null} />
          <div className="mt-3">
            <a
              href="/dev/market-signal"
              className="inline-block rounded-lg border border-[#cfb48a] bg-white px-3 py-2 text-[12px] font-medium text-[#5f472f] transition hover:bg-[#f7f2ea]"
            >
              Manage market signal →
            </a>
          </div>
        </Section>

        {/* SUMMARY + ACTIONS */}
        <Section emoji="🧮" title="Summary">
          <div className="rounded-2xl border-2 border-[#d8c5a8] bg-[#fbf7f0] p-6 shadow-[0_8px_24px_rgba(0,0,0,0.05)]">
            <div className="grid gap-4 sm:grid-cols-3">
              <SummaryCell label="Lots evaluated" value={summary ? String(summary.count) : "—"} />
              <SummaryCell
                label={summary?.applied ? "Updated" : "Would update"}
                value={summary ? String(summary.updatedCount) : "—"}
              />
              <SummaryCell label="Skipped" value={summary ? String(summary.skippedCount) : "—"} />
              <SummaryCell
                label="Avg delta %"
                value={
                  summary?.averageDeltaPercent != null
                    ? `${summary.averageDeltaPercent.toFixed(2)}%`
                    : "—"
                }
              />
              <SummaryCell
                label="Max |delta %|"
                value={
                  summary?.maxDeltaPercent != null
                    ? `${summary.maxDeltaPercent.toFixed(2)}%`
                    : "—"
                }
              />
              <SummaryCell
                label="Mode"
                value={summary?.mode ?? "—"}
                mono
              />
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onPreview}
                disabled={loading || working}
                className="rounded-xl border border-[#cfb48a] bg-white px-4 py-3 text-sm font-medium text-[#5f472f] transition hover:bg-[#f7f2ea] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Loading…" : "Preview refresh"}
              </button>
              <button
                type="button"
                onClick={onApply}
                disabled={loading || working || (summary?.count ?? 0) === 0}
                className="rounded-xl border border-[#8d6641] bg-[#7a5230] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#6f4726] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {working ? "Applying…" : "Apply refresh"}
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

        {/* RESULTS */}
        <Section emoji="📋" title="Per-lot results">
          {loading && !summary ? (
            <p className="text-sm text-[#6b5a45]">Loading…</p>
          ) : !summary || summary.results.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#cdb89a] bg-[#fcfaf6] p-8 text-sm text-[#7b6851]">
              No eligible lots found. Seed dev scenarios via{" "}
              <a className="underline" href="/dev/scenarios/lots">/dev/scenarios/lots</a>{" "}
              and reload.
            </div>
          ) : (
            <ResultsTable rows={summary.results} />
          )}
        </Section>
      </div>
    </div>
  )
}

// ------------------------------------------------------
// SUBCOMPONENTS
// ------------------------------------------------------

function Section({
  emoji,
  title,
  children,
}: {
  emoji: string
  title: string
  children: React.ReactNode
}) {
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

function MarketSignalCard({ signal }: { signal: MarketSignal | null }) {
  if (!signal || !signal.id) {
    return (
      <div className="rounded-2xl border border-dashed border-[#cdb89a] bg-[#fcfaf6] p-6 text-sm text-[#7b6851]">
        No active <code className="rounded bg-[#ede4d4] px-1.5 py-0.5 font-mono">MarketSignalSnapshot</code>.
        Pricing recompute runs deterministic (no cPrice / demand modifiers).
      </div>
    )
  }
  return (
    <div className="rounded-2xl border-2 border-[#d8c5a8] bg-[#fbf7f0] p-6 shadow-[0_8px_24px_rgba(0,0,0,0.05)]">
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCell label="cPrice (¢/lb)" value={signal.cPrice != null ? signal.cPrice.toFixed(1) : "—"} mono />
        <SummaryCell label="Demand index" value={signal.demandIndex != null ? signal.demandIndex.toFixed(3) : "—"} mono />
        <SummaryCell label="Source" value={signal.source ?? "—"} mono />
        <SummaryCell label="Valid from" value={fmtDate(signal.validFrom)} mono />
        <SummaryCell label="Expires" value={fmtDate(signal.expiresAt)} mono />
        <SummaryCell label="Snapshot id" value={signal.id} mono />
      </div>
    </div>
  )
}

function SummaryCell({
  label, value, mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9a8b73]">
        {label}
      </div>
      <div
        className={`mt-1 text-[14px] text-[#2f2418] ${mono ? "tabular-nums font-mono text-[12.5px]" : "font-medium"}`}
        title={value}
      >
        {value}
      </div>
    </div>
  )
}

function ResultsTable({ rows }: { rows: ReadonlyArray<RefreshRow> }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-[#d8c5a8] bg-[#fbf7f0] shadow-[0_8px_24px_rgba(0,0,0,0.05)]">
      <table className="w-full text-left text-[12.5px]">
        <thead className="bg-[#f3e9d7] text-[10.5px] uppercase tracking-[0.16em] text-[#7a5230]">
          <tr>
            <Th>Lot #</Th>
            <Th>Variety</Th>
            <Th>Status</Th>
            <Th align="right">SCA</Th>
            <Th align="right">Altitude</Th>
            <Th align="right">Persisted B2B</Th>
            <Th align="right">Recomputed</Th>
            <Th align="right">Δ €/kg</Th>
            <Th align="right">Δ %</Th>
            <Th>Source</Th>
            <Th>Mode</Th>
            <Th>State</Th>
            <Th></Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.greenLotId} className="border-t border-[#e2d6bd] text-[#2f2418]">
              <Td mono title={r.lotNumber}>
                <span className="block max-w-[220px] truncate">{r.lotNumber}</span>
              </Td>
              <Td>{r.variety}</Td>
              <Td><StatusPill status={r.status} /></Td>
              <Td align="right" mono>{r.scaScore != null ? r.scaScore.toFixed(2) : "—"}</Td>
              <Td align="right" mono>{r.altitude != null ? `${r.altitude.toLocaleString()} m` : "—"}</Td>
              <Td align="right" mono>{fmtPrice(r.persistedClientB2BPricePerKg)}</Td>
              <Td align="right" mono>{fmtPrice(r.recomputedClientB2BPricePerKg)}</Td>
              <Td align="right" mono>
                <span style={{ color: deltaColor(r.deltaAbsolute) }}>{fmtSigned(r.deltaAbsolute, 2)}</span>
              </Td>
              <Td align="right" mono>
                <span style={{ color: deltaColor(r.deltaPercent) }}>{fmtSignedPercent(r.deltaPercent)}</span>
              </Td>
              <Td mono><span className="text-[10.5px] text-[#7a5230]">{r.pricingSourceAfter}</span></Td>
              <Td mono><span className="text-[10.5px] text-[#7a5230]">{r.recomputedPricingMode ?? "—"}</span></Td>
              <Td>
                {r.applied ? <Badge tone="emerald">applied</Badge>
                  : r.skipped ? <Badge tone="amber" title={r.skipReason ?? "skipped"}>{r.skipReason ?? "skipped"}</Badge>
                  : <Badge tone="bronze">would update</Badge>}
              </Td>
              <Td>
                {r.greenLotId && (
                  <a
                    href={`/dev/pricing/lot/${encodeURIComponent(r.greenLotId)}`}
                    className="inline-block rounded-md border border-[#cfb48a] bg-white px-2.5 py-1 text-[11px] font-medium text-[#5f472f] transition hover:bg-[#f7f2ea]"
                  >
                    Inspect →
                  </a>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Th({ children, align }: { children?: React.ReactNode; align?: "right" }) {
  return (
    <th className={`px-3 py-2 ${align === "right" ? "text-right" : "text-left"}`}>
      {children}
    </th>
  )
}

function Td({
  children, align, mono, title,
}: {
  children: React.ReactNode
  align?: "right"
  mono?: boolean
  title?: string
}) {
  return (
    <td
      title={title}
      className={[
        "px-3 py-2",
        align === "right" ? "text-right" : "",
        mono ? "tabular-nums font-mono text-[12px]" : "",
      ].join(" ").trim()}
    >
      {children}
    </td>
  )
}

function Badge({
  tone, title, children,
}: {
  tone: "emerald" | "amber" | "bronze"
  title?: string
  children: React.ReactNode
}) {
  const cls =
    tone === "emerald" ? "bg-[#e8f0e6] text-[#3a6b35] border-[#b7cbb0]" :
    tone === "amber"   ? "bg-[#fef3d7] text-[#7a5c0a] border-[#d8c89a]" :
                         "bg-[#f3e9d7] text-[#7a5230] border-[#cfb48a]"
  return (
    <span title={title} className={`inline-block rounded-full border px-2 py-0.5 text-[10.5px] font-medium ${cls}`}>
      {children}
    </span>
  )
}

function StatusPill({ status }: { status: string }) {
  const cls =
    status === "PUBLISHED" ? "bg-[#e8f0e6] text-[#3a6b35] border-[#b7cbb0]" :
    status === "RESERVED"  ? "bg-[#fef3d7] text-[#7a5c0a] border-[#d8c89a]" :
    status === "SOLD"      ? "bg-[#f3e9d7] text-[#7a5230] border-[#cfb48a]" :
                             "bg-[#efe7da] text-[#7a5c2e] border-[#cfb48a]"
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-[10.5px] font-medium ${cls}`}>
      {status}
    </span>
  )
}

// ------------------------------------------------------
// FORMATTERS
// ------------------------------------------------------

function fmtPrice(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—"
  return `€${value.toFixed(2)}`
}

function fmtSigned(value: number | null, decimals: number): string {
  if (value == null || !Number.isFinite(value)) return "—"
  const sign = value > 0 ? "+" : ""
  return `${sign}${value.toFixed(decimals)}`
}

function fmtSignedPercent(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—"
  const sign = value > 0 ? "+" : ""
  return `${sign}${value.toFixed(2)}%`
}

function deltaColor(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "#7b6851"
  if (Math.abs(value) < 0.005) return "#7b6851"
  return value > 0 ? "#3a6b35" : "#8a3a25"
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—"
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return "—"
  return new Date(t).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
  })
}
