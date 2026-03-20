export type SignatureToken = {

  token: string
  contractId: string
  phone: string

  expiresAt: number

  verified: boolean
  signed: boolean

}

export type SignatureRequest = {

  contractId: string
  phone: string

}