import { NextResponse } from "next/server"

export async function POST() {
  const res = NextResponse.json({ success: true })

  // 🔥 SIN SECURE
  res.cookies.set("auth_token", "", {
    path: "/",
    expires: new Date(0)
  })

  // 🔥 CON SECURE
  res.cookies.set("auth_token", "", {
    path: "/",
    secure: true,
    expires: new Date(0)
  })

  // 🔥 EXTRA: forzar también Max-Age
  res.headers.append(
    "Set-Cookie",
    "auth_token=; Path=/; Max-Age=0"
  )

  return res
}