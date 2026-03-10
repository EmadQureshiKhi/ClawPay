"use client"

import { useEffect, useState, useCallback } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Github, Check as CheckIcon, ExternalLink, Loader2, Wallet as WalletIcon, Eye, EyeOff, AlertCircle } from "lucide-react"
import { useSession, signIn, signOut } from "@/lib/client/auth"
import { authApi } from "@/lib/client/utils"
import { toast } from "sonner"
import { useTheme } from "@/components/providers/theme-context"
import { useAccount, useConnect, useDisconnect, useChainId } from "wagmi"

type UserModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Balances removed as we are no longer fetching per-network balances here


type ApiKey = {
  id: string
  name?: string
  prefix?: string
  start?: string
  enabled?: boolean
  remaining?: number | null
  expiresAt?: string | null
  createdAt?: string
}

function fmtDate(value?: string | null) {
  if (!value) return "—"
  try {
    return new Date(value).toLocaleString()
  } catch {
    return String(value)
  }
}

type UserAccountPanelProps = {
  isActive?: boolean
  initialTab?: "wallets" | "developer"
}

// ═══════════════════════════════════════════════════════════════════════
// HEDERA WALLET TAB — MetaMask connect + private key + balance
// ═══════════════════════════════════════════════════════════════════════

function HederaWalletTab({ isDark, session }: { isDark: boolean; session: { user?: { id?: string; name?: string; email?: string; image?: string | null } } | null }) {
  const { address: connectedAddress, isConnected } = useAccount()
  const { connectors, connect } = useConnect()
  const { disconnect } = useDisconnect()
  const chainId = useChainId()

  const [hederaAccountId, setHederaAccountId] = useState("")
  const [privateKey, setPrivateKey] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [network, setNetwork] = useState<"testnet" | "mainnet">("testnet")
  const [linking, setLinking] = useState(false)
  const [linked, setLinked] = useState(false)

  // Balance state
  const [balance, setBalance] = useState<{ hbar: string; usdc: string } | null>(null)
  const [balanceLoading, setBalanceLoading] = useState(false)

  // Existing linked wallet
  const [existingWallet, setExistingWallet] = useState<{
    walletAddress: string;
    hederaAccountId?: string;
    network?: string;
    hasKey?: boolean;
  } | null>(null)
  const [loadingExisting, setLoadingExisting] = useState(true)

  // Load existing wallet on mount
  useEffect(() => {
    if (!session?.user) {
      setLoadingExisting(false)
      return
    }
    authApi.getWallets()
      .then((wallets: unknown) => {
        const arr = Array.isArray(wallets) ? wallets : []
        const hedera = arr.find((w: Record<string, unknown>) =>
          w.blockchain === "hedera-testnet" || w.blockchain === "hedera"
        )
        if (hedera) {
          const meta = (hedera as Record<string, unknown>).walletMetadata as Record<string, string> | null
          setExistingWallet({
            walletAddress: hedera.walletAddress,
            hederaAccountId: meta?.hederaAccountId,
            network: meta?.network || hedera.blockchain,
            hasKey: !!meta?.encryptedKey,
          })
          if (meta?.hederaAccountId) {
            setHederaAccountId(meta.hederaAccountId)
            const net = (meta.network || "").includes("mainnet") ? "mainnet" as const : "testnet" as const
            setNetwork(net)
            setLinked(true)
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoadingExisting(false))
  }, [session?.user])

  // Fetch balance when we have an account ID
  useEffect(() => {
    if (!hederaAccountId || !linked) return
    setBalanceLoading(true)
    authApi.getHederaBalance(hederaAccountId, network)
      .then((data: unknown) => {
        const d = data as { hbar?: { formatted: string }; usdc?: { formatted: string } } | null
        if (d?.hbar && d?.usdc) {
          setBalance({ hbar: d.hbar.formatted, usdc: d.usdc.formatted })
        }
      })
      .catch(() => {})
      .finally(() => setBalanceLoading(false))
  }, [hederaAccountId, network, linked])

  const isOnHedera = chainId === 296 || chainId === 295

  const metaMaskConnector = connectors.find(c => c.name === "MetaMask")

  const handleLink = async () => {
    if (!connectedAddress) {
      toast.error("Connect MetaMask first")
      return
    }
    if (!hederaAccountId || !/^0\.0\.\d+$/.test(hederaAccountId)) {
      toast.error("Enter a valid Hedera Account ID (0.0.xxxxx)")
      return
    }
    if (!privateKey || privateKey.length < 60) {
      toast.error("Enter a valid ECDSA private key")
      return
    }

    setLinking(true)
    try {
      const result = await authApi.linkHederaWallet({
        walletAddress: connectedAddress,
        hederaAccountId,
        privateKey,
        network: network === "mainnet" ? "hedera" : "hedera-testnet",
      }) as { ok?: boolean; updated?: boolean; error?: string }

      if (result?.ok) {
        toast.success(result.updated ? "Wallet updated" : "Wallet linked")
        setLinked(true)
        setPrivateKey("") // Clear from memory
        setExistingWallet({
          walletAddress: connectedAddress,
          hederaAccountId,
          network: network === "mainnet" ? "hedera" : "hedera-testnet",
          hasKey: true,
        })
      } else {
        toast.error(result?.error || "Failed to link wallet")
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to link wallet")
    } finally {
      setLinking(false)
    }
  }

  if (loadingExisting) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4 overflow-y-auto pr-1">
      {/* Step 1: MetaMask Connection */}
      <div className={`p-3 rounded-md border ${isDark ? "bg-gray-800/50 border-gray-700" : "bg-gray-50 border-gray-200"}`}>
        <div className="flex items-center gap-2 mb-2">
          <WalletIcon className="h-4 w-4 text-teal-500" />
          <span className={`text-xs font-medium ${isDark ? "text-gray-300" : "text-gray-700"}`}>
            1. Connect MetaMask
          </span>
          {isConnected && isOnHedera && (
            <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-sm ${isDark ? "bg-teal-800/50 text-teal-400" : "bg-teal-500/10 text-teal-600"}`}>
              Connected
            </span>
          )}
        </div>

        {!isConnected ? (
          <Button
            size="sm"
            className="w-full text-xs h-8 bg-teal-600 hover:bg-teal-700 text-white"
            onClick={() => metaMaskConnector && connect({ connector: metaMaskConnector })}
            disabled={!metaMaskConnector}
          >
            <WalletIcon className="h-3 w-3 mr-1.5" />
            Connect MetaMask
          </Button>
        ) : !isOnHedera ? (
          <div className="text-xs text-amber-500">
            Switch to Hedera network in MetaMask (Chain ID 296 for testnet, 295 for mainnet)
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className={`font-mono text-xs ${isDark ? "text-white" : "text-gray-900"}`}>
              {connectedAddress?.slice(0, 8)}...{connectedAddress?.slice(-6)}
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`text-[10px] px-1.5 py-0.5 rounded-sm ${chainId === 296 ? "bg-amber-500/10 text-amber-500" : "bg-teal-500/10 text-teal-500"}`}>
                {chainId === 296 ? "Testnet" : "Mainnet"}
              </span>
              <Button size="sm" variant="ghost" className="text-xs h-6 px-2" onClick={() => disconnect()}>
                Disconnect
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Step 2: Hedera Account ID + Private Key */}
      <div className={`p-3 rounded-md border ${isDark ? "bg-gray-800/50 border-gray-700" : "bg-gray-50 border-gray-200"}`}>
        <div className="flex items-center gap-2 mb-3">
          <span className={`text-xs font-medium ${isDark ? "text-gray-300" : "text-gray-700"}`}>
            2. Hedera Credentials
          </span>
          {linked && existingWallet?.hasKey && (
            <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-sm ${isDark ? "bg-teal-800/50 text-teal-400" : "bg-teal-500/10 text-teal-600"}`}>
              Key Stored
            </span>
          )}
        </div>

        <div className="space-y-2">
          <div>
            <Label className={`text-[10px] uppercase ${isDark ? "text-gray-400" : "text-gray-500"}`}>
              Hedera Account ID
            </Label>
            <Input
              placeholder="0.0.1234567"
              value={hederaAccountId}
              onChange={(e) => setHederaAccountId(e.target.value)}
              className={`h-8 text-xs font-mono ${isDark ? "bg-gray-900 border-gray-600" : "bg-white border-gray-300"}`}
              disabled={linked && existingWallet?.hasKey}
            />
          </div>

          {!(linked && existingWallet?.hasKey) && (
            <div>
              <Label className={`text-[10px] uppercase ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                ECDSA Private Key
              </Label>
              <div className="relative">
                <Input
                  type={showKey ? "text" : "password"}
                  placeholder="0x..."
                  value={privateKey}
                  onChange={(e) => setPrivateKey(e.target.value)}
                  className={`h-8 text-xs font-mono pr-8 ${isDark ? "bg-gray-900 border-gray-600" : "bg-white border-gray-300"}`}
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                >
                  {showKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </button>
              </div>
              <div className="flex items-start gap-1.5 mt-1.5">
                <AlertCircle className="h-3 w-3 text-amber-500 mt-0.5 flex-shrink-0" />
                <span className={`text-[10px] ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                  Your key is encrypted (AES-256-GCM) before storage. It&apos;s used by the proxy to sign x402 payments on your behalf.
                </span>
              </div>
            </div>
          )}

          {/* Network selector */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={network === "testnet" ? "default" : "outline"}
              className="text-[10px] h-6 px-2 flex-1"
              onClick={() => setNetwork("testnet")}
              disabled={linked && existingWallet?.hasKey}
            >
              Testnet
            </Button>
            <Button
              size="sm"
              variant={network === "mainnet" ? "default" : "outline"}
              className="text-[10px] h-6 px-2 flex-1"
              onClick={() => setNetwork("mainnet")}
              disabled={linked && existingWallet?.hasKey}
            >
              Mainnet
            </Button>
          </div>

          {!(linked && existingWallet?.hasKey) && (
            <Button
              size="sm"
              className="w-full text-xs h-8 bg-teal-600 hover:bg-teal-700 text-white"
              onClick={handleLink}
              disabled={linking || !isConnected || !isOnHedera || !hederaAccountId || !privateKey}
            >
              {linking ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : null}
              {linking ? "Linking..." : "Link Wallet & Store Key"}
            </Button>
          )}

          {linked && existingWallet?.hasKey && (
            <Button
              size="sm"
              variant="outline"
              className="w-full text-xs h-7"
              onClick={() => {
                setLinked(false)
                setExistingWallet(prev => prev ? { ...prev, hasKey: false } : null)
                setPrivateKey("")
              }}
            >
              Update Key
            </Button>
          )}
        </div>
      </div>

      {/* Step 3: Balance Display */}
      {linked && hederaAccountId && (
        <div className={`p-3 rounded-md border ${isDark ? "bg-gray-800/50 border-gray-700" : "bg-gray-50 border-gray-200"}`}>
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-xs font-medium ${isDark ? "text-gray-300" : "text-gray-700"}`}>
              3. Balance
            </span>
            <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-sm ${network === "testnet" ? "bg-amber-500/10 text-amber-500" : "bg-teal-500/10 text-teal-500"}`}>
              {network}
            </span>
          </div>

          {balanceLoading ? (
            <div className="flex items-center gap-2 py-1">
              <Loader2 className="h-3 w-3 animate-spin text-gray-400" />
              <span className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>Loading balance...</span>
            </div>
          ) : balance ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className={`text-[10px] uppercase ${isDark ? "text-gray-500" : "text-gray-400"}`}>HBAR</div>
                <div className={`text-sm font-mono font-medium ${isDark ? "text-white" : "text-gray-900"}`}>
                  {balance.hbar} ℏ
                </div>
              </div>
              <div>
                <div className={`text-[10px] uppercase ${isDark ? "text-gray-500" : "text-gray-400"}`}>USDC</div>
                <div className={`text-sm font-mono font-medium ${isDark ? "text-white" : "text-gray-900"}`}>
                  ${balance.usdc}
                </div>
              </div>
            </div>
          ) : (
            <div className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>
              Could not load balance
            </div>
          )}

          {hederaAccountId && (
            <Button
              size="sm"
              variant="ghost"
              className="text-[10px] h-6 px-0 mt-1"
              onClick={() => window.open(`https://hashscan.io/${network}/account/${hederaAccountId}`, "_blank")}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              View on HashScan
            </Button>
          )}
        </div>
      )}

      {/* Info box */}
      <div className={`p-3 rounded-md border ${isDark ? "bg-blue-950/30 border-blue-800/30" : "bg-blue-50 border-blue-200"}`}>
        <div className="flex items-start gap-2">
          <AlertCircle className={`h-3.5 w-3.5 mt-0.5 flex-shrink-0 ${isDark ? "text-blue-400" : "text-blue-500"}`} />
          <div className={`text-[10px] leading-relaxed ${isDark ? "text-blue-300/80" : "text-blue-600"}`}>
            After linking your wallet and creating an API key (Developer tab), agents can use your proxy URL to make autonomous payments. Alternatively, use the CLI directly: <code className="font-mono">npx @clawpay-hedera/sdk connect --hedera-key ...</code>
          </div>
        </div>
      </div>
    </div>
  )
}

export function UserAccountPanel({ isActive = true, initialTab }: UserAccountPanelProps) {
  const { data: session } = useSession()
  const { isDark } = useTheme()

  const [activeTab, setActiveTab] = useState<"wallets" | "developer">(initialTab || "wallets")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>("")

  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [apiKeysLoading, setApiKeysLoading] = useState(false)
  const [apiKeyCreated, setApiKeyCreated] = useState<string>("")
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)


  const loadApiKeys = useCallback(async () => {
    setApiKeysLoading(true)
    try {
      const items = await authApi.getApiKeys() as ApiKey[]
      setApiKeys(Array.isArray(items) ? items : [])
    } catch (e) {
      console.error(e)
    } finally {
      setApiKeysLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isActive) return
    setError("")
    if (session?.user) {
      if (activeTab === "developer") loadApiKeys()
    }
  }, [isActive, session?.user, activeTab, loadApiKeys])


  async function handleGitHubSignIn() {
    setLoading(true)
    setError("")
    try {
      await signIn.social({ provider: "github", callbackURL: window.location.href })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign in with GitHub")
      setLoading(false)
    }
  }

  async function handleGoogleSignIn() {
    setLoading(true)
    setError("")
    try {
      await signIn.social({ provider: "google", callbackURL: window.location.href })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign in with Google")
      setLoading(false)
    }
  }

  async function handleSignOut() {
    setLoading(true)
    setError("")
    try {
      await signOut()
      setApiKeys([])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign out")
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateApiKey() {
    if (!session?.user) return
    try {
      // Generate a descriptive name for the API key
      const prefixes = ['Manual', 'Custom', 'Personal', 'User', 'Dev', 'Test', 'App', 'Client', 'Service', 'Tool']
      const suffixes = ['Key', 'Token', 'Access', 'Auth', 'API', 'Credential', 'Secret', 'Pass', 'Login', 'Auth']
      const randomPrefix = prefixes[Math.floor(Math.random() * prefixes.length)]
      const randomSuffix = suffixes[Math.floor(Math.random() * suffixes.length)]
      const randomNumber = Math.floor(Math.random() * 9999) + 1
      const randomName = `${randomPrefix} ${randomSuffix} ${randomNumber}`
      
      const created = await authApi.createApiKey({ 
        name: randomName,
        prefix: 'clawpay_'
      })
      if (created && created.key) setApiKeyCreated(created.key as string)
      await loadApiKeys()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create API key")
    }
  }

  async function handleToggleKey(id: string, enabled: boolean) {
    try {
      await authApi.updateApiKey(id, !enabled)
      await loadApiKeys()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update API key")
    }
  }

  async function handleDeleteKey(id: string) {
    try {
      await authApi.deleteApiKey(id)
      await loadApiKeys()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete API key")
    }
  }

  async function handleBulkDelete() {
    if (selectedKeys.size === 0) return
    setBulkDeleting(true)
    try {
      const deletePromises = Array.from(selectedKeys).map(id => authApi.deleteApiKey(id))
      await Promise.all(deletePromises)
      setSelectedKeys(new Set())
      await loadApiKeys()
      toast.success(`Deleted ${selectedKeys.size} API key${selectedKeys.size > 1 ? 's' : ''}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete API keys")
    } finally {
      setBulkDeleting(false)
    }
  }

  function handleSelectKey(id: string, checked: boolean) {
    setSelectedKeys(prev => {
      const newSet = new Set(prev)
      if (checked) {
        newSet.add(id)
      } else {
        newSet.delete(id)
      }
      return newSet
    })
  }

  function handleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedKeys(new Set(apiKeys.map(k => k.id)))
    } else {
      setSelectedKeys(new Set())
    }
  }

  // Removed total and subtitle balance-related labels as balances are no longer fetched

  return (
    <div className="h-full flex flex-col p-4 pt-10 sm:p-6 sm:pt-10">
      {error ? (
        <div className={`mb-3 p-3 rounded-md border flex-shrink-0 ${isDark ? "bg-red-950/50 border-red-800/50" : "bg-red-50 border-red-200"}`}>
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-md ${isDark ? "bg-red-800/50 text-red-400" : "bg-red-500/10 text-red-600"}`}>
              <div className="h-4 w-4" />
            </div>
            <div className="space-y-2">
              <h4 className={`text-sm font-medium ${isDark ? "text-white" : "text-gray-900"}`}>Error</h4>
              <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>{error}</p>
            </div>
          </div>
        </div>
      ) : null}

      {!session?.user ? (
        <div className={`p-3 rounded-md border mb-4 ${isDark ? "bg-gray-800/50 border-gray-700" : "bg-gray-50 border-gray-200"}`}>
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-md ${isDark ? "bg-blue-800/50 text-blue-400" : "bg-blue-500/10 text-blue-600"}`}>
              <Github className="h-4 w-4" />
            </div>
            <div className="flex-1 space-y-2">
              <h4 className={`text-sm font-medium ${isDark ? "text-white" : "text-gray-900"}`}>Sign in required</h4>
              <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>Please sign in to access your account dashboard.</p>
              <div className="flex gap-2">
                <Button onClick={handleGoogleSignIn} disabled={loading} className="gap-2 text-xs h-7 flex-1">
                  {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : (
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  )}
                  {loading ? "Signing in..." : "Google"}
                </Button>
                <Button onClick={handleGitHubSignIn} disabled={loading} className="gap-2 text-xs h-7 flex-1">
                  {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Github className="h-3 w-3" />}
                  {loading ? "Signing in..." : "GitHub"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className={`p-3 rounded-md border mb-4 ${isDark ? "bg-gray-800/50 border-gray-700" : "bg-gray-50 border-gray-200"}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full overflow-hidden flex items-center justify-center ${isDark ? "bg-gray-700" : "bg-gray-200"}`}>
                {session.user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={session.user.image} alt="avatar" className="w-10 h-10 object-cover" />
                ) : (
                  <div className={`w-5 h-5 rounded-full ${isDark ? "bg-gray-500" : "bg-gray-400"}`} />
                )}
              </div>
              <div>
                <div className={`text-sm font-medium ${isDark ? "text-white" : "text-gray-900"}`}>{session.user.name || "User"}</div>
                <div className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>{session.user.email || ""}</div>
              </div>
            </div>
            <Button variant="outline" onClick={handleSignOut} disabled={loading} className="text-xs h-7">
              Sign out
            </Button>
          </div>
        </div>
      )}

      <div className={`border rounded-md flex-shrink-0 ${isDark ? "bg-gray-800/50 border-gray-700" : "bg-gray-50 border-gray-200"}`}>
        <div className="flex gap-2 overflow-x-auto p-2">
          {(
            [
              { key: "wallets", label: "Wallet" },
              { key: "developer", label: "Developer" },
            ] as const
          ).map((t) => (
            <Button
              key={t.key}
              size="sm"
              variant={activeTab === t.key ? "default" : "ghost"}
              onClick={() => setActiveTab(t.key)}
              className="text-xs h-7 px-3"
            >
              {t.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex-1 min-h-0">
        {activeTab === "wallets" && (
          <div className="h-full flex flex-col">
            <HederaWalletTab isDark={isDark} session={session} />
          </div>
        )}

        {activeTab === "developer" && (
          <div className="h-full flex flex-col">
            <div className="flex-1 min-h-0">
              {session?.user ? (
                <div className="h-full overflow-y-auto pr-2">
                  <div className="space-y-4 pb-4">
                    {apiKeyCreated ? (
                      <div className={`p-3 rounded-md border ${isDark ? "bg-gray-800/50 border-gray-700" : "bg-gray-50 border-gray-200"}`}>
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-md ${isDark ? "bg-teal-800/50 text-teal-400" : "bg-teal-500/10 text-teal-600"}`}>
                            <CheckIcon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 space-y-2">
                            <h4 className={`text-sm font-medium ${isDark ? "text-white" : "text-gray-900"}`}>API key created</h4>
                            <div className={`p-2 rounded-md border ${isDark ? "border-gray-700 bg-gray-900" : "border-gray-200 bg-white"}`}>
                              <code className={`text-xs font-mono break-all ${isDark ? "text-white" : "text-gray-900"}`}>{apiKeyCreated}</code>
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" className="text-xs h-7 px-2" onClick={() => {
                                navigator.clipboard.writeText(apiKeyCreated)
                                toast.success("API key copied")
                              }}>Copy</Button>
                              <Button size="sm" variant="ghost" className="text-xs h-7 px-2" onClick={() => setApiKeyCreated("")}>Dismiss</Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    <div className={`p-3 rounded-md border ${isDark ? "bg-gray-800/50 border-gray-700" : "bg-gray-50 border-gray-200"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>Keys inherit default permissions unless specified by the server.</div>
                        <Button size="sm" className="text-xs h-7 px-2 bg-teal-600 hover:bg-teal-700 text-white" onClick={handleCreateApiKey}>Create API Key</Button>
                      </div>
                    </div>

                    <div className={`rounded-md border ${isDark ? "border-gray-700" : "border-gray-200"}`}>
                      <div className={`p-3 border-b flex items-center justify-between flex-shrink-0 ${isDark ? "border-gray-700" : "border-gray-200"}`}>
                        <div className="flex items-center gap-3">
                          <div className={`text-sm font-medium ${isDark ? "text-white" : "text-gray-900"}`}>Your API Keys</div>
                          {apiKeys.length > 0 && (
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  checked={selectedKeys.size === apiKeys.length && apiKeys.length > 0}
                                  onCheckedChange={handleSelectAll}
                                />
                                <span className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                                  Select all
                                </span>
                              </div>
                              {selectedKeys.size > 0 && (
                                <Button 
                                  size="sm" 
                                  variant="destructive" 
                                  className="text-xs h-7 px-2" 
                                  onClick={handleBulkDelete}
                                  disabled={bulkDeleting}
                                >
                                  {bulkDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : `Delete ${selectedKeys.size}`}
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                        <Button size="sm" variant="outline" className="text-xs h-7 px-2" onClick={loadApiKeys} disabled={apiKeysLoading}>
                          {apiKeysLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Reload"}
                        </Button>
                      </div>
                      <div className="flex-1 min-h-0">
                        {apiKeys.length === 0 ? (
                          <div className={`p-4 text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>No API keys yet. Create one above.</div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                              <thead className={isDark ? "bg-gray-800/50" : "bg-gray-50"}>
                                <tr>
                                  <th className={`text-left font-medium px-3 py-2 text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}></th>
                                  <th className={`text-left font-medium px-3 py-2 text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>Name</th>
                                  <th className={`text-left font-medium px-3 py-2 text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>Enabled</th>
                                  <th className={`text-left font-medium px-3 py-2 text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>Created</th>
                                  <th className={`text-right font-medium px-3 py-2 text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>Actions</th>
                                </tr>
                              </thead>
                              <tbody className={`divide-y ${isDark ? "divide-gray-700" : "divide-gray-200"}`}>
                                {apiKeys.map((k) => {
                                  const enabled = k.enabled !== false
                                  return (
                                    <tr key={k.id} className={`transition-all duration-300 ${isDark ? "hover:bg-gray-800/40" : "hover:bg-gray-100"}`}>
                                      <td className="px-3 py-2">
                                        <Checkbox
                                          checked={selectedKeys.has(k.id)}
                                          onCheckedChange={(checked) => handleSelectKey(k.id, checked as boolean)}
                                        />
                                      </td>
                                      <td className={`px-3 py-2 text-xs ${isDark ? "text-white" : "text-gray-900"}`}>{k.name || "—"}</td>
                                      <td className={`px-3 py-2 text-xs ${isDark ? "text-white" : "text-gray-900"}`}>{enabled ? "Yes" : "No"}</td>
                                      <td className={`px-3 py-2 text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>{fmtDate(k.createdAt)}</td>
                                      <td className="px-3 py-2 text-right">
                                        <div className="inline-flex gap-2">
                                          <Button size="sm" variant="outline" className="text-xs h-7 px-2" onClick={() => handleToggleKey(k.id, enabled)}>
                                            {enabled ? "Disable" : "Enable"}
                                          </Button>
                                          <Button size="sm" variant="destructive" className="text-xs h-7 px-2" onClick={() => handleDeleteKey(k.id)}>
                                            Delete
                                          </Button>
                                        </div>
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className={`p-3 rounded-md border ${isDark ? "bg-gray-800/50 border-gray-700" : "bg-gray-50 border-gray-200"}`}>
                  <div className={`flex items-center justify-center text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                    Sign in to manage API keys.
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        </div>
    </div>
  )
}

export function UserModal({ open, onOpenChange }: UserModalProps) {
  const { isDark } = useTheme()
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`max-w-4xl max-h-[90vh] flex flex-col ${isDark ? "!bg-black border-neutral-800" : "!bg-white border-neutral-200"}`}>
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className={isDark ? "text-white" : "text-gray-900"}>Your Account</DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-hidden">
          <UserAccountPanel isActive={open} />
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default UserModal


