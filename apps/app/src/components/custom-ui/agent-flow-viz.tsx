"use client"

import { useMemo } from "react"

/**
 * Animated agent network visualization.
 * Shows 3 agent nodes in a triangle with animated connections
 * that react to demo events in real-time.
 */

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

interface AgentFlowVizProps {
  events: DemoEvent[]
  running: boolean
  done: boolean
}

// Agent positions in the SVG (triangle layout)
const AGENTS = [
  { id: "research", label: "Research", shortLabel: "R", x: 200, y: 50, color: "#60a5fa", bgColor: "rgba(96,165,250,0.12)" },
  { id: "analytics", label: "Analytics", shortLabel: "A", x: 80, y: 220, color: "#34d399", bgColor: "rgba(52,211,153,0.12)" },
  { id: "report", label: "Report", shortLabel: "Rp", x: 320, y: 220, color: "#f472b6", bgColor: "rgba(244,114,182,0.12)" },
]

// Connection paths between agents
const CONNECTIONS = [
  { from: 0, to: 1, id: "research-analytics" },
  { from: 0, to: 2, id: "research-report" },
  { from: 1, to: 2, id: "analytics-report" },
]


// Determine which agents and connections are active based on the latest event
function getActiveState(events: DemoEvent[]) {
  if (events.length === 0) return { activeAgents: new Set<number>(), activeConnections: new Set<string>(), particleType: "" as string, pulseAgent: -1 }

  const latest = events[events.length - 1]
  const activeAgents = new Set<number>()
  const activeConnections = new Set<string>()
  let particleType = ""
  let pulseAgent = -1

  const agentName = (latest.agent || "").toLowerCase()
  const targetName = (latest.target || "").toLowerCase()

  // Map names to indices
  const nameToIdx = (name: string): number => {
    if (name.includes("research")) return 0
    if (name.includes("analytics")) return 1
    if (name.includes("report")) return 2
    return -1
  }

  const fromIdx = nameToIdx(agentName)
  const toIdx = nameToIdx(targetName)

  switch (latest.type) {
    case "init":
      // All agents light up
      activeAgents.add(0)
      activeAgents.add(1)
      activeAgents.add(2)
      break
    case "discover":
      activeAgents.add(0) // Research
      activeAgents.add(1) // Analytics (discovered)
      activeConnections.add("research-analytics")
      particleType = "discover"
      pulseAgent = 0
      break
    case "evaluate":
      activeAgents.add(fromIdx >= 0 ? fromIdx : 0)
      activeAgents.add(toIdx >= 0 ? toIdx : 1)
      activeConnections.add("research-analytics")
      particleType = "evaluate"
      pulseAgent = toIdx >= 0 ? toIdx : 1
      break
    case "call":
      activeAgents.add(fromIdx >= 0 ? fromIdx : 0)
      activeAgents.add(toIdx >= 0 ? toIdx : 1)
      activeConnections.add("research-analytics")
      particleType = "call"
      pulseAgent = fromIdx >= 0 ? fromIdx : 0
      break
    case "payment":
      activeAgents.add(fromIdx >= 0 ? fromIdx : 0)
      activeAgents.add(toIdx >= 0 ? toIdx : 1)
      activeConnections.add("research-analytics")
      particleType = "payment"
      break
    case "result":
      activeAgents.add(0) // Research gets result
      activeAgents.add(1)
      activeConnections.add("research-analytics")
      particleType = "result"
      pulseAgent = 0
      break
    case "rating":
      activeAgents.add(fromIdx >= 0 ? fromIdx : 0)
      activeAgents.add(toIdx >= 0 ? toIdx : 1)
      activeConnections.add("research-analytics")
      particleType = "rating"
      break
    case "report":
      activeAgents.add(0) // Research
      activeAgents.add(2) // Report
      activeConnections.add("research-report")
      particleType = "report"
      pulseAgent = 2
      break
    case "complete":
      activeAgents.add(0)
      activeAgents.add(1)
      activeAgents.add(2)
      activeConnections.add("research-analytics")
      activeConnections.add("research-report")
      activeConnections.add("analytics-report")
      particleType = "complete"
      break
  }

  return { activeAgents, activeConnections, particleType, pulseAgent }
}

const PARTICLE_COLORS: Record<string, string> = {
  discover: "#a78bfa",  // purple
  evaluate: "#fbbf24",  // amber
  call: "#22d3ee",      // cyan
  payment: "#34d399",   // green
  result: "#94a3b8",    // slate
  rating: "#fbbf24",    // amber
  report: "#f472b6",    // pink
  complete: "#34d399",  // green
}


export default function AgentFlowViz({ events, running, done }: AgentFlowVizProps) {
  const { activeAgents, activeConnections, particleType, pulseAgent } = useMemo(
    () => getActiveState(events),
    [events]
  )

  const latest = events[events.length - 1]
  const particleColor = PARTICLE_COLORS[particleType] || "#94a3b8"

  return (
    <div className="relative w-full" style={{ aspectRatio: "400/280" }}>
      <svg viewBox="0 0 400 280" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          {/* Glow filter for active elements */}
          <filter id="glow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Animated particle along path */}
          {CONNECTIONS.map((conn) => (
            <linearGradient key={`grad-${conn.id}`} id={`grad-${conn.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={particleColor} stopOpacity="0" />
              <stop offset="40%" stopColor={particleColor} stopOpacity="0.8" />
              <stop offset="60%" stopColor={particleColor} stopOpacity="0.8" />
              <stop offset="100%" stopColor={particleColor} stopOpacity="0" />
            </linearGradient>
          ))}

          {/* Pulse animation for agent nodes */}
          <radialGradient id="pulse-grad">
            <stop offset="0%" stopColor="white" stopOpacity="0.15" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Background grid dots */}
        {Array.from({ length: 8 }).map((_, row) =>
          Array.from({ length: 10 }).map((_, col) => (
            <circle
              key={`dot-${row}-${col}`}
              cx={20 + col * 40}
              cy={15 + row * 35}
              r="0.8"
              fill="white"
              opacity="0.06"
            />
          ))
        )}

        {/* Connection lines */}
        {CONNECTIONS.map((conn) => {
          const from = AGENTS[conn.from]
          const to = AGENTS[conn.to]
          const isActive = activeConnections.has(conn.id)

          return (
            <g key={conn.id}>
              {/* Base line (always visible, dim) */}
              <line
                x1={from.x} y1={from.y}
                x2={to.x} y2={to.y}
                stroke="white"
                strokeOpacity={isActive ? 0.15 : 0.04}
                strokeWidth={isActive ? 1.5 : 0.5}
                strokeDasharray={isActive ? "none" : "4 4"}
                className="transition-all duration-500"
              />

              {/* Animated particle on active connections */}
              {isActive && running && (
                <>
                  <circle r="3" fill={particleColor} opacity="0.9" filter="url(#glow)">
                    <animateMotion
                      dur="1.5s"
                      repeatCount="indefinite"
                      path={`M${from.x},${from.y} L${to.x},${to.y}`}
                    />
                  </circle>
                  <circle r="6" fill={particleColor} opacity="0.2">
                    <animateMotion
                      dur="1.5s"
                      repeatCount="indefinite"
                      path={`M${from.x},${from.y} L${to.x},${to.y}`}
                    />
                  </circle>
                  {/* Second particle going the other way for bidirectional feel */}
                  <circle r="2" fill={particleColor} opacity="0.6">
                    <animateMotion
                      dur="2s"
                      repeatCount="indefinite"
                      path={`M${to.x},${to.y} L${from.x},${from.y}`}
                    />
                  </circle>
                </>
              )}

              {/* Static glow on completed connections */}
              {isActive && done && (
                <line
                  x1={from.x} y1={from.y}
                  x2={to.x} y2={to.y}
                  stroke={particleColor}
                  strokeOpacity="0.3"
                  strokeWidth="2"
                />
              )}
            </g>
          )
        })}

        {/* Agent nodes */}
        {AGENTS.map((agent, idx) => {
          const isActive = activeAgents.has(idx)
          const isPulsing = pulseAgent === idx

          return (
            <g key={agent.id}>
              {/* Pulse ring for active agent */}
              {isPulsing && running && (
                <circle cx={agent.x} cy={agent.y} r="30" fill="none" stroke={agent.color} strokeWidth="1" opacity="0">
                  <animate attributeName="r" from="24" to="40" dur="1.5s" repeatCount="indefinite" />
                  <animate attributeName="opacity" from="0.5" to="0" dur="1.5s" repeatCount="indefinite" />
                </circle>
              )}

              {/* Outer glow */}
              {isActive && (
                <circle
                  cx={agent.x} cy={agent.y} r="28"
                  fill={agent.bgColor}
                  className="transition-all duration-500"
                >
                  {running && (
                    <animate attributeName="r" values="26;30;26" dur="2s" repeatCount="indefinite" />
                  )}
                </circle>
              )}

              {/* Node circle */}
              <circle
                cx={agent.x} cy={agent.y} r="22"
                fill={isActive ? agent.bgColor : "rgba(255,255,255,0.02)"}
                stroke={isActive ? agent.color : "rgba(255,255,255,0.08)"}
                strokeWidth={isActive ? 1.5 : 0.5}
                className="transition-all duration-500"
              />

              {/* Agent icon (letter) */}
              <text
                x={agent.x} y={agent.y + 1}
                textAnchor="middle"
                dominantBaseline="central"
                fill={isActive ? agent.color : "rgba(255,255,255,0.2)"}
                fontSize="14"
                fontFamily="monospace"
                fontWeight="600"
                className="transition-all duration-500"
              >
                {agent.shortLabel}
              </text>

              {/* Agent label */}
              <text
                x={agent.x} y={agent.y + 38}
                textAnchor="middle"
                fill={isActive ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.15)"}
                fontSize="9"
                fontFamily="monospace"
                letterSpacing="0.5"
                className="transition-all duration-500 uppercase"
              >
                {agent.label}
              </text>
            </g>
          )
        })}

        {/* Current action label */}
        {latest && running && (
          <g>
            <rect x="100" y="130" width="200" height="24" rx="4" fill="rgba(0,0,0,0.6)" stroke={particleColor} strokeWidth="0.5" strokeOpacity="0.3" />
            <text x="200" y="145" textAnchor="middle" fill={particleColor} fontSize="9" fontFamily="monospace" opacity="0.8">
              {latest.type === "payment" ? "USDC PAYMENT" :
               latest.type === "call" ? "MCP TOOL CALL" :
               latest.type === "rating" ? "SUBMIT RATING" :
               latest.type === "discover" ? "ON-CHAIN DISCOVERY" :
               latest.type === "evaluate" ? "CHECK REPUTATION" :
               latest.type === "report" ? "GENERATE REPORT" :
               latest.type === "result" ? "DATA RECEIVED" :
               latest.type.toUpperCase()}
            </text>
          </g>
        )}

        {/* Completion badge */}
        {done && (
          <g>
            <rect x="120" y="125" width="160" height="30" rx="4" fill="rgba(52,211,153,0.08)" stroke="rgba(52,211,153,0.2)" strokeWidth="0.5" />
            <text x="200" y="144" textAnchor="middle" fill="#34d399" fontSize="10" fontFamily="monospace" fontWeight="600">
              AUTONOMOUS FLOW COMPLETE
            </text>
          </g>
        )}

        {/* Idle state */}
        {events.length === 0 && !running && (
          <g>
            <rect x="110" y="125" width="180" height="30" rx="4" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
            <text x="200" y="144" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="9" fontFamily="monospace">
              CLICK RUN DEMO TO START
            </text>
          </g>
        )}
      </svg>
    </div>
  )
}
