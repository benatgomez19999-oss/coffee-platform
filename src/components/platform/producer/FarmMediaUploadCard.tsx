"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"

//////////////////////////////////////////////////////
// 🌄 FARM MEDIA UPLOAD CARD
//
// Mini upload + preview surface on the producer
// dashboard "Farm profile" card. Scoped to FARM-role +
// PUBLIC_MARKET only — for the finca / origin photos
// surface, not process/buyer-private proof.
//
// Three ways to add a photo:
//   1. Click anywhere in the empty zone → file picker.
//   2. Drag a file from desktop / mobile gallery onto
//      the card.
//   3. Copy an image to clipboard and paste while the
//      card has focus (or hover for desktop).
//
// All three paths POST multipart/form-data to
// /api/producer/farms/[farmId]/media/upload, which
// stores the file in /public/uploads/ and creates the
// FarmMedia row via the service.
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
  visibility: string
  isPrimary: boolean
  altText: string | null
}

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"]
const MAX_BYTES = 8 * 1024 * 1024

export default function FarmMediaUploadCard() {

  const [farmId, setFarmId] = useState<string | null>(null)
  const [media, setMedia] = useState<MediaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [hover, setHover] = useState(false)

  // PARTNER-MEDIA-2A.2 — edit / read split.
  //
  // The card has two states once the producer has at least
  // one farm photo:
  //   - read mode: thumbs render flush, no "+" slot, no delete
  //     hover. A tiny "Edit" pencil sits top-right.
  //   - edit mode: "+" slot returns, delete buttons appear on
  //     hover, the top-right control flips to "Done" so the
  //     user can confirm and lock the card again.
  //
  // Empty state stays as a single "Add farm photo" button —
  // there's nothing to confirm yet.
  const [editMode, setEditMode] = useState(false)
  // Tracks whether the producer has *seen* media at least once,
  // so we only flip into read mode on the first load (not on
  // every refresh after an upload while editing).
  const initialisedRef = useRef(false)

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // ----------------------------------------------------
  // LOAD farm + media
  // ----------------------------------------------------

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const r = await fetch("/api/producer/farms", { credentials: "include" })
        if (!r.ok) throw new Error(`Failed to load farms (${r.status})`)
        const data = (await r.json()) as { farms: Farm[] }
        if (cancelled) return
        const first = data.farms[0] ?? null
        setFarmId(first?.id ?? null)
        if (!first) setLoading(false)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load farms")
          setLoading(false)
        }
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const refresh = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      const r = await fetch(`/api/producer/farms/${id}/media`, {
        credentials: "include",
      })
      if (!r.ok) throw new Error(`Failed to load media (${r.status})`)
      const data = (await r.json()) as { media: MediaRow[] }
      const farmMedia = data.media.filter(
        (m) => m.role === "FARM" && m.visibility === "PUBLIC_MARKET",
      )
      setMedia(farmMedia)
      // First-load behaviour: photos already there → start in
      // read mode. Empty → keep edit mode so the producer sees
      // the add zone immediately.
      if (!initialisedRef.current) {
        initialisedRef.current = true
        setEditMode(farmMedia.length === 0)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load media")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (farmId) refresh(farmId)
  }, [farmId, refresh])

  // ----------------------------------------------------
  // UPLOAD
  // ----------------------------------------------------

  const uploadFile = useCallback(
    async (file: File) => {
      if (!farmId) return
      setError(null)

      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError(`Unsupported file type${file.type ? `: ${file.type}` : ""}. Use JPEG, PNG or WebP.`)
        return
      }
      if (file.size > MAX_BYTES) {
        setError(`File too large (max ${MAX_BYTES / 1024 / 1024} MB).`)
        return
      }

      // Capture before async to decide whether this upload is the
      // producer's "first photo" — in which case we auto-exit edit
      // mode so the card lands on the saved/read state.
      const wasEmpty = media.length === 0

      setUploading(true)
      try {
        const formData = new FormData()
        formData.append("file", file)
        formData.append("role", "FARM")
        formData.append("visibility", "PUBLIC_MARKET")

        const res = await fetch(
          `/api/producer/farms/${farmId}/media/upload`,
          {
            method: "POST",
            credentials: "include",
            body: formData,
          },
        )
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(data?.error || `Upload failed (${res.status})`)
        }
        await refresh(farmId)
        if (wasEmpty) setEditMode(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed")
      } finally {
        setUploading(false)
      }
    },
    [farmId, refresh, media.length],
  )

  // ----------------------------------------------------
  // FILE PICKER
  // ----------------------------------------------------

  const openPicker = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
    // Reset so picking the same file twice still triggers change.
    e.target.value = ""
  }

  // ----------------------------------------------------
  // DRAG & DROP
  // ----------------------------------------------------

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!dragOver) setDragOver(true)
  }
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
  }
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) uploadFile(file)
  }

  // ----------------------------------------------------
  // PASTE — listens globally while the card is hovered.
  // ----------------------------------------------------

  useEffect(() => {
    if (!hover) return
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (let i = 0; i < items.length; i++) {
        const it = items[i]
        if (it.kind === "file" && it.type.startsWith("image/")) {
          const file = it.getAsFile()
          if (file) {
            e.preventDefault()
            uploadFile(file)
            return
          }
        }
      }
    }
    window.addEventListener("paste", onPaste)
    return () => window.removeEventListener("paste", onPaste)
  }, [hover, uploadFile])

  // ----------------------------------------------------
  // DELETE
  // ----------------------------------------------------

  const remove = async (mediaId: string) => {
    if (!farmId) return
    if (!confirm("Delete this farm photo?")) return
    await fetch(`/api/producer/farms/${farmId}/media/${mediaId}`, {
      method: "DELETE",
      credentials: "include",
    })
    refresh(farmId)
  }

  // ----------------------------------------------------
  // RENDER
  // ----------------------------------------------------

  if (!farmId && !loading) {
    return (
      <div className="hidden md:flex w-[260px] h-[120px] relative items-center justify-center rounded-xl bg-gradient-to-br from-[#e8dfd1] to-[#d6c7b2] opacity-70 text-[11px] text-[#7b6851] text-center px-4">
        Complete farm onboarding to upload photos.
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className="hidden md:block w-[260px] h-[120px] relative outline-none"
      tabIndex={-1}
    >
      {/* Hidden file input — opened by clicking the empty zone */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={onFileInputChange}
      />

      {/* BASE */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-[#e8dfd1] to-[#d6c7b2] opacity-60" />

      {/* DRAG OVERLAY */}
      {dragOver && !uploading && (
        <div className="absolute inset-0 rounded-xl border-2 border-dashed border-[#8d6a43] bg-[#fffbf5]/85 flex items-center justify-center text-[11.5px] font-medium text-[#5f472f] z-30 pointer-events-none">
          Drop image to upload
        </div>
      )}

      {/* UPLOADING OVERLAY */}
      {uploading && (
        <div className="absolute inset-0 rounded-xl bg-[#fffbf5]/85 flex items-center justify-center text-[11.5px] font-medium text-[#5f472f] z-30">
          <span className="inline-flex items-center gap-2">
            <Spinner /> Uploading…
          </span>
        </div>
      )}

      {/* TOP-RIGHT CONTROL — Edit / Done.
          Hidden in the empty state (nothing to confirm yet) and
          while another async op is in flight. */}
      {!loading && media.length > 0 && !uploading && !dragOver && (
        <button
          type="button"
          onClick={() => setEditMode((v) => !v)}
          aria-label={editMode ? "Save and close edit mode" : "Edit photos"}
          title={editMode ? "Done — close edit mode" : "Edit photos"}
          className="
            absolute top-2 right-2 z-20 grid h-6 w-6 place-items-center
            rounded-full bg-[#fffbf5]/95 border border-[#a98355]/40
            text-[#5f472f] shadow-sm transition-colors
            hover:bg-[#f7efdf] hover:text-[#3f2e1d]
          "
        >
          {editMode ? <CheckIcon /> : <PencilIcon />}
        </button>
      )}

      {/* PREVIEW STRIP */}
      <div className="absolute inset-0 rounded-xl overflow-hidden p-2 flex gap-2">
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-[10px] text-[#7b6851]">
            Loading…
          </div>
        ) : media.length === 0 ? (
          <button
            type="button"
            onClick={openPicker}
            className="
              flex-1 flex flex-col items-center justify-center gap-1
              border border-dashed border-[#a98355]/45 rounded-md
              text-[10.5px] text-[#7b6851] hover:bg-[#fffbf2]/50
              transition-colors
            "
            title="Click, drag a file, or paste from clipboard"
          >
            <UploadIcon />
            <span>Add farm photo</span>
            <span className="text-[9px] opacity-70">click · drop · paste</span>
          </button>
        ) : (
          <>
            {media.slice(0, 3).map((m) => (
              <div
                key={m.id}
                className="relative flex-1 h-full rounded-md overflow-hidden group/thumb bg-black/5"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={m.url}
                  alt={m.altText ?? "Farm photo"}
                  className="absolute inset-0 h-full w-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none"
                  }}
                />
                {/* Delete only available in edit mode. Hidden entirely
                    in read mode so the saved card stays "clean". */}
                {editMode && (
                  <button
                    type="button"
                    onClick={() => remove(m.id)}
                    aria-label="Delete photo"
                    className="
                      absolute top-1 right-1 z-10 grid h-5 w-5 place-items-center
                      rounded-full bg-black/55 text-white/95 opacity-0
                      group-hover/thumb:opacity-100 transition-opacity
                      hover:bg-black/75
                    "
                  >
                    <TrashIcon />
                  </button>
                )}
                {m.isPrimary && (
                  <span className="absolute bottom-1 left-1 rounded-full bg-[#d4af37] px-1.5 py-px text-[8.5px] font-semibold uppercase tracking-wide text-[#1a0f08]">
                    Primary
                  </span>
                )}
              </div>
            ))}
            {/* "+" slot only in edit mode. Read mode → cleaner card. */}
            {editMode && media.length < 3 && (
              <button
                type="button"
                onClick={openPicker}
                aria-label="Add farm photo"
                title="Click, drag a file, or paste from clipboard"
                className="
                  w-12 h-full rounded-md border border-dashed
                  border-[#a98355]/45 text-[#7b6851]
                  flex items-center justify-center
                  hover:bg-[#fffbf2]/60 transition-colors
                "
              >
                <UploadIcon />
              </button>
            )}
          </>
        )}
      </div>

      {/* COUNT BADGE */}
      {!loading && media.length > 0 && (
        <span className="absolute -bottom-2 right-2 rounded-full border border-[#a98355]/40 bg-[#fffbf5] px-2 py-[2px] text-[9.5px] font-medium text-[#5f472f] shadow-sm">
          {media.length} farm photo{media.length === 1 ? "" : "s"}
        </span>
      )}

      {/* ERROR */}
      {error && (
        <div className="absolute -bottom-7 left-0 right-0 text-[10px] text-red-700 px-2 truncate" title={error}>
          {error}
        </div>
      )}
    </div>
  )
}

// ------------------------------------------------------
// ICONS
// ------------------------------------------------------

function UploadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  )
}

function Spinner() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}

function PencilIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}
