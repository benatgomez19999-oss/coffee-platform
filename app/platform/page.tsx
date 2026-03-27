import { redirect } from "next/navigation"
import { getUserFromRequest } from "@/lib/getUserFromRequest"

export default async function PlatformPage() {

  const user = await getUserFromRequest()

  if (!user) {
    redirect("/signup")
  }

  // 🔥 CLAVE — routing por role
  if (user.role === "PRODUCER") {
    redirect("/platform/producer")
  }

  // 👇 cliente (default)
  redirect("/platform/client")
}