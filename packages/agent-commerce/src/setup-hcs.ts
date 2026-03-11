/**
 * Create the HCS topic for reputation comments.
 * Run once after deployment.
 */
import { Client, TopicCreateTransaction, AccountId, PrivateKey } from "@hashgraph/sdk";
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { config } from "./config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  console.log("=== Create HCS Reputation Topic ===\n");

  const client = config.network === "mainnet" ? Client.forMainnet() : Client.forTestnet();

  const rawKey = config.operatorKey.startsWith("0x")
    ? config.operatorKey.slice(2)
    : config.operatorKey;

  let key;
  try {
    key = PrivateKey.fromStringECDSA(rawKey);
  } catch {
    key = PrivateKey.fromStringDer(rawKey);
  }

  client.setOperator(AccountId.fromString(config.operatorId), key);

  const tx = await new TopicCreateTransaction()
    .setTopicMemo("ClawPay Agent Reputation Feedback")
    .execute(client);

  const receipt = await tx.getReceipt(client);
  const topicId = receipt.topicId?.toString();

  console.log(`Reputation topic created: ${topicId}`);
  console.log(`HashScan: https://hashscan.io/${config.network}/topic/${topicId}`);

  // Update .env
  if (topicId) {
    const envPath = resolve(__dirname, "../.env");
    let envContent = readFileSync(envPath, "utf-8");
    envContent = envContent.replace(
      /REPUTATION_TOPIC_ID=.*/,
      `REPUTATION_TOPIC_ID=${topicId}`
    );
    writeFileSync(envPath, envContent);
    console.log(`Updated .env with REPUTATION_TOPIC_ID=${topicId}`);
  }

  client.close();
}

main().catch(console.error);
