// =====================================================
// SIGNATURE REQUEST
// =====================================================

function generateSignatureToken() {

  return crypto.randomUUID()

}


// =====================================================
// REQUEST SIGNATURE
// =====================================================

export function requestSignature(
  contractId: string,
  phone: string
) {

  // =====================================================
  // GENERATE TOKEN
  // =====================================================

  const token =
    generateSignatureToken()


// =====================================================
// SIGNING LINK
// =====================================================

 // =====================================================
// NETWORK HOST
// =====================================================

const host =
  window.location.hostname === "localhost"
    ? "172.20.10.2"
    : window.location.hostname

const signingLink =
  `http://${host}:3000/sign/${contractId}`


  // =====================================================
  // DEV LOG
  // =====================================================

  console.log("SIGNATURE REQUEST")

  console.log("Contract:", contractId)
  console.log("Token:", token)
  console.log("Send to phone:", phone)
  console.log("Link:", signingLink)


  // =====================================================
  // DEMO ALERT
  // =====================================================

  alert(
    "Signature request created.\n\nOpen this link on mobile:\n\n" +
    signingLink
  )


  // =====================================================
  // RETURN LINK
  // =====================================================

  return signingLink

}