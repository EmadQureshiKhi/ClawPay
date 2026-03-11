/**
 * Register additional agents to make the registry look like a real ecosystem.
 * Run: npx tsx src/demo/register-more-agents.ts
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

function createWallet(seed: string, provider: ethers.Provider): ethers.Wallet {
  const hash = ethers.keccak256(ethers.toUtf8Bytes(seed));
  return new ethers.Wallet(hash, provider);
}

async function fundWallet(to: ethers.Wallet, amount: number) {
  const { Client, TransferTransaction, AccountId, PrivateKey, Hbar } = await import("@hashgraph/sdk");
  const client = Client.forTestnet();
  const rawKey = config.operatorKey.startsWith("0x") ? config.operatorKey.slice(2) : config.operatorKey;
  let key;
  try { key = PrivateKey.fromStringECDSA(rawKey); } catch { key = PrivateKey.fromStringDer(rawKey); }
  client.setOperator(AccountId.fromString(config.operatorId), key);

  const evmAddress = to.address.toLowerCase();
  const recipientId = AccountId.fromEvmAddress(0, 0, evmAddress);

  const tx = await new TransferTransaction()
    .addHbarTransfer(AccountId.fromString(config.operatorId), new Hbar(-amount))
    .addHbarTransfer(recipientId, new Hbar(amount))
    .execute(client);
  await tx.getReceipt(client);
  client.close();
}

const NEW_AGENTS = [
  {
    seed: "clawpay-data-curator-v1",
    profile: {
      name: "Data Curator Agent",
      description: "Curates and validates on-chain data feeds. Provides cleaned, structured Hedera network data for other agents.",
      capabilities: ["hedera_data_feed", "data_validation"],
    },
    tools: [
      { name: "hedera_data_feed", desc: "Real-time curated Hedera network data feed with anomaly detection", price: 25_000, endpoint: "http://localhost:3000/mcp" },
      { name: "data_validation", desc: "Validate and cross-reference on-chain data against multiple sources", price: 15_000, endpoint: "http://localhost:3000/mcp" },
    ],
  },
  {
    seed: "clawpay-security-auditor-v1",
    profile: {
      name: "Security Auditor Agent",
      description: "Autonomous security scanner for Hedera smart contracts and token configurations. Detects common vulnerabilities.",
      capabilities: ["contract_audit", "token_security_check"],
    },
    tools: [
      { name: "contract_audit", desc: "Automated security audit of Hedera EVM smart contracts", price: 100_000, endpoint: "http://localhost:3000/mcp" },
      { name: "token_security_check", desc: "Check HTS token configuration for security risks (admin keys, freeze, wipe)", price: 35_000, endpoint: "http://localhost:3000/mcp" },
    ],
  },
  {
    seed: "clawpay-price-oracle-v1",
    profile: {
      name: "Price Oracle Agent",
      description: "Aggregates token prices from SaucerSwap, Pangolin, and other Hedera DEXes. Provides real-time pricing data.",
      capabilities: ["token_price", "price_history", "liquidity_check"],
    },
    tools: [
      { name: "token_price", desc: "Current token price aggregated from Hedera DEXes", price: 10_000, endpoint: "http://localhost:3000/mcp" },
      { name: "price_history", desc: "Historical price data with OHLCV candles", price: 20_000, endpoint: "http://localhost:3000/mcp" },
      { name: "liquidity_check", desc: "Check liquidity depth across Hedera DEX pools", price: 15_000, endpoint: "http://localhost:3000/mcp" },
    ],
  },
  {
    seed: "clawpay-nft-appraiser-v1",
    profile: {
      name: "NFT Appraiser Agent",
      description: "Evaluates NFT collections on Hedera. Provides rarity scores, floor price estimates, and collection health metrics.",
      capabilities: ["nft_appraisal", "collection_health"],
    },
    tools: [
      { name: "nft_appraisal", desc: "NFT rarity and value estimation based on trait analysis and market data", price: 40_000, endpoint: "http://localhost:3000/mcp" },
      { name: "collection_health", desc: "Collection-level metrics: unique holders, listing ratio, volume trends", price: 30_000, endpoint: "http://localhost:3000/mcp" },
    ],
  },
  {
    seed: "clawpay-governance-agent-v1",
    profile: {
      name: "Governance Monitor Agent",
      description: "Tracks DAO proposals, voting activity, and governance token distributions across Hedera protocols.",
      capabilities: ["governance_tracker"],
    },
    tools: [
      { name: "governance_tracker", desc: "Monitor DAO proposals, votes, and governance activity on Hedera", price: 20_000, endpoint: "http://localhost:3000/mcp" },
    ],
  },
  {
    seed: "clawpay-compliance-agent-v1",
    profile: {
      name: "Compliance Agent",
      description: "Checks wallet addresses against known risk databases. Provides compliance scoring for agent-to-agent transactions.",
      capabilities: ["address_screening", "compliance_report"],
    },
    tools: [
      { name: "address_screening", desc: "Screen wallet addresses against risk databases and sanctions lists", price: 50_000, endpoint: "http://localhost:3000/mcp" },
      { name: "compliance_report", desc: "Generate compliance report for a set of transactions", price: 75_000, endpoint: "http://localhost:3000/mcp" },
    ],
  },
  {
    seed: "clawpay-notification-agent-v1",
    profile: {
      name: "Alert Agent",
      description: "Monitors Hedera accounts and tokens for configurable events. Sends alerts when thresholds are crossed.",
      capabilities: ["set_alert", "check_alerts"],
    },
    tools: [
      { name: "set_alert", desc: "Configure alerts for account balance changes, large transfers, or token events", price: 5_000, endpoint: "http://localhost:3000/mcp" },
      { name: "check_alerts", desc: "Check triggered alerts for monitored accounts", price: 3_000, endpoint: "http://localhost:3000/mcp" },
    ],
  },
];

async function main() {
  console.log("Registering additional agents on Hedera testnet EVM...\n");

  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  const artifact = loadArtifact();

  for (const agentDef of NEW_AGENTS) {
    const wallet = createWallet(agentDef.seed, provider);
    const contract = new ethers.Contract(config.registryAddress, artifact.abi, wallet);

    // Check if already registered
    try {
      const existing = await contract.agentOf(wallet.address);
      if (Number(existing) > 0) {
        console.log(`[skip] ${agentDef.profile.name} already registered (tokenId=${existing})`);
        continue;
      }
    } catch {}

    // Fund wallet
    console.log(`Funding ${agentDef.profile.name} (${wallet.address.slice(0, 10)}...)...`);
    const bal = await provider.getBalance(wallet.address);
    if (bal < ethers.parseEther("3")) {
      await fundWallet(wallet, 8);
      console.log("  Funded with 8 HBAR");
      await new Promise(r => setTimeout(r, 4000)); // wait for account creation
    }

    // Register
    const profile = {
      ...agentDef.profile,
      owner: config.operatorId,
      evmAddress: wallet.address,
      mcpEndpoint: "http://localhost:3000/mcp",
      createdAt: new Date().toISOString(),
    };
    const uri = `data:application/json;base64,${Buffer.from(JSON.stringify(profile)).toString("base64")}`;

    console.log(`Registering ${agentDef.profile.name}...`);
    const tx = await contract.registerAgent(uri, { gasLimit: 1_000_000 });
    const receipt = await tx.wait();

    let tokenId = 0;
    for (const log of receipt.logs) {
      try {
        const parsed = contract.interface.parseLog({ topics: log.topics as string[], data: log.data });
        if (parsed?.name === "AgentRegistered") { tokenId = Number(parsed.args[0]); break; }
      } catch {}
    }
    console.log(`  Registered: tokenId=${tokenId}\n`);

    // Add capabilities
    for (const tool of agentDef.tools) {
      try {
        const capTx = await contract.addCapability(tool.name, tool.desc, tool.price, tool.endpoint, { gasLimit: 300_000 });
        await capTx.wait();
        console.log(`  Published: ${tool.name} ($${(tool.price / 1e6).toFixed(3)})`);
      } catch (e: any) {
        console.log(`  Cap failed: ${e.message?.slice(0, 60)}`);
      }
    }

    console.log("");
  }

  // Submit some cross-agent ratings to build reputation data
  console.log("\nSubmitting cross-agent reputation ratings...\n");

  const ratingPairs = [
    { fromSeed: "clawpay-data-curator-v1", toSeed: "clawpay-security-auditor-v1", rating: 5, comment: "Thorough contract audit, found real issues" },
    { fromSeed: "clawpay-price-oracle-v1", toSeed: "clawpay-data-curator-v1", rating: 4, comment: "Good data quality, minor latency" },
    { fromSeed: "clawpay-nft-appraiser-v1", toSeed: "clawpay-price-oracle-v1", rating: 5, comment: "Accurate pricing data for NFT valuations" },
    { fromSeed: "clawpay-compliance-agent-v1", toSeed: "clawpay-security-auditor-v1", rating: 4, comment: "Useful for pre-transaction compliance checks" },
    { fromSeed: "clawpay-notification-agent-v1", toSeed: "clawpay-data-curator-v1", rating: 5, comment: "Reliable data feeds for alert triggers" },
    { fromSeed: "clawpay-research-agent-v1", toSeed: "clawpay-price-oracle-v1", rating: 4, comment: "Good price data for research reports" },
    { fromSeed: "clawpay-governance-agent-v1", toSeed: "clawpay-compliance-agent-v1", rating: 5, comment: "Essential for DAO compliance monitoring" },
  ];

  for (const pair of ratingPairs) {
    const fromWallet = createWallet(pair.fromSeed, provider);
    const toWallet = createWallet(pair.toSeed, provider);
    const contract = new ethers.Contract(config.registryAddress, artifact.abi, fromWallet);

    try {
      const toId = await contract.agentOf(toWallet.address);
      if (Number(toId) === 0) { console.log(`  [skip] Target not registered`); continue; }

      const commentHash = ethers.keccak256(ethers.toUtf8Bytes(pair.comment));
      const tx = await contract.submitFeedback(toId, pair.rating, commentHash, { gasLimit: 300_000 });
      await tx.wait();
      console.log(`  ${pair.fromSeed.split("-")[1]} rated ${pair.toSeed.split("-")[1]}: ${pair.rating}/5`);
    } catch (e: any) {
      if (e.message?.includes("Already rated")) {
        console.log(`  [skip] Already rated today`);
      } else {
        console.log(`  Rating failed: ${e.message?.slice(0, 60)}`);
      }
    }
  }

  console.log("\nDone. Run `pnpm --filter @clawpay/app dev:no-turbo` and visit /agents to see all agents.");
}

main().catch(console.error);
