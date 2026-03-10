"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import HighlighterText from "./highlighter-text"
import InfoCard from "./info-card"
import { ChartLine, DoorOpen, PiggyBank, ChevronDown } from "lucide-react"
import McpExampleCard from "./mcp-example-card"
import Image from "next/image"

const SERVER_EXAMPLES = [
  {
    label: "ClawPay Hedera Tools",
    description: "16 paid Hedera tools — gasless writes, smart analytics, and reads",
    icon: "/clawpay-logo.png",
    type: "live" as const,
    serverId: "626394a6-e8d1-4a6f-a181-2bc3c0165288",
  },
  {
    label: "Twitter / X Tools",
    description: "Post tweets, search trends, manage followers, and analyze engagement",
    icon: "/x-logo.svg",
    type: "static" as const,
    staticData: {
      name: "Twitter / X Tools",
      description: "Post tweets, search trends, manage followers, and analyze engagement via MCP",
      icon: "/x-logo.svg",
      subscriptionPrice: "$200 /month",
      perToolPrice: "$0.05 /tool",
      tools: [
        { name: "twitter_post_tweet", description: "Post a new tweet to your timeline. Supports text, threads, and media attachments.", price: 0.03 },
        { name: "twitter_search_tweets", description: "Search tweets by keyword, hashtag, or user. Returns recent and popular results.", price: 0.02 },
        { name: "twitter_get_trending", description: "Get current trending topics and hashtags for any region.", price: 0.01 },
        { name: "twitter_user_analytics", description: "Get follower growth, engagement rate, and top-performing tweets for any account.", price: 0.04 },
        { name: "twitter_schedule_tweet", description: "Schedule a tweet for future posting. Supports timezone-aware scheduling.", price: 0.03 },
      ],
    },
  },
] as const

interface ConsumerInfoProps extends React.HTMLAttributes<HTMLElement> {
  className?: string
}

export default function ConsumerInfo({
  className,
  ...props
}: ConsumerInfoProps) {
  const [expandedIdx, setExpandedIdx] = React.useState<number | null>(0)

  return (
    <section
      className={cn(
        "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-16 lg:py-24",
        className
      )}
      {...props}
    >
      <div className="flex flex-col gap-12">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="inline-flex">
            <HighlighterText>CONSUME MCP SERVERS</HighlighterText>
          </div>
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold font-host text-foreground leading-tight max-w-4xl">
            Pay cents per tool call.{" "}
            <span className="font-normal text-muted-foreground">Instead of expensive subscriptions. Consume any paid MCP with a single account.</span>
          </h2>
        </div>

        {/* Server Examples Accordion */}
        <div className="flex flex-col gap-3">
          {SERVER_EXAMPLES.map((ex, idx) => (
            <div key={idx} className="flex flex-col">
              {/* Accordion Header */}
              <button
                type="button"
                onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                className={cn(
                  "flex items-center gap-4 px-5 py-4 rounded-[2px] bg-card hover:bg-card/80 transition-colors w-full text-left",
                  expandedIdx === idx && "rounded-b-none"
                )}
              >
                <div className="w-8 h-8 bg-black rounded-[2px] flex-shrink-0 flex items-center justify-center p-1.5">
                  <Image src={ex.icon} alt={ex.label} width={20} height={20} className="w-full h-full object-contain" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-sm font-medium text-foreground">{ex.label}</div>
                  <div className="text-xs text-muted-foreground truncate">{ex.description}</div>
                </div>
                <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform flex-shrink-0", expandedIdx === idx && "rotate-180")} />
              </button>

              {/* Accordion Content — always mounted, hidden when collapsed */}
              <div className={cn("rounded-b-[2px] overflow-hidden", expandedIdx !== idx && "hidden")}>
                {ex.type === "live" ? (
                  <McpExampleCard serverId={ex.serverId} className="rounded-t-none" hideSubscriptionText />
                ) : (
                  <McpExampleCard staticData={{...ex.staticData, tools: [...ex.staticData.tools]}} className="rounded-t-none" />
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Info Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <InfoCard
            icon={ChartLine}
            label="USAGE BASED"
            copy="Forget subscriptions and pay only for what you use. Pay per tool call."
          />
          <InfoCard
            icon={DoorOpen}
            label="NO LOCK IN"
            copy="Withdraw your funds at anytime."
          />
          <InfoCard
            icon={PiggyBank}
            label="FREE"
            copy="We don't charge any fees, you are paying cents for each tool call."
          />
        </div>
      </div>
    </section>
  )
}
