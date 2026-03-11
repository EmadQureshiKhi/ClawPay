/**
 * Multi-Agent Orchestration Demo
 * 
 * Demonstrates the full Agentic Society flow on Hedera:
 * 
 * 1. Three agents register on-chain (get ERC-721 identity NFTs)
 * 2. Analytics Agent publishes its tool capabilities
 * 3. Research Agent discovers the Analytics Agent via on-chain registry
 * 4. Research Agent pays Analytics Agent USDC for tool calls (x402)
 * 5. Research Agent passes results to Report Agent
 * 6. Both agents submit reputation feedback on-chain
 * 7. All activity is logged to HCS for immutable audit
 * 
 * This runs fully autonomously — no human intervention.
 */
import { ethers } from "ethers";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { config } from "../config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadArtifact() {
  return JSON.parse(readFileSync(resolve(__dirname, "../../artifacts/AgentRegistry.json"), "utf-8"));
}

function getContract(wallet: ethers.Wallet) {
  const artifact = loadArtifact();
  return new ethers.Contract(config.registryAddress, artifact.abi, wallet);
}

// Helper: create a deterministic wallet from a seed phrase for demo agents
function createDemoWallet(seed: string, provider: ethers.Provider): ethers.Wallet {
  const hash = ethers.keccak256(ethers.toUtf8Bytes(seed));
  return new ethers.Wallet(hash, provider);
}

/**
 * Fund a wallet using Hedera native SDK (EVM transfers to non-existent accounts fail).
 * This creates the account on Hedera if it doesn't exist (auto-account creation via ECDSA key).
 */
async function fundWallet(to: ethers.Wallet, amount: number) {
  const { Client, TransferTransaction, AccountId, PrivateKey, Hbar } = await import("@hashgraph/sdk");

  const client = config.network === "mainnet" ? Client.forMainnet() : Client.forTestnet();
  const rawKey = config.operatorKey.startsWith("0x") ? config.operatorKey.slice(2) : config.operatorKey;
  let key;
  try { key = PrivateKey.fromStringECDSA(rawKey); } catch { key = PrivateKey.fromStringDer(rawKey); }
  client.setOperator(AccountId.fromString(config.operatorId), key);

  // Use the recipient's EVM address as an alias for auto-account creation
  const evmAddress = to.address.toLowerCase();
  const recipientId = AccountId.fromEvmAddress(0, 0, evmAddress);

  const tx = await new TransferTransaction()
    .addHbarTransfer(AccountId.fromString(config.operatorId), new Hbar(-amount))
    .addHbarTransfer(recipientId, new Hbar(amount))
    .execute(client);

  await tx.getReceipt(client);
  client.close();
}

// Simulated tool call (in real flow this goes through x402)
async function simulateToolCall(toolName: string, args: any): Promise<string> {
  const base = "https://testnet.mirrornode.hedera.com";
  
  if (toolName === "hedera_account_deep_dive") {
    const res = await fetch(`${base}/api/v1/accounts/${args.accountId}`);
    if (!res.ok) return JSON.stringify({ error: "Account not found" });
    const data = await res.json() as any;
    return JSON.stringify({
      accountId: args.accountId,
      hbarBalance: `${(data.balance?.balance / 1e8).toFixed(4)} HBAR`,
      tokenCount: data.balance?.tokens?.length || 0,
    });
  }

  if (toolName === "hedera_whale_tracker") {
    const res = await fetch(`${base}/api/v1/transactions?account.id=${args.accountId}&limit=5&order=desc`);
    if (!res.ok) return JSON.stringify({ error: "Failed to fetch" });
    const data = await res.json() as any;
    return JSON.stringify({
      accountId: args.accountId,
      recentTxCount: data.transactions?.length || 0,
      transactions: (data.transactions || []).slice(0, 3).map((t: any) => ({
        id: t.transaction_id,
        type: t.name,
      })),
    });
  }

  return JSON.stringify({ error: "Unknown tool" });
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║     ClawPay Multi-Agent Orchestration Demo                  ║");
  console.log("║     Autonomous Agent Commerce on Hedera                     ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  const operatorWallet = new ethers.Wallet(config.operatorKey, provider);
  const artifact = loadArtifact();

  // ═══════════════════════════════════════════════════════════════
  // STEP 1: Create agent wallets and fund them
  // ═══════════════════════════════════════════════════════════════
  console.log("--- Step 1: Create Agent Wallets ---\n");

  const researchWallet = createDemoWallet("clawpay-research-agent-v1", provider);
  const analyticsWallet = createDemoWallet("clawpay-analytics-agent-v1", provider);
  const reportWallet = createDemoWallet("clawpay-report-agent-v1", provider);

  console.log(`Research Agent:  ${researchWallet.address}`);
  console.log(`Analytics Agent: ${analyticsWallet.address}`);
  console.log(`Report Agent:    ${reportWallet.address}`);

  // Fund demo wallets with HBAR for gas (uses Hedera native SDK for auto-account creation)
  console.log("\nFunding agent wallets with HBAR for gas...");
  for (const w of [researchWallet, analyticsWallet, reportWallet]) {
    const bal = await provider.getBalance(w.address);
    if (bal < ethers.parseEther("5")) {
      await fundWallet(w, 10);
      console.log(`  Funded ${w.address.slice(0, 10)}... with 10 HBAR`);
    } else {
      console.log(`  ${w.address.slice(0, 10)}... already has ${ethers.formatEther(bal)} HBAR`);
    }
  }

  // Wait for mirror node to catch up with new accounts
  console.log("  Waiting for accounts to propagate...");
  await new Promise((r) => setTimeout(r, 5000));

  // ═══════════════════════════════════════════════════════════════
  // STEP 2: Register agents on-chain (mint identity NFTs)
  // ═══════════════════════════════════════════════════════════════
  console.log("\n--- Step 2: Register Agents On-Chain (ERC-8004) ---\n");

  const agents = [
    {
      wallet: researchWallet,
      profile: {
        name: "Research Agent",
        description: "Autonomous research agent that discovers and uses paid Hedera analytics tools",
        owner: config.operatorId,
        evmAddress: researchWallet.address,
        capabilities: [],
        createdAt: new Date().toISOString(),
      },
    },
    {
      wallet: analyticsWallet,
      profile: {
        name: "Analytics Agent",
        description: "Provides paid Hedera analytics tools: account deep dive, whale tracking, token analytics",
        owner: config.operatorId,
        evmAddress: analyticsWallet.address,
        mcpEndpoint: "http://localhost:3000/mcp",
        capabilities: ["hedera_account_deep_dive", "hedera_whale_tracker", "hedera_token_analytics"],
        createdAt: new Date().toISOString(),
      },
    },
    {
      wallet: reportWallet,
      profile: {
        name: "Report Agent",
        description: "Takes raw analytics data and generates structured reports",
        owner: config.operatorId,
        evmAddress: reportWallet.address,
        capabilities: ["generate_report"],
        createdAt: new Date().toISOString(),
      },
    },
  ];

  const tokenIds: number[] = [];

  for (const { wallet, profile } of agents) {
    const contract = new ethers.Contract(config.registryAddress, artifact.abi, wallet);

    // Check if already registered
    const existing = await contract.agentOf(wallet.address);
    if (Number(existing) > 0) {
      console.log(`  ${profile.name} already registered (tokenId=${existing})`);
      tokenIds.push(Number(existing));
      continue;
    }

    const uri = `data:application/json;base64,${Buffer.from(JSON.stringify(profile)).toString("base64")}`;
    const tx = await contract.registerAgent(uri, { gasLimit: 1_000_000 });
    const receipt = await tx.wait();

    // Parse event for token ID
    let tokenId = 0;
    for (const log of receipt.logs) {
      try {
        const parsed = contract.interface.parseLog({ topics: log.topics as string[], data: log.data });
        if (parsed?.name === "AgentRegistered") {
          tokenId = Number(parsed.args[0]);
          break;
        }
      } catch { /* skip */ }
    }

    tokenIds.push(tokenId);
    console.log(`  ${profile.name} registered: tokenId=${tokenId}, NFT minted`);
  }

  const [researchId, analyticsId, reportId] = tokenIds;

  // ═══════════════════════════════════════════════════════════════
  // STEP 3: Analytics Agent publishes capabilities
  // ═══════════════════════════════════════════════════════════════
  console.log("\n--- Step 3: Publish Tool Capabilities (UCP-inspired) ---\n");

  const analyticsContract = new ethers.Contract(config.registryAddress, artifact.abi, analyticsWallet);

  const tools = [
    { name: "hedera_account_deep_dive", desc: "Full account analysis with balances, tx history, risk score", price: 40_000, endpoint: "http://localhost:3000/mcp" },
    { name: "hedera_whale_tracker", desc: "Track large transfers above threshold for any token or HBAR", price: 30_000, endpoint: "http://localhost:3000/mcp" },
    { name: "hedera_token_analytics", desc: "Holder concentration, top holders, supply metrics", price: 50_000, endpoint: "http://localhost:3000/mcp" },
  ];

  // Check if capabilities already exist
  const existingCaps = await analyticsContract.getCapabilities(analyticsId);
  if (existingCaps.length > 0) {
    console.log(`  Analytics Agent already has ${existingCaps.length} capabilities registered`);
  } else {
    for (const tool of tools) {
      const tx = await analyticsContract.addCapability(tool.name, tool.desc, tool.price, tool.endpoint, { gasLimit: 300_000 });
      await tx.wait();
      console.log(`  Published: ${tool.name} ($${(tool.price / 1_000_000).toFixed(3)})`);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // STEP 4: Research Agent discovers Analytics Agent
  // ═══════════════════════════════════════════════════════════════
  console.log("\n--- Step 4: Research Agent Discovers Providers ---\n");

  const readContract = new ethers.Contract(config.registryAddress, artifact.abi, provider);

  // Research Agent queries the registry for "hedera_account_deep_dive" providers
  const providerIds = await readContract.findProviders("hedera_account_deep_dive");
  console.log(`  Found ${providerIds.length} provider(s) for "hedera_account_deep_dive"`);

  for (const pid of providerIds) {
    const tokenId = Number(pid);
    const uri = await readContract.tokenURI(tokenId);
    const [avg, count] = await readContract.getReputation(tokenId);

    let profile: any = {};
    if (uri.startsWith("data:application/json;base64,")) {
      profile = JSON.parse(Buffer.from(uri.replace("data:application/json;base64,", ""), "base64").toString());
    }

    const caps = await readContract.getCapabilities(tokenId);
    const cap = caps.find((c: any) => c.toolName === "hedera_account_deep_dive");

    console.log(`  Provider: ${profile.name || "Unknown"} (tokenId=${tokenId})`);
    console.log(`    Reputation: ${Number(count) > 0 ? (Number(avg) / 100).toFixed(1) : "unrated"}/5 (${count} ratings)`);
    console.log(`    Price: $${cap ? (Number(cap.priceUsdcAtomic) / 1_000_000).toFixed(3) : "?"}`);
    console.log(`    Endpoint: ${cap?.mcpEndpoint || "?"}`);
  }

  // ═══════════════════════════════════════════════════════════════
  // STEP 5: Research Agent calls tools (simulated x402 payment)
  // ═══════════════════════════════════════════════════════════════
  console.log("\n--- Step 5: Research Agent Calls Paid Tools ---\n");

  const targetAccount = config.operatorId; // analyze our own account

  console.log(`  Calling hedera_account_deep_dive for ${targetAccount}...`);
  const deepDiveResult = await simulateToolCall("hedera_account_deep_dive", { accountId: targetAccount });
  console.log(`  Result: ${deepDiveResult}`);

  console.log(`\n  Calling hedera_whale_tracker for ${targetAccount}...`);
  const whaleResult = await simulateToolCall("hedera_whale_tracker", { accountId: targetAccount });
  console.log(`  Result: ${whaleResult}`);

  // ═══════════════════════════════════════════════════════════════
  // STEP 6: Report Agent generates summary
  // ═══════════════════════════════════════════════════════════════
  console.log("\n--- Step 6: Report Agent Generates Summary ---\n");

  const deepDive = JSON.parse(deepDiveResult);
  const whale = JSON.parse(whaleResult);

  const report = {
    title: `Hedera Account Analysis: ${targetAccount}`,
    generatedBy: "Report Agent",
    generatedAt: new Date().toISOString(),
    summary: {
      balance: deepDive.hbarBalance || "unknown",
      tokenCount: deepDive.tokenCount || 0,
      recentActivity: whale.recentTxCount || 0,
    },
    dataProviders: [
      { agent: "Analytics Agent", tokenId: analyticsId, toolsUsed: ["hedera_account_deep_dive", "hedera_whale_tracker"] },
    ],
  };

  console.log(`  Report: ${JSON.stringify(report, null, 2)}`);

  // ═══════════════════════════════════════════════════════════════
  // STEP 7: Submit reputation feedback
  // ═══════════════════════════════════════════════════════════════
  console.log("\n--- Step 7: Submit Reputation Feedback ---\n");

  const researchContract = new ethers.Contract(config.registryAddress, artifact.abi, researchWallet);
  const reportContract = new ethers.Contract(config.registryAddress, artifact.abi, reportWallet);

  // Research Agent rates Analytics Agent
  try {
    const comment = "Accurate account data, fast response. Used for research report.";
    const commentHash = ethers.keccak256(ethers.toUtf8Bytes(comment));
    const tx1 = await researchContract.submitFeedback(analyticsId, 5, commentHash, { gasLimit: 300_000 });
    await tx1.wait();
    console.log(`  Research Agent rated Analytics Agent: 5/5 stars`);
  } catch (e: any) {
    if (e.message?.includes("Already rated")) {
      console.log(`  Research Agent already rated Analytics Agent today (rate limit)`);
    } else {
      console.warn(`  Rating failed: ${e.message?.slice(0, 80)}`);
    }
  }

  // Report Agent rates Analytics Agent
  try {
    const comment = "Good data quality for report generation.";
    const commentHash = ethers.keccak256(ethers.toUtf8Bytes(comment));
    const tx2 = await reportContract.submitFeedback(analyticsId, 4, commentHash, { gasLimit: 300_000 });
    await tx2.wait();
    console.log(`  Report Agent rated Analytics Agent: 4/5 stars`);
  } catch (e: any) {
    if (e.message?.includes("Already rated")) {
      console.log(`  Report Agent already rated Analytics Agent today (rate limit)`);
    } else {
      console.warn(`  Rating failed: ${e.message?.slice(0, 80)}`);
    }
  }

  // Check updated reputation
  const [finalAvg, finalCount] = await readContract.getReputation(analyticsId);
  console.log(`\n  Analytics Agent reputation: ${(Number(finalAvg) / 100).toFixed(1)}/5 (${finalCount} ratings)`);

  // ═══════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║                    Demo Complete                            ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  const total = await readContract.totalAgents();
  console.log(`Agents registered: ${total}`);
  console.log(`Contract: https://hashscan.io/${config.network}/contract/${config.registryAddress}`);
  console.log(`Reputation topic: https://hashscan.io/${config.network}/topic/${config.reputationTopicId}`);
  console.log(`\nAll operations were autonomous — no human intervention.`);
  console.log(`Agents discovered each other on-chain, transacted, and built reputation.`);
}

main().catch((err) => {
  console.error("Demo failed:", err);
  process.exit(1);
});
