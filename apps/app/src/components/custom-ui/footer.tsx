"use client"

import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { useTheme } from "@/components/providers/theme-context"
import { Moon, Sun } from "lucide-react"

export default function Footer() {
    const { isDark, toggleTheme } = useTheme()

    const brandColor = isDark ? "text-white" : "text-black"
    const year = new Date().getFullYear()

    // Platform-level HCS audit topic — global audit trail for all ClawPay payments
    const PLATFORM_HCS_URL = "https://hashscan.io/testnet/topic/0.0.8058213"

    // Docs site — separate Next.js app (port 3003 locally, docs.clawpay.tech in prod)
    const DOCS_URL = typeof window !== "undefined" && window.location.hostname === "localhost"
        ? "http://localhost:3003"
        : "https://docs.clawpay.tech"

    return (
        <footer
            suppressHydrationWarning
            className={`w-full border-t ${isDark ? "bg-black/95 border-gray-800" : "bg-white/95 border-gray-200"
                }`}
        >
            <div className="w-full px-2">
                {/* Desktop / ≥ sm: original layout */}
                <div className="hidden sm:flex items-center justify-between py-2">
                    {/* Left: symbol + © year ClawPay */}
                    <div className="flex items-center gap-2">
                        <img src="/clawpay-logo.png" alt="ClawPay" width={30} height={30} className="rounded-sm" />
                        <p className="text-[13px] font-semibold text-muted-foreground">
                            ©{" "}
                            <span className="font-mono tracking-wide font-medium">
                                {year} <span className={brandColor}>Claw</span><span className="text-neutral-400">Pay</span>
                            </span>
                        </p>
                    </div>

                    {/* Right: theme toggle + links */}
                    <div className="flex items-center gap-1 sm:gap-2">
                        <Button
                            variant="link"
                            size="icon"
                            aria-label="Toggle theme"
                            onClick={toggleTheme}
                            className="text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                            {isDark ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4" />}
                        </Button>

                        <nav className="flex items-center">
                            <Button
                                asChild
                                variant="link"
                                className="h-8 px-2 font-mono text-[13px] tracking-wide text-muted-foreground hover:text-foreground hover:underline hover:decoration-dotted underline-offset-2"
                            >
                                <Link href={PLATFORM_HCS_URL} target="_blank" rel="noreferrer">
                                    HCS AUDIT
                                </Link>
                            </Button>
                            <Button
                                asChild
                                variant="link"
                                className="h-8 px-2 font-mono text-[13px] tracking-wide text-muted-foreground hover:text-foreground hover:underline hover:decoration-dotted underline-offset-2"
                            >
                                <Link href={DOCS_URL} target="_blank" rel="noreferrer">
                                    DOCS
                                </Link>
                            </Button>
                            <Button
                                asChild
                                variant="link"
                                className="h-8 px-2 font-mono text-[13px] tracking-wide text-muted-foreground hover:text-foreground hover:underline hover:decoration-dotted underline-offset-2"
                            >
                                <Link href="https://github.com/EmadQureshiKhi/ClawPay" target="_blank" rel="noreferrer">
                                    GITHUB
                                </Link>
                            </Button>
                            <Button
                                asChild
                                variant="link"
                                className="h-8 px-2 font-mono text-[13px] tracking-wide text-muted-foreground hover:text-foreground hover:underline hover:decoration-dotted underline-offset-2"
                            >
                                <Link href="https://x.com/thecorgod1234" target="_blank" rel="noreferrer">
                                    X
                                </Link>
                            </Button>
                        </nav>
                    </div>
                </div>

                {/* Mobile / < sm: centered vertical stack: logo → buttons → copyright */}
                <div className="sm:hidden flex flex-col items-center gap-4 mt-2 py-4">
                    {/* Logo */}
                    <div className="flex items-center gap-2">
                      <img src="/clawpay-logo.png" alt="ClawPay" width={34} height={34} className="rounded-sm" />
                      <span className="font-host font-bold text-2xl"><span className={brandColor}>Claw</span><span className="text-neutral-400">Pay</span></span>
                    </div>

                    {/* Buttons row */}
                    <div className="flex items-center gap-2">
                        <Button
                            variant="link"
                            size="icon"
                            aria-label="Toggle theme"
                            onClick={toggleTheme}
                            className="text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                            {isDark ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4" />}
                        </Button>

                        <nav className="flex items-center">
                            <Button
                                asChild
                                variant="link"
                                className="h-8 px-2 font-mono text-[13px] tracking-wide text-muted-foreground hover:text-foreground hover:underline hover:decoration-dotted underline-offset-2"
                            >
                                <Link href={PLATFORM_HCS_URL} target="_blank" rel="noreferrer">
                                    HCS AUDIT
                                </Link>
                            </Button>
                            <Button
                                asChild
                                variant="link"
                                className="h-8 px-2 font-mono text-[13px] tracking-wide text-muted-foreground hover:text-foreground hover:underline hover:decoration-dotted underline-offset-2"
                            >
                                <Link href={DOCS_URL} target="_blank" rel="noreferrer">
                                    DOCS
                                </Link>
                            </Button>
                            <Button
                                asChild
                                variant="link"
                                className="h-8 px-2 font-mono text-[13px] tracking-wide text-muted-foreground hover:text-foreground hover:underline hover:decoration-dotted underline-offset-2"
                            >
                                <Link href="https://github.com/EmadQureshiKhi/ClawPay" target="_blank" rel="noreferrer">
                                    GITHUB
                                </Link>
                            </Button>
                            <Button
                                asChild
                                variant="link"
                                className="h-8 px-2 font-mono text-[13px] tracking-wide text-muted-foreground hover:text-foreground hover:underline hover:decoration-dotted underline-offset-2"
                            >
                                <Link href="https://x.com/thecorgod1234" target="_blank" rel="noreferrer">
                                    X
                                </Link>
                            </Button>
                        </nav>
                    </div>

                    {/* Copyright */}
                    <p className="text-[13px] font-semibold text-muted-foreground">
                        ©{" "}
                        <span className="font-mono tracking-wide font-medium">
                            {year}
                        </span>
                    </p>
                </div>

            </div>
        </footer>
    )
}
