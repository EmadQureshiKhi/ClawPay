# @clawpay-hedera/sdk

SDK and CLI for ClawPay — autonomous MCP micropayments for AI agents on Hedera. Enables any MCP-compatible AI agent (Claude, Cursor, ChatGPT, OpenClaw, etc.) to autonomously pay for tool calls using the x402 HTTP payment protocol with USDC on Hedera.

- 🔌 Connect to multiple MCP servers at once (stdio proxy)
- 💳 Handle 402 Payment Required automatically (x402 on Hedera)
- 📦 Programmatic APIs for both clients and servers
- 🦞 Hedera-native: HTS USDC payments, HCS audit trails, Blocky402 settlement

## Quick Start

Connect to a paid MCP server with automatic Hedera x402 payments:

```bash
npx @clawpay-hedera/sdk connect \
  --urls "https://your-server.com/mcp" \
  --hedera-key 0xYOUR_ECDSA_PRIVATE_KEY \
  --hedera-account 0.0.YOUR_ACCOUNT_ID
```

This starts an MCP stdio proxy that intercepts 402 responses, creates partially-signed HTS USDC transfers, and retries with payment — all automatically.

## Installation

```bash
npm i @clawpay-hedera/sdk
# or
pnpm i @clawpay-hedera/sdk
```

## CLI

### Commands

- `clawpay connect` — start an MCP stdio proxy with Hedera x402 payments
- `clawpay version` — show version information

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `-u, --urls <urls>` | Comma-separated list of MCP server URLs | Required |
| `-a, --api-key <key>` | API key for ClawPay proxy authentication | `API_KEY` env |
| `--hedera-key <privateKey>` | Hedera ECDSA private key (0x-prefixed) | `HEDERA_PRIVATE_KEY` env |
| `--hedera-account <accountId>` | Hedera account ID (e.g. 0.0.6514537) | `HEDERA_ACCOUNT_ID` env |
| `--hedera-network <network>` | `hedera-testnet` or `hedera` (mainnet) | `hedera-testnet` |
| `--max-atomic <value>` | Max payment in atomic units (e.g. 100000 = 0.1 USDC) | `X402_MAX_ATOMIC` env |

### Examples

```bash
# Direct Hedera key (recommended for agents)
npx @clawpay-hedera/sdk connect \
  --urls "https://your-server.com/mcp" \
  --hedera-key 0xYOUR_ECDSA_KEY \
  --hedera-account 0.0.1234567

# Multiple servers
npx @clawpay-hedera/sdk connect \
  --urls "https://server1.com/mcp,https://server2.com/mcp" \
  --hedera-key $HEDERA_PRIVATE_KEY \
  --hedera-account $HEDERA_ACCOUNT_ID

# Using API key (via ClawPay proxy)
npx @clawpay-hedera/sdk connect \
  --urls "https://clawpay-proxy.com/mcp" \
  --api-key clawpay_YOUR_API_KEY

# Custom max payment (500000 = 0.5 USDC)
npx @clawpay-hedera/sdk connect \
  --urls "https://your-server.com/mcp" \
  --hedera-key $HEDERA_PRIVATE_KEY \
  --hedera-account $HEDERA_ACCOUNT_ID \
  --max-atomic 500000
```

### Behavior

- With `--hedera-key`: the proxy uses x402 Payment transport — creates partially-signed HTS USDC transfers and settles via Blocky402 facilitator on Hedera.
- With `--api-key`: the proxy forwards the key to the ClawPay proxy service, which signs payments on your behalf using your stored encrypted Hedera key.
- Default max payment: 0.1 USDC (100000 atomic units). Override with `--max-atomic`.

## MCP Client Configuration

### Claude Desktop / Cursor / Windsurf

Add to your MCP client config (e.g. `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "hedera-tools": {
      "command": "npx",
      "args": [
        "@clawpay-hedera/sdk",
        "connect",
        "--urls",
        "https://your-server.com/mcp",
        "--hedera-key",
        "0xYOUR_ECDSA_PRIVATE_KEY",
        "--hedera-account",
        "0.0.YOUR_ACCOUNT_ID"
      ]
    }
  }
}
```

### Using API Key (Alternative)

If you've linked your wallet on the ClawPay dashboard and created an API key:

```json
{
  "mcpServers": {
    "hedera-tools": {
      "command": "npx",
      "args": [
        "@clawpay-hedera/sdk",
        "connect",
        "--urls",
        "https://your-server.com/mcp",
        "--api-key",
        "clawpay_YOUR_API_KEY"
      ]
    }
  }
}
```

## SDK Usage

### Client: x402 Payment Wrapper

Wrap any MCP client with automatic Hedera x402 payment handling:

```ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { withX402Client } from '@clawpay-hedera/sdk/client'

const client = new Client(
  { name: 'my-agent', version: '1.0.0' },
  { capabilities: {} }
)

const transport = new StreamableHTTPClientTransport(
  new URL('https://your-server.com/mcp')
)
await client.connect(transport)

// Wrap with Hedera x402 payment capabilities
const paymentClient = withX402Client(client, {
  hederaConfig: {
    privateKey: '0xYOUR_ECDSA_KEY',
    network: 'testnet',
    payerAccountId: '0.0.YOUR_ACCOUNT_ID',
    facilitatorFeePayer: '0.0.7162784', // Blocky402
  },
  maxPaymentValue: BigInt(0.1 * 10 ** 6), // 0.1 USDC max
  confirmationCallback: async () => true,  // Auto-approve payments
})

// Use tools — payments happen automatically on 402
const tools = await paymentClient.listTools()
const result = await paymentClient.callTool({
  name: 'hbar_account_balance',
  arguments: { accountId: '0.0.1234567' }
})
```

### Server: Protecting Tools with Payments

Use `createMcpPaidHandler` to add x402 paywalls to your MCP tools:

```ts
import { createMcpPaidHandler } from '@clawpay-hedera/sdk/handler'
import { z } from 'zod'

const handler = createMcpPaidHandler(
  (server) => {
    server.paidTool(
      'my_tool',
      'Description of what this tool does',
      '$0.05',  // Price in USD (charged in USDC on Hedera)
      { input: z.string().describe('Input parameter') },
      { readOnlyHint: true },
      async ({ input }) => ({
        content: [{ type: 'text', text: `Result: ${input}` }]
      })
    )
  },
  {
    name: 'My Paid Server',
    version: '1.0.0',
  },
  {
    recipient: '0xYOUR_EVM_ADDRESS',  // Where you receive USDC payments
    facilitator: {
      url: 'https://api.testnet.blocky402.com',
    },
  }
)

// Use with Hono, Express, or any framework
import { Hono } from 'hono'
const app = new Hono()
app.all('/mcp', (c) => handler(c.req.raw))
```

### Programmatic Stdio Proxy

```ts
import { startStdioServer, ServerType } from '@clawpay-hedera/sdk'

const serverConnections = [{
  url: 'https://your-server.com/mcp',
  serverType: ServerType.HTTPStream,
}]

await startStdioServer({
  serverConnections,
  x402ClientConfig: {
    hederaConfig: {
      privateKey: '0xYOUR_ECDSA_KEY',
      network: 'testnet',
      payerAccountId: '0.0.YOUR_ACCOUNT_ID',
      facilitatorFeePayer: '0.0.7162784',
    },
    maxPaymentValue: BigInt(0.1 * 10 ** 6),
    confirmationCallback: async () => true,
  },
})
```

## How Payment Works

When an agent calls a paid tool:

1. Agent sends `tools/call` request to the MCP server
2. Server returns a 402 response with payment requirements (network, asset, amount, recipient)
3. The SDK creates a partially-signed HTS USDC transfer on Hedera with Blocky402 as fee payer
4. SDK retries the request with the `X-PAYMENT` header containing the signed transaction
5. Server forwards payment to Blocky402 facilitator for verification
6. Blocky402 co-signs, submits to Hedera, and settles the USDC transfer
7. Agent receives the tool result

The entire flow is autonomous — no human intervention needed.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `HEDERA_PRIVATE_KEY` | Hedera ECDSA private key (0x-prefixed) |
| `HEDERA_ACCOUNT_ID` | Hedera account ID (e.g. 0.0.6514537) |
| `HEDERA_NETWORK` | `hedera-testnet` (default) or `hedera` |
| `API_KEY` | ClawPay API key for proxy authentication |
| `X402_MAX_ATOMIC` | Max payment in atomic units |

## Supported Network

- **Hedera Testnet** (`hedera-testnet`) — USDC token `0.0.5449`
- **Hedera Mainnet** (`hedera`) — USDC token `0.0.456858`

Settlement via [Blocky402](https://blocky402.com) facilitator (account `0.0.7162784` on testnet).

## Dependencies

- `@modelcontextprotocol/sdk` — MCP protocol implementation
- `@hashgraph/sdk` — Hedera SDK for HTS transfers
- `x402` — x402 payment protocol types
- `viem` — EVM utilities (used for Hedera EVM relay compatibility)
- `commander` — CLI framework
- `zod` — Schema validation
- `mcp-handler` — MCP server handler utilities

## Security

- Never commit private keys. Use environment variables.
- Use `maxPaymentValue` to cap per-transaction spend.
- The Blocky402 facilitator only co-signs valid, pre-authorized transfers.
- For production, consider using the ClawPay proxy with encrypted key storage instead of passing keys directly.

## Development

```bash
pnpm i
pnpm run build
pnpm run dev  # watch mode
```

## License

MIT
