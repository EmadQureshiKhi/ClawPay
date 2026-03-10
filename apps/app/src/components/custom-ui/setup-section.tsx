"use client"

import * as React from "react"
import { Check, Copy } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  motion,
  useReducedMotion,
  type Variants,
} from "motion/react"
import { easeOut } from "motion"

const PACKAGE_MANAGERS = ["pnpm", "npm", "bun"] as const
type PackageManager = typeof PACKAGE_MANAGERS[number]

const COMMANDS: Record<PackageManager, string> = {
  pnpm: "pnpm dlx @clawpay-hedera/sdk connect --urls https://your-server.com/mcp --hedera-key $HEDERA_PRIVATE_KEY --hedera-account $HEDERA_ACCOUNT_ID",
  npm: "npx @clawpay-hedera/sdk connect --urls https://your-server.com/mcp --hedera-key $HEDERA_PRIVATE_KEY --hedera-account $HEDERA_ACCOUNT_ID",
  bun: "bunx @clawpay-hedera/sdk connect --urls https://your-server.com/mcp --hedera-key $HEDERA_PRIVATE_KEY --hedera-account $HEDERA_ACCOUNT_ID",
}

const PROMPT_TEXT = "Read https://clawpay.tech/skill.md and follow the instructions to connect to paid MCP tools on Hedera."

function TypewriterText({ text, className }: { text: string; className?: string }) {
  const [displayed, setDisplayed] = React.useState("")
  const [done, setDone] = React.useState(false)
  const prefersReduced = useReducedMotion()

  React.useEffect(() => {
    if (prefersReduced) {
      setDisplayed(text)
      setDone(true)
      return
    }
    setDisplayed("")
    setDone(false)
    let i = 0
    const interval = setInterval(() => {
      i++
      setDisplayed(text.slice(0, i))
      if (i >= text.length) {
        clearInterval(interval)
        setDone(true)
      }
    }, 18)
    return () => clearInterval(interval)
  }, [text, prefersReduced])

  return (
    <span className={className}>
      {displayed}
      {!done && <span className="animate-pulse">|</span>}
    </span>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="p-1.5 rounded-md hover:bg-foreground/10 transition-colors flex-shrink-0"
      aria-label="Copy to clipboard"
    >
      {copied ? (
        <Check className="h-4 w-4 text-green-500" />
      ) : (
        <Copy className="h-4 w-4 text-muted-foreground" />
      )}
    </button>
  )
}

export default function SetupSection() {
  const [activeTab, setActiveTab] = React.useState<PackageManager>("pnpm")
  const prefersReduced = useReducedMotion()
  const [isMounted, setIsMounted] = React.useState(false)

  React.useEffect(() => {
    setIsMounted(true)
  }, [])

  const fadeUp: Variants = React.useMemo(
    () => ({
      hidden: { opacity: 0, y: prefersReduced ? 0 : 12 },
      visible: {
        opacity: 1,
        y: 0,
        transition: { duration: prefersReduced ? 0 : 0.5, ease: easeOut },
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
      <div className="space-y-8">
        {/* Heading */}
        <div className="space-y-1">
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Get started</p>
          <h2 className="text-2xl sm:text-3xl font-semibold font-host text-foreground">
            Setup in one minute
          </h2>
        </div>

        {/* Prompt instruction */}
        <div className="rounded-lg border border-border/60 bg-muted/30 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">prompt</p>
              <p className="text-sm sm:text-base text-foreground font-mono leading-relaxed break-all">
                <TypewriterText text={PROMPT_TEXT} />
              </p>
            </div>
            <CopyButton text={PROMPT_TEXT} />
          </div>
        </div>

        {/* Package manager tabs + command */}
        <div className="rounded-lg border border-border/60 bg-muted/30 overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-border/60">
            {PACKAGE_MANAGERS.map((pm) => (
              <button
                key={pm}
                onClick={() => setActiveTab(pm)}
                className={cn(
                  "px-4 sm:px-6 py-3 text-sm font-mono transition-colors relative",
                  activeTab === pm
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground/70"
                )}
              >
                {pm}
                {activeTab === pm && (
                  <motion.div
                    layoutId="setup-tab-indicator"
                    className="absolute bottom-0 left-0 right-0 h-[2px] bg-foreground"
                    transition={{ duration: 0.2 }}
                  />
                )}
              </button>
            ))}
          </div>

          {/* Command */}
          <div className="p-4 sm:p-5 flex items-center justify-between gap-3">
            <code className="text-sm font-mono text-foreground/90 break-all flex-1 min-w-0">
              <span className="text-muted-foreground select-none">$ </span>
              {COMMANDS[activeTab]}
            </code>
            <CopyButton text={COMMANDS[activeTab]} />
          </div>
        </div>
      </div>
    </motion.section>
  )
}
