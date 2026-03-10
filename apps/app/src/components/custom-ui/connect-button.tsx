"use client"

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain, type Connector } from 'wagmi'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'
import { hederaTestnet, hederaMainnet } from '@/lib/client/config'

const HEDERA_CHAINS = [
  { id: hederaTestnet.id, name: 'Hedera Testnet', explorer: 'https://hashscan.io/testnet' },
  { id: hederaMainnet.id, name: 'Hedera Mainnet', explorer: 'https://hashscan.io/mainnet' },
]

export function ConnectButton() {
  const { address, isConnected, connector } = useAccount()
  const { connectors, connect } = useConnect()
  const { disconnect } = useDisconnect()
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()

  const [isConnecting, setIsConnecting] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)

  const currentChain = useMemo(() => HEDERA_CHAINS.find(c => c.id === chainId), [chainId])
  const isOnHedera = currentChain !== undefined

  const availableConnectors = useMemo(() => {
    return connectors.filter(c => c.name !== 'Coinbase Wallet SDK')
  }, [connectors])

  const handleConnect = useCallback(async (connector: Connector) => {
    try {
      setIsConnecting(true)
      setConnectionError(null)
      connect({ connector })
    } catch (error) {
      console.error('Connection failed:', error)
      setConnectionError('Connection failed. Please try again.')
    } finally {
      setIsConnecting(false)
    }
  }, [connect])

  const handleDisconnect = useCallback(() => {
    disconnect()
    setConnectionError(null)
  }, [disconnect])

  useEffect(() => {
    if (connectionError) {
      const timer = setTimeout(() => setConnectionError(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [connectionError])

  if (!isConnected) {
    return (
      <div className="space-y-3">
        {connectionError && (
          <div className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg p-3">
            {connectionError}
          </div>
        )}
        <div className="space-y-2">
          {availableConnectors.map((connector) => (
            <Button
              key={connector.id}
              onClick={() => handleConnect(connector)}
              disabled={isConnecting}
              variant="outline"
              className="w-full h-11 text-[15px] font-medium"
            >
              {isConnecting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Connect {connector.name}
            </Button>
          ))}
        </div>
      </div>
    )
  }

  if (!isOnHedera) {
    return (
      <div className="space-y-3">
        <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
          Please switch to a Hedera network in MetaMask
        </div>
        <div className="space-y-2">
          {HEDERA_CHAINS.map((chain) => (
            <Button
              key={chain.id}
              onClick={() => switchChain?.({ chainId: chain.id })}
              variant="outline"
              className="w-full h-10 text-sm"
            >
              Switch to {chain.name}
            </Button>
          ))}
        </div>
        <Button onClick={handleDisconnect} variant="ghost" className="w-full text-sm text-gray-500">
          Disconnect
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="text-center space-y-3">
        <div className="flex items-center justify-center gap-2">
          <Badge variant="secondary" className="text-xs">{connector?.name}</Badge>
          <Badge variant="outline" className="text-xs">{currentChain?.name}</Badge>
        </div>
        <div className="text-sm font-mono text-gray-600">
          {address?.slice(0, 6)}...{address?.slice(-4)}
        </div>
      </div>
      <Button onClick={handleDisconnect} variant="outline" className="w-full h-10">
        Disconnect
      </Button>
    </div>
  )
}
