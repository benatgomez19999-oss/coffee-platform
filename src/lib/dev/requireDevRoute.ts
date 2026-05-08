import { NextResponse } from "next/server"
import { getUserFromRequest } from "@/src/lib/getUserFromRequest"

// =====================================================
// requireDevRoute — central guard for /api/dev/* routes
//
// Allows the request only if BOTH:
//   1) VERCEL_ENV is NOT "production"        (hard kill in prod)
//   2) INTERNAL_DEV_TOOLS_ENABLED === "true" (explicit opt-in)
//
// Why VERCEL_ENV instead of NODE_ENV:
//   On Vercel, NODE_ENV is "production" for both Production
//   and Preview deployments, which makes a NODE_ENV-only
//   guard block Preview environments where dev tooling
//   actually needs to run. VERCEL_ENV distinguishes them
//   ("production" / "preview" / "development") and is
//   undefined locally.
//
// Why an explicit feature flag on top:
//   So a Preview deployment is NOT auto-permissive. The
//   flag must be set deliberately on the Preview environment
//   in Vercel for the dev bypass to work, and can be removed
//   instantly without code changes.
//
// Auth rule:
//   By default the guard also requires an authenticated user.
//   /api/dev/login-as is the only route that opts out via
//   { requireUser: false } because it IS the route that
//   establishes the session.
// =====================================================

type GuardUser = NonNullable<Awaited<ReturnType<typeof getUserFromRequest>>>

type DevGuardFail = { ok: false; response: NextResponse }
type DevGuardOk<U> = { ok: true; user: U }

export type DevGuardResult<U = GuardUser | null> = DevGuardOk<U> | DevGuardFail

// ---------------------------------------------------
// Overloads — the caller's options choose the return shape
// ---------------------------------------------------

export function requireDevRoute(): Promise<
  DevGuardOk<GuardUser> | DevGuardFail
>
export function requireDevRoute(opts: {
  requireUser: true
}): Promise<DevGuardOk<GuardUser> | DevGuardFail>
export function requireDevRoute(opts: {
  requireUser: false
}): Promise<DevGuardOk<null> | DevGuardFail>

// ---------------------------------------------------
// Implementation
// ---------------------------------------------------

export async function requireDevRoute(
  opts: { requireUser?: boolean } = {}
): Promise<DevGuardOk<GuardUser> | DevGuardOk<null> | DevGuardFail> {

  const requireUser = opts.requireUser ?? true

  // 1) Hard kill on Vercel Production
  if (process.env.VERCEL_ENV === "production") {
    return fail(403, "Not allowed")
  }

  // 2) Explicit opt-in flag
  if (process.env.INTERNAL_DEV_TOOLS_ENABLED !== "true") {
    return fail(403, "Not allowed")
  }

  // 3) Authenticated user (default)
  if (requireUser) {
    const user = await getUserFromRequest()
    if (!user) {
      return fail(401, "Unauthorized")
    }
    return { ok: true, user }
  }

  return { ok: true, user: null }
}

function fail(status: number, message: string): DevGuardFail {
  return {
    ok: false,
    response: NextResponse.json({ error: message }, { status }),
  }
}
