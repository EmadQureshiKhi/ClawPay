import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env") });

export const config = {
  operatorId: process.env.HEDERA_OPERATOR_ID || "0.0.6514537",
  operatorKey: process.env.HEDERA_OPERATOR_KEY || "",
  network: (process.env.HEDERA_NETWORK || "testnet") as "testnet" | "mainnet",
  registryAddress: process.env.AGENT_REGISTRY_ADDRESS || "",
  reputationTopicId: process.env.REPUTATION_TOPIC_ID || "",
  rpcUrl: process.env.HEDERA_RPC_URL || "https://testnet.hashio.io/api",
};
