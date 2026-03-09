import type { McpServer, RegisteredTool, ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult, ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import type { ZodRawShape } from "zod";

import { getAddress } from "viem";
import { decodePayment as decodeX402Payment } from "x402/schemes";
import { findMatchingPaymentRequirements, processPriceToAtomicAmount } from "x402/shared";
import type {
    FacilitatorConfig,
    Network,
    PaymentPayload,
    PaymentRequirements,
    Price,
} from "x402/types";
import { useFacilitator } from "x402/verify";
import { isHederaNetwork, hederaPriceToAtomicAmount } from "../../shared/hedera-price.js";
import { HCSAuditHook, type HCSAuditConfig } from "../../proxy/hooks/hcs-audit-hook.js";

/** Use local Hedera conversion for Hedera networks, x402 for others */
function safeProcessPrice(price: Price, network: Network) {
  if (isHederaNetwork(network)) return hederaPriceToAtomicAmount(price, network);
  return processPriceToAtomicAmount(price, network);
}

export type RecipientWithTestnet = {
  address: string;
  isTestnet?: boolean;
};

export type X402Config = {
  recipient:
    | Partial<Record<Network, string>>
    | Partial<Record<"evm", RecipientWithTestnet>>;
  facilitator: FacilitatorConfig;
  version?: number;
  /** Enable HCS audit trail — logs every successful payment to Hedera Consensus Service */
  hcsAudit?: HCSAuditConfig;
};

export interface X402AugmentedServer {
  paidTool<Args extends ZodRawShape>(
    name: string,
    description: string,
    price: Price,
    paramsSchema: Args,
    annotations: ToolAnnotations,
    cb: ToolCallback<Args>
  ): RegisteredTool;
}

// Hedera networks supported by ClawPay
const HEDERA_EVM_NETWORKS: Network[] = [
  'hedera-testnet' as Network,
  'hedera' as Network,
];

export function withX402<S extends McpServer>(
  server: S,
  cfg: X402Config
): S & X402AugmentedServer {
  const { verify, settle } = useFacilitator(cfg.facilitator);
  const x402Version = cfg.version ?? 1;

  // HCS audit hook — lazily initialized on first payment if config provided
  const hcsHook = cfg.hcsAudit ? new HCSAuditHook(cfg.hcsAudit) : null;

  // Normalize recipients — Hedera-only
  const normalizeRecipients = (
    r: X402Config["recipient"]
  ): Partial<Record<Network, string>> => {
    if (!r || typeof r !== "object") return {};
    const out: Partial<Record<Network, string>> = {};

    const isTestnetNetwork = (network: Network): boolean =>
      network.includes("testnet");

    // Expand evm shorthand to Hedera networks
    const maybeFamily = r as Partial<Record<"evm", RecipientWithTestnet>>;
    if (maybeFamily.evm && typeof maybeFamily.evm.address === "string") {
      const useTestnet = maybeFamily.evm.isTestnet;
      for (const net of HEDERA_EVM_NETWORKS) {
        if (useTestnet === undefined || isTestnetNetwork(net) === !!useTestnet) {
          out[net] = maybeFamily.evm.address;
        }
      }
    }

    // Copy explicit per-network mappings
    for (const [key, value] of Object.entries(r as Record<string, unknown>)) {
      if (typeof value === "string" && HEDERA_EVM_NETWORKS.includes(key as Network)) {
        out[key as Network] = value;
      }
    }

    return out;
  };

  function paidTool<Args extends ZodRawShape>(
    name: string,
    description: string,
    price: Price,
    paramsSchema: Args,
    annotations: ToolAnnotations,
    cb: ToolCallback<Args>
  ): RegisteredTool {
    const recipientsByNetwork = normalizeRecipients(cfg.recipient);
    const paymentNetworks: unknown[] = [];
    
    const networks = Object.keys(recipientsByNetwork) as Network[];
    for (const network of networks) {
      const payTo = recipientsByNetwork[network];
      if (!network || !payTo) continue;

      const atomic = safeProcessPrice(price, network);
      if ("error" in atomic) continue;
      const { maxAmountRequired, asset } = atomic;

      paymentNetworks.push({
        network,
        recipient: payTo,
        maxAmountRequired: maxAmountRequired.toString(),
        asset: {
          address: asset.address,
          symbol: 'symbol' in asset ? asset.symbol : undefined,
          decimals: 'decimals' in asset ? asset.decimals : undefined
        },
        type: 'hedera'
      });
    }

    return server.tool(
      name,
      description,
      paramsSchema,
      { 
        ...annotations, 
        paymentHint: true, 
        paymentPriceUSD: price,
        paymentNetworks,
        paymentVersion: x402Version,
        ...(hcsHook?.getTopicId() ? { hcsTopic: hcsHook.getTopicId() } : {}),
      },
      (async (args, extra) => {
        const recipientsByNetwork = normalizeRecipients(cfg.recipient);

        const buildRequirements = async (): Promise<PaymentRequirements[]> => {
          const reqs: PaymentRequirements[] = [];
          const networks = Object.keys(recipientsByNetwork) as Network[];
          for (const network of networks) {
            const payTo = recipientsByNetwork[network];
            if (!network || !payTo) continue;

            const atomic = safeProcessPrice(price, network);
            if ("error" in atomic) continue;
            const { maxAmountRequired, asset } = atomic;

            const extra = ("eip712" in asset ? (asset as { eip712?: Record<string, unknown> }).eip712 : undefined) as
              | Record<string, unknown>
              | undefined;

            const normalizedPayTo = getAddress(String(payTo));
            const normalizedAsset = getAddress(String(asset.address));

            reqs.push({
              scheme: "exact" as const,
              network,
              maxAmountRequired,
              payTo: normalizedPayTo,
              asset: normalizedAsset,
              maxTimeoutSeconds: 300,
              resource: `mcp://${name}`,
              mimeType: "application/json",
              description,
              extra,
            });
          }
          return reqs;
        };

        const accepts = await buildRequirements();
        if (!accepts.length) {
          const payload = { x402Version, error: "PRICE_COMPUTE_FAILED" } as const;
          return {
            isError: true,
            _meta: { "x402/error": payload },
            content: [{ type: "text", text: JSON.stringify(payload) }],
          } as CallToolResult;
        }

        // Get token from MCP _meta or header
        const requestInfoUnknown: unknown = (extra as { requestInfo?: unknown }).requestInfo;
        const headersUnknown: unknown = requestInfoUnknown && (requestInfoUnknown as { headers?: unknown }).headers;
        const headerToken = (() => {
          if (!headersUnknown) return undefined;
          if (typeof (headersUnknown as Headers).get === "function") {
            return (headersUnknown as Headers).get("X-PAYMENT") ?? undefined;
          }
          if (typeof headersUnknown === "object" && headersUnknown !== null) {
            const rec = headersUnknown as Record<string, unknown>;
            const direct = rec["X-PAYMENT"] ?? rec["x-payment"];
            return typeof direct === "string" ? direct : undefined;
          }
          return undefined;
        })();

        const metaToken = (extra?._meta && (extra._meta as Record<string, unknown>)["x402/payment"]) as string | undefined;
        const token = metaToken ?? headerToken;

        const paymentRequired = (
          reason = "PAYMENT_REQUIRED",
          extraFields: Record<string, unknown> = {}
        ): CallToolResult => {
          const payload = { x402Version, error: reason, accepts, ...extraFields };
          return {
            isError: true,
            _meta: { "x402/error": payload },
            content: [{ type: "text", text: JSON.stringify(payload) }],
          };
        };

        if (!token || typeof token !== "string") return paymentRequired();

        // Check if this is a Hedera payment by checking if any accept is Hedera
        const hasHederaAccepts = accepts.some(a => isHederaNetwork(a.network));

        // For Hedera: bypass x402 npm decode (it doesn't support Hedera networks)
        // and call Blocky402 directly with the raw paymentHeader
        if (hasHederaAccepts) {
          // Pick the first Hedera requirement
          const selected = accepts.find(a => isHederaNetwork(a.network));
          if (!selected) return paymentRequired("UNABLE_TO_MATCH_PAYMENT_REQUIREMENTS");

          const facilitatorUrl = cfg.facilitator?.url || "https://api.testnet.blocky402.com";

          // Verify directly with Blocky402 (it expects paymentHeader, not paymentPayload)
          const vr = await fetch(`${facilitatorUrl}/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              x402Version,
              paymentHeader: token,
              paymentRequirements: selected,
            }),
          });
          if (vr.status !== 200) return paymentRequired("INVALID_PAYMENT");
          const verifyResult = await vr.json() as { isValid: boolean; invalidReason?: string; payer?: string };
          if (!verifyResult.isValid) {
            return paymentRequired(verifyResult.invalidReason ?? "INVALID_PAYMENT", { payer: verifyResult.payer });
          }

          // Execute the tool
          let result: CallToolResult;
          let failed = false;
          try {
            result = await cb(args, extra);
            if (result && typeof result === "object" && "isError" in result && result.isError) {
              failed = true;
            }
          } catch (e) {
            failed = true;
            result = {
              isError: true,
              content: [{ type: "text", text: `Tool execution failed: ${String(e)}` }],
            };
          }

          // Settle directly with Blocky402
          if (!failed) {
            try {
              const sr = await fetch(`${facilitatorUrl}/settle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  x402Version,
                  paymentHeader: token,
                  paymentRequirements: selected,
                }),
              });
              const settleResult = await sr.json() as { success: boolean; errorReason?: string; transaction?: string; network?: string; payer?: string };
              if (settleResult.success) {
                result._meta ??= {} as Record<string, unknown>;
                (result._meta as Record<string, unknown>)["x402/payment-response"] = {
                  success: true,
                  transaction: settleResult.transaction,
                  network: settleResult.network,
                  payer: settleResult.payer,
                };

                // HCS audit logging — await so topic metadata gets into response
                if (hcsHook) {
                  await hcsHook.processCallToolResult(
                    result,
                    { method: "tools/call", params: { name, arguments: args } } as any,
                    {} as any
                  ).catch(() => {});
                }
              } else {
                return paymentRequired(settleResult.errorReason ?? "SETTLEMENT_FAILED");
              }
            } catch {
              return paymentRequired("SETTLEMENT_FAILED");
            }
          }

          return result;
        }

        // Non-Hedera: use standard x402 npm decode + facilitator
        let decoded: PaymentPayload;
        try {
          decoded = decodeX402Payment(token);
          decoded.x402Version = x402Version;
        } catch {
          return paymentRequired("INVALID_PAYMENT");
        }

        const selected = findMatchingPaymentRequirements(accepts, decoded);
        if (!selected) return paymentRequired("UNABLE_TO_MATCH_PAYMENT_REQUIREMENTS");

        const vr = await verify(decoded, selected);
        if (!vr.isValid) {
          return paymentRequired(vr.invalidReason ?? "INVALID_PAYMENT", { payer: vr.payer });
        }

        let result: CallToolResult;
        let failed = false;
        try {
          result = await cb(args, extra);
          if (result && typeof result === "object" && "isError" in result && result.isError) {
            failed = true;
          }
        } catch (e) {
          failed = true;
          result = {
            isError: true,
            content: [{ type: "text", text: `Tool execution failed: ${String(e)}` }],
          };
        }

        if (!failed) {
          try {
            const s = await settle(decoded, selected);
            if (s.success) {
              result._meta ??= {} as Record<string, unknown>;
              (result._meta as Record<string, unknown>)["x402/payment-response"] = {
                success: true,
                transaction: s.transaction,
                network: s.network,
                payer: s.payer,
              };

              // HCS audit logging — await so topic metadata gets into response
              if (hcsHook) {
                await hcsHook.processCallToolResult(
                  result,
                  { method: "tools/call", params: { name, arguments: args } } as any,
                  {} as any
                ).catch(() => {});
              }
            } else {
              return paymentRequired(s.errorReason ?? "SETTLEMENT_FAILED");
            }
          } catch {
            return paymentRequired("SETTLEMENT_FAILED");
          }
        }

        return result;
      }) as ToolCallback<Args>
    );
  }

  Object.defineProperty(server, "paidTool", {
    value: paidTool,
    writable: false,
    enumerable: false,
    configurable: true,
  });

  return server as S & X402AugmentedServer;
}
