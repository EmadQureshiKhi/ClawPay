import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { withX402Client } from "@clawpay-hedera/sdk/client";
import { config } from 'dotenv';
config();

const MCP_SERVER_URL = process.env.MCP_SERVER_URL || "http://localhost:3000/mcp";

export const getClient = async () => {
  const client = new Client({
    name: "vlayer-client-example",
    version: "1.0.0",
  });

  const transport = new StreamableHTTPClientTransport(new URL(MCP_SERVER_URL), {
    requestInit: {
      headers: {
        'x-vlayer-enabled': 'true',
      },
    },
  });

  await client.connect(transport);

  return withX402Client(client, {
    wallet: {},
    hederaConfig: {
      privateKey: process.env.HEDERA_PRIVATE_KEY!,
      network: (process.env.HEDERA_NETWORK as 'testnet' | 'mainnet') || 'testnet',
      payerAccountId: process.env.HEDERA_ACCOUNT_ID!,
      facilitatorFeePayer: '0.0.7162784',
    },
    maxPaymentValue: BigInt(100000),
    confirmationCallback: async () => true,
  });
};

export const runTest = async () => {
  console.log("[vlayer-client] Starting test...");
  console.log("[vlayer-client] Connecting to:", MCP_SERVER_URL);

  const client = await getClient();

  // List tools
  const tools = await client.listTools();
  console.log(`[vlayer-client] Found ${tools.tools.length} tools:`);
  for (const t of tools.tools) {
    const price = t.description?.match(/\$[\d.]+/)?.[0] || 'free';
    console.log(`  ${t.name} (${price})`);
  }

  // Call a paid tool
  console.log("\n[vlayer-client] Calling hbar_account_balance (paid tool)...");
  const res = await client.callTool({
    name: "hbar_account_balance",
    arguments: { accountId: process.env.HEDERA_ACCOUNT_ID || "0.0.6514537" },
  });

  const text = res.content?.[0]?.text || '';
  if (text.includes('hbarBalance')) {
    const parsed = JSON.parse(text);
    console.log(`[vlayer-client] ✅ Payment settled! ${parsed.accountId}: ${parsed.hbarBalance}`);
  } else {
    console.log("[vlayer-client] Response:", text.slice(0, 300));
  }

  // Check for web proof in _meta
  const meta = res._meta as Record<string, unknown> | undefined;
  if (meta?.['vlayer/proof']) {
    console.log("[vlayer-client] ✅ Web proof attached!");
    console.log("[vlayer-client] Proof valid:", !!meta['vlayer/proof']);
  } else {
    console.log("[vlayer-client] ℹ️  No web proof (VLayer credentials not configured on server)");
  }

  console.log("\n[vlayer-client] Done.");
  await client.close().catch(() => {});
  process.exit(0);
};

try {
  await runTest();
} catch (err) {
  console.error("[vlayer-client] Error:", err);
  process.exit(1);
}
