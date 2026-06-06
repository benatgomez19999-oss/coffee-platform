import { notFound } from "next/navigation"

//////////////////////////////////////////////////////
// gateDevPage — Server Component guard for /dev/*
// (DEV-TEST-SETUP-1)
//
// Mirrors requireDevRoute() for Server Components.
// Returns void on success; calls notFound() when the
// caller is not allowed to see the page (renders 404).
//
// Rules — identical to requireDevRoute:
//   1) VERCEL_ENV is NOT "production"
//   2) INTERNAL_DEV_TOOLS_ENABLED === "true"
//
// Intentionally returns void rather than a boolean
// so callers can't accidentally render the page on
// failure: `notFound()` throws a NEXT_NOT_FOUND error
// that Next.js catches and renders the closest
// not-found boundary (or default 404).
//
// Existing /dev/* pages do not call this guard. The
// blast radius for DEV-TEST-SETUP-1 forbids modifying
// them — the new page wires it.
//////////////////////////////////////////////////////

export function gateDevPage(): void {
  if (process.env.VERCEL_ENV === "production") {
    notFound()
  }
  if (process.env.INTERNAL_DEV_TOOLS_ENABLED !== "true") {
    notFound()
  }
}
