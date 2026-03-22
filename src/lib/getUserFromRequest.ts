import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/database/prisma";

export async function getUserFromRequest() {

  // =====================================================
  // 🍪 GET TOKEN FROM COOKIES (SAFE - NEXT API)
  // =====================================================

  const token = cookies().get("auth_token")?.value;

  if (!token) return null;

  // =====================================================
  // 🔐 VERIFY TOKEN
  // =====================================================

  const payload = verifyToken(token);

  if (!payload) return null;

  // =====================================================
  // 👤 FETCH USER
  // =====================================================

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: {
      company: true,
    },
  });

  return user;
}