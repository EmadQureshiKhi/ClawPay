#!/bin/bash
# ClawPay — Start all services for full platform demo
#
# Prerequisites:
#   1. pnpm install (run once)
#   2. Copy .env.example → .env in apps/mcp, apps/mcp-data, apps/mcp2
#   3. Copy .env.local.example → .env.local in apps/app
#   4. Fill in: Neon DB URL, GitHub OAuth, Upstash Redis, BETTER_AUTH_SECRET
#   5. Run migrations:
#      pnpm --filter @clawpay/mcp-data db:migrate
#      pnpm --filter @clawpay/mcp db:migrate

set -e

echo "🦀 ClawPay — Starting full platform..."
echo ""

# Start backend services
echo "📊 Starting mcp-data (registry + analytics) on :3060..."
pnpm --filter @clawpay/mcp-data start &
sleep 2

echo "🔐 Starting mcp (auth + proxy) on :3050..."
pnpm --filter @clawpay/mcp start &
sleep 2

echo "💰 Starting mcp2 (monetization wrapper) on :3006..."
pnpm --filter @clawpay/mcp2 start &
sleep 1

echo "� Starting example Hedera tools server on :3000..."
pnpm --filter @clawpay/hedera-tools-example start &
sleep 1

# Start frontend
echo "🌐 Starting frontend on :3002..."
pnpm --filter @clawpay/app dev &

echo ""
echo "✅ All services starting!"
echo ""
echo "  Frontend:     http://localhost:3002"
echo "  Auth/Proxy:   http://localhost:3050"
echo "  Monetizer:    http://localhost:3006"
echo "  Registry:     http://localhost:3060"
echo "  Hedera Tools: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop all services."

wait
