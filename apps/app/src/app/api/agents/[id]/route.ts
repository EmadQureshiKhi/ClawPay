/**
 * API route: GET /api/agents/:id
 * Fetches a single agent by token ID, including full feedback history + HCS comments.
 */
import { NextResponse } from "next/server";
import { createPublicClient, http, parseAbi } from "viem";
import { hederaTestnet } from "viem/chains";

const REGISTRY_ADDRESS = "0x411278256411dA9018e3c880Df21e54271F2502b" as const;
const REPUTATION_TOPIC = "0.0.8107518";

const abi = parseAbi([
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function getReputation(uint256 tokenId) view returns (uint256 avg, uint256 count)",
  "function getCapabilities(uint256 tokenId) view returns ((string toolName, string description, uint256 priceUsdcAtomic, string mcpEndpoint, bool active)[])",
  "function getFeedbackIds(uint256 tokenId) view returns (uint256[])",
  "function feedbacks(uint256 id) view returns (uint256 fromAgent, uint256 toAgent, uint8 rating, bytes32 commentHash, uint64 timestamp)",
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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tokenId = parseInt(id, 10);
    if (isNaN(tokenId) || tokenId < 1) {
      return NextResponse.json({ error: "Invalid agent ID" }, { status: 400 });
    }

    const [owner, uri, reputation] = await Promise.all([
      client.readContract({ address: REGISTRY_ADDRESS, abi, functionName: "ownerOf", args: [BigInt(tokenId)] }),
      client.readContract({ address: REGISTRY_ADDRESS, abi, functionName: "tokenURI", args: [BigInt(tokenId)] }),
      client.readContract({ address: REGISTRY_ADDRESS, abi, functionName: "getReputation", args: [BigInt(tokenId)] }),
    ]);

    const profile = parseProfile(uri as string);
    const caps = await client.readContract({
      address: REGISTRY_ADDRESS, abi, functionName: "getCapabilities", args: [BigInt(tokenId)],
    });
    const feedbackIds = await client.readContract({
      address: REGISTRY_ADDRESS, abi, functionName: "getFeedbackIds", args: [BigInt(tokenId)],
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

    const feedbacks = [];
    for (const fbId of (feedbackIds as bigint[])) {
      try {
        const fb = await client.readContract({
          address: REGISTRY_ADDRESS, abi, functionName: "feedbacks", args: [fbId],
        });
        const result = fb as [bigint, bigint, number, string, bigint];
        feedbacks.push({
          fromAgent: Number(result[0]),
          toAgent: Number(result[1]),
          rating: Number(result[2]),
          commentHash: result[3],
          timestamp: new Date(Number(result[4]) * 1000).toISOString(),
        });
      } catch { /* skip */ }
    }

    // Fetch HCS comments
    let hcsComments: any[] = [];
    try {
      const res = await fetch(
        `https://testnet.mirrornode.hedera.com/api/v1/topics/${REPUTATION_TOPIC}/messages?limit=50&order=desc`,
        { next: { revalidate: 30 } }
      );
      if (res.ok) {
        const data = await res.json() as any;
        hcsComments = (data.messages || [])
          .map((m: any) => {
            try {
              const parsed = JSON.parse(Buffer.from(m.message, "base64").toString());
              if (parsed.toAgent === tokenId) {
                return { ...parsed, sequenceNumber: m.sequence_number, consensusTimestamp: m.consensus_timestamp };
              }
            } catch { /* skip */ }
            return null;
          })
          .filter(Boolean);
      }
    } catch { /* skip */ }

    return NextResponse.json({
      tokenId, owner, profile,
      reputation: { avg: Number(reputation[0]) / 100, count: Number(reputation[1]) },
      capabilities, feedbacks, hcsComments,
      hashscanContract: `https://hashscan.io/testnet/contract/${REGISTRY_ADDRESS}`,
      hashscanReputation: `https://hashscan.io/testnet/topic/${REPUTATION_TOPIC}`,
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
