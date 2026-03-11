/**
 * Agent Discovery — UCP-inspired capability profiles and search.
 * 
 * Agents publish capabilities (tools they offer) on-chain.
 * Other agents can search for providers of specific tools,
 * compare prices and reputation, and choose the best provider.
 */
import { ethers } from "ethers";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { config } from "./config.js";
import { getAgent, type AgentInfo } from "./registry.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface ToolCapability {
  toolName: string;
  description: string;
  priceUsdcAtomic: number;  // atomic USDC (6 decimals)
  priceUsd: string;         // human-readable (e.g. "$0.04")
  mcpEndpoint: string;
  active: boolean;
}

export interface ProviderResult {
  agent: AgentInfo;
  capability: ToolCapability;
  score: number;  // composite score (reputation * activity)
}

function loadArtifact() {
  const path = resolve(__dirname, "../artifacts/AgentRegistry.json");
  return JSON.parse(readFileSync(path, "utf-8"));
}

function getContract() {
  const artifact = loadArtifact();
  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  return new ethers.Contract(config.registryAddress, artifact.abi, provider);
}

/**
 * Register a capability (tool) for the current agent.
 */
export async function addCapability(
  toolName: string,
  description: string,
  priceUsdcAtomic: number,
  mcpEndpoint: string
): Promise<string> {
  const artifact = loadArtifact();
  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  const wallet = new ethers.Wallet(config.operatorKey, provider);
  const contract = new ethers.Contract(config.registryAddress, artifact.abi, wallet);

  console.log(`[Discovery] Adding capability: ${toolName} ($${(priceUsdcAtomic / 1_000_000).toFixed(3)})`);
  const tx = await contract.addCapability(toolName, description, priceUsdcAtomic, mcpEndpoint, {
    gasLimit: 300_000,
  });
  await tx.wait();
  console.log(`[Discovery] Capability added: tx=${tx.hash}`);
  return tx.hash;
}

/**
 * Get all capabilities for an agent.
 */
export async function getCapabilities(tokenId: number): Promise<ToolCapability[]> {
  const contract = getContract();
  const caps = await contract.getCapabilities(tokenId);

  return caps.map((c: any) => ({
    toolName: c.toolName,
    description: c.description,
    priceUsdcAtomic: Number(c.priceUsdcAtomic),
    priceUsd: `$${(Number(c.priceUsdcAtomic) / 1_000_000).toFixed(3)}`,
    mcpEndpoint: c.mcpEndpoint,
    active: c.active,
  }));
}

/**
 * Find all agents that offer a specific tool.
 * Returns providers sorted by composite score (reputation + price).
 */
export async function findProviders(toolName: string): Promise<ProviderResult[]> {
  const contract = getContract();
  const providerIds: bigint[] = await contract.findProviders(toolName);

  const results: ProviderResult[] = [];

  for (const id of providerIds) {
    const tokenId = Number(id);
    const agent = await getAgent(tokenId);
    if (!agent) continue;

    const caps = await getCapabilities(tokenId);
    const cap = caps.find((c) => c.toolName === toolName && c.active);
    if (!cap) continue;

    // Composite score: reputation weight (0-5) + inverse price bonus
    const repScore = agent.reputation.count > 0 ? agent.reputation.avg : 2.5; // default 2.5 for unrated
    const priceBonus = Math.max(0, 1 - cap.priceUsdcAtomic / 1_000_000); // cheaper = higher bonus
    const score = repScore * 0.8 + priceBonus * 0.2;

    results.push({ agent, capability: cap, score });
  }

  // Sort by score descending (best providers first)
  results.sort((a, b) => b.score - a.score);
  return results;
}

/**
 * Discover all available tools across all agents.
 * Returns a flat list of all active capabilities with provider info.
 */
export async function discoverAllTools(): Promise<ProviderResult[]> {
  const contract = getContract();
  const total = Number(await contract.totalAgents());
  const results: ProviderResult[] = [];

  for (let i = 1; i <= total; i++) {
    const agent = await getAgent(i);
    if (!agent) continue;

    const caps = await getCapabilities(i);
    for (const cap of caps) {
      if (!cap.active) continue;

      const repScore = agent.reputation.count > 0 ? agent.reputation.avg : 2.5;
      const priceBonus = Math.max(0, 1 - cap.priceUsdcAtomic / 1_000_000);
      const score = repScore * 0.8 + priceBonus * 0.2;

      results.push({ agent, capability: cap, score });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}
