/**
 * Hedera-specific x402 payment header creation.
 * 
 * Hedera x402 uses partially-signed HTS TokenTransfer transactions.
 * The facilitator (Blocky402) is set as fee payer via TransactionId,
 * then the payer partially signs. Blocky402 co-signs and submits.
 * 
 * Key: outer payload must be { x402Version, payload: { transaction } }
 * WITHOUT scheme/network in the outer object.
 */

import {
  Client,
  TransferTransaction,
  AccountId,
  TokenId,
  PrivateKey,
  TransactionId,
  Timestamp,
} from "@hashgraph/sdk";
import type { PaymentRequirements } from "x402/types";

/** Convert EVM payTo address to Hedera AccountId */
function resolvePayTo(payTo: string): AccountId {
  if (payTo.startsWith("0.0.")) return AccountId.fromString(payTo);
  return AccountId.fromEvmAddress(0, 0, payTo);
}

export interface HederaPaymentConfig {
  privateKey: string;
  network: 'testnet' | 'mainnet';
  payerAccountId?: string;
  facilitatorFeePayer?: string;
}

/**
 * Create a Hedera x402 payment header (partially-signed HTS transfer).
 * 
 * TransactionId is generated with the facilitator's account so Blocky402
 * pays the HBAR gas fee. The payer only partially signs the token transfer.
 */
export async function createHederaPaymentHeader(
  config: HederaPaymentConfig,
  paymentRequirements: PaymentRequirements
): Promise<string> {
  const { privateKey: pkHex, network, payerAccountId: payerStr, facilitatorFeePayer } = config;

  const pk = PrivateKey.fromStringECDSA(pkHex.replace(/^0x/, ''));

  // Resolve payer account ID
  let payerId: AccountId;
  if (payerStr) {
    payerId = AccountId.fromString(payerStr);
  } else {
    const evmAddress = pk.publicKey.toEvmAddress();
    payerId = AccountId.fromEvmAddress(0, 0, evmAddress);
  }

  const recipientId = resolvePayTo(paymentRequirements.payTo);

  // Convert EVM asset address to Hedera token ID
  const tokenEntityNum = parseInt(paymentRequirements.asset.replace(/^0x/, ''), 16);
  const tokenId = TokenId.fromString(`0.0.${tokenEntityNum}`);
  const amount = Number(paymentRequirements.maxAmountRequired);

  // Facilitator fee payer generates the TX ID (pays HBAR gas)
  const feePayerAccountId = facilitatorFeePayer
    ? AccountId.fromString(facilitatorFeePayer)
    : payerId;

  const client = network === 'testnet' ? Client.forTestnet() : Client.forMainnet();

  const txId = TransactionId.withValidStart(feePayerAccountId, Timestamp.generate());

  const tx = new TransferTransaction()
    .addTokenTransfer(tokenId, payerId, -amount)
    .addTokenTransfer(tokenId, recipientId, amount)
    .setTransactionId(txId)
    .setMaxTransactionFee(2_000_000)
    .setTransactionValidDuration(180);

  // Freeze and partially sign with payer's key only
  const frozenTx = tx.freezeWith(client);
  const signedTx = await frozenTx.sign(pk);
  const txBytes = signedTx.toBytes();

  // Blocky402 expects: { x402Version, payload: { transaction } }
  // Do NOT include scheme/network in the outer object
  const payload = {
    x402Version: 1,
    payload: {
      transaction: Buffer.from(txBytes).toString('base64'),
    },
  };

  client.close();
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}
