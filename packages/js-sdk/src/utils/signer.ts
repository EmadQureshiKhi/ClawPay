import { Account, Chain, Client, PublicActions, RpcSchema, Transport, WalletActions } from "viem";
import { base, baseSepolia, avalancheFuji, sei, seiTestnet, polygon, polygonAmoy } from "viem/chains";
import { createWalletClient, http, defineChain } from "viem";
import { publicActions } from "viem";

export type SignerWallet<
  chain extends Chain = Chain,
  transport extends Transport = Transport,
  account extends Account = Account,
> = Client<
  transport,
  chain,
  account,
  RpcSchema,
  PublicActions<transport, chain, account> & WalletActions<chain, account>
>;

// Hedera chain definitions (primary)
const hederaTestnet = defineChain({
  id: 296,
  name: 'Hedera Testnet',
  nativeCurrency: { name: 'HBAR', symbol: 'HBAR', decimals: 18 },
  rpcUrls: { default: { http: ['https://testnet.hashio.io/api'] } },
  blockExplorers: { default: { name: 'HashScan', url: 'https://hashscan.io/testnet' } },
  testnet: true,
});

const hederaMainnet = defineChain({
  id: 295,
  name: 'Hedera Mainnet',
  nativeCurrency: { name: 'HBAR', symbol: 'HBAR', decimals: 18 },
  rpcUrls: { default: { http: ['https://mainnet.hashio.io/api'] } },
  blockExplorers: { default: { name: 'HashScan', url: 'https://hashscan.io/mainnet' } },
  testnet: false,
});

function getChainFromNetwork(network: string | undefined): Chain {
    if (!network) {
      throw new Error("Network is required");
    }
  
    switch (network) {
      // Hedera (primary)
      case "hedera-testnet":
        return hederaTestnet;
      case "hedera":
        return hederaMainnet;
      // Legacy EVM chains (kept for backward compatibility with proxy strategies)
      case "base":
        return base;
      case "base-sepolia":
        return baseSepolia;
      case "avalanche-fuji":
        return avalancheFuji;
      case "sei":
        return sei;
      case "sei-testnet":
        return seiTestnet;
      case "polygon":
        return polygon;
      case "polygon-amoy":
        return polygonAmoy;
      default:
        throw new Error(`Unsupported network: ${network}`);
    }
  }

export function createSignerFromViemAccount(network: string, account: Account): SignerWallet<Chain> {
    const chain = getChainFromNetwork(network);
    return createWalletClient({
      chain,
      transport: http(),
      account: account,
    }).extend(publicActions);
  }
