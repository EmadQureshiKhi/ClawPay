/**
 * API route: GET /api/agents/activity
 * 
 * Unified activity feed from:
 * 1. On-chain feedback (contract) — reputation ratings between agents
 * 2. HCS payment audit topic — payment settlements
 * 3. HCS reputation topic — reputation comments (if any)
 */
import { NextResponse } from "next/server";
import { createPublicClient, http, parseAbi } from "viem";
import { hederaTestnet } from "viem/chains";

const REGISTRY_ADDRESS = "0x411278256411dA9018e3c880Df21e54271F2502b" as const;
const REPUTATION_TOPIC = "0.0.8107518";
const PAYMENT_TOPIC = "0.0.8058213";
const MIRROR = "https://testnet.mirrornode.hedera.com";

const abi = parseAbi([
  "function totalAgents() view returns (uint256)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function feedbackCount() view returns (uint256)",
  "function feedbacks(uint256 id) view returns (uint256 fromAgent, uint256 toAgent, uint8 rating, bytes32 commentHash, uint64 timestamp)",
]);

const client = createPublicClient({
  chain: hederaTestnet,
  transport: http("https://testnet.hashio.io/api"),
});

function parseProfile(uri: string) {
  try {
    if (uri.startsWith("data:application/json;base64,")) {
      return JSON.parse(Buffer.from(uri.replace("data:application/json;base64,", ""), "base64").toString());
    }
  } catch {}
  return null;
}

async function fetchHcsMessages(topicId: string, limit = 25) {
  try {
    const res = await fetch(`${MIRROR}/api/v1/topics/${topicId}/messages?limit=${limit}&order=desc`, {
      next: { revalidate: 10 },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as any;
    return (data.messages || []).map((m: any) => {
      try {
        const parsed = JSON.parse(Buffer.from(m.message, "base64").toString());
        return {
          ...parsed,
          topicId,
          sequenceNumber: m.sequence_number,
          consensusTimestamp: m.consensus_timestamp,
          type: topicId === REPUTATION_TOPIC ? "reputation" : "payment",
        };
      } catch { return null; }
    }).filter(Boolean);
  } catch { return []; }
}

export async function GET() {
  // Fetch on-chain feedback from contract
  const onChainFeedback: any[] = [];
  try {
    const count = Number(await client.readContract({ address: REGISTRY_ADDRESS, abi, functionName: "feedbackCount" }));

    // Build agent name cache
    const totalAgents = Number(await client.readContract({ address: REGISTRY_ADDRESS, abi, functionName: "totalAgents" }));
    const nameCache: Record<number, string> = {};
    for (let i = 1; i <= totalAgents; i++) {
      try {
        const uri = await client.readContract({ address: REGISTRY_ADDRESS, abi, functionName: "tokenURI", args: [BigInt(i)] });
        const profile = parseProfile(uri as string);
        if (profile?.name) nameCache[i] = profile.name;
      } catch {}
    }

    for (let i = 0; i < count; i++) {
      try {
        const fb = await client.readContract({ address: REGISTRY_ADDRESS, abi, functionName: "feedbacks", args: [BigInt(i)] });
        const result = fb as [bigint, bigint, number, string, bigint];
        const fromId = Number(result[0]);
        const toId = Number(result[1]);
        onChainFeedback.push({
          type: "reputation",
          fromAgent: fromId,
          toAgent: toId,
          fromName: nameCache[fromId] || `Agent #${fromId}`,
          toName: nameCache[toId] || `Agent #${toId}`,
          rating: Number(result[2]),
          timestamp: Number(result[4]),
          consensusTimestamp: String(Number(result[4])),
          sequenceNumber: i,
          source: "contract",
        });
      } catch {}
    }
  } catch {}

  // Fetch HCS messages
  const [repMessages, payMessages] = await Promise.all([
    fetchHcsMessages(REPUTATION_TOPIC, 20),
    fetchHcsMessages(PAYMENT_TOPIC, 20),
  ]);

  // Merge all and sort by timestamp descending
  const all = [...onChainFeedback, ...repMessages, ...payMessages].sort((a, b) => {
    const ta = parseFloat(a.consensusTimestamp || "0");
    const tb = parseFloat(b.consensusTimestamp || "0");
    return tb - ta;
  });

  return NextResponse.json({
    activity: all.slice(0, 40),
    reputationTopic: REPUTATION_TOPIC,
    paymentTopic: PAYMENT_TOPIC,
  });
}
