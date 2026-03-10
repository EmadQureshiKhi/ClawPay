# ClawPay Monetization Wrapper (mcp2)

x402 monetization wrapper for MCP servers. Wraps any free MCP server with a payment proxy so tool calls require USDC payment on Hedera via the x402 protocol.

When a developer pastes their free server URL on the Register page and chooses "Monetize", this service creates a wrapper endpoint that intercepts tool calls and adds x402 paywalls at the configured price.

## How It Works

1. Developer registers a free MCP server URL
2. mcp2 creates a wrapper endpoint (e.g. `http://localhost:3006/mcp?id=srv_abc123`)
3. Agents connect to the wrapper URL instead of the original
4. Wrapper intercepts `tools/call` requests and returns 402 with payment requirements
5. Agent pays via x402 on Hedera, wrapper verifies, forwards to the original server

## Setup

```bash
# From repo root
pnpm install

# Copy env and configure Redis (Upstash)
cp .env.example .env

# Run
pnpm --filter @clawpay/mcp2 dev    # dev with watch
pnpm --filter @clawpay/mcp2 start  # production
```

Runs on port 3006.

## Scripts

See `scripts/README.md` for management and analysis utilities.
