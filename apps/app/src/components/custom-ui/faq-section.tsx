"use client"

import React from "react"
import Link from "next/link"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { cn } from "@/lib/utils"

interface FAQItem {
  question: string
  answer: string | React.ReactNode
}

const faqData: FAQItem[] = [
  {
    question: "What is ClawPay and who is it for?",
    answer: (
      <>
        ClawPay is the payment layer for AI agents on Hedera. We offer solutions for both ends:
        <div className="mt-3 space-y-2">
          <div><strong>A) AI agent developers who want to consume paid tools:</strong> Connect your agent, find a server, and start using paid MCP tools. Payments happen autonomously via x402.</div>
          <div><strong>B) Developers who want to monetize MCP Servers or APIs:</strong> Use our open-source SDK to add per-call pricing to your tools. Get paid in USDC on Hedera with every tool invocation.</div>
        </div>
      </>
    )
  },
  {
    question: "Why Hedera?",
    answer: (
      <>
        Hedera offers sub-second finality, predictable low fees, and native HTS token support — ideal for high-frequency AI micropayments. Plus, HCS (Hedera Consensus Service) gives us a tamper-proof audit trail for every payment.
      </>
    )
  },
  {
    question: "How do payments work?",
    answer: (
      <>
        ClawPay uses the x402 protocol. When an AI agent calls a paid tool, the server responds with HTTP 402 and payment requirements. The agent&apos;s ClawPay client automatically builds a partially-signed HTS USDC transfer, sends it to the Blocky402 facilitator, which co-signs and submits to Hedera. The whole flow is autonomous — zero human intervention.
      </>
    )
  },
  {
    question: "How much do I pay?",
    answer: (
      <>
        Each MCP tool sets its own price, typically a few cents (e.g., $0.01). ClawPay does not charge any fees on top of that. You pay only for what you use.
      </>
    )
  },
  {
    question: "What tokens are supported?",
    answer: (
      <>
        Native Circle USDC on Hedera (HTS token, not bridged). Testnet token ID: <code>0.0.429274</code>, Mainnet: <code>0.0.456858</code>. HBAR support is also available.
      </>
    )
  },
  {
    question: "How do I monetize my API or MCP Server?",
    answer: (
      <>
        Use our open-source SDK to add payments in a few lines of code. Import <code>createMcpPaidHandler</code> from <code>@clawpay-hedera/sdk/handler</code>, define your tools with prices, and deploy. Or use our no-code UI to configure pricing.
      </>
    )
  },
  {
    question: "What is the HCS audit trail?",
    answer: (
      <>
        Every payment event is logged to a Hedera Consensus Service topic — creating a tamper-proof, publicly verifiable record of all transactions. You can view them on <Link href="https://hashscan.io" target="_blank" rel="noopener noreferrer" className="text-teal-700 dark:text-teal-200 hover:underline hover:decoration-dotted hover:underline-offset-2 transition-all duration-300">HashScan</Link>.
      </>
    )
  }
]

export default function FAQSection() {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
      <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-start">
        {/* Left side - Title */}
        <div className="space-y-4">
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold font-host text-foreground leading-tight">
            Frequently Asked<br />
            Questions
          </h2>
        </div>

        {/* Right side - FAQ Items */}
        <div>
          <Accordion type="single" collapsible className="w-full">
            {faqData.map((item, index) => (
              <AccordionItem 
                key={index} 
                value={`item-${index}`} 
                className={cn(
                  "border border-transparent rounded-[2px] bg-card mb-4 last:mb-0",
                  "hover:shadow-lg",
                  "transition-all duration-300 cursor-pointer"
                )}
              >
                <AccordionTrigger className={cn(
                  "text-left hover:no-underline group cursor-pointer px-4",
                  "data-[state=closed]:py-3 data-[state=open]:py-4",
                  "[&[data-state=open]_span]:text-foreground"
                )}>
                  <span className="text-sm sm:text-[15px] leading-relaxed font-mono font-normal uppercase text-muted-foreground group-hover:text-foreground group-hover:underline group-hover:decoration-dotted group-hover:underline-offset-2 transition-all duration-300">
                    {item.question}
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="text-sm sm:text-[15px] leading-relaxed text-foreground px-4 pb-4">
                    {item.answer}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  )
}
