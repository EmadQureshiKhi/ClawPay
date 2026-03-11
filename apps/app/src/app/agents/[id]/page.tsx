import { Suspense } from "react"
import AgentDetailPage from "@/components/custom-ui/agent-detail-page"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return {
    title: `Agent #${id} — ClawPay`,
    description: `View agent identity, reputation, and capabilities on the ClawPay Agent Society.`,
  }
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading agent...</div>}>
      <AgentDetailPage agentId={id} />
    </Suspense>
  )
}
