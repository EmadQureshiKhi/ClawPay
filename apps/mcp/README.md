# ClawPay Auth & Proxy (mcp)

Backend service handling authentication, wallet management, API keys, and the MCP proxy that routes requests to target servers with automatic x402 payment signing.

## What It Does

- GitHub/Google OAuth login via BetterAuth
- Hedera wallet linking (encrypted key storage via AES-256-GCM)
- API key creation and verification
- MCP proxy — routes agent requests to target servers, signs x402 payments using stored wallet keys
- vlayer web proof generation (hook-based, optional)
- Security hook — strips sensitive headers before forwarding

## Setup

```bash
# From repo root
pnpm install

# Copy env and configure:
#   - Neon DB (DATABASE_URL)
#   - GitHub/Google OAuth credentials
#   - BETTER_AUTH_SECRET
cp .env.example .env

# Run migrations
pnpm --filter @clawpay/mcp db:migrate

# Run
pnpm --filter @clawpay/mcp dev    # dev with watch
pnpm --filter @clawpay/mcp start  # production
```

Runs on port 3050.

## Key Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /api/wallets/hedera` | Link Hedera wallet + store encrypted key |
| `GET /api/wallets/hedera/balance` | Query Mirror Node for HBAR/USDC balance |
| `POST /api/keys` | Create API key |
| `ALL /mcp` | MCP proxy — forwards to target server with payment signing |
