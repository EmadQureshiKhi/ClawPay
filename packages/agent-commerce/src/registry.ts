/**
 * Agent Identity Registry — TypeScript client for the on-chain AgentRegistry contract.
 * 
 * Handles agent registration (NFT minting), profile updates, and lookups.
 */
import { ethers } from "ethers";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { config } from "./config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Agent profile metadata (stored as JSON at the tokenURI)
export interface AgentProfile {
  name: string;
  description: string;
  owner: string;           // Hedera account ID (0.0.xxxxx)
  evmAddress: string;      // EVM address
  mcpEndpoint?: string;    // MCP server URL
  hcsAuditTopic?: string;  // HCS topic for payment audit trail
  capabilities: string[];  // Tool names this agent offers
  createdAt: string;
}

// On-chain agent data
export interface AgentInfo {
  tokenId: number;
  owner: string;
  uri: string;
  profile?: AgentProfile;
  reputation: { avg: number; count: number };
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
 * Register a new agent on-chain. Mints an ERC-721 NFT.
 * Returns the token ID.
 */
export async function registerAgent(profile: AgentProfile): Promise<number> {
  const wallet = getWallet();
  const contract = getContract(wallet);

  // For now, store profile as a data URI (could use IPFS in production)
  const uri = `data:application/json;base64,${Buffer.from(JSON.stringify(profile)).toString("base64")}`;

  console.log(`[Registry] Registering agent "${profile.name}"...`);
  const tx = await contract.registerAgent(uri, { gasLimit: 500_000 });
  const receipt = await tx.wait();

  // Parse AgentRegistered event to get token ID
  const event = receipt.logs.find((log: any) => {
    try {
      const parsed = contract.interface.parseLog({ topics: log.topics as string[], data: log.data });
      return parsed?.name === "AgentRegistered";
    } catch { return false; }
  });

  let tokenId = 0;
  if (event) {
    const parsed = contract.interface.parseLog({ topics: event.topics as string[], data: event.data });
    tokenId = Number(parsed?.args[0] || 0);
  }

  console.log(`[Registry] Agent registered: tokenId=${tokenId}, tx=${tx.hash}`);
  return tokenId;
}

/**
 * Update an agent's profile URI.
 */
export async function updateProfile(profile: AgentProfile): Promise<void> {
  const wallet = getWallet();
  const contract = getContract(wallet);

  const uri = `data:application/json;base64,${Buffer.from(JSON.stringify(profile)).toString("base64")}`;
  const tx = await contract.updateProfile(uri, { gasLimit: 200_000 });
  await tx.wait();
  console.log(`[Registry] Profile updated: tx=${tx.hash}`);
}

/**
 * Get agent info by token ID.
 */
export async function getAgent(tokenId: number): Promise<AgentInfo | null> {
  const contract = getContract();

  try {
    const owner = await contract.ownerOf(tokenId);
    const uri = await contract.tokenURI(tokenId);
    const [avg, count] = await contract.getReputation(tokenId);

    let profile: AgentProfile | undefined;
    try {
      if (uri.startsWith("data:application/json;base64,")) {
        const json = Buffer.from(uri.replace("data:application/json;base64,", ""), "base64").toString();
        profile = JSON.parse(json);
      }
    } catch { /* ignore parse errors */ }

    return {
      tokenId,
      owner,
      uri,
      profile,
      reputation: { avg: Number(avg) / 100, count: Number(count) },
    };
  } catch {
    return null;
  }
}

/**
 * Get agent info by EVM address.
 */
export async function getAgentByAddress(address: string): Promise<AgentInfo | null> {
  const contract = getContract();
  try {
    const tokenId = Number(await contract.agentOf(address));
    if (tokenId === 0) return null;
    return getAgent(tokenId);
  } catch {
    return null;
  }
}

/**
 * Get total number of registered agents.
 */
export async function totalAgents(): Promise<number> {
  const contract = getContract();
  return Number(await contract.totalAgents());
}

/**
 * List all agents (iterates from 1 to totalAgents).
 */
export async function listAgents(): Promise<AgentInfo[]> {
  const total = await totalAgents();
  const agents: AgentInfo[] = [];
  for (let i = 1; i <= total; i++) {
    const agent = await getAgent(i);
    if (agent) agents.push(agent);
  }
  return agents;
}
