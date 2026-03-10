"use client"

import { McpServer, mcpDataApi } from "@/lib/client/utils"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { urlUtils } from "@/lib/client/utils"
import { Check, CheckCircle2, Copy, PlugZap } from "lucide-react"
import Link from "next/link"
import { useState, useEffect, useMemo } from "react"
import { toast } from "sonner"
import { Spinner } from "@/components/ui/spinner"
import HighlighterText from "./highlighter-text"

export default function ServersGrid({
  servers,
  loading = false,
  className = "",
}: {
  servers: McpServer[]
  loading?: boolean
  className?: string
}) {
  const skeletonCount = 6

  return (
    <div className={`space-y-3 max-w-6xl mx-auto ${className}`}>
      <TooltipProvider>
        {loading
          ? Array.from({ length: skeletonCount }).map((_, idx) => (
              <ServerSkeletonCard key={idx} />
            ))
          : servers.map((server) => <ServerCard key={server.id} server={server} />)}
      </TooltipProvider>
    </div>
  )
}

function formatRelative(dateString?: string) {
  if (!dateString) return ""
  const ms = Date.now() - new Date(dateString).getTime()
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

function ServerCard({ server }: { server: McpServer }) {
  const [copied, setCopied] = useState(false)
  const [serverDetail, setServerDetail] = useState<{
    totalRequests: number
    totalPayments: number
    lastActivity?: string
  } | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(true)
  const url = urlUtils.getMcpUrl(server.origin)

  useEffect(() => {
    setLoadingDetail(true)
    mcpDataApi.getServerById(server.id)
      .then((data) => {
        setServerDetail({
          totalRequests: data.summary?.totalRequests || 0,
          totalPayments: data.summary?.totalPayments || 0,
          lastActivity: data.summary?.lastActivity,
        })
      })
      .catch(() => {
        setServerDetail({ totalRequests: 0, totalPayments: 0 })
      })
      .finally(() => {
        setLoadingDetail(false)
      })
  }, [server.id])

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    navigator.clipboard.writeText(url)
    setCopied(true)
    toast.success("Copied MCP endpoint to clipboard")
    setTimeout(() => setCopied(false), 2000)
  }

  // Extract price range from tools
  const priceRange = useMemo(() => {
    const prices: number[] = []
    for (const tool of server.tools) {
      const ann = tool.annotations as Record<string, unknown> | undefined
      if (ann?.paymentPriceUSD) {
        const p = String(ann.paymentPriceUSD).replace("$", "")
        const num = parseFloat(p)
        if (!isNaN(num)) prices.push(num)
      }
    }
    if (prices.length === 0) return null
    const min = Math.min(...prices)
    const max = Math.max(...prices)
    if (min === max) return `$${min}`
    return `$${min} – $${max}`
  }, [server.tools])

  // Count paid vs free tools
  const paidToolCount = useMemo(() => {
    return server.tools.filter(t => {
      const ann = t.annotations as Record<string, unknown> | undefined
      return ann?.paymentHint === true
    }).length
  }, [server.tools])

  return (
    <Link href={`/servers/${server.id}`} className="block group">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 p-4 sm:p-5 rounded-[2px] border border-transparent hover:border-foreground/20 bg-card hover:bg-muted/30 transition-all duration-200">
        {/* Left: Name + description */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-base font-semibold font-host text-foreground truncate">
              {server?.server?.info?.name || "Unknown Server"}
            </h3>
            {server.moderation_status === 'approved' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <CheckCircle2 className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400 flex-shrink-0" />
                </TooltipTrigger>
                <TooltipContent>Verified</TooltipContent>
              </Tooltip>
            )}
          </div>
          {server?.server?.info?.description && (
            <p className="text-sm text-muted-foreground line-clamp-1">
              {server.server.info.description}
            </p>
          )}
        </div>

        {/* Middle: Stats pills */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {priceRange && (
            <HighlighterText variant="green" className="text-xs whitespace-nowrap">
              {priceRange}
            </HighlighterText>
          )}
          <HighlighterText className="text-xs whitespace-nowrap">
            <span className="text-foreground">{server.tools.length}</span>
            <span className="ml-1">TOOLS</span>
          </HighlighterText>
          {loadingDetail ? (
            <HighlighterText className="text-xs flex items-center gap-1 whitespace-nowrap">
              <Spinner className="size-3" />
              <span>REQUESTS</span>
            </HighlighterText>
          ) : (
            <>
              <HighlighterText className="text-xs whitespace-nowrap">
                <span className="text-foreground">{serverDetail?.totalRequests ?? 0}</span>
                <span className="ml-1">REQUESTS</span>
              </HighlighterText>
              {(serverDetail?.totalPayments ?? 0) > 0 && (
                <HighlighterText className="text-xs whitespace-nowrap">
                  <span className="text-foreground">{serverDetail?.totalPayments}</span>
                  <span className="ml-1">PAYMENTS</span>
                </HighlighterText>
              )}
            </>
          )}
          {serverDetail?.lastActivity && (
            <span className="text-xs font-mono text-muted-foreground whitespace-nowrap hidden lg:inline">
              {formatRelative(serverDetail.lastActivity)}
            </span>
          )}
        </div>

        {/* Right: Connect button */}
        <Button
          variant="customTallAccentAmber"
          size="xs"
          onClick={handleCopy}
          className="w-auto self-start sm:self-center justify-start rounded-[2px] text-xs !px-3 tracking-wider border-0 flex-shrink-0"
        >
          {copied ? <Check className="size-3.5" /> : <PlugZap className="size-3.5" />}
          {copied ? "COPIED" : "CONNECT"}
        </Button>
      </div>
    </Link>
  )
}

function ServerSkeletonCard() {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 p-4 sm:p-5 rounded-[2px] bg-card">
      <div className="flex-1 min-w-0 space-y-2">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-6 w-16 rounded-[2px]" />
        <Skeleton className="h-6 w-20 rounded-[2px]" />
        <Skeleton className="h-6 w-20 rounded-[2px]" />
      </div>
      <Skeleton className="h-8 w-24 rounded-[2px]" />
    </div>
  )
}
