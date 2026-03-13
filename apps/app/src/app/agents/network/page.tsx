import { Suspense } from "react"
import AgentNetwork from "@/components/custom-ui/agent-network"

export const metadata = {
  title: "Agent Network — ClawPay",
  description: "Live visualization of the autonomous agent society on Hedera",
}

export default function NetworkPage() {
  return (
    <Suspense fallback={
      <div className="bg-black min-h-screen flex items-center justify-center">
        <div className="text-white/20 font-mono text-sm">Loading network...</div>
      </div>
    }>
      <AgentNetwork />
    </Suspense>
  )
}
