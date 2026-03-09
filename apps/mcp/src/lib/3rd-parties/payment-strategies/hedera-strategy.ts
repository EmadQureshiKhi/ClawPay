/**
 * Hedera Signing Strategy
 * 
 * Signs x402 payments using the user's stored (encrypted) Hedera ECDSA key.
 * Creates a partially-signed HTS USDC transfer with Blocky402 as fee payer.
 */
import type { PaymentSigningStrategy, PaymentSigningContext, PaymentSigningResult } from "./index.js";
import { db } from "../../auth.js";
import { decryptKey } from "../../crypto.js";

// Blocky402 fee payer account on testnet
const BLOCKY402_ACCOUNT = "0.0.7162784";

export class HederaSigningStrategy implements PaymentSigningStrategy {
  name = "hedera";
  priority = 100;

  async canSign(context: PaymentSigningContext): Promise<boolean> {
    const network = context.paymentRequirement?.network;
    if (!network) return false;
    const networkStr = String(network);
    const isHedera = networkStr === "hedera-testnet" || networkStr === "hedera";
    if (!isHedera) return false;

    // Check if user has a Hedera wallet with stored key
    const wallet = await this.getUserHederaWallet(context.user.id);
    return wallet !== null;
  }

  async signPayment(context: PaymentSigningContext): Promise<PaymentSigningResult> {
      try {
        const wallet = await this.getUserHederaWallet(context.user.id);
        if (!wallet) {
          return { success: false, error: "No Hedera wallet with stored key found" };
        }

        const meta = wallet.walletMetadata as Record<string, string>;
        const privateKeyHex = decryptKey(meta.encryptedKey, meta.iv, meta.tag);
        const hederaAccountId = meta.hederaAccountId;
        const network = context.paymentRequirement.network as string;

        const req = context.paymentRequirement;
        const maxAmount = req.maxAmountRequired as string;
        const asset = req.asset as string;

        // Convert EVM asset address to token number for balance check
        const assetHex = asset.replace("0x", "").replace(/^0+/, "");
        const tokenNum = parseInt(assetHex, 16);
        const tokenEntityId = `0.0.${tokenNum}`;

        // Check USDC balance before signing — don't sign if user can't pay
        const amountNeeded = parseInt(maxAmount, 10);
        const balance = await this.getTokenBalance(hederaAccountId, tokenEntityId, network);
        if (balance < amountNeeded) {
          console.log(`[HederaStrategy] Insufficient USDC: have ${balance}, need ${amountNeeded} (account ${hederaAccountId}, token ${tokenEntityId})`);
          return { success: false, error: "insufficient_funds" };
        }

        // Dynamically import @hashgraph/sdk to avoid loading it at startup
        const {
          Client,
          TransferTransaction,
          AccountId,
          TokenId,
          PrivateKey,
          TransactionId,
          Hbar,
        } = await import("@hashgraph/sdk");

        const payTo = req.payTo as string;

        // Convert EVM address to Hedera AccountId for payTo
        const recipientAccountId = AccountId.fromEvmAddress(0, 0, payTo);

        const tokenId = TokenId.fromString(tokenEntityId);

        // Parse the payer's private key
        const payerKey = PrivateKey.fromStringECDSA(privateKeyHex);
        const payerAccountId = AccountId.fromString(hederaAccountId);

        // Blocky402 is the fee payer (pays HBAR gas)
        const feePayerAccountId = AccountId.fromString(BLOCKY402_ACCOUNT);

        // Create client for the right network
        const client = network === "hedera" ? Client.forMainnet() : Client.forTestnet();

        // Build the TransferTransaction
        const txId = TransactionId.generate(feePayerAccountId);
        const amount = amountNeeded;

        const transferTx = new TransferTransaction()
          .setTransactionId(txId)
          .addTokenTransfer(tokenId, payerAccountId, -amount)
          .addTokenTransfer(tokenId, recipientAccountId, amount)
          .setMaxTransactionFee(new Hbar(2))
          .freezeWith(client);

        // Partially sign with payer's key only (Blocky402 co-signs later)
        const signedTx = await transferTx.sign(payerKey);
        const txBytes = signedTx.toBytes();

        // Build the x402 payment header
        const payload = {
          x402Version: 1,
          payload: {
            transaction: Buffer.from(txBytes).toString("base64"),
          },
        };
        const paymentHeader = Buffer.from(JSON.stringify(payload)).toString("base64");

        client.close();

        console.log(`[HederaStrategy] Signed payment: ${amount} atomic USDC from ${hederaAccountId} to ${recipientAccountId}`);

        return {
          success: true,
          signedPaymentHeader: paymentHeader,
          strategy: "hedera",
          walletAddress: wallet.walletAddress,
        };
      } catch (error) {
        console.error("[HederaStrategy] Signing failed:", error);
        return { success: false, error: (error as Error).message };
      }
    }


  private async getUserHederaWallet(userId: string) {
    const wallet = await db.query.userWallets.findFirst({
      where: (t, { and, eq }) => and(
        eq(t.userId, userId),
        eq(t.isActive, true),
      ),
      orderBy: (t, { desc }) => [desc(t.isPrimary), desc(t.createdAt)],
    });

    if (!wallet) return null;

    const meta = wallet.walletMetadata as Record<string, string> | null;
    if (!meta?.encryptedKey || !meta?.iv || !meta?.tag || !meta?.hederaAccountId) {
      return null;
    }

    return wallet;
  }

  /**
   * Check token balance via Hedera Mirror Node before signing.
   * Returns the token balance in atomic units (e.g. 406000000 for 406 USDC).
   */
  private async getTokenBalance(accountId: string, tokenId: string, network: string): Promise<number> {
    try {
      const isTestnet = network.includes("testnet");
      const mirrorBase = isTestnet
        ? "https://testnet.mirrornode.hedera.com"
        : "https://mainnet.mirrornode.hedera.com";

      const res = await fetch(`${mirrorBase}/api/v1/accounts/${accountId}/tokens?token.id=${tokenId}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return 0;

      const data = await res.json() as { tokens?: Array<{ token_id: string; balance: number }> };
      const token = data.tokens?.find(t => t.token_id === tokenId);
      return token?.balance ?? 0;
    } catch (err) {
      console.warn(`[HederaStrategy] Balance check failed for ${accountId}:`, err);
      // If balance check fails, let it through (don't block on mirror node issues)
      return Number.MAX_SAFE_INTEGER;
    }
  }


}
