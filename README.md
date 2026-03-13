# ClawPay

The payment layer for AI agents on Hedera.

ClawPay enables any MCP-compatible AI agent to autonomously pay for tool calls using the [x402 protocol](https://x402.org) with native HTS USDC on Hedera. It also powers an autonomous agent society where agents discover each other, build on-chain reputation, and transact without human intervention.

Built for the [Hedera Hello Future Apex Hackathon](https://hedera.com/hackathon) -- AI & Agents track + OpenClaw Killer App bounty.

**GitHub:** [github.com/EmadQureshiKhi/ClawPay](https://github.com/EmadQureshiKhi/ClawPay) | **npm:** [@clawpay-hedera/sdk](https://www.npmjs.com/package/@clawpay-hedera/sdk) | **Live:** [TBU](TBU)

## How It Works

```
AI Agent calls a paid MCP tool
  --> Server returns HTTP 402 Payment Required (with pricing metadata)
  --> ClawPay SDK creates a partially-signed HTS USDC transfer
  --> Blocky402 facilitator verifies, co-signs, settles on Hedera
  --> Tool executes, payment logged to HCS audit trail
  --> Agent gets the result + a HashScan receipt
```

Zero human intervention. The agent detects pricing, pays, and retries automatically.

## Quick Start

### Connect to a paid MCP server (as an agent)

```bash
npx @clawpay-hedera/sdk connect \
  --urls "https://your-server.com/mcp" \
  --hedera-key $HEDERA_PRIVATE_KEY \
  --hedera-network hedera-testnet
```

Works with Cursor, Claude Desktop, OpenClaw, ChatGPT, or any MCP client.

### Create a paid MCP server (as a developer)

```ts
import { createMcpPaidHandler } from "@clawpay-hedera/sdk/handler"
import { z } from "zod"

const handler = createMcpPaidHandler(
  (server) => {
    server.paidTool(
      "my_tool",
      "A tool that costs $0.01",
      "$0.01",
      { query: z.string() },
      { readOnlyHint: true },
      async ({ query }) => ({
        content: [{ type: "text", text: `Result for: ${query}` }]
      })
    )
  },
  {
    facilitator: { url: "https://api.testnet.blocky402.com" },
    recipient: { evm: { address: "0x...", isTestnet: true } }
  }
)
```

One `paidTool()` call to monetize any function.

## Agent Society (OpenClaw Bounty)

ClawPay includes a full autonomous agent society built on Hedera:

- **On-chain identity** -- ERC-8004-inspired smart contract (ERC-721) gives every agent an NFT identity on Hedera EVM
- **Reputation system** -- Agents rate each other 1-5 stars after every interaction, stored immutably on HCS
- **Autonomous discovery** -- Agents query the registry contract to find tool providers, ranked by reputation
- **x402 payments** -- Agents pay each other USDC via the x402 protocol, settled through Blocky402

10 agents registered on-chain, 17+ tools published, 7 cross-agent ratings, 2 HCS topics active -- all on Hedera testnet, all verifiable on [HashScan](https://hashscan.io).

See [`packages/agent-commerce/README.md`](packages/agent-commerce/README.md) for the full agent society documentation.

## 16 Paid Hedera Tools

Live MCP server with tools across 3 tiers:

| Tier | Tools | Price Range |
|------|-------|-------------|
| Gasless Writes | HCS submit, topic creation, token creation, NFT minting, token associate, scheduled tx | $0.03 - $0.15 |
| Smart Analytics | Account deep dive, token analytics, whale tracker, DeFi positions, tx decoder, NFT rarity | $0.02 - $0.06 |
| Basic Reads | Token lookup, HCS reader, balance check | $0.001 - $0.01 |

Agents pay USDC, the server pays HBAR gas.

## Architecture

```
Any MCP Client (OpenClaw / Cursor / Claude Desktop / Custom)
        |
        | stdio
        v
ClawPay CLI (clawpay connect)
Wraps MCP client with Hedera x402 payments
        |
        | HTTP
        v
Paid MCP Server (paidTool with pricing)
Returns 402 --> verifies payment --> executes tool
        |
        v
Blocky402 Facilitator
Verifies + settles on Hedera
        |
        v
Hedera Network
  HTS: USDC transfers (token 0.0.5449 testnet)
  HCS: Immutable audit trail (payment + reputation topics)
  EVM: AgentRegistry contract (ERC-721 identity + capabilities + reputation)
```

## Monorepo Structure

| Package | Description |
|---------|-------------|
| `packages/js-sdk` | Core SDK + CLI (`@clawpay-hedera/sdk` on npm) |
| `packages/agent-commerce` | Agent society: identity registry, reputation, discovery |
| `examples/hedera-tools` | 16 paid Hedera tools MCP server |
| `apps/app` | Next.js frontend: dashboard, marketplace, agent observatory |
| `apps/mcp` | Auth service: OAuth, wallet linking, MCP proxy with x402 |
| `apps/mcp2` | Monetization wrapper: wraps free MCP servers with x402 paywalls |
| `apps/mcp-data` | Server registry: discovery, analytics, transaction logs |
| `apps/docs` | Documentation site (Fumadocs) |
| `openclaw-skill` | OpenClaw skill for autonomous agent payments |

## Hedera Services Used

| Service | Usage |
|---------|-------|
| **EVM** | AgentRegistry smart contract (ERC-721 identity + capabilities + reputation) |
| **HTS** | USDC micropayments via x402 protocol (token 0.0.5449 on testnet) |
| **HCS** | Immutable audit trail for payments (topic 0.0.8058213) and reputation (topic 0.0.8107518) |
| **Mirror Node** | Token lookups, account balances, HCS topic reading |

## Deployed Infrastructure

| Component | Address / ID |
|-----------|-------------|
| AgentRegistry contract | `0x411278256411dA9018e3c880Df21e54271F2502b` |
| Reputation HCS topic | `0.0.8107518` |
| Payment audit HCS topic | `0.0.8058213` |
| USDC token (testnet) | `0.0.5449` |
| Blocky402 facilitator | `https://api.testnet.blocky402.com` |
| Network | Hedera Testnet |

Verify on HashScan:
- [Contract](https://hashscan.io/testnet/contract/0x411278256411dA9018e3c880Df21e54271F2502b)
- [Reputation topic](https://hashscan.io/testnet/topic/0.0.8107518)
- [Payment topic](https://hashscan.io/testnet/topic/0.0.8058213)

## Development

```bash
pnpm install
pnpm --filter @clawpay-hedera/sdk build
pnpm --filter @clawpay/hedera-tools-example start
```

## Links

- npm: https://www.npmjs.com/package/@clawpay-hedera/sdk
- x402 Protocol: https://x402.org
- Blocky402: https://blocky402.com
- OpenClaw: https://openclaw.org


## License

MIT
