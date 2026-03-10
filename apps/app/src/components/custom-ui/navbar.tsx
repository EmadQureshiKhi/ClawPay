"use client"

import { Button } from "@/components/ui/button"
import { useTheme } from "@/components/providers/theme-context"
import { useSession } from "@/lib/client/auth"
import { User, Menu, Moon, Sun, X } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAccountModal } from "@/components/hooks/use-account-modal"
import { AccountModal } from "@/components/custom-ui/account-modal"
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetClose,
} from "@/components/ui/sheet"
import { useState, useEffect } from "react"

export default function Navbar() {
  const pathname = usePathname()
  const { isDark, toggleTheme } = useTheme()
  const { data: session, isPending: sessionLoading } = useSession()
  const { isOpen, defaultTab, openModal, closeModal } = useAccountModal()
  const [menuOpen, setMenuOpen] = useState(false)

  // Hash detection for auto-opening account modal (only on mount)
  useEffect(() => {
    const hash = window.location.hash
    if (hash === "#account-developer" || hash === "#account-wallet") {
      const tab = hash === "#account-developer" ? "developer" : "wallets"
      openModal(tab)
      // Clear the hash from URL after opening modal
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
    }
  }, []) // Empty dependency array - only run on mount

  // Use text-based branding for ClawPay — avoid hydration mismatch by
  // deferring theme-dependent class to client only
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  const brandColor = mounted ? (isDark ? "text-white" : "text-black") : ""

  const linkClasses =
    "h-8 px-2 font-mono text-[13px] tracking-wider text-muted-foreground hover:text-foreground hover:underline hover:decoration-dotted underline-offset-2"
  const activeLinkClasses = "text-foreground underline decoration-dotted"

  return (
    <nav
      className="sticky top-0 z-40 w-full border-b transition-colors duration-200 bg-white/95 dark:bg-black/95 backdrop-blur border-gray-200 dark:border-gray-800"
    >
      <div className="w-full px-2">
        {/* Mobile: logo left, actions right. Desktop: 3-col grid to center middle links */}
        <div className="flex items-center justify-between py-2 sm:grid sm:grid-cols-3">
          {/* Left: Logo */}
          <div className="flex items-center">
            <Link href="/">
              {/* Mobile: logo + short name */}
              <div className="block sm:hidden">
                <div className="flex items-center gap-1.5">
                  <img src="/clawpay-logo.png" alt="ClawPay" width={32} height={32} className="rounded-sm" />
                  <span className="font-host font-bold text-lg"><span className={brandColor}>Claw</span><span className="text-neutral-400">Pay</span></span>
                </div>
              </div>
              {/* Desktop: full logo */}
              <div className="hidden sm:flex items-center gap-2">
                <img src="/clawpay-logo.png" alt="ClawPay" width={34} height={34} className="rounded-sm" />
                <span className="font-host font-bold text-xl"><span className={brandColor}>Claw</span><span className="text-neutral-400">Pay</span></span>
              </div>
            </Link>
          </div>

          {/* Center (desktop only): BROWSE / MONETIZE / EXPLORER */}
          <div className="hidden sm:flex justify-center items-center gap-8">
            <Button
              asChild
              variant="link"
              className={`${linkClasses} ${pathname === "/servers" ? activeLinkClasses : ""}`}
            >
              <Link href="/servers">BROWSE</Link>
            </Button>
            <Button
              asChild
              variant="link"
              className={`${linkClasses} ${pathname === "/register" ? activeLinkClasses : ""}`}
            >
              <Link href="/register">MONETIZE</Link>
            </Button>
            <Button
              asChild
              variant="link"
              className={`${linkClasses} ${pathname === "/explorer" ? activeLinkClasses : ""}`}
            >
              <Link href="/explorer">EXPLORER</Link>
            </Button>
            <div className="relative group">
              <Button
                asChild
                variant="link"
                className={`${linkClasses} ${pathname === "/agents" || pathname.startsWith("/agents/") ? activeLinkClasses : ""}`}
              >
                <Link href="/agents">AGENTS</Link>
              </Button>
              <div className="absolute top-full left-1/2 -translate-x-1/2 pt-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50">
                <div className="bg-white dark:bg-black border border-gray-200 dark:border-white/[0.08] rounded-md shadow-lg py-1 min-w-[120px]">
                  <Link
                    href="/agents"
                    className="block px-3 py-1.5 text-[11px] font-mono tracking-wider text-muted-foreground hover:text-foreground hover:bg-gray-100 dark:hover:bg-white/[0.04] transition-colors"
                  >
                    REGISTRY
                  </Link>
                  <Link
                    href="/agents/network"
                    className="block px-3 py-1.5 text-[11px] font-mono tracking-wider text-muted-foreground hover:text-foreground hover:bg-gray-100 dark:hover:bg-white/[0.04] transition-colors"
                  >
                    NETWORK
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Connect/Account + Mobile Menu */}
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghostCustom"
              onClick={() => openModal("wallets")}
              disabled={sessionLoading}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors duration-200 cursor-pointer"
              aria-label={session?.user ? "Open account" : "Sign in"}
            >
              {session?.user ? (
                <>
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center bg-gray-200 dark:bg-gray-700"
                  >
                    {session.user.image ? (
                      <Image
                        src={session.user.image}
                        alt="Profile"
                        width={24}
                        height={24}
                        className="w-6 h-6 rounded-full object-cover"
                      />
                    ) : (
                      <User className="h-3 w-3" />
                    )}
                  </div>
                  <span className="hidden sm:inline">
                    {session.user.name?.split(" ")[0] || "Account"}
                  </span>
                </>
              ) : (
                // No icon; always show "SIGN IN" label (mobile + desktop)
                <span>SIGN IN</span>
              )}
            </Button>

            {/* Mobile hamburger (right aligned) */}
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="sm:hidden" aria-label="Open menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>

              {/* Fullscreen sheet, hide built-in close so we can align our own */}
              <SheetContent
                side="right"
                className="p-0 w-screen max-w-none h-screen sm:hidden 
             bg-white text-foreground dark:bg-black
             [&>button.absolute.right-4.top-4]:hidden"
              >
                {/* Header: bigger logo + our aligned close (same row, vertically centered) */}
                <SheetHeader className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <img src="/clawpay-logo.png" alt="ClawPay" width={28} height={28} className="rounded-sm" />
                      <span className="font-host font-bold text-2xl"><span className={brandColor}>Claw</span><span className="text-neutral-400">Pay</span></span>
                    </div>
                    <SheetClose asChild>
                      <Button variant="ghost" size="icon" className="text-foreground" aria-label="Close menu">
                        <X className="h-6 w-6" />
                      </Button>
                    </SheetClose>
                  </div>
                </SheetHeader>


                {/* Links */}
                <div className="px-8 pt-6 space-y-8">
                  <SheetClose asChild>
                    <Link
                      href="/servers"
                      className="block font-mono tracking-wide text-lg text-muted-foreground hover:text-foreground"
                    >
                      BROWSE
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link
                      href="/register"
                      className="block font-mono tracking-wide text-lg text-muted-foreground hover:text-foreground"
                    >
                      MONETIZE
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link
                      href="/explorer"
                      className="block font-mono tracking-wide text-lg text-muted-foreground hover:text-foreground"
                    >
                      EXPLORER
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link
                      href="/agents"
                      className="block font-mono tracking-wide text-lg text-muted-foreground hover:text-foreground"
                    >
                      AGENTS
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link
                      href="/agents/network"
                      className="block font-mono tracking-wide text-base text-muted-foreground/60 hover:text-foreground pl-4"
                    >
                      NETWORK
                    </Link>
                  </SheetClose>
                </div>

                {/* Bottom: centered theme + socials */}
                <div className="absolute inset-x-0 bottom-0 p-5">
                  <div className="flex items-center justify-center gap-2">
                    <Button
                      variant="link"
                      size="icon"
                      aria-label="Toggle theme"
                      onClick={toggleTheme}
                      className="text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      {isDark ? <Sun className="h-5 w-5 text-amber-500" /> : <Moon className="h-5 w-5" />}
                    </Button>

                    <nav className="flex items-center">
                      <Button asChild variant="link" className={linkClasses}>
                        <Link href="https://github.com/EmadQureshiKhi/ClawPay" target="_blank" rel="noreferrer">
                          GITHUB
                        </Link>
                      </Button>
                      <Button asChild variant="link" className={linkClasses}>
                        <Link href="https://x.com/clawpaytech" target="_blank" rel="noreferrer">
                          X
                        </Link>
                      </Button>
                    </nav>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      <AccountModal isOpen={isOpen} onClose={closeModal} defaultTab={defaultTab} />
    </nav>
  )
}
