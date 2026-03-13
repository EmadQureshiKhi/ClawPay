"use client"

import { useEffect, useState, useCallback, useRef, useMemo } from "react"
import { Star, Zap, Bot, ExternalLink, ArrowLeft, Radio } from "lucide-react"
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

interface ActivityItem {
  type: "reputation" | "payment"
  fromAgent?: number
  toAgent?: number
  fromName?: string
  toName?: string
  rating?: number
  toolName?: string
  amount?: string
  source?: string
  sequenceNumber: number
  consensusTimestamp: string
}

interface NetworkNode {
  id: number
  name: string
  role: "PROVIDER" | "CONSUMER" | "AGENT"
  x: number
  y: number
  radius: number
  color: string
  glowColor: string
  reputation: { avg: number; count: number }
  toolCount: number
  active: boolean
}

interface NetworkEdge {
  from: number
  to: number
  weight: number
  type: "rating" | "payment"
}

interface FlyingParticle {
  id: string
  fromX: number
  fromY: number
  toX: number
  toY: number
  color: string
  type: "rating" | "payment"
  startTime: number
}


// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

const ROLE_COLORS: Record<string, { fill: string; glow: string; ring: string }> = {
  PROVIDER: { fill: "#059669", glow: "rgba(52,211,153,0.25)", ring: "#34d399" },
  CONSUMER: { fill: "#2563eb", glow: "rgba(96,165,250,0.25)", ring: "#60a5fa" },
  AGENT: { fill: "#6b7280", glow: "rgba(156,163,175,0.2)", ring: "#9ca3af" },
}

const REGISTRY_ADDRESS = "0x411278256411dA9018e3c880Df21e54271F2502b"

// ═══════════════════════════════════════════════════════════════
// LAYOUT — arrange agents in an orbital ring, no overlaps
// ═══════════════════════════════════════════════════════════════

function computeLayout(agents: Agent[], width: number, height: number): NetworkNode[] {
  const cx = width / 2
  const cy = height / 2
  const orbitRadius = Math.min(width, height) * 0.34

  return agents.map((agent, i) => {
    const angle = (i / agents.length) * Math.PI * 2 - Math.PI / 2
    const capCount = agent.capabilities.length
    const repCount = agent.reputation.count

    // Node size scales with tools + reputation
    const baseRadius = 28
    const sizeBonus = Math.min(capCount * 3, 12) + Math.min(repCount * 1.5, 8)
    const radius = baseRadius + sizeBonus

    let role: "PROVIDER" | "CONSUMER" | "AGENT" = "AGENT"
    if (capCount > 0) role = "PROVIDER"
    if (agent.profile?.capabilities?.includes("generate_report")) role = "CONSUMER"

    const colors = ROLE_COLORS[role]

    return {
      id: agent.tokenId,
      name: agent.profile?.name || `Agent #${agent.tokenId}`,
      role,
      x: cx + Math.cos(angle) * orbitRadius,
      y: cy + Math.sin(angle) * orbitRadius,
      radius,
      color: colors.fill,
      glowColor: colors.glow,
      reputation: agent.reputation,
      toolCount: capCount,
      active: false,
    }
  })
}

// Build edges from activity data
function computeEdges(activity: ActivityItem[]): NetworkEdge[] {
  const edgeMap = new Map<string, NetworkEdge>()

  for (const item of activity) {
    if (item.type === "reputation" && item.fromAgent && item.toAgent) {
      const key = `${Math.min(item.fromAgent, item.toAgent)}-${Math.max(item.fromAgent, item.toAgent)}`
      const existing = edgeMap.get(key)
      if (existing) {
        existing.weight++
      } else {
        edgeMap.set(key, { from: item.fromAgent, to: item.toAgent, weight: 1, type: "rating" })
      }
    }
  }

  return Array.from(edgeMap.values())
}


// ═══════════════════════════════════════════════════════════════
// BACKGROUND STARS (solar system feel)
// ═══════════════════════════════════════════════════════════════

function BackgroundStars({ width, height }: { width: number; height: number }) {
  const stars = useMemo(() => {
    const s: { x: number; y: number; r: number; opacity: number; delay: number }[] = []
    // Seed-based pseudo-random for consistent layout
    let seed = 42
    const rand = () => { seed = (seed * 16807 + 0) % 2147483647; return seed / 2147483647 }
    for (let i = 0; i < 120; i++) {
      s.push({
        x: rand() * width,
        y: rand() * height,
        r: rand() * 1.2 + 0.3,
        opacity: rand() * 0.4 + 0.05,
        delay: rand() * 5,
      })
    }
    return s
  }, [width, height])

  return (
    <g>
      {stars.map((star, i) => (
        <circle key={i} cx={star.x} cy={star.y} r={star.r} fill="white" opacity={star.opacity}>
          <animate
            attributeName="opacity"
            values={`${star.opacity};${star.opacity * 2.5};${star.opacity}`}
            dur={`${3 + star.delay}s`}
            repeatCount="indefinite"
          />
        </circle>
      ))}
    </g>
  )
}

// ═══════════════════════════════════════════════════════════════
// GRID OVERLAY
// ═══════════════════════════════════════════════════════════════

function GridOverlay({ width, height }: { width: number; height: number }) {
  const cx = width / 2
  const cy = height / 2
  const rings = [0.15, 0.28, 0.42]

  return (
    <g>
      {/* Concentric orbit rings */}
      {rings.map((r, i) => (
        <circle
          key={`ring-${i}`}
          cx={cx} cy={cy}
          r={Math.min(width, height) * r}
          fill="none"
          stroke="white"
          strokeOpacity={0.03}
          strokeWidth="0.5"
          strokeDasharray="4 8"
        />
      ))}
      {/* Cross-hair lines */}
      <line x1={cx} y1={0} x2={cx} y2={height} stroke="white" strokeOpacity="0.015" strokeWidth="0.5" />
      <line x1={0} y1={cy} x2={width} y2={cy} stroke="white" strokeOpacity="0.015" strokeWidth="0.5" />
    </g>
  )
}

// ═══════════════════════════════════════════════════════════════
// AGENT NODE
// ═══════════════════════════════════════════════════════════════

function AgentNode({
  node, isHovered, isHighlighted, onHover, onLeave, onClick,
}: {
  node: NetworkNode
  isHovered: boolean
  isHighlighted: boolean
  onHover: () => void
  onLeave: () => void
  onClick: () => void
}) {
  const roleColors = ROLE_COLORS[node.role]
  const scale = isHovered ? 1.15 : 1
  const opacity = isHighlighted || isHovered ? 1 : 0.7
  const stars = Math.round(node.reputation.avg)

  return (
    <g
      transform={`translate(${node.x}, ${node.y})`}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onClick={onClick}
      style={{ cursor: "pointer" }}
    >
      {/* Outer glow */}
      <circle r={node.radius + 12} fill={node.glowColor} opacity={isHovered ? 0.5 : 0.15}>
        {node.active && (
          <animate attributeName="r" values={`${node.radius + 8};${node.radius + 18};${node.radius + 8}`} dur="2s" repeatCount="indefinite" />
        )}
      </circle>

      {/* Orbit ring */}
      <circle
        r={node.radius + 4}
        fill="none"
        stroke={roleColors.ring}
        strokeWidth={isHovered ? 1.5 : 0.8}
        strokeOpacity={isHovered ? 0.6 : 0.2}
        strokeDasharray={node.role === "PROVIDER" ? "none" : "3 3"}
      />

      {/* Main node */}
      <circle
        r={node.radius}
        fill={`${roleColors.fill}20`}
        stroke={roleColors.ring}
        strokeWidth={isHovered ? 2 : 1}
        strokeOpacity={opacity * 0.5}
      />

      {/* Inner gradient circle */}
      <circle r={node.radius * 0.7} fill={`${roleColors.fill}15`} />

      {/* Agent icon */}
      <text
        y={-6}
        textAnchor="middle"
        dominantBaseline="central"
        fill={roleColors.ring}
        fontSize={isHovered ? "16" : "13"}
        fontFamily="monospace"
        fontWeight="700"
        opacity={opacity}
      >
        {node.name.split(" ")[0].charAt(0)}{node.name.split(" ").length > 1 ? node.name.split(" ")[1]?.charAt(0) : ""}
      </text>

      {/* Name label */}
      <text
        y={node.radius + 16}
        textAnchor="middle"
        fill="white"
        fontSize="9"
        fontFamily="monospace"
        opacity={isHovered ? 0.8 : 0.35}
        letterSpacing="0.3"
      >
        {node.name.length > 16 ? node.name.slice(0, 14) + ".." : node.name}
      </text>

      {/* Reputation stars (below name) */}
      {node.reputation.count > 0 && (
        <g transform={`translate(0, ${node.radius + 28})`}>
          {[1, 2, 3, 4, 5].map((s) => (
            <text
              key={s}
              x={(s - 3) * 8}
              textAnchor="middle"
              fill={s <= stars ? "#fbbf24" : "rgba(255,255,255,0.1)"}
              fontSize="7"
            >
              ★
            </text>
          ))}
        </g>
      )}

      {/* Tool count badge */}
      {node.toolCount > 0 && (
        <g transform={`translate(${node.radius * 0.7}, ${-node.radius * 0.7})`}>
          <circle r="9" fill="#0a0a0a" stroke={roleColors.ring} strokeWidth="1" strokeOpacity="0.4" />
          <text textAnchor="middle" dominantBaseline="central" fill={roleColors.ring} fontSize="8" fontFamily="monospace" fontWeight="600">
            {node.toolCount}
          </text>
        </g>
      )}

      {/* Role badge */}
      <g transform={`translate(0, ${10})`}>
        <text
          textAnchor="middle"
          dominantBaseline="central"
          fill={roleColors.ring}
          fontSize="7"
          fontFamily="monospace"
          opacity={isHovered ? 0.7 : 0.3}
          letterSpacing="0.8"
        >
          {node.role}
        </text>
      </g>

      {/* Hover tooltip */}
      {isHovered && (
        <g transform={`translate(0, ${-node.radius - 30})`}>
          <rect x="-70" y="-14" width="140" height="28" rx="4" fill="rgba(0,0,0,0.85)" stroke={roleColors.ring} strokeWidth="0.5" strokeOpacity="0.4" />
          <text textAnchor="middle" y="2" fill="white" fontSize="9" fontFamily="monospace" opacity="0.8">
            ID #{node.id} — {node.reputation.count > 0 ? `${node.reputation.avg.toFixed(1)}/5 (${node.reputation.count})` : "unrated"} — {node.toolCount} tools
          </text>
        </g>
      )}
    </g>
  )
}


// ═══════════════════════════════════════════════════════════════
// EDGE (connection between agents)
// ═══════════════════════════════════════════════════════════════

function EdgeLine({
  fromNode, toNode, weight, isHighlighted,
}: {
  fromNode: NetworkNode
  toNode: NetworkNode
  weight: number
  isHighlighted: boolean
}) {
  const opacity = isHighlighted ? 0.25 : 0.06
  const strokeWidth = Math.min(0.5 + weight * 0.4, 3)

  return (
    <line
      x1={fromNode.x} y1={fromNode.y}
      x2={toNode.x} y2={toNode.y}
      stroke="white"
      strokeOpacity={opacity}
      strokeWidth={isHighlighted ? strokeWidth + 0.5 : strokeWidth}
      className="transition-all duration-500"
    />
  )
}

// ═══════════════════════════════════════════════════════════════
// FLYING PARTICLE (animated event)
// ═══════════════════════════════════════════════════════════════

function FlyingParticleEl({ particle }: { particle: FlyingParticle }) {
  const color = particle.type === "rating" ? "#fbbf24" : "#34d399"
  const dur = "1.8s"

  return (
    <g>
      {/* Main particle */}
      <circle r="4" fill={color} opacity="0.9">
        <animateMotion
          dur={dur}
          repeatCount="1"
          fill="freeze"
          path={`M${particle.fromX},${particle.fromY} L${particle.toX},${particle.toY}`}
        />
        <animate attributeName="opacity" values="0;0.9;0.9;0" dur={dur} repeatCount="1" fill="freeze" />
      </circle>
      {/* Glow trail */}
      <circle r="10" fill={color} opacity="0.15">
        <animateMotion
          dur={dur}
          repeatCount="1"
          fill="freeze"
          path={`M${particle.fromX},${particle.fromY} L${particle.toX},${particle.toY}`}
        />
        <animate attributeName="opacity" values="0;0.2;0.15;0" dur={dur} repeatCount="1" fill="freeze" />
      </circle>
      {/* Label */}
      <text fill={color} fontSize="8" fontFamily="monospace" fontWeight="600" opacity="0">
        <animateMotion
          dur={dur}
          repeatCount="1"
          fill="freeze"
          path={`M${particle.fromX},${particle.fromY - 14} L${particle.toX},${particle.toY - 14}`}
        />
        <animate attributeName="opacity" values="0;0.7;0.7;0" dur={dur} repeatCount="1" fill="freeze" />
        {particle.type === "rating" ? "★" : "$"}
      </text>
    </g>
  )
}

// ═══════════════════════════════════════════════════════════════
// EVENT TICKER (bottom bar)
// ═══════════════════════════════════════════════════════════════

function EventTicker({ activity }: { activity: ActivityItem[] }) {
  const recent = activity.slice(0, 6)

  function formatTs(ts: string) {
    try {
      const seconds = parseFloat(ts)
      const d = new Date(seconds * 1000)
      const diff = Date.now() - d.getTime()
      if (diff < 60_000) return "just now"
      if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`
      if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`
      return `${Math.floor(diff / 86400_000)}d ago`
    } catch { return "" }
  }

  return (
    <div className="flex items-center gap-4 overflow-x-auto scrollbar-hide py-1">
      {recent.map((item, i) => (
        <div key={`${item.sequenceNumber}-${i}`} className="flex items-center gap-2 flex-shrink-0">
          <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
            item.type === "reputation" ? "bg-amber-500/15 text-amber-400" : "bg-emerald-500/15 text-emerald-400"
          }`}>
            {item.type === "reputation" ? <Star className="h-2.5 w-2.5" /> : <Zap className="h-2.5 w-2.5" />}
          </div>
          <span className="text-[10px] font-mono text-white/40 whitespace-nowrap">
            {item.type === "reputation"
              ? `${item.fromName || "Agent"} → ${item.toName || "Agent"}`
              : item.toolName || `Payment #${item.sequenceNumber}`
            }
          </span>
          <span className="text-[9px] font-mono text-white/20">{formatTs(item.consensusTimestamp)}</span>
          {i < recent.length - 1 && <span className="text-white/10">|</span>}
        </div>
      ))}
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function AgentNetwork() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [hoveredNode, setHoveredNode] = useState<number | null>(null)
  const [particles, setParticles] = useState<FlyingParticle[]>([])
  const [dimensions, setDimensions] = useState({ width: 1200, height: 700 })
  const containerRef = useRef<HTMLDivElement>(null)
  const prevActivityRef = useRef<number>(0)

  // Zoom & pan state
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 })

  // Responsive sizing
  useEffect(() => {
    function updateSize() {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setDimensions({ width: Math.max(rect.width, 800), height: Math.max(rect.height, 500) })
      } else {
        // Fallback to window size
        setDimensions({ width: window.innerWidth, height: window.innerHeight - 120 })
      }
    }
    // Delay first measurement to let layout settle
    const timer = setTimeout(updateSize, 50)
    window.addEventListener("resize", updateSize)
    return () => { clearTimeout(timer); window.removeEventListener("resize", updateSize) }
  }, [loading])

  // Zoom via scroll wheel
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    function handleWheel(e: WheelEvent) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -0.08 : 0.08
      setZoom((z) => Math.min(Math.max(z + delta, 0.3), 3))
    }
    el.addEventListener("wheel", handleWheel, { passive: false })
    return () => el.removeEventListener("wheel", handleWheel)
  }, [loading])

  // Pan via mouse drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only pan on background click (not on agent nodes)
    if ((e.target as HTMLElement).tagName === "svg" || (e.target as SVGElement).closest?.("svg") === e.currentTarget.querySelector("svg")) {
      setIsPanning(true)
      panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y }
    }
  }, [pan])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return
    const dx = e.clientX - panStart.current.x
    const dy = e.clientY - panStart.current.y
    setPan({ x: panStart.current.panX + dx, y: panStart.current.panY + dy })
  }, [isPanning])

  const handleMouseUp = useCallback(() => {
    setIsPanning(false)
  }, [])

  const resetView = useCallback(() => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }, [])

  // Load agents
  useEffect(() => {
    fetch("/api/agents")
      .then((r) => r.json())
      .then((data) => setAgents(data.agents || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Load activity + poll every 15s
  const loadActivity = useCallback(() => {
    fetch("/api/agents/activity")
      .then((r) => r.json())
      .then((data) => {
        const newActivity: ActivityItem[] = data.activity || []
        setActivity(newActivity)

        // Detect new events and spawn particles
        if (prevActivityRef.current > 0 && newActivity.length > prevActivityRef.current) {
          const newEvents = newActivity.slice(0, newActivity.length - prevActivityRef.current)
          spawnParticles(newEvents)
        }
        prevActivityRef.current = newActivity.length
      })
      .catch(() => {})
  }, [])

  useEffect(() => { loadActivity() }, [loadActivity])
  useEffect(() => {
    const interval = setInterval(loadActivity, 15_000)
    return () => clearInterval(interval)
  }, [loadActivity])

  // Compute layout
  const nodes = useMemo(
    () => computeLayout(agents, dimensions.width, dimensions.height - 80),
    [agents, dimensions]
  )

  const edges = useMemo(() => computeEdges(activity), [activity])

  const nodeMap = useMemo(() => {
    const m = new Map<number, NetworkNode>()
    nodes.forEach((n) => m.set(n.id, n))
    return m
  }, [nodes])

  // Which edges connect to the hovered node
  const highlightedEdges = useMemo(() => {
    if (hoveredNode === null) return new Set<string>()
    const s = new Set<string>()
    edges.forEach((e) => {
      if (e.from === hoveredNode || e.to === hoveredNode) {
        s.add(`${e.from}-${e.to}`)
      }
    })
    return s
  }, [hoveredNode, edges])

  const highlightedNodes = useMemo(() => {
    if (hoveredNode === null) return new Set<number>()
    const s = new Set<number>([hoveredNode])
    edges.forEach((e) => {
      if (e.from === hoveredNode) s.add(e.to)
      if (e.to === hoveredNode) s.add(e.from)
    })
    return s
  }, [hoveredNode, edges])

  // Spawn flying particles for new events
  function spawnParticles(newEvents: ActivityItem[]) {
    const newParticles: FlyingParticle[] = []
    for (const event of newEvents) {
      if (event.fromAgent && event.toAgent) {
        const fromNode = nodeMap.get(event.fromAgent)
        const toNode = nodeMap.get(event.toAgent)
        if (fromNode && toNode) {
          newParticles.push({
            id: `${event.sequenceNumber}-${Date.now()}`,
            fromX: fromNode.x,
            fromY: fromNode.y,
            toX: toNode.x,
            toY: toNode.y,
            color: event.type === "reputation" ? "#fbbf24" : "#34d399",
            type: event.type === "reputation" ? "rating" as const : "payment" as const,
            startTime: Date.now(),
          })
        }
      }
    }
    if (newParticles.length > 0) {
      setParticles((prev) => [...prev, ...newParticles])
      // Clean up old particles after animation
      setTimeout(() => {
        setParticles((prev) => prev.filter((p) => Date.now() - p.startTime < 3000))
      }, 3000)
    }
  }

  // Stats
  const totalTools = agents.reduce((s, a) => s + a.capabilities.length, 0)
  const totalRatings = agents.reduce((s, a) => s + a.reputation.count, 0)
  const avgRep = useMemo(() => {
    const rated = agents.filter((a) => a.reputation.count > 0)
    if (rated.length === 0) return 0
    return rated.reduce((s, a) => s + a.reputation.avg, 0) / rated.length
  }, [agents])

  if (loading) {
    return (
      <div className="bg-black min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-white/30 font-mono text-sm">Connecting to Hedera...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-black min-h-screen w-screen max-w-full flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06] flex-shrink-0 z-10">
        <div className="flex items-center gap-4">
          <Link href="/agents" className="flex items-center gap-1.5 text-[11px] font-mono text-white/30 hover:text-white/50 transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> AGENTS
          </Link>
          <div className="h-4 w-px bg-white/[0.08]" />
          <div className="flex items-center gap-2">
            <Radio className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-sm font-mono text-white/60 uppercase tracking-wider">Agent Network</span>
          </div>
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] font-mono text-white/20">LIVE</span>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-white/30">AGENTS</span>
            <span className="text-sm font-mono text-white/70 font-bold">{agents.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-white/30">TOOLS</span>
            <span className="text-sm font-mono text-white/70 font-bold">{totalTools}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-white/30">RATINGS</span>
            <span className="text-sm font-mono text-white/70 font-bold">{totalRatings}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-white/30">AVG REP</span>
            <span className="text-sm font-mono text-amber-400 font-bold">{avgRep > 0 ? `${avgRep.toFixed(1)}/5` : "—"}</span>
          </div>
          <a
            href={`https://hashscan.io/testnet/contract/${REGISTRY_ADDRESS}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-[10px] font-mono text-white/20 hover:text-white/40 transition-colors"
          >
            HASHSCAN <ExternalLink className="h-2.5 w-2.5" />
          </a>
        </div>
      </div>

      {/* Main visualization area */}
      <div
        ref={containerRef}
        className="flex-1 relative w-full"
        style={{ cursor: isPanning ? "grabbing" : "grab" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox={`0 0 ${dimensions.width} ${dimensions.height - 80}`}
          preserveAspectRatio="xMidYMid meet"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <filter id="net-glow">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Background stars (outside transform so they don't move with pan) */}
          <BackgroundStars width={dimensions.width} height={dimensions.height - 80} />

          {/* Pannable + zoomable content */}
          <g transform={`translate(${dimensions.width / 2 + pan.x}, ${(dimensions.height - 80) / 2 + pan.y}) scale(${zoom}) translate(${-dimensions.width / 2}, ${-(dimensions.height - 80) / 2})`}>

            {/* Grid overlay */}
            <GridOverlay width={dimensions.width} height={dimensions.height - 80} />

            {/* Center label */}
            <text
              x={dimensions.width / 2}
              y={(dimensions.height - 80) / 2}
              textAnchor="middle"
              fill="white"
              fontSize="10"
              fontFamily="monospace"
              opacity="0.06"
              letterSpacing="4"
            >
              HEDERA TESTNET
            </text>

          {/* Edges */}
          {edges.map((edge) => {
            const fromNode = nodeMap.get(edge.from)
            const toNode = nodeMap.get(edge.to)
            if (!fromNode || !toNode) return null
            const edgeKey = `${edge.from}-${edge.to}`
            return (
              <EdgeLine
                key={edgeKey}
                fromNode={fromNode}
                toNode={toNode}
                weight={edge.weight}
                isHighlighted={highlightedEdges.has(edgeKey) || highlightedEdges.has(`${edge.to}-${edge.from}`)}
              />
            )
          })}

          {/* Agent nodes */}
          {nodes.map((node) => (
            <AgentNode
              key={node.id}
              node={node}
              isHovered={hoveredNode === node.id}
              isHighlighted={hoveredNode === null || highlightedNodes.has(node.id)}
              onHover={() => setHoveredNode(node.id)}
              onLeave={() => setHoveredNode(null)}
              onClick={() => { window.location.href = `/agents/${node.id}` }}
            />
          ))}

          {/* Flying particles */}
          {particles.map((p) => (
            <FlyingParticleEl key={p.id} particle={p} />
          ))}

          </g>{/* end pannable/zoomable group */}
        </svg>

        {/* Zoom controls (bottom-right) */}
        <div className="absolute bottom-4 right-5 flex flex-col gap-1.5 z-10">
          <button
            onClick={() => setZoom((z) => Math.min(z + 0.2, 3))}
            className="w-8 h-8 rounded bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-white/50 hover:text-white/80 font-mono text-sm flex items-center justify-center transition-colors"
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(z - 0.2, 0.3))}
            className="w-8 h-8 rounded bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-white/50 hover:text-white/80 font-mono text-sm flex items-center justify-center transition-colors"
            aria-label="Zoom out"
          >
            -
          </button>
          <button
            onClick={resetView}
            className="w-8 h-8 rounded bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-white/50 hover:text-white/80 font-mono text-[9px] flex items-center justify-center transition-colors"
            aria-label="Reset view"
          >
            FIT
          </button>
          <div className="text-[9px] font-mono text-white/20 text-center mt-1">{Math.round(zoom * 100)}%</div>
        </div>

        {/* Legend overlay (bottom-left) */}
        <div className="absolute bottom-4 left-5 flex items-center gap-5 z-10">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full border border-emerald-400/40 bg-emerald-500/15" />
            <span className="text-[10px] font-mono text-white/30">PROVIDER</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full border border-blue-400/40 bg-blue-500/15" />
            <span className="text-[10px] font-mono text-white/30">CONSUMER</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full border border-gray-400/40 bg-gray-500/15" />
            <span className="text-[10px] font-mono text-white/30">AGENT</span>
          </div>
          <div className="h-3 w-px bg-white/[0.08]" />
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-[10px] font-mono text-white/30">RATING</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-[10px] font-mono text-white/30">PAYMENT</span>
          </div>
        </div>
      </div>

      {/* Bottom event ticker */}
      <div className="border-t border-white/[0.06] px-5 py-2.5 flex-shrink-0">
        <EventTicker activity={activity} />
      </div>
    </div>
  )
}
