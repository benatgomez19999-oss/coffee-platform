"use client"

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"

//////////////////////////////////////////////////////
// 🖼️ /platform/producer/media (PARTNER-MEDIA-2A)
//
// Standalone media management page for producers. URL-only
// in this sprint (no storage upload yet). Renders:
//   - the producer's farm(s)
//   - the readiness panel (public-listing vs buyer-private)
//   - existing FarmMedia rows with delete + set-primary actions
//   - a "Add media" form that POSTs to /api/producer/farms/[id]/media
//
// Lot-specific GreenLotMedia management is reachable via the
// same API but not yet wired into a dedicated UI surface —
// PARTNER-MEDIA-2B will add it in the partner verification flow.
//////////////////////////////////////////////////////

type Farm = {
  id: string
  name: string
  region: string | null
  altitude: number | null
}

type MediaRow = {
  id: string
  url: string
  role: string
  source: string
  visibility: string
  position: number
  isPrimary: boolean
  altText: string | null
  caption: string | null
  credit: string | null
  createdAt: string
}

type ReadinessSlot = {
  code: string
  label: string
  description: string
  state: "SATISFIED" | "MISSING"
  required: boolean
}

type ReadinessPanel = {
  publicListing: { ready: boolean; slots: ReadinessSlot[] }
  buyerProof: { blocking: boolean; slots: ReadinessSlot[] }
}

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
  FARM:               "PUBLIC_MARKET",
  PROCESS:            "PUBLIC_MARKET",
  PRODUCER:           "PUBLIC_MARKET",
  TRACEABILITY_BAG:   "BUYER_PRIVATE",
  PRODUCT_DETAIL:     "PUBLIC_MARKET",
  CERTIFICATE:        "BUYER_PRIVATE",
  EDITORIAL_FALLBACK: "PUBLIC_MARKET",
}

// PRODUCER-PROOF-POLISH — deep-link defaults driven by the
// optional `?focus=` query param. Honoured by the page +
// passed down to AddMediaForm as initial role / visibility.
type MediaFocus = "private-proof" | "public-listing"

function normaliseFocus(value: string | null): MediaFocus | null {
  if (value === "private-proof" || value === "public-listing") return value
  return null
}

// PRODUCER-PROOF-POLISH — `useSearchParams` requires a
// Suspense boundary during static rendering. The page
// component is wrapped here and the actual body moves to
// the inner client component.
export default function ProducerMediaPage() {
  return (
    <Suspense fallback={<ProducerMediaPageFallback />}>
      <ProducerMediaPageInner />
    </Suspense>
  )
}

function ProducerMediaPageFallback() {
  return (
    <div className="min-h-screen bg-[#0b1410] px-6 pb-16 pt-24 text-[#f4efe3]">
      <div className="mx-auto max-w-5xl text-sm text-[#cdc0a4]">Loading…</div>
    </div>
  )
}

function ProducerMediaPageInner() {

  //////////////////////////////////////////////////////
  // PRODUCER-PROOF-POLISH — DEEP-LINK QUERY PARAMS
  //
  // Read once on mount. Used to:
  //   - preselect the matching farm if `farmId` is set
  //     AND it belongs to this producer.
  //   - hint AddMediaForm to default role/visibility based
  //     on `focus`.
  // `lotId` is passed through to AddMediaForm so the form
  // can echo it back in helper text — the upload endpoints
  // are still farm-scoped today, so we cannot use `lotId`
  // to drive the actual POST.
  //////////////////////////////////////////////////////
  const searchParams = useSearchParams()
  const queryFarmId =
    searchParams?.get("farmId")?.trim() || null
  const queryLotId =
    searchParams?.get("lotId")?.trim() || null
  const queryFocus = normaliseFocus(searchParams?.get("focus") ?? null)

  const [farms, setFarms] = useState<Farm[]>([])
  const [activeFarmId, setActiveFarmId] = useState<string | null>(null)
  const [media, setMedia] = useState<MediaRow[]>([])
  const [readiness, setReadiness] = useState<ReadinessPanel | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const activeFarm = useMemo(
    () => farms.find((f) => f.id === activeFarmId) ?? null,
    [farms, activeFarmId],
  )

  // Load farms
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const r = await fetch("/api/producer/farms", { credentials: "include" })
        if (!r.ok) throw new Error(`Farms load failed (${r.status})`)
        const data = (await r.json()) as { farms: Farm[] }
        if (!cancelled) {
          setFarms(data.farms)
          if (data.farms.length > 0) {
            // PRODUCER-PROOF-POLISH — honour the `?farmId=` deep
            // link when present AND owned. Falls back to the
            // first farm otherwise (existing behaviour).
            const preferred =
              queryFarmId && data.farms.some((f) => f.id === queryFarmId)
                ? queryFarmId
                : data.farms[0].id
            setActiveFarmId(preferred)
          }
          else setLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load farms")
          setLoading(false)
        }
      }
    }
    load()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load media + readiness for the active farm
  const refresh = useCallback(async (farmId: string) => {
    setLoading(true)
    setError(null)
    try {
      const [mediaRes, readinessRes] = await Promise.all([
        fetch(`/api/producer/farms/${farmId}/media`, { credentials: "include" }),
        fetch(`/api/producer/farms/${farmId}/media-readiness`, { credentials: "include" }),
      ])
      if (!mediaRes.ok) throw new Error(`Media load failed (${mediaRes.status})`)
      if (!readinessRes.ok) throw new Error(`Readiness load failed (${readinessRes.status})`)
      const m = (await mediaRes.json()) as { media: MediaRow[] }
      const r = (await readinessRes.json()) as { readiness: ReadinessPanel }
      setMedia(m.media)
      setReadiness(r.readiness)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load media")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeFarmId) refresh(activeFarmId)
  }, [activeFarmId, refresh])

  return (
    <div className="min-h-screen bg-[#0b1410] px-6 pb-16 pt-24 text-[#f4efe3]">
      <div className="mx-auto max-w-5xl">

        <header className="mb-8">
          <div className="text-[11px] uppercase tracking-[0.22em] text-[#d6b04f]">
            Farm media
          </div>
          <h1
            className="mt-1 text-3xl font-medium leading-tight"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            Manage public listing and private buyer proof images
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-[#cdc0a4]">
            Farm-level photos are reused across every lot from this farm. Public
            listing media is shown in the marketplace and is required before a
            lot can be published. Buyer-private proof is only shared with a
            buyer after a contract is agreed.
          </p>
        </header>

        {/* Farm selector */}
        {farms.length > 1 && (
          <div className="mb-6 flex gap-2 flex-wrap">
            {farms.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setActiveFarmId(f.id)}
                className={
                  "rounded-full border px-4 py-2 text-xs " +
                  (f.id === activeFarmId
                    ? "border-[#d6b04f] bg-[#d6b04f] text-[#1a0f08]"
                    : "border-[#d6b04f]/30 text-[#cdc0a4] hover:bg-[#d6b04f]/10")
                }
              >
                {f.name}
              </button>
            ))}
          </div>
        )}

        {farms.length === 0 && !loading && (
          <EmptyBox message="No farms attached to your account yet. Complete onboarding first." />
        )}

        {error && <ErrorBox message={error} />}

        {activeFarm && readiness && (
          <ReadinessPanelView panel={readiness} />
        )}

        {activeFarm && (
          <MediaList
            farm={activeFarm}
            media={media}
            loading={loading}
            onChange={() => refresh(activeFarm.id)}
          />
        )}

        {activeFarm && (
          <AddMediaForm
            farm={activeFarm}
            focus={queryFocus}
            lotIdHint={queryLotId}
            onAdded={() => refresh(activeFarm.id)}
          />
        )}
      </div>
    </div>
  )
}

// ------------------------------------------------------
// READINESS PANEL
// ------------------------------------------------------

function ReadinessPanelView({ panel }: { panel: ReadinessPanel }) {
  return (
    <section className="mb-8 grid gap-4 md:grid-cols-2">
      <div className="rounded-2xl border border-[#d6b04f]/20 bg-[rgba(255,255,255,0.025)] p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[10.5px] uppercase tracking-[0.2em] text-[#d6b04f]">
            Public listing readiness
          </div>
          <span
            className={
              "rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] " +
              (panel.publicListing.ready
                ? "bg-[#86c69b]/15 text-[#86c69b]"
                : "bg-[#e2b65c]/15 text-[#e2b65c]")
            }
          >
            {panel.publicListing.ready ? "Ready" : "Not ready"}
          </span>
        </div>
        <p className="mt-2 text-xs text-[#cdc0a4]">
          Visible to buyers browsing the marketplace. Required before publish.
        </p>
        <ul className="mt-3 flex flex-col gap-2">
          {panel.publicListing.slots.map((s) => (
            <ReadinessRow key={s.code} slot={s} />
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-[#d6b04f]/20 bg-[rgba(255,255,255,0.025)] p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[10.5px] uppercase tracking-[0.2em] text-[#d6b04f]">
            Private buyer proof
          </div>
          <span className="rounded-full bg-[#cdc0a4]/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#cdc0a4]">
            Informational
          </span>
        </div>
        <p className="mt-2 text-xs text-[#cdc0a4]">
          Visible only to the buyer after a contract is agreed. Required later
          before shipment, not before publish.
        </p>
        <ul className="mt-3 flex flex-col gap-2">
          {panel.buyerProof.slots.map((s) => (
            <ReadinessRow key={s.code} slot={s} />
          ))}
        </ul>
      </div>
    </section>
  )
}

function ReadinessRow({ slot }: { slot: ReadinessSlot }) {
  const isOk = slot.state === "SATISFIED"
  return (
    <li className="flex items-start gap-3">
      <span
        aria-hidden
        className={
          "mt-1 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full " +
          (isOk ? "bg-[#86c69b]/25 text-[#86c69b]" : "bg-[#e2b65c]/25 text-[#e2b65c]")
        }
      >
        {isOk ? "✓" : "·"}
      </span>
      <div>
        <div className="text-[13px] text-[#f4efe3]">
          {slot.label}
          {slot.required && !isOk && (
            <span className="ml-2 text-[10px] uppercase tracking-[0.12em] text-[#e2b65c]">
              required
            </span>
          )}
        </div>
        <div className="text-[11px] text-[#cdc0a4]">{slot.description}</div>
      </div>
    </li>
  )
}

// ------------------------------------------------------
// MEDIA LIST
// ------------------------------------------------------

function MediaList({
  farm,
  media,
  loading,
  onChange,
}: {
  farm: Farm
  media: MediaRow[]
  loading: boolean
  onChange: () => void
}) {

  const setPrimary = async (id: string) => {
    await fetch(`/api/producer/farms/${farm.id}/media/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPrimary: true }),
    })
    onChange()
  }

  const remove = async (id: string) => {
    if (!confirm("Delete this media row?")) return
    await fetch(`/api/producer/farms/${farm.id}/media/${id}`, {
      method: "DELETE",
      credentials: "include",
    })
    onChange()
  }

  return (
    <section className="mb-8 rounded-2xl border border-[#d6b04f]/20 bg-[rgba(255,255,255,0.025)] p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[10.5px] uppercase tracking-[0.2em] text-[#d6b04f]">
          Existing farm media · {farm.name}
        </div>
        <div className="text-xs text-[#cdc0a4]">
          {loading ? "Loading…" : `${media.length} row${media.length === 1 ? "" : "s"}`}
        </div>
      </div>

      {media.length === 0 && !loading && (
        <EmptyBox message="No media yet for this farm. Add a public farm/origin photo to start." />
      )}

      {media.length > 0 && (
        <div className="flex flex-col gap-3">
          {media.map((m) => (
            <MediaRowView
              key={m.id}
              row={m}
              onSetPrimary={() => setPrimary(m.id)}
              onDelete={() => remove(m.id)}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function MediaRowView({
  row,
  onSetPrimary,
  onDelete,
}: {
  row: MediaRow
  onSetPrimary: () => void
  onDelete: () => void
}) {
  const visibilityChip =
    row.visibility === "PUBLIC_MARKET" ? "Public" :
    row.visibility === "BUYER_PRIVATE" ? "Buyer-private" :
    "Internal"

  return (
    <div className="flex flex-wrap items-start gap-3 rounded-xl border border-white/5 bg-black/20 p-3">
      <div className="flex h-14 w-20 items-center justify-center overflow-hidden rounded-md bg-[#1f2e1c]">
        {row.url && row.url.startsWith("supabase://") ? (
          // BUYER-PROOF-1 — private rows persist a `supabase://`
          // reference. We don't render the bytes here; the buyer
          // proof panel resolves them via signed read URLs. Show
          // a lock affordance so the producer knows the upload
          // landed and is intentionally not public.
          <div className="flex h-full w-full flex-col items-center justify-center text-[#d6b04f]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
        ) : row.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={row.url}
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
          <span className="text-[10px] uppercase tracking-[0.18em] text-[#d6b04f]">
            {row.role}
          </span>
          <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-[#cdc0a4]">
            {row.source}
          </span>
          <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-[#cdc0a4]">
            {visibilityChip}
          </span>
          {row.isPrimary && (
            <span className="rounded-full bg-[#d6b04f] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#1a0f08]">
              Primary
            </span>
          )}
        </div>
        <div className="mt-1 truncate text-xs text-[#cdc0a4]" title={row.url}>
          {row.url && row.url.startsWith("supabase://")
            ? "Stored privately in Supabase"
            : row.url}
        </div>
        {row.altText && (
          <div className="mt-0.5 truncate text-[11px] text-[#aea38a]">{row.altText}</div>
        )}
      </div>
      <div className="flex flex-shrink-0 gap-2">
        {!row.isPrimary && (
          <button
            type="button"
            onClick={onSetPrimary}
            className="rounded-md border border-[#d6b04f]/40 px-3 py-1.5 text-[11px] text-[#d6b04f] hover:bg-[#d6b04f]/10"
          >
            Set primary
          </button>
        )}
        <button
          type="button"
          onClick={onDelete}
          className="rounded-md border border-white/10 px-3 py-1.5 text-[11px] text-[#cdc0a4] hover:bg-white/5"
        >
          Delete
        </button>
      </div>
    </div>
  )
}

// ------------------------------------------------------
// ADD MEDIA FORM
//
// STORAGE-MEDIA-1 — adds a real file picker that asks the
// server for a Supabase signed upload URL, uploads to it
// directly, then persists the FarmMedia row via the
// existing create endpoint. URL paste stays as the
// "Use URL" fallback for testing / external curated
// images / dev environments without Supabase configured.
// ------------------------------------------------------

const ACCEPTED_UPLOAD_MIME = ["image/jpeg", "image/png", "image/webp"] as const
const UPLOAD_MAX_BYTES = 8 * 1024 * 1024

type SignedUploadResponse = {
  uploadUrl: string
  token?: string
  method: "PUT" | "POST"
  bucket: string
  // BUYER-PROOF-1 — `PRIVATE` rows persist `storageReference`
  // (a `supabase://<bucket>/<path>` URI) instead of a public
  // URL. The proof endpoint resolves the reference to a signed
  // read URL at view time.
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

function AddMediaForm({
  farm,
  focus,
  lotIdHint,
  onAdded,
}: {
  farm: Farm
  focus: MediaFocus | null
  lotIdHint: string | null
  onAdded: () => void
}) {

  // PRODUCER-PROOF-POLISH — initial defaults driven by the
  // `?focus=` query param. private-proof opens the form on
  // the upload tab with TRACEABILITY_BAG + BUYER_PRIVATE so
  // a partner clicking "Add private proof" lands in the
  // right shape with one click. public-listing keeps the
  // historical defaults but the helper copy below swaps to
  // match.
  const initialRole: typeof ROLES[number] =
    focus === "private-proof" ? "TRACEABILITY_BAG" : "FARM"
  const initialVisibility: typeof VISIBILITIES[number] =
    focus === "private-proof" ? "BUYER_PRIVATE" : "PUBLIC_MARKET"

  const [mode, setMode] = useState<"upload" | "url">("upload")
  const [file, setFile] = useState<File | null>(null)
  const [url, setUrl] = useState("")
  const [role, setRole] = useState<typeof ROLES[number]>(initialRole)
  const [visibility, setVisibility] = useState<typeof VISIBILITIES[number]>(initialVisibility)
  const [altText, setAltText] = useState("")
  const [phase, setPhase] = useState<
    "idle" | "signing" | "uploading" | "saving" | "success"
  >("idle")
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const onRoleChange = (next: typeof ROLES[number]) => {
    setRole(next)
    const defaultV = ROLE_DEFAULT_VISIBILITY[next]
    if (defaultV) setVisibility(defaultV as typeof VISIBILITIES[number])
  }

  const reset = () => {
    setFile(null)
    setUrl("")
    setAltText("")
    setPhase("idle")
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const submitUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return
    setError(null)

    // Client-side guard rails — re-checked server-side.
    if (!(ACCEPTED_UPLOAD_MIME as readonly string[]).includes(file.type)) {
      setError(`That file type (${file.type || "unknown"}) isn't supported. Use JPEG, PNG or WebP.`)
      return
    }
    if (file.size > UPLOAD_MAX_BYTES) {
      setError(`File is too large. Maximum is ${UPLOAD_MAX_BYTES / 1024 / 1024} MB.`)
      return
    }

    try {
      // 1. Ask the server for a signed upload URL.
      setPhase("signing")
      const signRes = await fetch(
        `/api/producer/farms/${farm.id}/media/upload-url`,
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
            "Uploads aren't configured yet on this environment. Switch to “Use URL instead” for now.",
          )
          setMode("url")
          setPhase("idle")
          return
        }
        throw new Error(data?.error || `Upload preparation failed (${signRes.status})`)
      }
      const sign = signData as SignedUploadResponse

      // 2. Upload the bytes directly to Supabase.
      setPhase("uploading")
      const putRes = await fetch(sign.uploadUrl, {
        method: sign.method,
        // Supabase signed PUT expects the raw bytes. Setting
        // Content-Type matches what we signed; cache-control
        // is set so the public URL is cacheable.
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

      // 3. Persist the FarmMedia row via the existing endpoint.
      //    PUBLIC uploads persist the CDN url; PRIVATE uploads
      //    persist the `supabase://<bucket>/<path>` reference
      //    so the proof endpoint can sign a short-lived read URL
      //    on demand. (BUYER-PROOF-1)
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
      const createRes = await fetch(`/api/producer/farms/${farm.id}/media`, {
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
      })
      const createData = await createRes.json().catch(() => ({}))
      if (!createRes.ok) {
        throw new Error(createData?.error || `Save failed (${createRes.status}).`)
      }

      setPhase("success")
      onAdded()
      // Auto-clear success state shortly so the form is ready
      // for the next upload.
      setTimeout(() => {
        reset()
      }, 1400)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.")
      setPhase("idle")
    }
  }

  const submitUrl = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setPhase("saving")
    try {
      const res = await fetch(`/api/producer/farms/${farm.id}/media`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          role,
          visibility,
          altText: altText.trim() || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || `Save failed (${res.status})`)
      }
      setPhase("success")
      onAdded()
      setTimeout(() => reset(), 1400)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed")
      setPhase("idle")
    }
  }

  const busy = phase !== "idle" && phase !== "success"
  const phaseLabel =
    phase === "signing" ? "Preparing upload…" :
    phase === "uploading" ? "Uploading…" :
    phase === "saving" ? "Saving…" :
    phase === "success" ? "Saved." :
    null

  return (
    <section className="rounded-2xl border border-[#d6b04f]/20 bg-[rgba(255,255,255,0.025)] p-5">
      {focus === "private-proof" && (
        <div className="mb-4 rounded-xl border border-[#d6b04f]/30 bg-[#d6b04f]/10 px-4 py-3 text-xs text-[#f4efe3]">
          Upload a private traceability or final-bag proof
          {lotIdHint ? <> for lot <span className="font-mono">{lotIdHint}</span></> : null}.
          Private proof is visible only to the contracted buyer and operations
          — never to the public marketplace.
        </div>
      )}
      <div className="mb-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="text-[10.5px] uppercase tracking-[0.2em] text-[#d6b04f]">
          Add farm media
        </div>
        <div className="inline-flex rounded-full border border-[#d6b04f]/25 bg-black/20 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => { setMode("upload"); setError(null) }}
            className={
              "rounded-full px-3 py-1 transition-colors " +
              (mode === "upload"
                ? "bg-[#d6b04f] text-[#1a0f08]"
                : "text-[#cdc0a4] hover:bg-white/5")
            }
          >
            Upload file
          </button>
          <button
            type="button"
            onClick={() => { setMode("url"); setError(null) }}
            className={
              "rounded-full px-3 py-1 transition-colors " +
              (mode === "url"
                ? "bg-[#d6b04f] text-[#1a0f08]"
                : "text-[#cdc0a4] hover:bg-white/5")
            }
          >
            Use URL
          </button>
        </div>
      </div>

      {mode === "upload" ? (
        <>
          <p className="mb-4 text-xs text-[#cdc0a4]">
            Upload a JPEG, PNG or WebP image up to 8&nbsp;MB. Public listing
            images appear in marketplace and contract catalog cards. Private
            buyer proof stays hidden from the marketplace.
          </p>

          <form onSubmit={submitUpload} className="grid gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1 md:col-span-2">
              <span className="text-[10px] uppercase tracking-[0.18em] text-[#cdc0a4]">
                Image file
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_UPLOAD_MIME.join(",")}
                required
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-[#f4efe3] file:mr-3 file:rounded-md file:border-0 file:bg-[#d6b04f]/15 file:px-3 file:py-1 file:text-[#d6b04f]"
                disabled={busy}
              />
              {file && (
                <span className="text-[10.5px] text-[#cdc0a4]">
                  {file.name} · {(file.size / 1024).toFixed(0)} KB
                </span>
              )}
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-[0.18em] text-[#cdc0a4]">Role</span>
              <select
                value={role}
                onChange={(e) => onRoleChange(e.target.value as typeof ROLES[number])}
                className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-[#f4efe3]"
                disabled={busy}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-[0.18em] text-[#cdc0a4]">Visibility</span>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as typeof VISIBILITIES[number])}
                className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-[#f4efe3]"
                disabled={busy}
              >
                {VISIBILITIES.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 md:col-span-2">
              <span className="text-[10px] uppercase tracking-[0.18em] text-[#cdc0a4]">
                Alt text (optional)
              </span>
              <input
                type="text"
                value={altText}
                onChange={(e) => setAltText(e.target.value)}
                placeholder="Auto-generated from lot context when blank"
                className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-[#f4efe3]"
                disabled={busy}
              />
            </label>

            {error && (
              <div className="md:col-span-2 rounded-md border border-red-400/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                {error}
              </div>
            )}
            {phaseLabel && phase !== "success" && (
              <div className="md:col-span-2 rounded-md border border-[#d6b04f]/30 bg-[#d6b04f]/10 px-3 py-2 text-xs text-[#f3d27a]">
                {phaseLabel}
              </div>
            )}
            {phase === "success" && (
              <div className="md:col-span-2 rounded-md border border-[#86c69b]/40 bg-[#86c69b]/10 px-3 py-2 text-xs text-[#86c69b]">
                Saved.
              </div>
            )}

            <div className="md:col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={busy || !file}
                className="rounded-md bg-[#d6b04f] px-4 py-2 text-sm font-medium text-[#1a0f08] disabled:opacity-40"
              >
                {busy ? phaseLabel : "Upload image"}
              </button>
            </div>
          </form>
        </>
      ) : (
        <>
          <p className="mb-4 text-xs text-[#cdc0a4]">
            URL fallback — useful for testing or external curated images.
            Accepts https:// URLs and local <code>/images/...</code> or{" "}
            <code>/uploads/...</code> paths.
          </p>

          <form onSubmit={submitUrl} className="grid gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1 md:col-span-2">
              <span className="text-[10px] uppercase tracking-[0.18em] text-[#cdc0a4]">URL</span>
              <input
                type="text"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/farm.jpg or /images/farm.jpg"
                className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-[#f4efe3]"
                disabled={busy}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-[0.18em] text-[#cdc0a4]">Role</span>
              <select
                value={role}
                onChange={(e) => onRoleChange(e.target.value as typeof ROLES[number])}
                className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-[#f4efe3]"
                disabled={busy}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-[0.18em] text-[#cdc0a4]">Visibility</span>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as typeof VISIBILITIES[number])}
                className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-[#f4efe3]"
                disabled={busy}
              >
                {VISIBILITIES.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 md:col-span-2">
              <span className="text-[10px] uppercase tracking-[0.18em] text-[#cdc0a4]">
                Alt text (optional)
              </span>
              <input
                type="text"
                value={altText}
                onChange={(e) => setAltText(e.target.value)}
                placeholder="Auto-generated from lot context when blank"
                className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-[#f4efe3]"
                disabled={busy}
              />
            </label>

            {error && (
              <div className="md:col-span-2 rounded-md border border-red-400/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                {error}
              </div>
            )}
            {phase === "success" && (
              <div className="md:col-span-2 rounded-md border border-[#86c69b]/40 bg-[#86c69b]/10 px-3 py-2 text-xs text-[#86c69b]">
                Saved.
              </div>
            )}

            <div className="md:col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={busy || !url.trim()}
                className="rounded-md bg-[#d6b04f] px-4 py-2 text-sm font-medium text-[#1a0f08] disabled:opacity-40"
              >
                {busy ? "Saving…" : "Add media"}
              </button>
            </div>
          </form>
        </>
      )}
    </section>
  )
}

// ------------------------------------------------------
// UTILS
// ------------------------------------------------------

function EmptyBox({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-dashed border-[#d6b04f]/25 bg-black/20 p-4 text-xs text-[#cdc0a4]">
      {message}
    </div>
  )
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="mb-4 rounded-md border border-red-400/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
      {message}
    </div>
  )
}
