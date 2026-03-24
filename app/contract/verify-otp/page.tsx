// =====================================================
// VERIFY OTP PAGE (SERVER WRAPPER)
// =====================================================

export const dynamic = "force-dynamic"

import VerifyOtpClient from "./VerifyOtpClient"




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

