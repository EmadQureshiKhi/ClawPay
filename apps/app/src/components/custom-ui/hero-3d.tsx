"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import Logo3D from "./logo-3d"
import {
  motion,
  useReducedMotion,
  type Variants,
} from "motion/react"
import { easeOut } from "motion"
import { mcpDataApi } from "@/lib/client/utils"

const WORKS_WITH_CLIENTS = [
  {
    name: "OpenClaw",
    href: "https://openclaw.org",
    icon: "/logos/mcp-clients/openclaw.svg",
  },
  {
    name: "Claude Code",
    href: "https://docs.anthropic.com/en/docs/claude-code",
    icon: "/logos/mcp-clients/claude.svg",
  },
  {
    name: "OpenCode",
    href: "https://opencode.ai",
    icon: "/logos/mcp-clients/opencode.svg",
  },
  {
    name: "Cursor",
    href: "https://cursor.com",
    icon: "/logos/mcp-clients/cursor-cube.svg",
  },
  {
    name: "OpenAI Codex",
    href: "https://openai.com/codex",
    icon: "/logos/mcp-clients/OpenAI-black-monoblossom.svg",
  },
] as const

function ClientPill({ client }: { client: typeof WORKS_WITH_CLIENTS[number] }) {
  return (
    <Link
      href={client.href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col items-center gap-3"
    >
      <Image
        src={client.icon}
        alt={client.name}
        width={40}
        height={40}
        className="h-10 w-10 object-contain opacity-60 group-hover:opacity-100 transition-opacity duration-200 grayscale brightness-0 dark:brightness-200 dark:invert-0"
      />
      <span className="text-[11px] font-medium tracking-[0.15em] uppercase text-muted-foreground group-hover:text-foreground transition-colors">
        {client.name}
      </span>
    </Link>
  )
}

export function SupportedBySection() {
  const prefersReduced = useReducedMotion()
  const [isMounted, setIsMounted] = React.useState(false)

  React.useEffect(() => {
    setIsMounted(true)
  }, [])

  const fadeUp: Variants = React.useMemo(
    () => ({
      hidden: { opacity: 0, y: prefersReduced ? 0 : 8 },
      visible: {
        opacity: 1,
        y: 0,
        transition: { duration: prefersReduced ? 0 : 0.4, ease: easeOut },
      },
    }),
    [prefersReduced]
  )

  return (
    <motion.section
      className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-16"
      initial="hidden"
      animate={isMounted ? "visible" : "hidden"}
      variants={fadeUp}
    >
      <div className="flex flex-col sm:flex-row items-center gap-10 sm:gap-0">
        <h2 className="text-lg sm:text-xl font-semibold font-host text-foreground whitespace-nowrap sm:mr-auto">
          Works with<br />all clients
        </h2>

        <div className="flex items-center gap-10 sm:gap-16">
          {WORKS_WITH_CLIENTS.map((client) => (
            <ClientPill key={client.name} client={client} />
          ))}
        </div>
      </div>
    </motion.section>
  )
}

export default function Hero3D({
  className,
}: {
  className?: string
}) {
  const prefersReduced = useReducedMotion()
  const [isMounted, setIsMounted] = React.useState(false)
  const [stats, setStats] = React.useState({ totalTransactions: 0, totalVolumeUsd: 0 })

  React.useEffect(() => {
    setIsMounted(true)
    mcpDataApi.getStats().then(setStats).catch(() => {})
  }, [])

  const fadeUp: Variants = React.useMemo(
    () => ({
      hidden: { opacity: 0, y: prefersReduced ? 0 : 8 },
      visible: {
        opacity: 1,
        y: 0,
        transition: { duration: prefersReduced ? 0 : 0.4, ease: easeOut },
      },
    }),
    [prefersReduced]
  )

  return (
    <section
      className={cn(
        "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-16 lg:py-24",
        className
      )}
    >
      <div className="flex flex-col lg:grid lg:grid-cols-2 gap-8 lg:gap-12 lg:items-stretch lg:min-h-[600px]">
        {/* Mobile Layout */}
        {/* Heading and Subheading - Mobile */}
        <motion.div
          className="flex flex-col gap-1 order-1 lg:hidden"
          initial="hidden"
          animate={isMounted ? "visible" : "hidden"}
          variants={fadeUp}
        >
          <h1 className="text-3xl sm:text-3xl lg:text-4xl font-semibold font-host text-foreground leading-tight">
            The best way for AI agents to pay for services on Hedera
          </h1>
          <p className="text-sm sm:text-lg text-foreground/80 leading-relaxed max-w-lg">
            Autonomous x402 micropayments using native HTS USDC, HBAR, and HCS audit trails. Pay-per-use instead of expensive subscriptions.
          </p>
        </motion.div>

        {/* 3D Container - Mobile */}
        <div className="order-2 lg:hidden">
          <Logo3D className="h-[300px] min-h-0" delay={prefersReduced ? 0 : 0.4} duration={prefersReduced ? 0 : 1.2} />
        </div>

        {/* CTAs - Mobile */}
        <motion.div
          className="flex flex-col gap-4 pt-2 order-3 lg:hidden -mx-4 px-4"
          initial="hidden"
          animate={isMounted ? "visible" : "hidden"}
          variants={fadeUp}
        >
          <Link href="/servers" className="w-full">
            <Button variant="customTallPrimary" size="tall" animated className="w-full px-3 lg:px-6">
              BROWSE TOOLS
            </Button>
          </Link>
          <Link href="/register" className="w-full">
            <Button variant="customTallSecondary" size="tall" animated className="w-full px-3 lg:px-6">
              MONETIZE SERVERS
            </Button>
          </Link>
        </motion.div>

        {/* Stats - Mobile (moved to bottom) */}
        <motion.div
          className="flex flex-wrap gap-3 order-4 lg:hidden text-muted-foreground font-mono text-sm tracking-wider uppercase"
          initial="hidden"
          animate={isMounted ? "visible" : "hidden"}
          variants={fadeUp}
        >
          <span>TRANSACTIONS: <span className="!text-foreground font-medium">{stats.totalTransactions.toLocaleString()}</span></span>
          <span>VOLUME: <span className="!text-foreground font-medium">${stats.totalVolumeUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></span>
        </motion.div>

        {/* Desktop Layout - Left Column */}
        <div className="hidden lg:flex lg:flex-col lg:justify-between lg:gap-24 lg:order-1 lg:col-span-1 lg:h-full">
          {/* Main Content - Top Aligned */}
          <motion.div
            className="flex flex-col space-y-3 max-w-lg"
            initial="hidden"
            animate={isMounted ? "visible" : "hidden"}
            variants={fadeUp}
          >
            {/* Heading */}
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold font-host text-foreground leading-tight">
              The best way for AI agents to pay for services on Hedera
            </h1>

            {/* Subheading */}
            <p className="text-base sm:text-lg text-foreground/80 leading-relaxed">
              Autonomous x402 micropayments using native HTS USDC, HBAR, and HCS audit trails.<br />
              Pay-per-use instead of expensive subscriptions.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap gap-4 pt-6">
              <Link href="/servers" className="flex-1 lg:flex-none">
                <Button variant="customTallPrimary" size="tall" animated className="w-full min-w-[220px]">
                  BROWSE TOOLS
                </Button>
              </Link>
              <Link href="/register" className="flex-1 lg:flex-none">
                <Button variant="customTallSecondary" size="tall" animated className="w-full min-w-[220px]">
                  MONETIZE SERVERS
                </Button>
              </Link>
            </div>
          </motion.div>

          {/* Stats - Bottom Aligned */}
          <motion.div
            className="flex flex-wrap gap-3 text-muted-foreground font-mono text-sm tracking-wider uppercase"
            initial="hidden"
            animate={isMounted ? "visible" : "hidden"}
            variants={fadeUp}
          >
            <span>TRANSACTIONS: <span className="text-foreground font-medium">{stats.totalTransactions.toLocaleString()}</span></span>
            <span>VOLUME: <span className="text-foreground font-medium">${stats.totalVolumeUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></span>
          </motion.div>
        </div>

        {/* Desktop Layout - Right Column - 3D Container */}
        <div className="hidden lg:block lg:order-2 lg:col-span-1 lg:h-full">
          <Logo3D className="h-full" delay={prefersReduced ? 0 : 0.4} duration={prefersReduced ? 0 : 1.2} />
        </div>
      </div>
    </section>
  )
}

