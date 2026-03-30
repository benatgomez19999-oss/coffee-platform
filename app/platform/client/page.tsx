import Dashboard from "@/components/platform/client/Dashboard"
import { getUserFromRequest } from "@/lib/getUserFromRequest"

export default async function ClientPage() {

  const user = await getUserFromRequest()

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