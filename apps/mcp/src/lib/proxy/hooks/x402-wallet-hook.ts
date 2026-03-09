import type { CallToolRequest, CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Hook, RequestExtra, ToolCallResponseHookResult } from "@clawpay-hedera/sdk/handler";
import { PaymentRequirements } from "x402/types";
import { attemptSignPayment } from "../../3rd-parties/payment-strategies/index.js";


type X402ErrorPayload = {
    x402Version?: number;
    error?: string;
    accepts?: Array<{
        scheme: string;
        network: string;
        maxAmountRequired: string;
        payTo?: string;
        asset: string;
        maxTimeoutSeconds?: number;
        resource?: string;
        mimeType?: string;
        description?: string;
        extra?: Record<string, unknown>;
    }>;
};

function isPaymentRequired(res: any): X402ErrorPayload | null {
    const meta = (res?._meta as Record<string, unknown> | undefined) ?? null;
    if (!meta) return null;
    const payload = meta["x402/error"] as X402ErrorPayload | undefined;
    if (!payload) return null;
    if (!payload.error) return null;
    // Treat any pricing-related error as an opportunity to auto-pay
    // Normalize error codes to lowercase for consistent validation
    const normalizedError = payload.error.toLowerCase();
    const codes = new Set(["payment_required", "invalid_payment", "unable_to_match_payment_requirements", "price_compute_failed", "insufficient_funds"]);
    return codes.has(normalizedError) ? payload : null;
}

export class X402WalletHook implements Hook {
    name = "x402-wallet";
    session: any;
    constructor(session: any) {
        this.session = session;
    }

    async processCallToolRequest(req: CallToolRequest, _extra: RequestExtra) {
        return { resultType: "continue" as const, request: req };
    }

    async processCallToolResult(res: CallToolResult, req: CallToolRequest, extra: RequestExtra): Promise<ToolCallResponseHookResult> {
        try {
            console.log("[X402WalletHook] processCallToolResult called");
            const payload = isPaymentRequired(res);
            if (!payload) {
                console.log("[X402WalletHook] No payment required, continuing.");
                return { resultType: "continue" as const, response: res };
            }

            // Handle insufficient_funds error by providing funding links
            // Normalize error code to lowercase for consistent comparison
            if (payload.error && payload.error.toLowerCase() === "insufficient_funds") {
                console.log("[X402WalletHook] Insufficient funds detected, providing funding links.");
                return this.handleInsufficientFunds(res, payload, req, extra);
            }

            // Must have an authenticated user to auto-pay
            const session = this.session;

            console.log("[X402WalletHook] Session userId:", session?.userId);
            if (!session?.userId) {
                console.log("[X402WalletHook] No authenticated user found, cannot auto-pay.");
                return { resultType: "continue" as const, response: res };
            }

            const first = Array.isArray(payload.accepts) && payload.accepts.length > 0 ? payload.accepts[0] : null;
            if (!first) {
                console.log("[X402WalletHook] No acceptable payment option found in payload, continuing.");
                return { resultType: "continue" as const, response: res };
            }

            const toolName = String((req?.params as unknown as { name?: string })?.name ?? "");

            const user = {
                id: String(session.userId),
            } as const;

            const result = await attemptSignPayment(first as unknown as PaymentRequirements, user);
            if (!result.success || !result.signedPaymentHeader) {
                console.log("[X402WalletHook] Auto-sign failed or no signedPaymentHeader returned. Result:", result);
                // If signing failed due to insufficient funds, show funding links
                if (result.error === "insufficient_funds") {
                    console.log("[X402WalletHook] Signing failed due to insufficient USDC, showing funding links.");
                    return this.handleInsufficientFunds(res, payload, req, extra);
                }
                return { resultType: "continue" as const, response: res };
            }

            // Ask proxy to retry with x402/payment token
            const originalParams = (req?.params ?? {}) as Record<string, unknown>;
            const originalMeta = (originalParams["_meta"] as Record<string, unknown> | undefined) ?? {};
            const inferredName = typeof (originalParams)?.name === "string" ? String((originalParams).name) : toolName;
            const nextMeta = { ...originalMeta, ["x402/payment"]: result.signedPaymentHeader } as Record<string, unknown>;
            const nextParams = { ...originalParams, name: inferredName, _meta: nextMeta } as Record<string, unknown>;
            const nextRequest = { method: "tools/call" as const, params: nextParams } as CallToolRequest;

            console.log("[X402WalletHook] Auto-sign succeeded, retrying with signed payment header.");

            return { resultType: "retry" as const, request: nextRequest };
        } catch (err) {
            console.error("[X402WalletHook] Error in processCallToolResult:", err);
            return { resultType: "continue" as const, response: res };
        }
    }

    /**
     * Hedera-native insufficient funds handler.
     * 
     * Mainnet: Banxa (fiat → HBAR) + SaucerSwap (HBAR → USDC)
     * Testnet: Hedera Faucet (free HBAR) + SaucerSwap testnet (HBAR → USDC)
     */
    private async handleInsufficientFunds(res: CallToolResult, payload: X402ErrorPayload, _req: CallToolRequest, _extra: RequestExtra): Promise<ToolCallResponseHookResult> {
        try {
            const network = payload.accepts?.[0]?.network || "hedera-testnet";
            const isTestnet = network.includes("testnet");
            const payerAddress = (payload as any).payer as string | undefined;

            // Extract required amount for display
            const requiredAmount = payload.accepts?.[0]?.maxAmountRequired;
            const amountDisplay = requiredAmount ? `$${(parseInt(requiredAmount, 10) / 1_000_000).toFixed(2)} USDC` : "the required USDC amount";

            let fundingMessage: string;

            if (isTestnet) {
                // --- TESTNET FLOW ---
                fundingMessage = [
                    `## Insufficient USDC`,
                    ``,
                    `This tool costs ${amountDisplay}. Your wallet does not have enough USDC to cover it.`,
                    ``,
                    `**Step 1 — Get Testnet HBAR (free)**`,
                    `Claim free testnet HBAR from the Hedera Faucet:`,
                    `[Hedera Testnet Faucet](https://portal.hedera.com/faucet)`,
                    ``,
                    `**Step 2 — Swap HBAR to USDC**`,
                    `Use SaucerSwap testnet to swap HBAR for USDC (token 0.0.5449):`,
                    `[SaucerSwap Testnet](https://testnet.saucerswap.finance/swap/HBAR/0.0.5449)`,
                    ``,
                    `**Step 3 — Retry**`,
                    `Once your wallet has USDC, come back and run the tool again.`,
                    payerAddress ? `\nYour account: \`${payerAddress}\`` : ``,
                ].join("\n");
            } else {
                // --- MAINNET FLOW ---
                const banxaUrl = this.buildBanxaUrl(payerAddress);
                fundingMessage = [
                    `## Insufficient USDC`,
                    ``,
                    `This tool costs ${amountDisplay}. Your wallet does not have enough USDC to cover it.`,
                    ``,
                    `**Step 1 — Buy HBAR**`,
                    `Purchase HBAR with a credit or debit card via Banxa:`,
                    `[Buy HBAR on Banxa](${banxaUrl})`,
                    ``,
                    `**Step 2 — Swap HBAR to USDC**`,
                    `Use SaucerSwap to swap HBAR for USDC:`,
                    `[Swap on SaucerSwap](https://app.saucerswap.finance/swap/HBAR/0.0.5449)`,
                    ``,
                    `**Step 3 — Retry**`,
                    `Once your wallet has USDC, come back and run the tool again.`,
                    payerAddress ? `\nYour account: \`${payerAddress}\`` : ``,
                ].join("\n");
            }

            // Prepend funding message to existing error content
            const enhancedContent = Array.isArray(res.content) ? [...res.content] : [];
            enhancedContent.unshift({ type: "text", text: fundingMessage });

            return {
                resultType: "continue" as const,
                response: { ...res, content: enhancedContent }
            };
        } catch (error) {
            console.error("[X402WalletHook] Error in handleInsufficientFunds:", error);
            return { resultType: "continue" as const, response: res };
        }
    }

    /**
     * Build a Banxa referral URL pre-filled for HBAR purchase.
     * Uses the simple referral link format (no API key needed).
     */
    private buildBanxaUrl(walletAddress?: string): string {
        const params = new URLSearchParams({
            coinType: "HBAR",
            fiatType: "USD",
            fiatAmount: "20",
            blockchain: "HBAR",
        });
        if (walletAddress) {
            params.set("walletAddress", walletAddress);
        }
        return `https://banxa.com/?${params.toString()}`;
    }
}

