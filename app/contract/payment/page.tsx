import { Suspense } from "react"
import PaymentClient from "./PaymentClient"

export const dynamic = "force-dynamic"

export default function Page() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-neutral-950 text-white">
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-10 w-full max-w-md text-center shadow-xl">
          <div className="w-12 h-12 border-4 border-neutral-700 border-t-white rounded-full animate-spin mx-auto mb-6" />
          <h1 className="text-xl font-semibold">Loading payment...</h1>
        </div>
      </div>
    }>
      <PaymentClient />
    </Suspense>
  )
}

 