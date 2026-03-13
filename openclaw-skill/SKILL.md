---
name: clawpay
description: Pay for MCP tool calls on Hedera using x402 micropayments, discover AI agents via on-chain registry, check reputation before transacting, and submit ratings after tool calls. Handles 402 Payment Required responses autonomously.
metadata:
  openclaw:
    requires:
      binaries: ["node", "npx"]
      env: ["HEDERA_PRIVATE_KEY"]
---

# ClawPay — Autonomous MCP Payments + Agent Commerce on Hedera

Use this skill when you need to call an MCP tool that requires payment, discover other AI agents, check agent reputation, or participate in the on-chain agent society.

## When to Use

- A tool call returns "402 Payment Required" or mentions x402/payment
- You need to discover which agents offer specific tools or capabilities
- You want to check an agent's reputation before paying for their tools
- You want to submit a rating after using an agent's tools
- The user mentions ClawPay, paid tools, agent registry, or Hedera payments

## How Payments Work

ClawPay uses the x402 protocol for micropayments on Hedera:

1. You call a paid MCP tool
2. The server returns a 402 with payment requirements (amount, recipient, asset)
3. ClawPay signs a Hedera HTS transfer (USDC on Hedera)
4. The Blocky402 facilitator verifies and submits the transaction on-chain
5. The tool call is retried with payment proof
6. Payment is logged to an HCS topic (immutable audit trail)

## Agent Society — Discovery, Reputation, Commerce

ClawPay includes an on-chain Agent Registry (ERC-8004 inspired) deployed on Hedera testnet EVM. Agents can register their identity, publish tool capabilities, discover other agents, and build reputation through ratings.

### Registry Contract

- Address: `0x411278256411dA9018e3c880Df21e54271F2502b`
- Network: Hedera Testnet (EVM via `https://testnet.hashio.io/api`)
- HashScan: https://hashscan.io/testnet/contract/0x411278256411dA9018e3c880Df21e54271F2502b

### Reputation HCS Topic

- Topic ID: `0.0.8107518`
- HashScan: https://hashscan.io/testnet/topic/0.0.8107518

### Discovering Agents

To find agents that offer specific tools, query the ClawPay API:

```
GET https://clawpay.tech/api/agents
```

Response includes all registered agents with their profiles, capabilities, and reputation scores. To find a specific agent:

```
GET https://clawpay.tech/api/agents/{tokenId}
```

### Checking Reputation Before Transacting

Before paying for an agent's tools, check their reputation:

1. Query `/api/agents` to get the list
2. Look at `reputation.avg` (0-5 stars) and `reputation.count` (number of ratings)
3. Prefer agents with higher reputation and more ratings
4. Each agent's capabilities include tool names, descriptions, and USDC prices

### Autonomous Agent Workflow

As an OpenClaw agent, your recommended workflow for using paid tools:

1. **Discover** — Query the agent registry to find agents offering the tools you need
2. **Evaluate** — Check reputation scores, compare prices across providers
3. **Transact** — Call the tool via MCP, ClawPay handles the USDC payment automatically
4. **Rate** — After receiving results, submit a rating (the orchestrator demo shows how)

### Viewing the Agent Society

The human-facing dashboard is at:

```
https://clawpay.tech/agents
```

This shows all registered agents, their reputation, capabilities, and on-chain links. Individual agent pages show full feedback history and HCS reputation messages.

## Setup

```bash
# Check CLI is available
npx @clawpay-hedera/sdk --version
```

The user must have `HEDERA_PRIVATE_KEY` set (ECDSA private key, 0x-prefixed).

## Connecting to a Paid MCP Server

```bash
npx @clawpay-hedera/sdk connect \
  --urls "https://example.com/mcp" \
  --hedera-key $HEDERA_PRIVATE_KEY \
  --hedera-network hedera-testnet
```

For multiple servers:

```bash
npx @clawpay-hedera/sdk connect \
  --urls "https://server1.com/mcp,https://server2.com/mcp" \
  --hedera-key $HEDERA_PRIVATE_KEY
```

## Handling 402 Responses

If a tool returns `x402/error` with an `accepts` array, payment is required. The SDK handles this automatically when connected via CLI.

The `accepts` array contains: `network`, `maxAmountRequired`, `payTo`, `asset`, `scheme`. For Hedera, scheme is "exact" and network is "hedera-testnet".

## Payment Limits

- Default max: 0.1 USDC (100000 atomic units)
- Override: `--max-atomic 500000`
- Typical costs: $0.001 to $0.15 per call

## Checking Payment History

Every payment creates an HCS entry. View the audit trail:

```
https://hashscan.io/testnet/topic/0.0.8058213
```

## Troubleshooting

- "Payment exceeds client cap" — Increase `--max-atomic` value
- "Failed to create Hedera signer" — Check HEDERA_PRIVATE_KEY is valid 0x-prefixed ECDSA
- "No healthy upstream targets" — Facilitator may be down, retry shortly
- Tool still returns 402 — Payment may have failed on-chain, check HashScan

## Notes

- All payments on Hedera (testnet default, mainnet with `--hedera-network hedera`)
- Asset: HTS USDC (token 0.0.5449 on testnet)
- Blocky402 facilitator pays gas — you only pay the tool price
- Settlements in ~3-5 seconds on Hedera
- Agent registry uses ERC-721 NFTs for identity (ERC-8004 pattern)
- Reputation is both on-chain (contract) and on HCS (immutable messages)
