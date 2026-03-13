# ClawPay Registry & Analytics (mcp-data)

Server registry and analytics service. Powers the `/servers` marketplace page and auto-indexes MCP servers when they're registered.

## What It Does

- Stores registered MCP servers in Postgres (Neon)
- Auto-indexes servers: connects via MCP, discovers tools, pricing, capabilities
- Categorizes servers by domain (blockchain, AI/ML, data, etc.)
- Tracks tool call events and computes quality scores
- Moderation system (pending/approved/rejected/flagged)

## Setup

```bash
# From repo root
pnpm install

# Copy env and configure:
#   - Neon DB (DATABASE_URL)
#   - INGESTION_SECRET
#   - MODERATION_SECRET (optional, for admin endpoints)
cp .env.example .env

# Run migrations
pnpm --filter @clawpay/mcp-data db:migrate

# Run
pnpm --filter @clawpay/mcp-data dev    # dev with watch
pnpm --filter @clawpay/mcp-data start  # production
```

Runs on port 3060.

## Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/servers` | GET | List servers (filter: `include=approved\|all`, sort: `score\|recent`) |
| `/server/:id` | GET | Get server details |
| `/index/run` | POST | Trigger auto-indexer for a server |
| `/ingest/event` | POST | Ingest tool call event |
| `/events/summary` | GET | Event summary by origin |
| `/servers/:id/moderate` | POST | Moderate server (requires `MODERATION_SECRET`) |
| `/score/recompute` | POST | Recompute quality scores (requires `MODERATION_SECRET`) |
