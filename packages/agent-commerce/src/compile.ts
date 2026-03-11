/**
 * Compile the AgentRegistry Solidity contract using solc npm package.
 * Outputs ABI and bytecode to artifacts/ directory.
 */
import solc from "solc";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const CONTRACTS = resolve(ROOT, "contracts");
const ARTIFACTS = resolve(ROOT, "artifacts");

// Ensure artifacts dir exists
if (!existsSync(ARTIFACTS)) mkdirSync(ARTIFACTS, { recursive: true });

// Read the contract source
const source = readFileSync(resolve(CONTRACTS, "AgentRegistry.sol"), "utf-8");

// Build solc input
const input = JSON.stringify({
  language: "Solidity",
  sources: {
    "AgentRegistry.sol": { content: source },
  },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: {
      "*": {
        "*": ["abi", "evm.bytecode.object"],
      },
    },
  },
});

console.log("Compiling AgentRegistry.sol...");
const output = JSON.parse(solc.compile(input));

// Check for errors
if (output.errors) {
  const fatal = output.errors.filter((e: any) => e.severity === "error");
  if (fatal.length > 0) {
    console.error("Compilation errors:");
    fatal.forEach((e: any) => console.error(e.formattedMessage));
    process.exit(1);
  }
  // Print warnings (but don't fail)
  output.errors
    .filter((e: any) => e.severity === "warning")
    .forEach((e: any) => console.warn(e.formattedMessage));
}

// Extract ABI and bytecode
const contract = output.contracts["AgentRegistry.sol"]["AgentRegistry"];
const abi = contract.abi;
const bytecode = "0x" + contract.evm.bytecode.object;

// Write artifacts
writeFileSync(resolve(ARTIFACTS, "AgentRegistry.abi.json"), JSON.stringify(abi, null, 2));
writeFileSync(resolve(ARTIFACTS, "AgentRegistry.bytecode.json"), JSON.stringify({ bytecode }));
writeFileSync(
  resolve(ARTIFACTS, "AgentRegistry.json"),
  JSON.stringify({ abi, bytecode }, null, 2)
);

console.log(`Compiled successfully.`);
console.log(`  ABI: ${abi.length} entries`);
console.log(`  Bytecode: ${bytecode.length} chars`);
console.log(`  Output: artifacts/AgentRegistry.json`);
