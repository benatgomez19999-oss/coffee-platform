import ProducerDashboard from "@/components/platform/ProducerDashboard"
import { getUserFromRequest } from "@/lib/getUserFromRequest"

export default async function ProducerPage() {
  const user = await getUserFromRequest()

  return <ProducerDashboard user={user} />
}