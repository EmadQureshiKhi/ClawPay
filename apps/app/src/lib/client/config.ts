"use client";

import { metaMask } from 'wagmi/connectors'
import { http, createConfig, createStorage } from 'wagmi'
import { defineChain } from 'viem'

// Hedera Mainnet via HashIO JSON-RPC relay
export const hederaMainnet = defineChain({
  id: 295,
  name: 'Hedera Mainnet',
  nativeCurrency: { name: 'HBAR', symbol: 'HBAR', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://mainnet.hashio.io/api'] },
  },
  blockExplorers: {
    default: { name: 'HashScan', url: 'https://hashscan.io/mainnet' },
  },
})

// Hedera Testnet via HashIO JSON-RPC relay
export const hederaTestnet = defineChain({
  id: 296,
  name: 'Hedera Testnet',
  nativeCurrency: { name: 'HBAR', symbol: 'HBAR', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://testnet.hashio.io/api'] },
  },
  blockExplorers: {
    default: { name: 'HashScan', url: 'https://hashscan.io/testnet' },
  },
})

export const wagmiConfig = createConfig({
  chains: [hederaTestnet, hederaMainnet],
  connectors: [
    metaMask({
      dappMetadata: {
        name: "ClawPay",
        url: "https://clawpay.tech",
        iconUrl: "https://clawpay.tech/clawpay-logo.png",
      },
    }),
  ],
  storage: typeof window !== 'undefined'
    ? createStorage({ storage: localStorage })
    : undefined,
  transports: {
    [hederaTestnet.id]: http('https://testnet.hashio.io/api'),
    [hederaMainnet.id]: http('https://mainnet.hashio.io/api'),
  },
})
