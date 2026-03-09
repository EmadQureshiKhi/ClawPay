/**
 * HCS Audit Trail Hook for ClawPay
 * 
 * Logs every successful x402 payment to a Hedera Consensus Service (HCS) topic,
 * creating an immutable, publicly verifiable audit trail of all MCP tool payments.
 * 
 * Each MCP server gets its own HCS topic. Payment events are JSON messages
 * containing transaction ID, amount, asset, tool name, and timestamp.
 * 
 * View audit trails on HashScan: https://hashscan.io/testnet/topic/{topicId}
 */

import type {
    CallToolRequest,
    CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import type { Hook, RequestExtra } from "../hooks.js";

export interface HCSAuditConfig {
    /** Hedera operator account ID (e.g. "0.0.12345") */
    operatorId: string;
    /** Hedera operator private key (DER-encoded hex) */
    operatorKey: string;
    /** Network: "testnet" or "mainnet" */
    network: "testnet" | "mainnet";
    /** Optional: pre-existing topic ID to use instead of creating one */
    topicId?: string;
}

export interface HCSPaymentEvent {
    type: "payment_settled";
    txId: string;
    network: string;
    amount: string;
    asset: string;
    tool: string;
    payer?: string;
    serverId?: string;
    timestamp: string;
}

/**
 * HCS Audit Hook — logs payment events to Hedera Consensus Service.
 * 
 * Lazily initializes the Hedera SDK and topic on first payment.
 * Falls back gracefully if HCS submission fails (payment still succeeds).
 */
export class HCSAuditHook implements Hook {
    name = "hcs-audit";
    private config: HCSAuditConfig;
    private topicId: string | null;
    private hederaClient: any = null;
    private initialized = false;

    constructor(config: HCSAuditConfig) {
        this.config = config;
        this.topicId = config.topicId || null;
    }

    private async ensureInitialized(): Promise<boolean> {
        if (this.initialized) return true;

        try {
            // Dynamic import to avoid requiring @hashgraph/sdk when not using HCS
            const { Client, TopicCreateTransaction, AccountId, PrivateKey } = await import("@hashgraph/sdk");

            const client = this.config.network === "mainnet"
                ? Client.forMainnet()
                : Client.forTestnet();

            // Try multiple key formats: ECDSA hex, DER, ED25519
            let operatorKey;
            try {
                operatorKey = PrivateKey.fromStringECDSA(this.config.operatorKey);
            } catch {
                try {
                    operatorKey = PrivateKey.fromStringDer(this.config.operatorKey);
                } catch {
                    operatorKey = PrivateKey.fromStringED25519(this.config.operatorKey);
                }
            }

            client.setOperator(
                AccountId.fromString(this.config.operatorId),
                operatorKey
            );

            this.hederaClient = client;

            // Create topic if not provided
            if (!this.topicId) {
                const txResponse = await new TopicCreateTransaction()
                    .setTopicMemo("ClawPay Payment Audit Trail")
                    .execute(client);

                const receipt = await txResponse.getReceipt(client);
                this.topicId = receipt.topicId?.toString() || null;

                if (this.topicId) {
                    console.log(`[HCSAuditHook] Created audit topic: ${this.topicId}`);
                    const base = this.config.network === "mainnet"
                        ? "https://hashscan.io/mainnet"
                        : "https://hashscan.io/testnet";
                    console.log(`[HCSAuditHook] View on HashScan: ${base}/topic/${this.topicId}`);
                }
            }

            this.initialized = true;
            return true;
        } catch (error) {
            console.error("[HCSAuditHook] Failed to initialize:", error);
            return false;
        }
    }

    private async submitAuditMessage(event: HCSPaymentEvent): Promise<void> {
        if (!this.hederaClient || !this.topicId) return;

        try {
            const { TopicMessageSubmitTransaction, TopicId } = await import("@hashgraph/sdk");

            const message = JSON.stringify(event);

            await new TopicMessageSubmitTransaction()
                .setTopicId(TopicId.fromString(this.topicId))
                .setMessage(message)
                .execute(this.hederaClient);

            console.log(`[HCSAuditHook] Payment logged to topic ${this.topicId}: ${event.txId}`);
        } catch (error) {
            // Don't fail the payment if HCS logging fails
            console.error("[HCSAuditHook] Failed to submit audit message:", error);
        }
    }

    /**
     * Get the HCS topic ID for this audit trail.
     * Returns null if not yet initialized.
     */
    getTopicId(): string | null {
        return this.topicId;
    }

    async processCallToolResult(
        res: CallToolResult,
        req: CallToolRequest,
        extra: RequestExtra
    ) {
        // Check if this response contains a successful payment settlement
        const meta = (res._meta as Record<string, unknown>) || {};
        const paymentResponse = meta["x402/payment-response"] as {
            success?: boolean;
            transaction?: string;
            network?: string;
            payer?: string;
        } | undefined;

        if (paymentResponse?.success && paymentResponse.transaction) {
            // Initialize HCS on first payment (lazy init)
            const ready = await this.ensureInitialized();
            if (!ready) {
                return { resultType: "continue" as const, response: res };
            }

            // Extract payment details from the x402 error metadata (original requirements)
            const x402Error = meta["x402/error"] as {
                accepts?: Array<{ maxAmountRequired?: string; asset?: string }>;
            } | undefined;

            const toolName = String((req?.params as any)?.name ?? "unknown");
            const firstAccept = x402Error?.accepts?.[0];

            const event: HCSPaymentEvent = {
                type: "payment_settled",
                txId: paymentResponse.transaction,
                network: paymentResponse.network || "hedera-testnet",
                amount: firstAccept?.maxAmountRequired || "unknown",
                asset: firstAccept?.asset || "HBAR",
                tool: toolName,
                payer: paymentResponse.payer,
                serverId: extra?.serverId || undefined,
                timestamp: new Date().toISOString(),
            };

            // Submit to HCS (fire-and-forget, don't block the response)
            this.submitAuditMessage(event).catch(() => {});

            // Add HCS topic info to response metadata
            if (this.topicId) {
                (res._meta as Record<string, unknown>)["clawpay/hcs-topic"] = this.topicId;
                const base = this.config.network === "mainnet"
                    ? "https://hashscan.io/mainnet"
                    : "https://hashscan.io/testnet";
                (res._meta as Record<string, unknown>)["clawpay/hcs-url"] = `${base}/topic/${this.topicId}`;
            }
        }

        return { resultType: "continue" as const, response: res };
    }
}
