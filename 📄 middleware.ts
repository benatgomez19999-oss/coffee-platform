import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { verifyToken } from "@/lib/auth"

export function middleware(req: NextRequest) {

  const token = req.cookies.get("auth_token")?.value

  // proteger platform
  if (req.nextUrl.pathname.startsWith("/platform")) {

    if (!token) {
      return NextResponse.redirect(new URL("/login", req.url))
    }

    const payload = verifyToken(token)

    if (!payload) {
      return NextResponse.redirect(new URL("/login", req.url))
    }
  }

  // evitar entrar a login si ya estás logeado
  if (req.nextUrl.pathname === "/login" && token) {
    return NextResponse.redirect(new URL("/platform", req.url))
  }

  return NextResponse.next()
}


export const config = {
  matcher: ["/platform/:path*", "/login"]
}