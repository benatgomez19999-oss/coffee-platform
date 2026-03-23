"use client"

import { Suspense } from "react"
import ContractCreateContent from "./ContractCreateContent"

export default function Page() {
  
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ContractCreateContent />
    </Suspense>
  )
}