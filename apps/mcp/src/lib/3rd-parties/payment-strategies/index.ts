/**
 * Simple Payment Signing Strategies for ClawPay
 *
 * This module signs a single payment requirement using the first available
 * compatible strategy. Keep it minimal and predictable.
 */

import type { PaymentRequirements } from "x402/types";
import { HederaSigningStrategy } from "./hedera-strategy.js";

export interface PaymentSigningContext {
    user: {
        id: string;
    };
    paymentRequirement: PaymentRequirements;
}

export interface PaymentSigningResult {
    success: boolean;
    signedPaymentHeader?: string;
    error?: string;
    strategy?: string;
    walletAddress?: string;
}

export interface PaymentSigningStrategy {
    name: string;
    priority: number;
    canSign(context: PaymentSigningContext): Promise<boolean>;
    signPayment(context: PaymentSigningContext): Promise<PaymentSigningResult>;
}

export async function attemptSignPayment(
    paymentRequirement: PaymentRequirements,
    user?: PaymentSigningContext['user']
): Promise<PaymentSigningResult> {
    if (!user) {
        return { success: false, error: 'User not provided' };
    }
    if (!paymentRequirement) {
        return { success: false, error: 'Payment requirement not provided' };
    }

    const context: PaymentSigningContext = { user, paymentRequirement };
    const strategies = await getSigningStrategies();
    const sorted = strategies.sort((a, b) => b.priority - a.priority);

    let lastError: string | undefined;
    for (const strategy of sorted) {
        try {
            const can = await strategy.canSign(context);
            if (!can) continue;
            const result = await strategy.signPayment(context);
            if (result.success) {
                return { ...result, strategy: strategy.name };
            }
            // Preserve specific errors like "insufficient_funds" — don't swallow them
            if (result.error) {
                lastError = result.error;
                if (result.error === "insufficient_funds") {
                    return { success: false, error: "insufficient_funds" };
                }
            }
        } catch (err) {
            // Move on to next strategy
            console.warn(`[PaymentSigning] Strategy ${strategy.name} error:`, err);
        }
    }

    return { success: false, error: lastError || 'No strategy could sign the payment' };
}

// Backwards-compatible shim: take first entry when array is provided
export async function attemptAutoSign(
    paymentRequirements: PaymentRequirements[],
    user?: PaymentSigningContext['user']
): Promise<PaymentSigningResult> {
    const first = Array.isArray(paymentRequirements) && paymentRequirements.length > 0
        ? paymentRequirements[0]
        : undefined;
    return attemptSignPayment(first as PaymentRequirements, user);
}

async function getSigningStrategies(): Promise<PaymentSigningStrategy[]> {
    const strategies: PaymentSigningStrategy[] = [];
    try {
        strategies.push(new HederaSigningStrategy());
    } catch (error) {
        console.warn('[PaymentSigning] Hedera strategy not available:', error);
    }
    return strategies;
}

const paymentStrategies = { attemptSignPayment, attemptAutoSign };

export default paymentStrategies;