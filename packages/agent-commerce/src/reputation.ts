/**
 * Agent Reputation System — on-chain ratings + HCS comment storage.
 * 
 * Ratings (1-5 stars) are stored on-chain in the AgentRegistry contract.
 * Full comment text is stored on HCS for immutability and transparency.
 * The on-chain feedback stores a keccak256 hash of the comment for verification.
 */
import { ethers } from "ethers";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { config } from "./config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface ReputationFeedback {
  fromAgent: number;
  toAgent: number;
  rating: number;       // 1-5
  comment: string;
  timestamp: string;
}

export interface ReputationScore {
  tokenId: number;
  avgRating: number;    // e.g. 4.5
  ratingCount: number;
  feedbacks: ReputationFeedback[];
}

function loadArtifact() {
  const path = resolve(__dirname, "../artifacts/AgentRegistry.json");
  return JSON.parse(readFileSync(path, "utf-8"));
}

function getContract(signerOrProvider?: ethers.Signer | ethers.Provider) {
  const artifact = loadArtifact();
  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  const target = signerOrProvider || provider;
  return new ethers.Contract(config.registryAddress, artifact.abi, target);
}

function getWallet() {
  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  return new ethers.Wallet(config.operatorKey, provider);
}

/**
 * Submit feedback for an agent.
 * Stores rating on-chain + comment on HCS.
 */
export async function submitFeedback(
  toAgent: number,
  rating: number,
  comment: string
): Promise<{ txHash: string; hcsSequence?: number }> {
  const wallet = getWallet();
  const contract = getContract(wallet);

  // Hash the comment for on-chain storage
  const commentHash = ethers.keccak256(ethers.toUtf8Bytes(comment));

  console.log(`[Reputation] Submitting feedback: agent ${toAgent}, ${rating} stars`);
  const tx = await contract.submitFeedback(toAgent, rating, commentHash, { gasLimit: 300_000 });
  const receipt = await tx.wait();

  // Also submit the full comment to HCS for transparency
  let hcsSequence: number | undefined;
  if (config.reputationTopicId) {
    hcsSequence = await submitCommentToHCS(toAgent, rating, comment);
  }

  console.log(`[Reputation] Feedback submitted: tx=${tx.hash}`);
  return { txHash: tx.hash, hcsSequence };
}

/**
 * Get reputation score for an agent.
 */
export async function getReputation(tokenId: number): Promise<{ avg: number; count: number }> {
  const contract = getContract();
  const [avg, count] = await contract.getReputation(tokenId);
  return { avg: Number(avg) / 100, count: Number(count) };
}

/**
 * Get all feedback entries for an agent.
 */
export async function getFeedbacks(tokenId: number): Promise<ReputationFeedback[]> {
  const contract = getContract();
  const feedbackIds: bigint[] = await contract.getFeedbackIds(tokenId);

  const feedbacks: ReputationFeedback[] = [];
  for (const id of feedbackIds) {
    const fb = await contract.feedbacks(id);
    feedbacks.push({
      fromAgent: Number(fb.fromAgent),
      toAgent: Number(fb.toAgent),
      rating: Number(fb.rating),
      comment: "", // Full comment is on HCS, on-chain only has hash
      timestamp: new Date(Number(fb.timestamp) * 1000).toISOString(),
    });
  }
  return feedbacks;
}

/**
 * Submit comment text to HCS topic for immutable storage.
 */
async function submitCommentToHCS(
  toAgent: number,
  rating: number,
  comment: string
): Promise<number | undefined> {
  try {
    const {
      Client, TopicMessageSubmitTransaction, TopicId,
      AccountId, PrivateKey,
    } = await import("@hashgraph/sdk");

    const client = config.network === "mainnet"
      ? Client.forMainnet()
      : Client.forTestnet();

    let key;
    const rawKey = config.operatorKey.startsWith("0x")
      ? config.operatorKey.slice(2)
      : config.operatorKey;
    try {
      key = PrivateKey.fromStringECDSA(rawKey);
    } catch {
      key = PrivateKey.fromStringDer(rawKey);
    }

    client.setOperator(AccountId.fromString(config.operatorId), key);

    const message = JSON.stringify({
      type: "agent_feedback",
      toAgent,
      rating,
      comment,
      timestamp: new Date().toISOString(),
    });

    const txResponse = await new TopicMessageSubmitTransaction()
      .setTopicId(TopicId.fromString(config.reputationTopicId))
      .setMessage(message)
      .execute(client);

    const receipt = await txResponse.getReceipt(client);
    const seq = receipt.topicSequenceNumber?.toNumber();
    client.close();

    console.log(`[Reputation] Comment stored on HCS: topic=${config.reputationTopicId}, seq=${seq}`);
    return seq;
  } catch (err) {
    console.warn("[Reputation] HCS comment submission failed:", err);
    return undefined;
  }
}

/**
 * Read reputation comments from HCS topic via Mirror Node.
 */
export async function getHCSComments(
  topicId: string,
  limit = 25
): Promise<Array<{ sequenceNumber: number; message: any; timestamp: string }>> {
  const base = config.network === "mainnet"
    ? "https://mainnet.mirrornode.hedera.com"
    : "https://testnet.mirrornode.hedera.com";

  const res = await fetch(
    `${base}/api/v1/topics/${topicId}/messages?limit=${limit}&order=desc`
  );
  if (!res.ok) return [];

  const data = await res.json() as { messages?: Array<{ sequence_number: number; message: string; consensus_timestamp: string }> };
  return (data.messages || []).map((m) => {
    let parsed: any;
    try {
      parsed = JSON.parse(Buffer.from(m.message, "base64").toString());
    } catch {
      parsed = { raw: m.message };
    }
    return {
      sequenceNumber: m.sequence_number,
      message: parsed,
      timestamp: m.consensus_timestamp,
    };
  });
}
