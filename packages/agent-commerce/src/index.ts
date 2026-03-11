/**
 * @clawpay-hedera/agent-commerce
 * 
 * Agent identity, reputation, and discovery for the Agentic Society on Hedera.
 * 
 * - Identity: ERC-8004 inspired on-chain agent registry (ERC-721 NFTs)
 * - Reputation: On-chain ratings + HCS comment storage
 * - Discovery: UCP-inspired capability profiles and provider search
 */

export { registerAgent, updateProfile, getAgent, getAgentByAddress, totalAgents, listAgents } from "./registry.js";
export type { AgentProfile, AgentInfo } from "./registry.js";

export { submitFeedback, getReputation, getFeedbacks, getHCSComments } from "./reputation.js";
export type { ReputationFeedback, ReputationScore } from "./reputation.js";

export { addCapability, getCapabilities, findProviders, discoverAllTools } from "./discovery.js";
export type { ToolCapability, ProviderResult } from "./discovery.js";

export { config } from "./config.js";
