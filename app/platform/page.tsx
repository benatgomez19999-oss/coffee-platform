import { redirect } from "next/navigation"
import { getUserFromRequest } from "@/lib/getUserFromRequest"

export default async function PlatformPage() {

  const user = await getUserFromRequest()

  if (!user) {
    redirect("/signup")
  }

  //////////////////////////////////////////////////////
  // 🧠 ROLE ROUTING
  //////////////////////////////////////////////////////

  // 🔥 PARTNER FIRST (importante)
  if (user.role === "PARTNER") {
    redirect("/platform/partner")
  }

  if (user.role === "PRODUCER") {
    redirect("/platform/producer")
  }

  //////////////////////////////////////////////////////
  // 👇 CLIENT (DEFAULT)
  //////////////////////////////////////////////////////

  redirect("/platform/client")
}