/**
 * Deploy the AgentRegistry contract to Hedera testnet via JSON-RPC relay.
 * 
 * Usage: tsx src/deploy.ts
 * 
 * Prerequisites:
 *   1. Compile first: tsx src/compile.ts
 *   2. Set HEDERA_OPERATOR_KEY in .env (ECDSA private key, 0x-prefixed)
 */
import { ethers } from "ethers";
import { readFileSync, writeFileSync, readFileSync as rf } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { config } from "./config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

async function main() {
  console.log("=== Deploy AgentRegistry to Hedera ===\n");

  // Load compiled artifact
  const artifactPath = resolve(ROOT, "artifacts/AgentRegistry.json");
  let artifact: { abi: any[]; bytecode: string };
  try {
    artifact = JSON.parse(readFileSync(artifactPath, "utf-8"));
  } catch {
    console.error("Artifact not found. Run compile first: tsx src/compile.ts");
    process.exit(1);
  }

  if (!config.operatorKey) {
    console.error("HEDERA_OPERATOR_KEY not set in .env");
    process.exit(1);
  }

  // Connect to Hedera JSON-RPC relay
  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  const wallet = new ethers.Wallet(config.operatorKey, provider);

  console.log(`Network: ${config.network}`);
  console.log(`Deployer: ${wallet.address}`);
  console.log(`RPC: ${config.rpcUrl}`);

  // Check balance
  const balance = await provider.getBalance(wallet.address);
  console.log(`Balance: ${ethers.formatEther(balance)} HBAR\n`);

  if (balance === 0n) {
    console.error("No HBAR balance. Fund the account first.");
    process.exit(1);
  }

  // Deploy
  console.log("Deploying AgentRegistry...");
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  
  const contract = await factory.deploy({
    gasLimit: 5_000_000,
  });

  console.log(`Transaction sent: ${contract.deploymentTransaction()?.hash}`);
  console.log("Waiting for confirmation...");

  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log(`\nDeployed at: ${address}`);
  console.log(`HashScan: https://hashscan.io/${config.network}/contract/${address}`);

  // Update .env with the contract address
  const envPath = resolve(ROOT, ".env");
  let envContent = readFileSync(envPath, "utf-8");
  envContent = envContent.replace(
    /AGENT_REGISTRY_ADDRESS=.*/,
    `AGENT_REGISTRY_ADDRESS=${address}`
  );
  writeFileSync(envPath, envContent);
  console.log(`\nUpdated .env with AGENT_REGISTRY_ADDRESS=${address}`);

  // Verify by reading contract state
  const registry = new ethers.Contract(address, artifact.abi, wallet);
  const totalAgents = await registry.totalAgents();
  const contractName = await registry.name();
  console.log(`\nVerification:`);
  console.log(`  Name: ${contractName}`);
  console.log(`  Total agents: ${totalAgents}`);
  console.log(`\nDone.`);
}

main().catch((err) => {
  console.error("Deploy failed:", err);
  process.exit(1);
});
