# ClawPay Frontend (app)

Next.js dashboard for ClawPay. Browse MCP servers, register new ones, manage wallets and API keys.

## Pages

| Page | Route | What It Does |
|------|-------|-------------|
| Home | `/` | Landing page with ClawPay overview |
| Servers | `/servers` | Browse registered MCP servers |
| Server Detail | `/servers/:id` | Tools, pricing, connection config |
| Register | `/register` | Register or monetize an MCP server |
| Explorer | `/explorer` | Transaction history and analytics |
| Connect | `/connect` | OAuth login flow |

## Setup

```bash
# From repo root
pnpm install

# Copy env
cp .env.local.example .env.local

# Run
pnpm --filter @clawpay/app dev
```

Runs on port 3002.

## Requires

- `apps/mcp` (port 3050) for auth and wallet management
- `apps/mcp-data` (port 3060) for server registry
- `apps/mcp2` (port 3006) for monetization wrapper
