import { Suspense } from "react"
import AgentsPage from "@/components/custom-ui/agents-page"

export const metadata = {
  title: "Agent Society — ClawPay",
  description: "On-chain AI agent registry with ERC-8004 identity, reputation, and capability discovery on Hedera.",
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading agents...</div>}>
      <AgentsPage />
    </Suspense>
  )
}
