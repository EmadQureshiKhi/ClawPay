/**
 * Hedera network configuration for ClawPay
 * Supports HTS USDC and native HBAR payments via x402
 */

export const HEDERA_NETWORKS = {
  'hedera-testnet': {
    name: 'Hedera Testnet',
    chainId: 296,
    rpcUrl: 'https://testnet.hashio.io/api',
    mirrorNodeUrl: 'https://testnet.mirrornode.hedera.com',
    usdc: {
      tokenId: '0.0.5449',
      decimals: 6,
      symbol: 'USDC',
    },
    hbar: {
      decimals: 8,
      symbol: 'HBAR',
    },
    isTestnet: true,
  },
  'hedera': {
    name: 'Hedera Mainnet',
    chainId: 295,
    rpcUrl: 'https://mainnet.hashio.io/api',
    mirrorNodeUrl: 'https://mainnet.mirrornode.hedera.com',
    usdc: {
      tokenId: '0.0.456858',
      decimals: 6,
      symbol: 'USDC',
    },
    hbar: {
      decimals: 8,
      symbol: 'HBAR',
    },
    isTestnet: false,
  },
} as const;

export type HederaNetworkName = keyof typeof HEDERA_NETWORKS;

export const SUPPORTED_HEDERA_NETWORKS: HederaNetworkName[] = ['hedera-testnet', 'hedera'];

export const DEFAULT_HEDERA_NETWORK: HederaNetworkName = 'hedera-testnet';

/** Facilitator endpoint for Hedera x402 payments */
export const HEDERA_FACILITATOR_URL = 'https://api.testnet.blocky402.com';

/**
 * Get the HashScan explorer URL for a transaction
 */
export function getHashScanUrl(txId: string, network: HederaNetworkName = 'hedera-testnet'): string {
  const base = network === 'hedera'
    ? 'https://hashscan.io/mainnet'
    : 'https://hashscan.io/testnet';
  return `${base}/transaction/${txId}`;
}

/**
 * Get the HashScan explorer URL for an HCS topic
 */
export function getHCSTopicUrl(topicId: string, network: HederaNetworkName = 'hedera-testnet'): string {
  const base = network === 'hedera'
    ? 'https://hashscan.io/mainnet'
    : 'https://hashscan.io/testnet';
  return `${base}/topic/${topicId}`;
}
