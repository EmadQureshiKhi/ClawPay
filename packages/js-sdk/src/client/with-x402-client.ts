import type { Client as MCPClient } from '@modelcontextprotocol/sdk/client/index.js';
import type { RequestOptions } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type {
    CallToolRequest,
    CallToolResult,
    CallToolResultSchema,
    CompatibilityCallToolResultSchema
} from '@modelcontextprotocol/sdk/types.js';
import { createPaymentHeader } from 'x402/client';
import type { MultiNetworkSigner, PaymentRequirements, Network } from 'x402/types';
import { createHederaPaymentHeader, type HederaPaymentConfig } from './hedera-payment.js';
import { isHederaNetwork } from '../handler/shared/hedera-price.js';


export interface X402AugmentedClient {
  callTool(
    params: CallToolRequest["params"],
    resultSchema?:
      | typeof CallToolResultSchema
      | typeof CompatibilityCallToolResultSchema,
    options?: RequestOptions
  ): Promise<CallToolResult>;
}

export type X402ClientConfig = {
  wallet: Partial<MultiNetworkSigner>;
  maxPaymentValue?: bigint;
  version?: number;
  /** Hedera-specific config for native HTS payment signing */
  hederaConfig?: HederaPaymentConfig;
  confirmationCallback?: (payment: PaymentRequirements[]) => Promise<
    | boolean
    | number
    | { index: number }
    | { network: Network }
    | { requirement: PaymentRequirements }
  >;
};

// Hedera-supported networks only
const HEDERA_NETWORKS: Network[] = ['hedera-testnet' as Network, 'hedera' as Network];

/**
 * Wraps an MCP client with X402 payment capabilities (Hedera-only)
 */
export function withX402Client<T extends MCPClient>(
  client: T,
  x402Config: X402ClientConfig
): X402AugmentedClient & T {
  const { wallet: walletConfig, version } = x402Config;
  const signer = { evm: walletConfig.evm, svm: walletConfig.svm } as MultiNetworkSigner;

  const maxPaymentValue = x402Config.maxPaymentValue ?? BigInt(0.1 * 10 ** 6); // 0.10 USDC

  const _listTools = client.listTools.bind(client);

  const listTools: typeof _listTools = async (params, options) => {
    const toolsRes = await _listTools(params, options);
    toolsRes.tools = toolsRes.tools.map((tool) => {
      let description = tool.description;
      if (tool.annotations?.paymentHint) {
        const cost = tool.annotations?.paymentPriceUSD
          ? `${tool.annotations?.paymentPriceUSD}`
          : "an unknown amount";
        
        let paymentDetails = ` (This is a paid tool, you will be charged ${cost} for its execution via Hedera x402)`;
        
        if (tool.annotations?.paymentNetworks && Array.isArray(tool.annotations.paymentNetworks)) {
          const networks = tool.annotations.paymentNetworks as Array<{
            network: string;
            recipient: string;
            maxAmountRequired: string;
            asset: { address: string; symbol?: string; decimals?: number };
          }>;
          
          if (networks.length > 0) {
            paymentDetails += `\n\nPayment Details (Hedera):`;
            networks.forEach((net) => {
              const amount = net.maxAmountRequired;
              const symbol = net.asset.symbol || 'USDC';
              const decimals = net.asset.decimals || 6;
              const formattedAmount = (Number(amount) / Math.pow(10, decimals)).toFixed(decimals);
              paymentDetails += `\n• ${net.network}: ${formattedAmount} ${symbol}`;
              paymentDetails += `\n  Recipient: ${net.recipient}`;
            });
          }
        }
        
        description += paymentDetails;
      }
      return { ...tool, description };
    });
    return toolsRes;
  };

  const _callTool = client.callTool.bind(client);

  const callToolWithPayment = async (
    params: CallToolRequest["params"],
    resultSchema?:
      | typeof CallToolResultSchema
      | typeof CompatibilityCallToolResultSchema,
    options?: RequestOptions
  ): ReturnType<typeof client.callTool> => {
    const res = await _callTool(params, resultSchema, options);

    const maybeX402Error = res._meta?.["x402/error"] as
      | { accepts: PaymentRequirements[] }
      | undefined;

    if (
      res.isError &&
      maybeX402Error &&
      maybeX402Error.accepts &&
      Array.isArray(maybeX402Error.accepts) &&
      maybeX402Error.accepts.length > 0
    ) {
      const accepts = maybeX402Error.accepts;
      const confirmationCallback = x402Config.confirmationCallback;

      // Filter to Hedera networks only
      const hederaAccepts = accepts.filter(a => 
        HEDERA_NETWORKS.includes(a.network) || 
        a.network.startsWith('hedera')
      );
      const effectiveAccepts = hederaAccepts.length > 0 ? hederaAccepts : accepts;

      let selectedReq: PaymentRequirements | undefined;
      if (confirmationCallback) {
        const selection = await confirmationCallback(effectiveAccepts);

        if (selection === false) {
          return {
            isError: true,
            content: [{ type: "text", text: "User declined payment" }]
          };
        }

        if (selection !== true) {
          if (typeof selection === 'number') {
            const idx = selection;
            if (Number.isInteger(idx) && idx >= 0 && idx < effectiveAccepts.length) {
              selectedReq = effectiveAccepts[idx];
            }
          } else if (typeof selection === 'object' && selection) {
            if ('index' in selection) {
              const idx = selection.index;
              if (Number.isInteger(idx) && idx >= 0 && idx < effectiveAccepts.length) {
                selectedReq = effectiveAccepts[idx];
              }
            } else if ('network' in selection) {
              selectedReq = effectiveAccepts.find((a) => a.network === selection.network && a.scheme === 'exact');
            } else if ('requirement' in selection) {
              const reqSel = selection.requirement as PaymentRequirements;
              selectedReq = effectiveAccepts.find((a) =>
                a.scheme === reqSel.scheme &&
                a.network === reqSel.network &&
                a.maxAmountRequired === reqSel.maxAmountRequired
              ) ?? undefined;
            }
          }
        }
      }

      // Default: prefer hedera-testnet, then any exact scheme
      const req = selectedReq ?? (
        effectiveAccepts.find((a) => a?.scheme === "exact" && (a.network as string) === "hedera-testnet")
        ?? effectiveAccepts.find((a) => a?.scheme === "exact")
        ?? effectiveAccepts[0]
      );

      if (!req || req.scheme !== "exact") {
        return res;
      }

      const maxAmountRequired = BigInt(req.maxAmountRequired);
      if (maxAmountRequired > maxPaymentValue) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Payment exceeds client cap: ${maxAmountRequired} > ${maxPaymentValue}`
            }
          ]
        };
      }

      const token = isHederaNetwork(req.network) && x402Config.hederaConfig
        ? await createHederaPaymentHeader(x402Config.hederaConfig, req)
        : await createPaymentHeader(signer, version ?? 1, req);

      const paidRes = await _callTool(
        {
          ...params,
          _meta: {
            ...(params._meta ?? {}),
            "x402/payment": token
          }
        },
        resultSchema,
        options
      );
      return paidRes;
    }

    return res;
  };

  const _client = client as X402AugmentedClient & T;
  _client.listTools = listTools;
  Object.defineProperty(_client, "callTool", {
    value: callToolWithPayment,
    writable: false,
    enumerable: false,
    configurable: true
  });

  return _client;
}
