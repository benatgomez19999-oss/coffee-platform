import { NextResponse } from "next/server";

// ✅ NECESARIO para Vercel (evita problemas en build/runtime)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  // ✅ Creamos la respuesta base
  const response = NextResponse.json({ success: true });

  // ✅ Eliminamos la cookie correctamente (UNA sola vez, bien configurada)
  response.cookies.set("auth_token", "", {
    httpOnly: true,
    secure: true, // ⚠️ en producción siempre true
    sameSite: "lax",
    path: "/",
    expires: new Date(0), // fuerza eliminación inmediata
  });

  return response;
}