"use client"

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"

import {
  formatProofBadge,
  formatProofMissingDetail,
  formatProofMissingLabel,
} from "@/src/services/lot-media/proofReadinessLabels.pure"

//////////////////////////////////////////////////////
// 🧰 /platform/partner/media — PARTNER-MEDIA-UI-1
//
// Lot-scoped media upload surface for partner/admin
// operators. The "Add private proof" CTA on
// /platform/partner/lots deep-links here with
//   ?lotId=<greenLotId>&farmId=<farmId>&focus=private-proof
//
// Reads context from /api/partner/lots/[id]/media-context
// (PARTNER/ADMIN auth) and writes through:
//   POST /api/partner/lots/[id]/media/upload-url
//   PUT  <signed Supabase URL>
//   POST /api/partner/lots/[id]/media   (persist row)
//
// We never render the bytes of a `supabase://` row —
// the context endpoint returns null `publicUrl` for
// private rows and we draw a lock card instead.
//////////////////////////////////////////////////////

type LotContext = {
  id: string
  lotNumber: string
  name: string | null
  status: string
  farmId: string
  farmName: string | null
  region: string | null
  producerName: string | null
  producerCountry: string | null
}

type MediaRow = {
  id: string
  role: string
  source: string
  visibility: "PUBLIC_MARKET" | "BUYER_PRIVATE" | "INTERNAL_ONLY"
  position: number
  isPrimary: boolean
  altText: string | null
  caption: string | null
  credit: string | null
  isPrivateReference: boolean
  publicUrl: string | null
  createdAt: string
}

type MediaContext = {
  lot: LotContext
  media: MediaRow[]
  proofReady: boolean
  proofMissing: string[]
}

type Focus = "private-proof" | "public-listing"

const ROLES = [
  "FARM",
  "PROCESS",
  "PRODUCER",
  "TRACEABILITY_BAG",
  "PRODUCT_DETAIL",
  "CERTIFICATE",
  "EDITORIAL_FALLBACK",
] as const

const VISIBILITIES = ["PUBLIC_MARKET", "BUYER_PRIVATE", "INTERNAL_ONLY"] as const

const ROLE_DEFAULT_VISIBILITY: Record<string, string> = {
  FARM: "PUBLIC_MARKET",
  PROCESS: "PUBLIC_MARKET",
  PRODUCER: "PUBLIC_MARKET",
  TRACEABILITY_BAG: "BUYER_PRIVATE",
  PRODUCT_DETAIL: "PUBLIC_MARKET",
  CERTIFICATE: "BUYER_PRIVATE",
  EDITORIAL_FALLBACK: "PUBLIC_MARKET",
}

const ACCEPTED_MIME = ["image/jpeg", "image/png", "image/webp"] as const
const MAX_BYTES = 8 * 1024 * 1024

function normaliseFocus(value: string | null): Focus | null {
  if (value === "private-proof" || value === "public-listing") return value
  return null
}

//////////////////////////////////////////////////////
// PAGE SHELL — Suspense wraps useSearchParams so the
// route can be prerendered.
//////////////////////////////////////////////////////

export default function PartnerMediaPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <PartnerMediaPageInner />
    </Suspense>
  )
}

function PageFallback() {
  return (
    <div className="min-h-screen bg-[#f5f1e6] px-6 py-12 pt-24">
      <div className="mx-auto max-w-4xl text-sm text-black/60">Loading…</div>
    </div>
  )
}

function PartnerMediaPageInner() {
  const searchParams = useSearchParams()
  const queryLotId = searchParams?.get("lotId")?.trim() || null
  const queryFarmId = searchParams?.get("farmId")?.trim() || null
  const focus = normaliseFocus(searchParams?.get("focus") ?? null)

  const [context, setContext] = useState<MediaContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async (lotId: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/partner/lots/${encodeURIComponent(lotId)}/media-context`,
        { credentials: "include" },
      )
      if (res.status === 401 || res.status === 403) {
        throw new Error("You do not have access to this page.")
      }
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(
          (body && typeof body.error === "string" && body.error) ||
            `Failed to load lot (${res.status}).`,
        )
      }
      const data = (await res.json()) as MediaContext
      setContext(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load lot.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!queryLotId) {
      setLoading(false)
      return
    }
    refresh(queryLotId)
  }, [queryLotId, refresh])

  return (
    <div className="min-h-screen bg-[#f5f1e6] px-6 py-12 pt-24">
      <div className="mx-auto max-w-4xl">

        <header className="mb-6">
          <div className="text-[10.5px] uppercase tracking-[0.22em] text-[#7a4f00]">
            Partner ops · Lot media
          </div>
          <h1 className="mt-1 text-2xl font-semibold">
            Lot media &amp; buyer proof
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-black/60">
            Upload private traceability and certificate proof for a specific
            green lot. Private proof is visible only to the contracted buyer
            and operations — never to the public marketplace.
          </p>
        </header>

        {!queryLotId && <EmptyState />}

        {queryLotId && loading && (
          <p className="text-sm text-black/60">Loading lot…</p>
        )}

        {error && <ErrorState message={error} />}

        {context && (
          <PartnerMediaWorkspace
            context={context}
            focus={focus}
            queryFarmId={queryFarmId}
            onRefresh={() => refresh(context.lot.id)}
          />
        )}

      </div>
    </div>
  )
}

// ------------------------------------------------------
// EMPTY / ERROR
// ------------------------------------------------------

function EmptyState() {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-6">
      <p className="text-sm text-black/70">
        Select a lot from the <strong>Ready for Export</strong> list to add
        proof media.
      </p>
      <a
        href="/platform/partner/lots"
        className="mt-3 inline-flex items-center rounded-full bg-black px-4 py-2 text-sm text-white"
      >
        Go to Ready for Export
      </a>
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      {message}
    </div>
  )
}

// ------------------------------------------------------
// WORKSPACE
// ------------------------------------------------------

function PartnerMediaWorkspace({
  context,
  focus,
  queryFarmId,
  onRefresh,
}: {
  context: MediaContext
  focus: Focus | null
  queryFarmId: string | null
  onRefresh: () => void
}) {
  const farmIdMatches =
    !queryFarmId || queryFarmId === context.lot.farmId
  const badge = formatProofBadge({
    proofReady: context.proofReady,
    proofMissing: context.proofMissing,
  })

  return (
    <div className="flex flex-col gap-6">

      <LotIdentityCard lot={context.lot} farmIdMismatch={!farmIdMatches} />

      <ProofStatusCard
        proofReady={context.proofReady}
        proofMissing={context.proofMissing}
        badge={badge}
      />

      <PartnerLotMediaUploadCard
        lot={context.lot}
        focus={focus}
        onCreated={onRefresh}
      />

      <ExistingMediaList media={context.media} />
    </div>
  )
}

// ------------------------------------------------------
// LOT IDENTITY
// ------------------------------------------------------

function LotIdentityCard({
  lot,
  farmIdMismatch,
}: {
  lot: LotContext
  farmIdMismatch: boolean
}) {
  return (
    <section className="rounded-2xl border border-black/10 bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.18em] text-black/60">
            Lot
          </div>
          <div className="mt-1 text-lg font-semibold">{lot.lotNumber}</div>
          {lot.name && (
            <div className="text-sm text-black/60">{lot.name}</div>
          )}
        </div>
        <span className="rounded-full border border-black/10 px-3 py-1 text-[10px] uppercase tracking-[0.06em] text-black/60">
          {lot.status}
        </span>
      </div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <Stat label="Farm" value={lot.farmName ?? "—"} />
        <Stat label="Region" value={lot.region ?? "—"} />
        <Stat label="Producer" value={lot.producerName ?? "—"} />
        <Stat label="Country" value={lot.producerCountry ?? "—"} />
      </dl>
      {farmIdMismatch && (
        <p className="mt-3 text-xs text-[#a06b00]">
          Heads up: this lot belongs to a different farm than the URL hint —
          using the lot&rsquo;s real farm.
        </p>
      )}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.16em] text-black/40">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-black">{value}</dd>
    </div>
  )
}

// ------------------------------------------------------
// PROOF STATUS CARD
// ------------------------------------------------------

function ProofStatusCard({
  proofReady,
  proofMissing,
  badge,
}: {
  proofReady: boolean
  proofMissing: string[]
  badge: { tone: "ok" | "warning"; label: string }
}) {
  const styles =
    badge.tone === "ok"
      ? "border-[#1f7a3a]/30 bg-[#e6f4ea] text-[#1f7a3a]"
      : "border-[#d6a72c]/40 bg-[#fdf2d0] text-[#7a4f00]"
  return (
    <section className={"rounded-2xl border p-5 " + styles}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.18em] opacity-80">
            Shipment proof
          </div>
          <div className="mt-1 text-lg font-semibold">{badge.label}</div>
        </div>
      </div>
      {proofReady ? (
        <p className="mt-3 text-sm">
          This lot already has verified buyer-private proof and can be added
          to a shipment.
        </p>
      ) : (
        <>
          <p className="mt-3 text-sm">
            {formatProofMissingDetail(proofMissing)}
          </p>
          <p className="mt-1 text-xs opacity-80">
            This proof is required before the lot can be added to a shipment.
          </p>
          {proofMissing.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-xs">
              {proofMissing.map((code) => (
                <li key={code}>{formatProofMissingLabel(code)}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}

// ------------------------------------------------------
// UPLOAD CARD
// ------------------------------------------------------

type SignedUploadResponse = {
  uploadUrl: string
  token?: string
  method: "PUT" | "POST"
  bucket: string
  bucketKind?: "PUBLIC" | "PRIVATE"
  storagePath: string
  storageReference?: string
  publicUrl: string | null
  expiresInSeconds: number
  mediaDefaults: {
    role: string
    source: string
    visibility: string
  }
}

function PartnerLotMediaUploadCard({
  lot,
  focus,
  onCreated,
}: {
  lot: LotContext
  focus: Focus | null
  onCreated: () => void
}) {
  const initialRole: typeof ROLES[number] =
    focus === "private-proof" ? "TRACEABILITY_BAG" : "FARM"
  const initialVisibility: typeof VISIBILITIES[number] =
    focus === "private-proof" ? "BUYER_PRIVATE" : "PUBLIC_MARKET"

  const [file, setFile] = useState<File | null>(null)
  const [role, setRole] = useState<typeof ROLES[number]>(initialRole)
  const [visibility, setVisibility] =
    useState<typeof VISIBILITIES[number]>(initialVisibility)
  const [altText, setAltText] = useState("")
  const [phase, setPhase] = useState<
    "idle" | "signing" | "uploading" | "saving" | "success"
  >("idle")
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const onRoleChange = (next: typeof ROLES[number]) => {
    setRole(next)
    const defaultV = ROLE_DEFAULT_VISIBILITY[next]
    if (defaultV) setVisibility(defaultV as typeof VISIBILITIES[number])
  }

  const reset = () => {
    setFile(null)
    setAltText("")
    setPhase("idle")
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return
    setError(null)
    setSuccessMessage(null)

    if (!(ACCEPTED_MIME as readonly string[]).includes(file.type)) {
      setError(
        `That file type (${file.type || "unknown"}) isn’t supported. Use JPEG, PNG or WebP.`,
      )
      return
    }
    if (file.size > MAX_BYTES) {
      setError(`File is too large. Maximum is ${MAX_BYTES / 1024 / 1024} MB.`)
      return
    }

    try {
      setPhase("signing")
      const signRes = await fetch(
        `/api/partner/lots/${encodeURIComponent(lot.id)}/media/upload-url`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            contentType: file.type,
            sizeBytes: file.size,
            role,
            visibility,
          }),
        },
      )
      const signData = (await signRes.json().catch(() => ({}))) as
        | SignedUploadResponse
        | { error?: string; code?: string }
      if (!signRes.ok) {
        const data = signData as { error?: string; code?: string }
        if (data?.code === "STORAGE_NOT_CONFIGURED") {
          setError(
            "Uploads aren’t configured on this environment. Ask the producer to upload via their dashboard for now.",
          )
          setPhase("idle")
          return
        }
        throw new Error(
          data?.error || `Upload preparation failed (${signRes.status}).`,
        )
      }
      const sign = signData as SignedUploadResponse

      setPhase("uploading")
      const putRes = await fetch(sign.uploadUrl, {
        method: sign.method,
        headers: {
          "Content-Type": file.type,
          "x-upsert": "true",
          "cache-control": "public, max-age=3600",
        },
        body: file,
      })
      if (!putRes.ok) {
        throw new Error(
          `Upload failed (${putRes.status}). Please try again in a moment.`,
        )
      }

      // PRIVATE rows persist the storageReference (supabase://...).
      // PUBLIC rows persist the public CDN URL.
      const persistedUrl =
        sign.bucketKind === "PRIVATE"
          ? sign.storageReference
          : sign.publicUrl
      if (!persistedUrl) {
        throw new Error(
          "Upload succeeded but the storage location was not returned.",
        )
      }

      setPhase("saving")
      const createRes = await fetch(
        `/api/partner/lots/${encodeURIComponent(lot.id)}/media`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: persistedUrl,
            role: sign.mediaDefaults.role,
            source: sign.mediaDefaults.source,
            visibility: sign.mediaDefaults.visibility,
            altText: altText.trim() || undefined,
          }),
        },
      )
      const createData = await createRes.json().catch(() => ({}))
      if (!createRes.ok) {
        throw new Error(
          createData?.error || `Save failed (${createRes.status}).`,
        )
      }

      setPhase("success")
      setSuccessMessage(
        visibility === "BUYER_PRIVATE"
          ? "Private proof uploaded. This lot is ready for shipment."
          : "Media uploaded.",
      )
      onCreated()
      setTimeout(() => reset(), 1400)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.")
      setPhase("idle")
    }
  }

  const busy = phase !== "idle" && phase !== "success"
  const phaseLabel =
    phase === "signing"
      ? "Preparing upload…"
      : phase === "uploading"
        ? "Uploading…"
        : phase === "saving"
          ? "Saving…"
          : phase === "success"
            ? "Saved."
            : null

  return (
    <section className="rounded-2xl border border-black/10 bg-white p-5">
      {focus === "private-proof" && (
        <div className="mb-4 rounded-xl border border-[#d6a72c]/40 bg-[#fdf2d0] px-4 py-3 text-xs text-[#7a4f00]">
          Upload a private traceability or final-bag proof for lot{" "}
          <span className="font-mono">{lot.lotNumber}</span>. Private proof
          is visible only to the contracted buyer and operations — never to
          the public marketplace.
        </div>
      )}

      <div className="mb-3 text-[10.5px] uppercase tracking-[0.18em] text-black/60">
        Add lot media
      </div>

      <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="text-[10px] uppercase tracking-[0.16em] text-black/50">
            Image file
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept={(ACCEPTED_MIME as readonly string[]).join(",")}
            required
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm"
            disabled={busy}
          />
          {file && (
            <span className="text-[11px] text-black/60">
              {file.name} · {(file.size / 1024).toFixed(0)} KB · {file.type}
            </span>
          )}
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.16em] text-black/50">
            Role
          </span>
          <select
            value={role}
            onChange={(e) => onRoleChange(e.target.value as typeof ROLES[number])}
            disabled={busy}
            className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {humaniseRole(r)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.16em] text-black/50">
            Visibility
          </span>
          <select
            value={visibility}
            onChange={(e) =>
              setVisibility(e.target.value as typeof VISIBILITIES[number])
            }
            disabled={busy}
            className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm"
          >
            {VISIBILITIES.map((v) => (
              <option key={v} value={v}>
                {humaniseVisibility(v)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="text-[10px] uppercase tracking-[0.16em] text-black/50">
            Caption (optional)
          </span>
          <input
            type="text"
            value={altText}
            onChange={(e) => setAltText(e.target.value)}
            disabled={busy}
            placeholder="e.g. Final export bag, lot label visible"
            className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm"
          />
        </label>

        <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-black/60">
            {phaseLabel || "Accepted: JPEG, PNG, WebP up to 8 MB."}
          </div>
          <button
            type="submit"
            disabled={!file || busy}
            className="rounded-full bg-black px-5 py-2 text-sm text-white disabled:bg-black/30"
          >
            Upload
          </button>
        </div>

        {error && (
          <div className="md:col-span-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}
        {successMessage && (
          <div className="md:col-span-2 rounded-md border border-[#1f7a3a]/30 bg-[#e6f4ea] px-3 py-2 text-xs text-[#1f7a3a]">
            {successMessage}
          </div>
        )}
      </form>
    </section>
  )
}

// ------------------------------------------------------
// EXISTING MEDIA LIST
// ------------------------------------------------------

function ExistingMediaList({ media }: { media: MediaRow[] }) {
  if (media.length === 0) {
    return (
      <section className="rounded-2xl border border-black/10 bg-white p-5">
        <div className="mb-1 text-[10.5px] uppercase tracking-[0.18em] text-black/60">
          Existing media
        </div>
        <p className="text-sm text-black/60">
          No media uploaded for this lot yet.
        </p>
      </section>
    )
  }
  return (
    <section className="rounded-2xl border border-black/10 bg-white p-5">
      <div className="mb-3 text-[10.5px] uppercase tracking-[0.18em] text-black/60">
        Existing media ({media.length})
      </div>
      <ul className="grid gap-3 md:grid-cols-2">
        {media.map((row) => (
          <MediaRowCard key={row.id} row={row} />
        ))}
      </ul>
    </section>
  )
}

function MediaRowCard({ row }: { row: MediaRow }) {
  const isPrivate = row.isPrivateReference
  return (
    <li className="flex gap-3 rounded-xl border border-black/10 bg-[#fafafa] p-3">
      <div className="flex h-16 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-md bg-[#1f2e1c]">
        {isPrivate ? (
          <PrivateLock />
        ) : row.publicUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={row.publicUrl}
            alt={row.altText ?? ""}
            className="h-full w-full object-cover"
            onError={(e) => {
              ;(e.currentTarget as HTMLImageElement).style.display = "none"
            }}
          />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.16em] text-[#7a4f00]">
            {humaniseRole(row.role)}
          </span>
          <span className="rounded-full border border-black/10 px-2 py-0.5 text-[10px] text-black/60">
            {humaniseVisibility(row.visibility)}
          </span>
          {row.isPrimary && (
            <span className="rounded-full bg-black px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-white">
              Primary
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-black/60">
          {isPrivate ? "Private proof uploaded" : "Public image"}
        </p>
        {row.altText && (
          <p className="mt-0.5 truncate text-[11px] text-black/50">
            {row.altText}
          </p>
        )}
      </div>
    </li>
  )
}

function PrivateLock() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d6b04f" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

// ------------------------------------------------------
// LABELS
// ------------------------------------------------------

function humaniseRole(role: string): string {
  switch (role) {
    case "FARM": return "Farm photo"
    case "PROCESS": return "Process photo"
    case "PRODUCER": return "Producer photo"
    case "TRACEABILITY_BAG": return "Traceability / bag proof"
    case "PRODUCT_DETAIL": return "Product detail"
    case "CERTIFICATE": return "Certificate"
    case "EDITORIAL_FALLBACK": return "Editorial"
    default: return role
  }
}

function humaniseVisibility(v: string): string {
  switch (v) {
    case "PUBLIC_MARKET": return "Public"
    case "BUYER_PRIVATE": return "Buyer-private"
    case "INTERNAL_ONLY": return "Internal"
    default: return v
  }
}
