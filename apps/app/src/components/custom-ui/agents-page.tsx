"use client"

import Footer from "@/components/custom-ui/footer"
import AgentFlowViz from "@/components/custom-ui/agent-flow-viz"
import { useEffect, useState, useMemo, useCallback, useRef } from "react"
import { Input } from "@/components/ui/input"
import {
  Search, Star, ExternalLink, Bot, Shield, Activity,
  Play, Loader2, CheckCircle2, ArrowRight, Zap, Clock,
  Radio, ChevronDown, ChevronUp,
} from "lucide-react"
import Link from "next/link"

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface AgentCapability {
  toolName: string
  description: string
  priceUsdcAtomic: number
  priceUsd: string
  mcpEndpoint: string
}

interface Agent {
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
}

interface DemoEvent {
  step: number
  totalSteps: number
  type: "init" | "discover" | "evaluate" | "call" | "payment" | "result" | "rating" | "report" | "complete"
  agent?: string
  target?: string
  title: string
  detail: string
  data?: any
  timestamp: string
}

interface ActivityItem {
  type: "reputation" | "payment"
  topicId: string
  sequenceNumber: number
  consensusTimestamp: string
  [key: string]: any
}

const REGISTRY_ADDRESS = "0x411278256411dA9018e3c880Df21e54271F2502b"
const REPUTATION_TOPIC = "0.0.8107518"

// ═══════════════════════════════════════════════════════════════
// SMALL COMPONENTS
// ═══════════════════════════════════════════════════════════════

function StarRating({ avg, count }: { avg: number; count: number }) {
  const stars = Math.round(avg)
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star key={i} className={`h-3.5 w-3.5 ${i <= stars ? "fill-amber-400 text-amber-400" : "text-white/20"}`} />
        ))}
      </div>
      <span className="text-xs text-white/50 font-mono">
        {count > 0 ? `${avg.toFixed(1)} (${count})` : "unrated"}
      </span>
    </div>
  )
}

const EVENT_ICONS: Record<string, typeof Bot> = {
  init: Radio,
  discover: Search,
  evaluate: Shield,
  call: Zap,
  payment: CheckCircle2,
  result: ArrowRight,
  rating: Star,
  report: Activity,
  complete: CheckCircle2,
}

const EVENT_COLORS: Record<string, string> = {
  init: "text-blue-400 bg-blue-500/10",
  discover: "text-purple-400 bg-purple-500/10",
  evaluate: "text-amber-400 bg-amber-500/10",
  call: "text-cyan-400 bg-cyan-500/10",
  payment: "text-emerald-400 bg-emerald-500/10",
  result: "text-white/60 bg-white/[0.06]",
  rating: "text-amber-400 bg-amber-500/10",
  report: "text-rose-400 bg-rose-500/10",
  complete: "text-emerald-400 bg-emerald-500/10",
}

// ═══════════════════════════════════════════════════════════════
// LIVE DEMO PANEL
// ═══════════════════════════════════════════════════════════════

function LiveDemoPanel({ onDemoComplete }: { onDemoComplete?: (events: DemoEvent[]) => void }) {
  const [running, setRunning] = useState(false)
  const [events, setEvents] = useState<DemoEvent[]>([])
  const [done, setDone] = useState(false)
  const feedRef = useRef<HTMLDivElement>(null)

  const runDemo = useCallback(() => {
    setRunning(true)
    setEvents([])
    setDone(false)

    const evtSource = new EventSource("/api/agents/demo")

    evtSource.onmessage = (e) => {
      try {
        const event: DemoEvent = JSON.parse(e.data)
        setEvents((prev) => {
          const next = [...prev, event]
          if (event.type === "complete") {
            onDemoComplete?.(next)
          }
          return next
        })
        if (event.type === "complete") {
          setDone(true)
          setRunning(false)
          evtSource.close()
        }
      } catch {}
    }

    evtSource.onerror = () => {
      setRunning(false)
      setDone(true)
      evtSource.close()
    }
  }, [onDemoComplete])

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight
    }
  }, [events])

  return (
    <div className="rounded-lg bg-black dark:bg-[#0a0a0a] border border-white/[0.08] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${running ? "bg-emerald-400 animate-pulse" : done ? "bg-emerald-400" : "bg-white/20"}`} />
          <h2 className="text-sm font-mono uppercase tracking-wider text-white/60">
            {running ? "LIVE DEMO RUNNING" : done ? "DEMO COMPLETE" : "MULTI-AGENT ORCHESTRATION"}
          </h2>
        </div>
        <button
          onClick={runDemo}
          disabled={running}
          className="inline-flex items-center gap-2 px-4 py-2 rounded bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-xs font-mono uppercase tracking-wider text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {running ? (
            <><Loader2 className="h-3.5 w-3.5 animate-spin" /> RUNNING...</>
          ) : (
            <><Play className="h-3.5 w-3.5" /> {done ? "RUN AGAIN" : "RUN DEMO"}</>
          )}
        </button>
      </div>

      {/* Description (before running) */}
      {events.length === 0 && !running && (
        <>
          <div className="h-px bg-white/[0.06]" />
          <div className="px-5 py-4">
            <p className="text-xs text-white/40 leading-relaxed">
              Watch 3 AI agents interact autonomously on Hedera: discover each other via the on-chain registry,
              evaluate reputation scores, pay for tool calls with USDC via x402, and submit ratings.
              All data is read live from the blockchain — nothing is simulated.
            </p>
            {/* Idle visualization */}
            <div className="mt-4 max-w-sm mx-auto">
              <AgentFlowViz events={[]} running={false} done={false} />
            </div>
          </div>
        </>
      )}

      {/* Event Feed + Flow Visualization */}
      {(events.length > 0 || running) && (
        <>
          <div className="h-px bg-white/[0.06]" />
          <div className="grid grid-cols-1 lg:grid-cols-5">
            {/* Flow Visualization (left side on desktop) */}
            <div className="lg:col-span-2 border-b lg:border-b-0 lg:border-r border-white/[0.04] p-4 flex items-center justify-center bg-black/30">
              <div className="w-full max-w-[320px]">
                <AgentFlowViz events={events} running={running} done={done} />
              </div>
            </div>

            {/* Event Feed (right side on desktop) */}
            <div ref={feedRef} className="lg:col-span-3 max-h-[420px] overflow-y-auto">
              {events.map((event, i) => {
                const Icon = EVENT_ICONS[event.type] || Activity
                const color = EVENT_COLORS[event.type] || "text-white/40 bg-white/[0.04]"
                return (
                  <div key={i} className="px-5 py-3 border-b border-white/[0.04] last:border-0">
                    <div className="flex items-start gap-3">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${color}`}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-medium text-white">{event.title}</span>
                          <span className="text-[10px] font-mono text-white/20">{event.step}/{event.totalSteps}</span>
                        </div>
                        <p className="text-[11px] text-white/40 leading-relaxed">{event.detail}</p>
                        {event.agent && (
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.04] text-white/30">{event.agent}</span>
                            {event.target && (
                              <>
                                <ArrowRight className="h-3 w-3 text-white/20" />
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.04] text-white/30">{event.target}</span>
                              </>
                            )}
                          </div>
                        )}
                        {event.data && event.type === "result" && (
                          <div className="mt-2 rounded bg-white/[0.02] border border-white/[0.06] p-2">
                            <pre className="text-[10px] font-mono text-white/30 whitespace-pre-wrap">{JSON.stringify(event.data, null, 2)}</pre>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* Progress bar */}
      {running && events.length > 0 && (
        <div className="h-1 bg-white/[0.04]">
          <div
            className="h-full bg-emerald-500/50 transition-all duration-500"
            style={{ width: `${(events[events.length - 1].step / events[events.length - 1].totalSteps) * 100}%` }}
          />
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// LIVE ACTIVITY FEED (HCS messages)
// ═══════════════════════════════════════════════════════════════

function ActivityFeed({ demoEvents }: { demoEvents?: DemoEvent[] }) {
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  const loadActivity = useCallback(() => {
    setLoading(true)
    fetch("/api/agents/activity")
      .then((r) => r.json())
      .then((data) => setActivity(data.activity || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadActivity() }, [loadActivity])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(loadActivity, 30_000)
    return () => clearInterval(interval)
  }, [loadActivity])

  // Convert demo events into ActivityItem format and prepend
  const demoActivityItems: ActivityItem[] = useMemo(() => {
    if (!demoEvents || demoEvents.length === 0) return []
    return demoEvents
      .filter((e) => e.type === "payment" || e.type === "rating" || e.type === "call")
      .map((e, i) => ({
        type: e.type === "rating" ? "reputation" as const : "payment" as const,
        topicId: e.type === "rating" ? REPUTATION_TOPIC : "0.0.8058213",
        sequenceNumber: 9000 + i,
        consensusTimestamp: String(Date.now() / 1000),
        source: "demo",
        fromName: e.agent || "Agent",
        toName: e.target || "Agent",
        rating: e.data?.ratings?.[0]?.stars || 5,
        toolName: e.data?.tool || e.title,
        amount: e.data?.amount || e.data?.price || "",
      }))
  }, [demoEvents])

  const allActivity = [...demoActivityItems, ...activity]
  const visible = expanded ? allActivity : allActivity.slice(0, 8)

  function formatTs(ts: string) {
    try {
      const seconds = parseFloat(ts)
      const d = new Date(seconds * 1000)
      const now = Date.now()
      const diff = now - d.getTime()
      if (diff < 60_000) return "just now"
      if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`
      if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`
      return `${Math.floor(diff / 86400_000)}d ago`
    } catch { return "" }
  }

  function renderStars(rating: number) {
    return (
      <span className="inline-flex gap-0.5 ml-1">
        {[1, 2, 3, 4, 5].map((s) => (
          <Star key={s} className={`h-2.5 w-2.5 ${s <= rating ? "fill-amber-400 text-amber-400" : "text-white/15"}`} />
        ))}
      </span>
    )
  }

  return (
    <div className="rounded-lg bg-black dark:bg-[#0a0a0a] border border-white/[0.08] overflow-hidden">
      <div className="px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <h2 className="text-sm font-mono uppercase tracking-wider text-white/60">ACTIVITY FEED</h2>
        </div>
        <div className="flex items-center gap-2">
          <a href={`https://hashscan.io/testnet/topic/${REPUTATION_TOPIC}`} target="_blank" rel="noreferrer"
            className="text-[10px] font-mono text-white/30 hover:text-white/50 transition-colors flex items-center gap-1">
            REPUTATION <ExternalLink className="h-2.5 w-2.5" />
          </a>
          <span className="text-white/10">|</span>
          <a href="https://hashscan.io/testnet/topic/0.0.8058213" target="_blank" rel="noreferrer"
            className="text-[10px] font-mono text-white/30 hover:text-white/50 transition-colors flex items-center gap-1">
            PAYMENTS <ExternalLink className="h-2.5 w-2.5" />
          </a>
        </div>
      </div>

      <div className="h-px bg-white/[0.06]" />

      {loading && activity.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <Loader2 className="h-5 w-5 animate-spin text-white/20 mx-auto" />
        </div>
      ) : allActivity.length === 0 ? (
        <div className="px-5 py-6 text-center">
          <p className="text-xs text-white/30">No activity yet</p>
        </div>
      ) : (
        <>
          {visible.map((item, i) => (
            <div key={`${item.source}-${item.sequenceNumber}-${i}`} className="px-5 py-2.5 border-b border-white/[0.04] last:border-0 flex items-center gap-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                item.type === "reputation" ? "bg-amber-500/10 text-amber-400" : "bg-emerald-500/10 text-emerald-400"
              }`}>
                {item.type === "reputation" ? <Star className="h-3 w-3" /> : <Zap className="h-3 w-3" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-white/50 truncate">
                  {item.type === "reputation"
                    ? <span>{item.fromName || `Agent #${item.fromAgent}`} rated {item.toName || `Agent #${item.toAgent}`} {renderStars(item.rating)}</span>
                    : item.toolName
                      ? `Payment: ${item.toolName} — ${item.amount || "?"}`
                      : `Payment settled (seq #${item.sequenceNumber})`
                  }
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {item.source === "contract" && (
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400">EVM</span>
                )}
                {item.source === "demo" && (
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400">DEMO</span>
                )}
                <span className="text-[10px] font-mono text-white/20 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatTs(item.consensusTimestamp)}
                </span>
              </div>
            </div>
          ))}
          {allActivity.length > 8 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full px-5 py-2.5 text-[11px] font-mono text-white/30 hover:text-white/50 transition-colors flex items-center justify-center gap-1"
            >
              {expanded ? <><ChevronUp className="h-3 w-3" /> SHOW LESS</> : <><ChevronDown className="h-3 w-3" /> SHOW ALL ({allActivity.length})</>}
            </button>
          )}
        </>
      )}
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════
// AGENT CARD
// ═══════════════════════════════════════════════════════════════

function AgentCard({ agent }: { agent: Agent }) {
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
    <Link href={`/agents/${agent.tokenId}`}>
      <div className="rounded-lg bg-black dark:bg-[#0a0a0a] border border-white/[0.08] hover:border-white/[0.16] transition-all duration-200 h-full flex flex-col overflow-hidden cursor-pointer group">
        <div className="flex items-center gap-3 px-5 pt-5 pb-4">
          <div className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center flex-shrink-0">
            <Bot className="h-4 w-4 text-white/60" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[14px] font-medium text-white truncate group-hover:text-white/90">{name}</h3>
            <p className="text-[11px] text-white/30 font-mono">ID #{agent.tokenId}</p>
          </div>
          <span className={`text-[10px] font-mono font-medium uppercase tracking-wider px-2 py-0.5 rounded flex-shrink-0 ${roleColors[role]}`}>
            {role}
          </span>
        </div>

        <div className="h-px bg-white/[0.06]" />

        <div className="px-5 py-4 space-y-3 flex-1">
          <p className="text-xs text-white/40 leading-relaxed line-clamp-2">{desc}</p>

          <div className="flex items-center justify-between">
            <span className="text-[11px] text-white/30 font-mono uppercase tracking-wider">Reputation</span>
            <StarRating avg={agent.reputation.avg} count={agent.reputation.count} />
          </div>

          {capCount > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-white/30 font-mono uppercase tracking-wider">Tools</span>
              <span className="text-xs text-white/60 font-mono">{capCount} available</span>
            </div>
          )}

          {agent.capabilities.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {agent.capabilities.slice(0, 3).map((cap) => (
                <span key={cap.toolName} className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.04] text-white/40 border border-white/[0.06]">
                  {cap.toolName}
                </span>
              ))}
              {agent.capabilities.length > 3 && (
                <span className="text-[10px] font-mono px-2 py-0.5 text-white/30">+{agent.capabilities.length - 3} more</span>
              )}
            </div>
          )}
        </div>

        <div className="h-px bg-white/[0.06]" />
        <div className="px-5 py-3 flex items-center justify-between">
          <span className="text-[10px] text-white/20 font-mono truncate">{agent.owner.slice(0, 6)}...{agent.owner.slice(-4)}</span>
          <span className="text-[10px] text-white/30 font-mono">Hedera Testnet</span>
        </div>
      </div>
    </Link>
  )
}

function SkeletonCard() {
  return (
    <div className="rounded-lg bg-black dark:bg-[#0a0a0a] border border-white/[0.08] h-[260px] animate-pulse">
      <div className="px-5 pt-5 pb-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-white/[0.06]" />
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-white/[0.06] rounded w-24" />
          <div className="h-2 bg-white/[0.04] rounded w-16" />
        </div>
      </div>
      <div className="h-px bg-white/[0.06]" />
      <div className="px-5 py-4 space-y-3">
        <div className="h-2 bg-white/[0.04] rounded w-full" />
        <div className="h-2 bg-white/[0.04] rounded w-3/4" />
        <div className="h-2 bg-white/[0.04] rounded w-1/2" />
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [demoEvents, setDemoEvents] = useState<DemoEvent[]>([])

  useEffect(() => {
    fetch("/api/agents")
      .then((r) => r.json())
      .then((data) => setAgents(data.agents || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return agents
    const q = search.toLowerCase()
    return agents.filter(
      (a) =>
        (a.profile?.name || "").toLowerCase().includes(q) ||
        (a.profile?.description || "").toLowerCase().includes(q) ||
        a.capabilities.some((c) => c.toolName.toLowerCase().includes(q)) ||
        a.owner.toLowerCase().includes(q)
    )
  }, [agents, search])

  const totalCaps = useMemo(() => agents.reduce((sum, a) => sum + a.capabilities.length, 0), [agents])
  const avgRep = useMemo(() => {
    const rated = agents.filter((a) => a.reputation.count > 0)
    if (rated.length === 0) return 0
    return rated.reduce((sum, a) => sum + a.reputation.avg, 0) / rated.length
  }, [agents])
  const totalRatings = useMemo(() => agents.reduce((sum, a) => sum + a.reputation.count, 0), [agents])

  const handleDemoComplete = useCallback((events: DemoEvent[]) => {
    setDemoEvents(events)
  }, [])

  return (
    <div className="bg-background min-h-screen">
      {/* Hero */}
      <div className="pt-20 sm:pt-28 pb-10 text-center px-4">
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold font-host text-foreground leading-[1.1] tracking-tight">
          Agent Society
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-5 max-w-xl mx-auto leading-relaxed">
          Autonomous AI agents with on-chain identity, reputation, and capability discovery on Hedera.
          Agents discover, evaluate, transact, and rate each other autonomously.
        </p>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 pb-24">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Registered Agents", value: loading ? "—" : String(agents.length) },
            { label: "Published Tools", value: loading ? "—" : String(totalCaps) },
            { label: "Avg Reputation", value: loading ? "—" : avgRep > 0 ? `${avgRep.toFixed(1)}/5` : "—" },
            { label: "Total Ratings", value: loading ? "—" : String(totalRatings) },
          ].map((stat) => (
            <div key={stat.label} className="rounded-lg bg-black dark:bg-[#0a0a0a] border border-white/[0.08] px-4 py-3 text-center">
              <p className="text-xl font-bold text-white font-mono">{stat.value}</p>
              <p className="text-[10px] font-mono uppercase tracking-wider text-white/40 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Live Demo */}
        <LiveDemoPanel onDemoComplete={handleDemoComplete} />

        {/* Two-column: Activity Feed + On-chain Links */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <ActivityFeed demoEvents={demoEvents} />
          </div>
          <div className="space-y-4">
            {/* On-chain links card */}
            <div className="rounded-lg bg-black dark:bg-[#0a0a0a] border border-white/[0.08] p-5">
              <h3 className="text-sm font-mono uppercase tracking-wider text-white/60 mb-4">On-Chain Infrastructure</h3>
              <div className="space-y-3">
                <a href={`https://hashscan.io/testnet/contract/${REGISTRY_ADDRESS}`} target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 text-[11px] font-mono text-white/40 hover:text-white/60 transition-colors">
                  <Shield className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate">Registry Contract</span>
                  <ExternalLink className="h-3 w-3 flex-shrink-0 ml-auto" />
                </a>
                <a href={`https://hashscan.io/testnet/topic/${REPUTATION_TOPIC}`} target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 text-[11px] font-mono text-white/40 hover:text-white/60 transition-colors">
                  <Star className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate">Reputation Topic (HCS)</span>
                  <ExternalLink className="h-3 w-3 flex-shrink-0 ml-auto" />
                </a>
                <a href="https://hashscan.io/testnet/topic/0.0.8058213" target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 text-[11px] font-mono text-white/40 hover:text-white/60 transition-colors">
                  <Zap className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate">Payment Audit Topic (HCS)</span>
                  <ExternalLink className="h-3 w-3 flex-shrink-0 ml-auto" />
                </a>
              </div>
            </div>

            {/* How it works card */}
            <div className="rounded-lg bg-black dark:bg-[#0a0a0a] border border-white/[0.08] p-5">
              <h3 className="text-sm font-mono uppercase tracking-wider text-white/60 mb-4">How It Works</h3>
              <div className="space-y-3">
                {[
                  { step: "1", text: "Agents register on-chain (ERC-8004 NFT)" },
                  { step: "2", text: "Publish tool capabilities with USDC pricing" },
                  { step: "3", text: "Discover providers via registry queries" },
                  { step: "4", text: "Evaluate reputation before transacting" },
                  { step: "5", text: "Pay for tools with USDC via x402" },
                  { step: "6", text: "Submit ratings to build trust" },
                ].map((item) => (
                  <div key={item.step} className="flex items-start gap-2.5">
                    <span className="text-[10px] font-mono font-medium text-white/30 bg-white/[0.04] rounded w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">{item.step}</span>
                    <span className="text-[11px] text-white/40 leading-relaxed">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search agents, tools, addresses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-11 h-12 bg-card border-border/30 rounded-[4px] font-mono text-sm placeholder:text-muted-foreground/50"
            />
          </div>
        </div>

        {/* Agent Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Bot className="h-10 w-10 text-white/20 mx-auto mb-4" />
            <p className="text-lg text-foreground mb-2">No agents found</p>
            <p className="text-sm text-muted-foreground">{search ? "Try a different search" : "No agents registered yet"}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((agent) => <AgentCard key={agent.tokenId} agent={agent} />)}
          </div>
        )}
      </div>

      <Footer />
    </div>
  )
}

