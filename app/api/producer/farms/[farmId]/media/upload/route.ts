import { NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { randomBytes } from "crypto"
import { getUserFromRequest } from "@/src/lib/getUserFromRequest"
import {
  createFarmMedia,
  LotMediaServiceError,
} from "@/src/services/lot-media/lotMedia.service"
import {
  normalizeLotMediaRole,
  normalizeLotMediaVisibility,
} from "@/src/services/lot-media/lotMedia.pure"

//////////////////////////////////////////////////////
// POST /api/producer/farms/[farmId]/media/upload
//
// PARTNER-MEDIA-2A.1 — multipart upload from device/clipboard.
//
// Accepts a single image file via FormData "file" and writes
// it to public/uploads/farm/<farmId>/<random>.<ext>. Next.js
// serves /public/* statically, so the resulting URL becomes
// /uploads/farm/<farmId>/<random>.<ext> — exactly the shape
// validateLotMediaUrl already accepts.
//
// Optional FormData fields:
//   role        — defaults to FARM
//   visibility  — defaults to PUBLIC_MARKET
//   isPrimary   — "true" / "1" sets the new row as primary
//   altText     — optional caption-like text
//
// The DB row is created via createFarmMedia so the same
// single-primary transaction + ownership checks apply. If
// the row insert fails after the file is on disk, we delete
// the file before returning the error.
//
// LIMITATION: writes to the local filesystem — works in
// `next dev` and traditional Node hosts but NOT in
// serverless functions (Vercel etc.). STORAGE-MEDIA-1 will
// migrate this to Supabase Storage signed uploads.
//////////////////////////////////////////////////////

const MAX_BYTES = 8 * 1024 * 1024 // 8 MB
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"])

function extensionForMime(mime: string): string {
  if (mime === "image/jpeg") return "jpg"
  if (mime === "image/png") return "png"
  if (mime === "image/webp") return "webp"
  return "bin"
}

export async function POST(
  req: NextRequest,
  { params }: { params: { farmId: string } },
) {
  // ─── AUTH ──────────────────────────────────────────
  const user = await getUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (user.role !== "PRODUCER" && user.role !== "PARTNER" && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // ─── PARSE BODY ────────────────────────────────────
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data body." },
      { status: 400 },
    )
  }

  const file = formData.get("file")
  if (!(file instanceof Blob)) {
    return NextResponse.json(
      { error: "Field \"file\" is required and must be a file." },
      { status: 400 },
    )
  }
  const mime = file.type
  if (!ALLOWED_MIME.has(mime)) {
    return NextResponse.json(
      {
        error: `Unsupported file type${mime ? `: ${mime}` : ""}. Use JPEG, PNG or WebP.`,
      },
      { status: 415 },
    )
  }
  if (file.size <= 0) {
    return NextResponse.json({ error: "File is empty." }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large (max ${MAX_BYTES / 1024 / 1024} MB).` },
      { status: 413 },
    )
  }

  // Optional fields
  const role =
    normalizeLotMediaRole(formData.get("role")) ?? "FARM"
  const visibility =
    normalizeLotMediaVisibility(formData.get("visibility")) ?? "PUBLIC_MARKET"
  const isPrimary =
    formData.get("isPrimary") === "true" || formData.get("isPrimary") === "1"
  const altTextRaw = formData.get("altText")
  const altText =
    typeof altTextRaw === "string" && altTextRaw.trim() !== ""
      ? altTextRaw
      : undefined

  // ─── WRITE FILE TO DISK ────────────────────────────
  const filename = `${randomBytes(16).toString("hex")}.${extensionForMime(mime)}`
  const farmDir = join(
    process.cwd(),
    "public",
    "uploads",
    "farm",
    params.farmId,
  )
  const filePath = join(farmDir, filename)
  const publicUrl = `/uploads/farm/${params.farmId}/${filename}`

  try {
    await mkdir(farmDir, { recursive: true })
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(filePath, buffer)
  } catch (err) {
    console.error("[FARM_MEDIA_UPLOAD] disk write failed:", err)
    return NextResponse.json(
      { error: "Failed to store uploaded file." },
      { status: 500 },
    )
  }

  // ─── CREATE DB ROW ─────────────────────────────────
  try {
    const row = await createFarmMedia(
      params.farmId,
      {
        url: publicUrl,
        role,
        visibility,
        isPrimary,
        altText,
      },
      {
        userId: user.id,
        role:
          user.role === "ADMIN"
            ? "ADMIN"
            : user.role === "PARTNER"
              ? "PARTNER"
              : "PRODUCER",
      },
    )
    return NextResponse.json({ media: row }, { status: 201 })
  } catch (err) {
    // Best-effort cleanup of the orphaned file.
    try {
      const { unlink } = await import("fs/promises")
      await unlink(filePath)
    } catch {
      /* ignore */
    }
    if (err instanceof LotMediaServiceError) {
      return NextResponse.json(
        {
          code: err.code,
          error: err.message,
          ...(err.details ? { details: err.details } : {}),
        },
        { status: err.status },
      )
    }
    console.error("[FARM_MEDIA_UPLOAD] DB insert failed:", err)
    return NextResponse.json(
      { error: "Failed to record uploaded file." },
      { status: 500 },
    )
  }
}

// Default Next route body size is 1MB; we accept up to 8MB images.
// "force-dynamic" so the route is never statically optimised.
export const dynamic = "force-dynamic"
export const runtime = "nodejs"
