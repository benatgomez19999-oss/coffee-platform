import { headers } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/database/prisma";

export async function getUserFromRequest() {

  const headersList = await headers();
  const cookieHeader = headersList.get("cookie") || "";

  const token = cookieHeader
    .split("; ")
    .find((c) => c.startsWith("auth_token="))
    ?.split("=")[1];

  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: {
      company: true,
    },
  });

  return user;
}