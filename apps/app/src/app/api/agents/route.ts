/**
 * API route: GET /api/agents
 * Fetches all registered agents from the AgentRegistry contract on Hedera testnet.
 */
import { NextResponse } from "next/server";
import { createPublicClient, http, parseAbi } from "viem";
import { hederaTestnet } from "viem/chains";

const REGISTRY_ADDRESS = "0x411278256411dA9018e3c880Df21e54271F2502b" as const;

const abi = parseAbi([
  "function totalAgents() view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function getReputation(uint256 tokenId) view returns (uint256 avg, uint256 count)",
  "function getCapabilities(uint256 tokenId) view returns ((string toolName, string description, uint256 priceUsdcAtomic, string mcpEndpoint, bool active)[])",
]);

const client = createPublicClient({
  chain: hederaTestnet,
  transport: http("https://testnet.hashio.io/api"),
});

function parseProfile(uri: string) {
  try {
    if (uri.startsWith("data:application/json;base64,")) {
      const json = Buffer.from(uri.replace("data:application/json;base64,", ""), "base64").toString();
      return JSON.parse(json);
    }
  } catch { /* ignore */ }
  return null;
}

export async function GET() {
  try {
    const total = await client.readContract({
      address: REGISTRY_ADDRESS, abi, functionName: "totalAgents",
    });
    const agents = [];

    for (let i = 1; i <= Number(total); i++) {
      try {
        const [owner, uri, reputation] = await Promise.all([
          client.readContract({ address: REGISTRY_ADDRESS, abi, functionName: "ownerOf", args: [BigInt(i)] }),
          client.readContract({ address: REGISTRY_ADDRESS, abi, functionName: "tokenURI", args: [BigInt(i)] }),
          client.readContract({ address: REGISTRY_ADDRESS, abi, functionName: "getReputation", args: [BigInt(i)] }),
        ]);

        const profile = parseProfile(uri as string);
        const caps = await client.readContract({
          address: REGISTRY_ADDRESS, abi, functionName: "getCapabilities", args: [BigInt(i)],
        });

        const capabilities = (caps as any[])
          .filter((c: any) => c.active)
          .map((c: any) => ({
            toolName: c.toolName,
            description: c.description,
            priceUsdcAtomic: Number(c.priceUsdcAtomic),
            priceUsd: `${(Number(c.priceUsdcAtomic) / 1_000_000).toFixed(3)}`,
            mcpEndpoint: c.mcpEndpoint,
          }));

        agents.push({
          tokenId: i,
          owner,
          profile,
          reputation: { avg: Number(reputation[0]) / 100, count: Number(reputation[1]) },
          capabilities,
        });
      } catch { /* skip */ }
    }

    return NextResponse.json({ agents, total: Number(total) });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message, agents: [], total: 0 }, { status: 500 });
  }
}
