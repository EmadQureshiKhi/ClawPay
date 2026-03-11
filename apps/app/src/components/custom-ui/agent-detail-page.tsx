"use client"

import Footer from "@/components/custom-ui/footer"
import { useEffect, useState } from "react"
import { Star, Bot, ExternalLink, ArrowLeft, Shield, Activity, Clock, Hash } from "lucide-react"
import Link from "next/link"

interface AgentCapability {
  toolName: string
  description: string
  priceUsdcAtomic: number
  priceUsd: string
  mcpEndpoint: string
}

interface Feedback {
  fromAgent: number
  toAgent: number
  rating: number
  commentHash: string
  timestamp: string
}

interface HcsComment {
  fromAgent: number
  toAgent: number
  rating: number
  comment?: string
  sequenceNumber: number
  consensusTimestamp: string
}

interface AgentDetail {
  tokenId: number
  owner: string
  profile: {
    name: string
    description: string
    owner: string
    evmAddress: string
    mcpEndpoint?: string
    capabilities: string[]
    createdAt: string
  } | null
  reputation: { avg: number; count: number }
  capabilities: AgentCapability[]
  feedbacks: Feedback[]
  hcsComments: HcsComment[]
  hashscanContract: string
  hashscanReputation: string
}

function StarRating({ avg, count, size = "sm" }: { avg: number; count: number; size?: "sm" | "lg" }) {
  const stars = Math.round(avg)
  const cls = size === "lg" ? "h-5 w-5" : "h-3.5 w-3.5"
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star key={i} className={`${cls} ${i <= stars ? "fill-amber-400 text-amber-400" : "text-white/20"}`} />
        ))}
      </div>
      <span className={`font-mono text-white/50 ${size === "lg" ? "text-sm" : "text-xs"}`}>
        {count > 0 ? `${avg.toFixed(1)} (${count} ${count === 1 ? "rating" : "ratings"})` : "No ratings yet"}
      </span>
    </div>
  )
}

function DetailRow({ label, value, href, mono = true }: { label: string; value: string; href?: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-[11px] font-mono uppercase tracking-wider text-white/40">{label}</span>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className={`text-xs ${mono ? "font-mono" : ""} text-white/70 hover:text-white underline decoration-dotted underline-offset-2 flex items-center gap-1`}>
          {value} <ExternalLink className="h-3 w-3" />
        </a>
      ) : (
        <span className={`text-xs ${mono ? "font-mono" : ""} text-white`}>{value}</span>
      )}
    </div>
  )
}

function formatTimestamp(ts: string) {
  try {
    const d = new Date(ts)
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })
  } catch { return ts }
}

export default function AgentDetailPage({ agentId }: { agentId: string }) {
  const [agent, setAgent] = useState<AgentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch(`/api/agents/${agentId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Agent not found")
        return r.json()
      })
      .then((data) => setAgent(data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [agentId])

  if (loading) {
    return (
      <div className="bg-background min-h-screen">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-24">
          <div className="animate-pulse space-y-6">
            <div className="h-6 bg-white/[0.06] rounded w-48" />
            <div className="h-40 bg-white/[0.04] rounded-lg" />
            <div className="h-60 bg-white/[0.04] rounded-lg" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !agent) {
    return (
      <div className="bg-background min-h-screen">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-24 text-center">
          <Bot className="h-12 w-12 text-white/20 mx-auto mb-4" />
          <p className="text-lg text-foreground mb-2">Agent not found</p>
          <p className="text-sm text-muted-foreground mb-6">{error || "This agent does not exist."}</p>
          <Link href="/agents" className="text-sm font-mono text-white/50 hover:text-white underline decoration-dotted underline-offset-2">
            Back to Agent Society
          </Link>
        </div>
      </div>
    )
  }

  const name = agent.profile?.name || `Agent #${agent.tokenId}`
  const desc = agent.profile?.description || "Registered agent"
  const capCount = agent.capabilities.length

  let role = "AGENT"
  if (capCount > 0) role = "PROVIDER"
  if (agent.profile?.capabilities?.includes("generate_report")) role = "CONSUMER"

  const roleColors: Record<string, string> = {
    PROVIDER: "bg-emerald-500/10 text-emerald-400",
    CONSUMER: "bg-blue-500/10 text-blue-400",
    AGENT: "bg-white/[0.06] text-white/50",
  }

  return (
    <div className="bg-background min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 sm:pt-24 pb-24">
        {/* Back link */}
        <Link href="/agents" className="inline-flex items-center gap-1.5 text-xs font-mono text-white/40 hover:text-white/60 transition-colors mb-8">
          <ArrowLeft className="h-3.5 w-3.5" /> AGENT SOCIETY
        </Link>

        {/* Profile Header */}
        <div className="rounded-lg bg-black dark:bg-[#0a0a0a] border border-white/[0.08] overflow-hidden mb-6">
          <div className="px-6 py-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-white/[0.06] flex items-center justify-center flex-shrink-0">
                <Bot className="h-6 w-6 text-white/60" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-xl font-bold text-white">{name}</h1>
                  <span className={`text-[10px] font-mono font-medium uppercase tracking-wider px-2 py-0.5 rounded ${roleColors[role]}`}>
                    {role}
                  </span>
                </div>
                <p className="text-sm text-white/40 mb-3">{desc}</p>
                <StarRating avg={agent.reputation.avg} count={agent.reputation.count} size="lg" />
              </div>
            </div>
          </div>

          <div className="h-px bg-white/[0.06]" />

          {/* Details */}
          <div className="px-6 py-4">
            <DetailRow label="Token ID" value={`#${agent.tokenId}`} />
            <DetailRow label="Owner" value={`${agent.owner.slice(0, 10)}...${agent.owner.slice(-8)}`} href={`https://hashscan.io/testnet/account/${agent.owner}`} />
            {agent.profile?.evmAddress && (
              <DetailRow label="EVM Address" value={`${agent.profile.evmAddress.slice(0, 10)}...${agent.profile.evmAddress.slice(-8)}`} href={`https://hashscan.io/testnet/account/${agent.profile.evmAddress}`} />
            )}
            {agent.profile?.mcpEndpoint && (
              <DetailRow label="MCP Endpoint" value={agent.profile.mcpEndpoint} />
            )}
            {agent.profile?.createdAt && (
              <DetailRow label="Registered" value={formatTimestamp(agent.profile.createdAt)} />
            )}
            <DetailRow label="Network" value="Hedera Testnet" />
          </div>

          <div className="h-px bg-white/[0.06]" />

          {/* HashScan links */}
          <div className="px-6 py-3 flex flex-wrap gap-4">
            <a href={agent.hashscanContract} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[11px] font-mono text-white/40 hover:text-white/60 transition-colors">
              <Shield className="h-3.5 w-3.5" /> REGISTRY CONTRACT <ExternalLink className="h-3 w-3" />
            </a>
            <a href={agent.hashscanReputation} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[11px] font-mono text-white/40 hover:text-white/60 transition-colors">
              <Activity className="h-3.5 w-3.5" /> REPUTATION TOPIC <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        {/* Capabilities */}
        {agent.capabilities.length > 0 && (
          <div className="rounded-lg bg-black dark:bg-[#0a0a0a] border border-white/[0.08] overflow-hidden mb-6">
            <div className="px-6 py-4">
              <h2 className="text-sm font-mono uppercase tracking-wider text-white/60 mb-4">Published Capabilities</h2>
              <div className="space-y-3">
                {agent.capabilities.map((cap) => (
                  <div key={cap.toolName} className="rounded bg-white/[0.02] border border-white/[0.06] p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-white font-mono">{cap.toolName}</span>
                      <span className="text-xs font-mono text-emerald-400">${cap.priceUsd} USDC</span>
                    </div>
                    <p className="text-xs text-white/40 leading-relaxed">{cap.description}</p>
                    {cap.mcpEndpoint && (
                      <p className="text-[10px] font-mono text-white/25 mt-2">{cap.mcpEndpoint}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Feedback History */}
        {agent.feedbacks.length > 0 && (
          <div className="rounded-lg bg-black dark:bg-[#0a0a0a] border border-white/[0.08] overflow-hidden mb-6">
            <div className="px-6 py-4">
              <h2 className="text-sm font-mono uppercase tracking-wider text-white/60 mb-4">On-Chain Feedback</h2>
              <div className="space-y-2">
                {agent.feedbacks.map((fb, i) => (
                  <div key={i} className="flex items-center justify-between py-2.5 border-b border-white/[0.04] last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star key={s} className={`h-3 w-3 ${s <= fb.rating ? "fill-amber-400 text-amber-400" : "text-white/20"}`} />
                        ))}
                      </div>
                      <span className="text-[11px] font-mono text-white/40">from Agent #{fb.fromAgent}</span>
                    </div>
                    <span className="text-[10px] font-mono text-white/25 flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {formatTimestamp(fb.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* HCS Comments */}
        {agent.hcsComments.length > 0 && (
          <div className="rounded-lg bg-black dark:bg-[#0a0a0a] border border-white/[0.08] overflow-hidden mb-6">
            <div className="px-6 py-4">
              <h2 className="text-sm font-mono uppercase tracking-wider text-white/60 mb-4">HCS Reputation Messages</h2>
              <div className="space-y-2">
                {agent.hcsComments.map((msg, i) => (
                  <div key={i} className="rounded bg-white/[0.02] border border-white/[0.06] p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star key={s} className={`h-3 w-3 ${s <= msg.rating ? "fill-amber-400 text-amber-400" : "text-white/20"}`} />
                          ))}
                        </div>
                        <span className="text-[11px] font-mono text-white/40">from Agent #{msg.fromAgent}</span>
                      </div>
                      <span className="text-[10px] font-mono text-white/25 flex items-center gap-1">
                        <Hash className="h-3 w-3" /> seq {msg.sequenceNumber}
                      </span>
                    </div>
                    {msg.comment && <p className="text-xs text-white/50 leading-relaxed">{msg.comment}</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  )
}
