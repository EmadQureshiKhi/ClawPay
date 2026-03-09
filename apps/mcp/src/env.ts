import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  // Node.js environment
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // Server
  PORT: z.string().default("3050").transform((val) => parseInt(val, 10)),

  // Better Auth
  BETTER_AUTH_SECRET: z.string().min(1, "BETTER_AUTH_SECRET is required").default(""),
  BETTER_AUTH_URL: z.string().url("BETTER_AUTH_URL must be a valid URL").optional(),

  // CORS / Origins
  TRUSTED_ORIGINS: z.string().optional(),

  // GitHub OAuth
  GITHUB_CLIENT_ID: z.string().min(1, "GITHUB_CLIENT_ID is required").default(""),
  GITHUB_CLIENT_SECRET: z.string().min(1, "GITHUB_CLIENT_SECRET is required").default(""),

  // Google OAuth (optional — not used for Hedera demo)
  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(""),

  // VLayer Configuration (optional — not used for Hedera demo)
  VLAYER_WEB_PROOF_API: z.string().url().optional().default("https://web-prover.vlayer.xyz/api/v0/prove"),
  VLAYER_CLIENT_ID: z.string().optional().default(""),
  VLAYER_BEARER_TOKEN: z.string().optional().default(""),

  // Payment strategy configuration
  PAYMENT_STRATEGY_ENABLED: z.boolean().default(true),
  PAYMENT_STRATEGY_FALLBACK: z.enum(["fail", "continue", "log_only"]).default("continue"),
  PAYMENT_STRATEGY_MAX_RETRIES: z.number().min(1).max(10).default(3),
  PAYMENT_STRATEGY_TIMEOUT_MS: z.number().min(1000).max(120000).default(30000),
  PAYMENT_STRATEGY_LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  PAYMENT_STRATEGY_LOG_AUTH_DETAILS: z.boolean().default(false),

  // Test strategy optional overrides (per-network)
  TEST_EVM_PRIVATE_KEY: z.string().optional(),
  TEST_EVM_ADDRESS: z.string().optional(),
  TEST_SOLANA_SECRET_KEY: z.string().optional(),
  TEST_SOLANA_ADDRESS: z.string().optional(),
  TEST_NEAR_PRIVATE_KEY: z.string().optional(),
  TEST_NEAR_ADDRESS: z.string().optional(),

  // Database (postgres)
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // MCP Data URL
  MCP_DATA_URL: z.url("MCP_DATA_URL must be a valid URL"),
  MCP_DATA_SECRET: z.string().min(1, "MCP_DATA_SECRET is required"),
});

function parseEnv() {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if ((error as any)?.issues) {
      const issues = (error as any).issues as Array<any>;
      const missingVars = issues
        .filter((err) => err.code === "invalid_type")
        .map((err) => err.path.join("."));
      const invalidVars = issues
        .filter((err) => err.code !== "invalid_type")
        .map((err) => `${err.path.join(".")}: ${err.message}`);

      console.error("❌ Auth environment validation failed:");
      if (missingVars.length > 0) {
        console.error("Missing required variables:", missingVars.join(", "));
      }
      if (invalidVars.length > 0) {
        console.error("Invalid variables:", invalidVars.join(", "));
      }
      process.exit(1);
    }
    throw error;
  }
}

export const env = parseEnv();
export type Env = typeof env;

export const isDevelopment = () => env.NODE_ENV === "development";
export const isProduction = () => env.NODE_ENV === "production";
export const isTest = () => env.NODE_ENV === "test";

export const getPort = () => env.PORT;

export const getTrustedOrigins = (): string[] => {
  const raw = env.TRUSTED_ORIGINS;
  if (!raw) return [];
  return raw
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
};

export const getGitHubConfig = () => ({
  clientId: env.GITHUB_CLIENT_ID,
  clientSecret: env.GITHUB_CLIENT_SECRET
});

export const getDatabaseUrl = () => env.DATABASE_URL;

export const validateEnvironment = () => {
  console.log("✅ Auth environment variables validated successfully");
  if (isDevelopment()) {
    console.log("🔧 Running in development mode");
  }
};

export default env;


