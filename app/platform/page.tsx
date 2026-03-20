import { redirect } from "next/navigation"
import { getUserFromRequest } from "@/lib/getUserFromRequest"
import Dashboard from "@/components/platform/Dashboard"

export default async function PlatformPage() {

  // ======================================================
  // AUTH (SERVER SIDE — PRO)
  // ======================================================

  const user = await getUserFromRequest()

  if (!user) {
    redirect("/signup")
  }

  // ======================================================
  // UI
  // ======================================================
return (
  <div style={{
    minHeight: "100vh",
    background: "#0b0f0f",
    color: "white"
  }}>
    <Dashboard user={user as any} />
  </div>
)
  
}




 











