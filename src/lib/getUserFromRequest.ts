import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/database/prisma";
import { NextRequest } from "next/server";

export async function getUserFromRequest(req?: NextRequest) {
  try {
    //////////////////////////////////////////////////////
    // 🍪 GET TOKEN (DUAL MODE 🔥)
    //////////////////////////////////////////////////////

    let token: string | undefined;

    // 👉 modo API (con req)
    if (req) {
      token = req.cookies.get("auth_token")?.value;
    }

    // 👉 fallback modo server (cookies())
    if (!token) {
      token = cookies().get("auth_token")?.value;
    }

    if (!token) return null;

    //////////////////////////////////////////////////////
    // 🔐 VERIFY TOKEN
    //////////////////////////////////////////////////////

    const payload = verifyToken(token);

    if (!payload?.userId) return null;

    //////////////////////////////////////////////////////
    // 👤 FETCH USER
    //////////////////////////////////////////////////////

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: {
        company: true,
      },
    });

    return user;

  } catch (error) {
    console.error("getUserFromRequest error:", error);
    return null;
  }
}