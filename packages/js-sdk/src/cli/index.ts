#!/usr/bin/env node

import { Command } from "commander";
import { config } from "dotenv";
import { createWalletClient, http, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { publicActions } from "viem";
import packageJson from '../../package.json' with { type: 'json' };
import type { X402ClientConfig } from "../client/with-x402-client.js";
import { ServerType, startStdioServer } from '../server/stdio/start-stdio-server.js';

config();

const SUPPORTED_HEDERA_NETWORKS = ['hedera-testnet', 'hedera'] as const;
type HederaNetwork = typeof SUPPORTED_HEDERA_NETWORKS[number];

// Custom Hedera chain definitions for viem
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

function createHederaSigner(network: HederaNetwork, privateKey: `0x${string}`) {
  const chain = network === 'hedera-testnet' ? hederaTestnet : hederaMainnet;
  const account = privateKeyToAccount(privateKey);
  return createWalletClient({ chain, transport: http(), account }).extend(publicActions);
}

interface ServerOptions {
  urls: string;
  apiKey?: string;
  maxAtomic?: string;
  hederaKey?: string;
  hederaAccount?: string;
  hederaNetwork?: string;
}

const program = new Command();

program
  .name('clawpay')
  .description('ClawPay CLI — autonomous MCP micropayments for AI agents on Hedera')
  .version(packageJson.version);

program
  .command('connect')
  .description('Start an MCP stdio proxy to remote servers with Hedera x402 payments')
  .requiredOption('-u, --urls <urls>', 'Comma-separated list of MCP server URLs')
  .option('-a, --api-key <key>', 'API key for authentication (env: API_KEY)')
  .option('--max-atomic <value>', 'Max payment in atomic units (e.g. 100000 for 0.1 USDC). Env: X402_MAX_ATOMIC')
  .option('--hedera-key <privateKey>', 'Hedera ECDSA private key (0x...) (env: HEDERA_PRIVATE_KEY)')
  .option('--hedera-account <accountId>', 'Hedera account ID (e.g. 0.0.6514537) (env: HEDERA_ACCOUNT_ID)')
  .option('--hedera-network <network>', 'Hedera network: hedera-testnet (default) or hedera (env: HEDERA_NETWORK)')
  .action(async (options: ServerOptions) => {
    try {
      const apiKey = options.apiKey || process.env.API_KEY;
      const maxAtomicArg = options.maxAtomic || process.env.X402_MAX_ATOMIC;
      const hederaKeyArg = options.hederaKey || process.env.HEDERA_PRIVATE_KEY;
      const hederaAccountArg = options.hederaAccount || process.env.HEDERA_ACCOUNT_ID;
      const hederaNetwork = (options.hederaNetwork || process.env.HEDERA_NETWORK || 'hedera-testnet') as HederaNetwork;

      if (!apiKey && !hederaKeyArg) {
        console.error('Error: Provide either --api-key or --hedera-key (env: HEDERA_PRIVATE_KEY).');
        process.exit(1);
      }

      if (hederaKeyArg && !SUPPORTED_HEDERA_NETWORKS.includes(hederaNetwork as any)) {
        console.error(`Error: Invalid network '${hederaNetwork}'. Supported: ${SUPPORTED_HEDERA_NETWORKS.join(', ')}`);
        process.exit(1);
      }

      const serverType = ServerType.HTTPStream;
      const serverUrls = options.urls.split(',').map((url: string) => url.trim());

      if (serverUrls.length === 0) {
        console.error('Error: At least one server URL is required.');
        process.exit(1);
      }

      // Determine proxy mode (API key with proxy URLs)
      const isProxyMode = apiKey && serverUrls.some(url =>
        url.includes('/v1/mcp') || url.includes('clawpay') || url.includes('clawpay-hedera') || url.includes('proxy')
      );

      if (apiKey && !isProxyMode) {
        console.error('Error: API key can only be used with proxy URLs. Use --hedera-key for direct x402 payments.');
        process.exit(1);
      }

      const serverConnections = serverUrls.map(url => {
        const isProxyUrl = url.includes('/v1/mcp') || url.includes('clawpay') || url.includes('clawpay-hedera') || url.includes('proxy');

        let transportOptions: any = undefined;
        if (apiKey && isProxyUrl) {
          transportOptions = {
            requestInit: {
              credentials: 'include',
              headers: new Headers({ 'x-api-key': apiKey })
            }
          };
        }

        return { url, serverType, transportOptions };
      });

      // X402 client config (when using Hedera key directly)
      let x402ClientConfig: X402ClientConfig | undefined = undefined;
      if (!apiKey && hederaKeyArg) {
        const pk = hederaKeyArg.trim();
        if (!pk.startsWith('0x') || pk.length !== 66) {
          console.error('Error: Invalid --hedera-key. Must be 0x-prefixed 64-hex ECDSA key.');
          process.exit(1);
        }

        try {
          const signer = createHederaSigner(hederaNetwork, pk as `0x${string}`);
          const maybeMax = maxAtomicArg ? (() => { try { return BigInt(maxAtomicArg); } catch { return undefined; } })() : undefined;

          x402ClientConfig = {
            wallet: { evm: signer as any },
            hederaConfig: {
              privateKey: pk,
              network: hederaNetwork === 'hedera' ? 'mainnet' : 'testnet',
              payerAccountId: hederaAccountArg,
              facilitatorFeePayer: '0.0.7162784', // Blocky402 fee payer
            },
            ...(maybeMax !== undefined ? { maxPaymentValue: maybeMax } : {}),
            confirmationCallback: async () => true,
          };
        } catch (error) {
          console.error(`Error: Failed to create Hedera signer:`, error instanceof Error ? error.message : String(error));
          process.exit(1);
        }
      }

      await startStdioServer({ serverConnections, x402ClientConfig });

    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  });

program
  .command('version')
  .description('Show version information')
  .action(() => {
    console.log('clawpay version ' + packageJson.version);
  });

program.parse();

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
