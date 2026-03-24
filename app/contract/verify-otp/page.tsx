// =====================================================
// VERIFY OTP PAGE (SERVER WRAPPER)
// =====================================================

export const dynamic = "force-dynamic"

import VerifyOtpClient from "./VerifyOtpClient"
import { useSearchParams } from "next/navigation"

const searchParams = useSearchParams()
const contractId = searchParams.get("contractId")

type Props = {
  searchParams: {
    contractId?: string
  }
}

export default function VerifyOtpPage({ searchParams }: Props) {

  const contractId = searchParams.contractId

  return (
    <VerifyOtpClient contractId={contractId} />
  )
}

