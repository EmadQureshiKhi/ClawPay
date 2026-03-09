/**
 * Local Hedera price-to-atomic-amount conversion.
 * 
 * The x402 npm package's `processPriceToAtomicAmount` doesn't support Hedera networks,
 * so we handle it locally using our own Hedera network config.
 */

import type { Price, Network } from "x402/types";
import { HEDERA_NETWORKS, type HederaNetworkName } from "../../networks/hedera.js";

// Hedera USDC EVM addresses (derived from token entity IDs)
// Token 0.0.5449 (testnet) -> entity 5449 -> 0x1549 padded
// Token 0.0.456858 (mainnet) -> entity 456858 -> 0x6f89a padded
const HEDERA_USDC_EVM: Record<HederaNetworkName, `0x${string}`> = {
  'hedera-testnet': '0x0000000000000000000000000000000000001549',
  'hedera': '0x000000000000000000000000000000000006f89a',
};

const HEDERA_NETWORK_NAMES: string[] = ['hedera-testnet', 'hedera'];

export function isHederaNetwork(network: Network | string): network is HederaNetworkName {
  return HEDERA_NETWORK_NAMES.includes(network);
}

/**
 * Convert a USD price string (e.g. "$0.01") to atomic USDC units for Hedera.
 * USDC has 6 decimals, so $0.01 = 10000 atomic units.
 * 
 * Returns the same shape as x402's `processPriceToAtomicAmount`.
 */
export function hederaPriceToAtomicAmount(
  price: Price,
  network: HederaNetworkName
): { maxAmountRequired: string; asset: { address: `0x${string}`; decimals: number; symbol: string } } | { error: string } {
  const config = HEDERA_NETWORKS[network];
  if (!config) {
    return { error: `Unsupported Hedera network: ${network}` };
  }

  // Parse price — supports "$0.01", "0.01", etc.
  let amount: number;
  try {
    const cleaned = String(price).replace(/^\$/, '').trim();
    amount = parseFloat(cleaned);
    if (isNaN(amount) || amount < 0) {
      return { error: `Invalid price: ${price}` };
    }
  } catch {
    return { error: `Failed to parse price: ${price}` };
  }

  const decimals = config.usdc.decimals; // 6
  const atomicAmount = BigInt(Math.round(amount * 10 ** decimals));
  const evmAddress = HEDERA_USDC_EVM[network];

  return {
    maxAmountRequired: atomicAmount.toString(),
    asset: {
      address: evmAddress,
      decimals,
      symbol: config.usdc.symbol,
    },
  };
}
