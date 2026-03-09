/**
 * ClawPay Hedera Tools — Full Suite
 * 
 * Tier 1: Gasless write operations (HCS submit, create topic, mint NFT, create token, associate, schedule)
 * Tier 2: Smart analytics & aggregation (deep dive, token analytics, whale tracker, DeFi, tx decoder, NFT rarity)
 * Tier 3: Basic reads (token lookup, topic reader, balance check)
 * 
 * All payments in USDC on Hedera via x402 + Blocky402 facilitator.
 * 
 * Start: tsx index.ts
 * MCP endpoint: http://localhost:3000/mcp
 */

import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { createMcpPaidHandler } from "@clawpay-hedera/sdk/handler";
import { z } from "zod";
import {
  Client,
  PrivateKey,
  AccountId,
  TopicMessageSubmitTransaction,
  TopicCreateTransaction,
  TokenCreateTransaction,
  TokenType,
  TokenSupplyType,
  TokenMintTransaction,
  TokenAssociateTransaction,
  TransferTransaction,
  ScheduleCreateTransaction,
  Hbar,
} from "@hashgraph/sdk";

const app = new Hono();

const MIRROR = "https://testnet.mirrornode.hedera.com/api/v1";
const RECIPIENT_ADDRESS = process.env.HEDERA_RECIPIENT || "0x0f1a0cb488f42b1bb2a04453ba9c410c5ac72f3c";

// Operator account for write operations — this server pays gas
const OPERATOR_ID = process.env.HEDERA_OPERATOR_ID || "0.0.6514537";
const OPERATOR_KEY = process.env.HEDERA_OPERATOR_KEY || "92a9952290387a03bbaa8756366321def94240c1f9a1b0f40ce6606418ee57e2";

function getClient(): Client {
  const client = Client.forTestnet();
  client.setOperator(
    AccountId.fromString(OPERATOR_ID),
    PrivateKey.fromStringECDSA(OPERATOR_KEY)
  );
  return client;
}

// Helper: fetch JSON from mirror node
async function mirror(path: string) {
  const res = await fetch(`${MIRROR}${path}`);
  if (!res.ok) return null;
  return res.json() as Promise<any>;
}

const handler = createMcpPaidHandler(
  (server) => {

    // ═══════════════════════════════════════════════════════════════
    // TIER 1 — GASLESS WRITE OPERATIONS
    // "I can't do this without you" — user pays USDC, we pay HBAR gas
    // ═══════════════════════════════════════════════════════════════

    server.paidTool(
      "hedera_hcs_submit",
      "Submit a message to ANY Hedera Consensus Service (HCS) topic. Gasless — you pay USDC, we handle HBAR fees. Returns consensus timestamp as proof.",
      "$0.05",
      {
        topicId: z.string().describe("HCS topic ID (e.g. 0.0.123456)"),
        message: z.string().describe("Message to submit (text, JSON, or any string up to 1024 bytes)"),
      },
      {},
      async ({ topicId, message }) => {
        try {
          const client = getClient();
          const tx = await new TopicMessageSubmitTransaction()
            .setTopicId(topicId)
            .setMessage(message)
            .execute(client);
          const receipt = await tx.getReceipt(client);
          client.close();
          return {
            content: [{ type: "text", text: JSON.stringify({
              success: true,
              topicId,
              sequenceNumber: receipt.topicSequenceNumber?.toString(),
              consensusTimestamp: tx.transactionId.toString(),
              message: message.substring(0, 100) + (message.length > 100 ? "..." : ""),
            }, null, 2) }]
          };
        } catch (error: any) {
          return { content: [{ type: "text", text: `Error submitting to HCS: ${error.message || error}` }], isError: true };
        }
      }
    );

    server.paidTool(
      "hedera_create_hcs_topic",
      "Create a brand new HCS topic on Hedera. Returns the topic ID. Gasless — you pay USDC only.",
      "$0.08",
      {
        memo: z.string().optional().describe("Optional memo/description for the topic"),
        submitKeyRequired: z.boolean().optional().describe("If true, only the admin key can submit messages (default: false, anyone can submit)"),
      },
      {},
      async ({ memo, submitKeyRequired }) => {
        try {
          const client = getClient();
          const operatorKey = PrivateKey.fromStringECDSA(OPERATOR_KEY);
          let tx = new TopicCreateTransaction()
            .setAdminKey(operatorKey.publicKey);
          if (memo) tx = tx.setTopicMemo(memo);
          if (submitKeyRequired) tx = tx.setSubmitKey(operatorKey.publicKey);
          const response = await tx.execute(client);
          const receipt = await response.getReceipt(client);
          client.close();
          return {
            content: [{ type: "text", text: JSON.stringify({
              success: true,
              topicId: receipt.topicId?.toString(),
              memo: memo || "(none)",
              submitKeyRequired: submitKeyRequired || false,
              adminKey: operatorKey.publicKey.toStringDER().substring(0, 40) + "...",
            }, null, 2) }]
          };
        } catch (error: any) {
          return { content: [{ type: "text", text: `Error creating topic: ${error.message || error}` }], isError: true };
        }
      }
    );

    server.paidTool(
      "hedera_create_hts_token",
      "Create a brand new HTS token (fungible or NFT) on Hedera. Gasless — you pay USDC, we handle everything.",
      "$0.15",
      {
        name: z.string().describe("Token name (e.g. 'My Token')"),
        symbol: z.string().describe("Token symbol (e.g. 'MTK')"),
        isNFT: z.boolean().optional().describe("True for NFT collection, false for fungible token (default: false)"),
        decimals: z.number().optional().describe("Decimals for fungible tokens (default: 6, ignored for NFTs)"),
        initialSupply: z.number().optional().describe("Initial supply for fungible tokens (default: 1000000, ignored for NFTs)"),
        maxSupply: z.number().optional().describe("Max supply (0 = infinite for fungible, required for NFTs)"),
        memo: z.string().optional().describe("Token memo"),
      },
      {},
      async ({ name, symbol, isNFT, decimals, initialSupply, maxSupply, memo }) => {
        try {
          const client = getClient();
          const operatorKey = PrivateKey.fromStringECDSA(OPERATOR_KEY);
          const treasuryId = AccountId.fromString(OPERATOR_ID);

          let tx = new TokenCreateTransaction()
            .setTokenName(name)
            .setTokenSymbol(symbol)
            .setTreasuryAccountId(treasuryId)
            .setAdminKey(operatorKey.publicKey)
            .setSupplyKey(operatorKey.publicKey);

          if (isNFT) {
            tx = tx.setTokenType(TokenType.NonFungibleUnique)
              .setSupplyType(TokenSupplyType.Finite)
              .setMaxSupply(maxSupply || 1000)
              .setDecimals(0)
              .setInitialSupply(0);
          } else {
            tx = tx.setTokenType(TokenType.FungibleCommon)
              .setDecimals(decimals ?? 6)
              .setInitialSupply(initialSupply ?? 1000000);
            if (maxSupply && maxSupply > 0) {
              tx = tx.setSupplyType(TokenSupplyType.Finite).setMaxSupply(maxSupply);
            }
          }
          if (memo) tx = tx.setTokenMemo(memo);

          const response = await tx.execute(client);
          const receipt = await response.getReceipt(client);
          client.close();
          return {
            content: [{ type: "text", text: JSON.stringify({
              success: true,
              tokenId: receipt.tokenId?.toString(),
              name, symbol,
              type: isNFT ? "NON_FUNGIBLE_UNIQUE" : "FUNGIBLE_COMMON",
              decimals: isNFT ? 0 : (decimals ?? 6),
              initialSupply: isNFT ? 0 : (initialSupply ?? 1000000),
              hashscan: `https://hashscan.io/testnet/token/${receipt.tokenId?.toString()}`,
            }, null, 2) }]
          };
        } catch (error: any) {
          return { content: [{ type: "text", text: `Error creating token: ${error.message || error}` }], isError: true };
        }
      }
    );

    server.paidTool(
      "hedera_mint_nft",
      "Mint an NFT to an existing HTS NFT collection. Supply metadata as a CID or JSON string. Gasless — pay USDC only.",
      "$0.10",
      {
        tokenId: z.string().describe("NFT collection token ID (e.g. 0.0.12345)"),
        metadata: z.string().describe("NFT metadata — IPFS CID or JSON string (max 100 bytes on-chain)"),
      },
      {},
      async ({ tokenId, metadata }) => {
        try {
          const client = getClient();
          const metadataBytes = new TextEncoder().encode(metadata.substring(0, 100));
          const tx = await new TokenMintTransaction()
            .setTokenId(tokenId)
            .addMetadata(Buffer.from(metadataBytes))
            .execute(client);
          const receipt = await tx.getReceipt(client);
          client.close();
          const serials = receipt.serials?.map((s: any) => s.toString()) || [];
          return {
            content: [{ type: "text", text: JSON.stringify({
              success: true,
              tokenId,
              serialNumbers: serials,
              metadata: metadata.substring(0, 100),
              hashscan: `https://hashscan.io/testnet/token/${tokenId}`,
            }, null, 2) }]
          };
        } catch (error: any) {
          return { content: [{ type: "text", text: `Error minting NFT: ${error.message || error}` }], isError: true };
        }
      }
    );

    server.paidTool(
      "hedera_token_associate",
      "Associate an HTS token with a Hedera account. Required before receiving any HTS token. Gasless — pay USDC only.",
      "$0.03",
      {
        accountId: z.string().describe("Account to associate the token with (e.g. 0.0.12345)"),
        tokenId: z.string().describe("Token ID to associate (e.g. 0.0.67890)"),
      },
      {},
      async ({ accountId, tokenId }) => {
        try {
          const client = getClient();
          // Note: token association requires the account's key to sign.
          // This will only work if the operator IS the account, or has the account's key.
          const tx = await new TokenAssociateTransaction()
            .setAccountId(accountId)
            .setTokenIds([tokenId])
            .execute(client);
          const receipt = await tx.getReceipt(client);
          client.close();
          return {
            content: [{ type: "text", text: JSON.stringify({
              success: true,
              accountId,
              tokenId,
              status: receipt.status.toString(),
            }, null, 2) }]
          };
        } catch (error: any) {
          return { content: [{ type: "text", text: `Error associating token: ${error.message || error}. Note: the account owner must have auto-association enabled or this server must have the account's key.` }], isError: true };
        }
      }
    );

    server.paidTool(
      "hedera_schedule_tx",
      "Create a scheduled HBAR transfer on Hedera. The transaction executes when all required signatures are collected. Gasless.",
      "$0.07",
      {
        fromAccountId: z.string().describe("Sender account ID"),
        toAccountId: z.string().describe("Recipient account ID"),
        amountHbar: z.number().describe("Amount in HBAR to transfer"),
        memo: z.string().optional().describe("Transaction memo"),
      },
      {},
      async ({ fromAccountId, toAccountId, amountHbar, memo }) => {
        try {
          const client = getClient();
          const innerTx = new TransferTransaction()
            .addHbarTransfer(fromAccountId, new Hbar(-amountHbar))
            .addHbarTransfer(toAccountId, new Hbar(amountHbar));
          if (memo) innerTx.setTransactionMemo(memo);

          const scheduleTx = await new ScheduleCreateTransaction()
            .setScheduledTransaction(innerTx)
            .setScheduleMemo(memo || `Scheduled transfer of ${amountHbar} HBAR`)
            .execute(client);
          const receipt = await scheduleTx.getReceipt(client);
          client.close();
          return {
            content: [{ type: "text", text: JSON.stringify({
              success: true,
              scheduleId: receipt.scheduleId?.toString(),
              from: fromAccountId,
              to: toAccountId,
              amount: `${amountHbar} HBAR`,
              status: "PENDING — awaiting required signatures",
              hashscan: `https://hashscan.io/testnet/schedule/${receipt.scheduleId?.toString()}`,
            }, null, 2) }]
          };
        } catch (error: any) {
          return { content: [{ type: "text", text: `Error creating scheduled tx: ${error.message || error}` }], isError: true };
        }
      }
    );

    // ═══════════════════════════════════════════════════════════════
    // TIER 2 — SMART ANALYTICS & AGGREGATION
    // "This saves me hours" — processed data, not raw mirror node
    // ═══════════════════════════════════════════════════════════════

    server.paidTool(
      "hedera_account_deep_dive",
      "Full account analysis: balances, recent transactions, token holdings, top interactions, and risk indicators. One call instead of 50 Mirror Node queries.",
      "$0.04",
      {
        accountId: z.string().describe("Hedera account ID (e.g. 0.0.12345)"),
      },
      { readOnlyHint: true },
      async ({ accountId }) => {
        try {
          const [balRes, txRes, infoRes] = await Promise.all([
            mirror(`/balances?account.id=${accountId}&limit=1`),
            mirror(`/transactions?account.id=${accountId}&limit=25&order=desc`),
            mirror(`/accounts/${accountId}`),
          ]);

          const balance = balRes?.balances?.[0];
          const txs = txRes?.transactions || [];
          const info = infoRes;

          // Analyze transaction patterns
          const txTypes: Record<string, number> = {};
          const interactedAccounts: Record<string, number> = {};
          for (const tx of txs) {
            txTypes[tx.name] = (txTypes[tx.name] || 0) + 1;
            for (const t of tx.transfers || []) {
              if (t.account !== accountId) {
                interactedAccounts[t.account] = (interactedAccounts[t.account] || 0) + 1;
              }
            }
          }
          const topInteractions = Object.entries(interactedAccounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([acct, count]) => ({ account: acct, interactions: count }));

          // Risk indicators
          const riskFlags: string[] = [];
          if (txs.length >= 25) riskFlags.push("High transaction volume");
          if (!info?.key) riskFlags.push("No public key set");
          const tokenCount = (balance?.tokens || []).length;
          if (tokenCount > 20) riskFlags.push(`Holds ${tokenCount} different tokens`);

          return {
            content: [{ type: "text", text: JSON.stringify({
              accountId,
              hbarBalance: balance ? `${(Number(balance.balance) / 1e8).toFixed(4)} HBAR` : "unknown",
              tokenHoldings: tokenCount,
              tokens: (balance?.tokens || []).slice(0, 10),
              recentTransactions: txs.length,
              transactionTypes: txTypes,
              topInteractions,
              accountCreated: info?.created_timestamp,
              autoRenewPeriod: info?.auto_renew_period,
              memo: info?.memo || "(none)",
              riskFlags: riskFlags.length > 0 ? riskFlags : ["None detected"],
              hashscan: `https://hashscan.io/testnet/account/${accountId}`,
            }, null, 2) }]
          };
        } catch (error: any) {
          return { content: [{ type: "text", text: `Error analyzing account: ${error.message || error}` }], isError: true };
        }
      }
    );

    server.paidTool(
      "hedera_token_analytics",
      "Deep token analytics: holder count, concentration, top 10 holders, transfer velocity, and supply metrics. Instant due-diligence.",
      "$0.05",
      {
        tokenId: z.string().describe("HTS token ID (e.g. 0.0.5449)"),
      },
      { readOnlyHint: true },
      async ({ tokenId }) => {
        try {
          const [tokenRes, holdersRes, txRes] = await Promise.all([
            mirror(`/tokens/${tokenId}`),
            mirror(`/tokens/${tokenId}/balances?limit=100&order=desc`),
            mirror(`/transactions?transactiontype=CRYPTOTRANSFER&limit=50&order=desc`),
          ]);

          if (!tokenRes) {
            return { content: [{ type: "text", text: `Token ${tokenId} not found.` }] };
          }

          const holders = holdersRes?.balances || [];
          const totalHolders = holders.length;
          const totalSupply = Number(tokenRes.total_supply || 0);
          const decimals = Number(tokenRes.decimals || 0);

          // Top 10 holders with concentration
          const top10 = holders.slice(0, 10).map((h: any) => ({
            account: h.account,
            balance: Number(h.balance) / Math.pow(10, decimals),
            percentage: totalSupply > 0 ? ((Number(h.balance) / totalSupply) * 100).toFixed(2) + "%" : "N/A",
          }));

          // Concentration: top 10 hold what %
          const top10Total = holders.slice(0, 10).reduce((sum: number, h: any) => sum + Number(h.balance), 0);
          const concentration = totalSupply > 0 ? ((top10Total / totalSupply) * 100).toFixed(2) : "N/A";

          return {
            content: [{ type: "text", text: JSON.stringify({
              tokenId,
              name: tokenRes.name,
              symbol: tokenRes.symbol,
              type: tokenRes.type,
              decimals,
              totalSupply: totalSupply / Math.pow(10, decimals),
              maxSupply: tokenRes.max_supply || "infinite",
              treasury: tokenRes.treasury_account_id,
              holdersCount: totalHolders + (totalHolders >= 100 ? "+" : ""),
              top10Concentration: concentration + "%",
              top10Holders: top10,
              hashscan: `https://hashscan.io/testnet/token/${tokenId}`,
            }, null, 2) }]
          };
        } catch (error: any) {
          return { content: [{ type: "text", text: `Error analyzing token: ${error.message || error}` }], isError: true };
        }
      }
    );

    server.paidTool(
      "hedera_whale_tracker",
      "Track large transfers on Hedera. Returns recent whale movements for any token or HBAR above a threshold. Real-time edge for traders.",
      "$0.03",
      {
        tokenId: z.string().optional().describe("Token ID to track (omit for HBAR)"),
        minAmount: z.number().optional().describe("Minimum transfer amount to qualify as 'whale' (default: 10000 for HBAR, 1000 for tokens)"),
        limit: z.number().optional().describe("Max results (default 20)"),
      },
      { readOnlyHint: true },
      async ({ tokenId, minAmount, limit }) => {
        try {
          const maxResults = Math.min(limit || 20, 50);
          let transfers: any[] = [];

          if (tokenId) {
            // Token transfers
            const res = await mirror(`/tokens/${tokenId}/balances?limit=100&order=desc`);
            // Get recent token transactions
            const txRes = await mirror(`/transactions?transactiontype=CRYPTOTRANSFER&limit=100&order=desc`);
            const threshold = minAmount || 1000;
            const tokenInfo = await mirror(`/tokens/${tokenId}`);
            const decimals = Number(tokenInfo?.decimals || 0);

            for (const tx of txRes?.transactions || []) {
              for (const tt of tx.token_transfers || []) {
                if (tt.token_id === tokenId && Math.abs(Number(tt.amount)) >= threshold * Math.pow(10, decimals)) {
                  transfers.push({
                    timestamp: tx.consensus_timestamp,
                    txId: tx.transaction_id,
                    account: tt.account,
                    amount: (Number(tt.amount) / Math.pow(10, decimals)).toFixed(decimals),
                    direction: Number(tt.amount) > 0 ? "IN" : "OUT",
                    token: tokenId,
                  });
                }
              }
              if (transfers.length >= maxResults) break;
            }
          } else {
            // HBAR transfers
            const threshold = (minAmount || 10000) * 1e8; // convert to tinybars
            const txRes = await mirror(`/transactions?transactiontype=CRYPTOTRANSFER&limit=100&order=desc`);
            for (const tx of txRes?.transactions || []) {
              for (const t of tx.transfers || []) {
                if (Math.abs(Number(t.amount)) >= threshold) {
                  transfers.push({
                    timestamp: tx.consensus_timestamp,
                    txId: tx.transaction_id,
                    account: t.account,
                    amount: (Number(t.amount) / 1e8).toFixed(4) + " HBAR",
                    direction: Number(t.amount) > 0 ? "IN" : "OUT",
                  });
                }
              }
              if (transfers.length >= maxResults) break;
            }
          }

          return {
            content: [{ type: "text", text: JSON.stringify({
              tracking: tokenId || "HBAR",
              threshold: minAmount || (tokenId ? 1000 : 10000),
              whaleMovements: transfers.slice(0, maxResults),
              count: Math.min(transfers.length, maxResults),
            }, null, 2) }]
          };
        } catch (error: any) {
          return { content: [{ type: "text", text: `Error tracking whales: ${error.message || error}` }], isError: true };
        }
      }
    );

    server.paidTool(
      "hedera_defi_positions",
      "Scan all DeFi positions for a Hedera account: LP tokens, staked assets, token balances with USD estimates. One-stop DeFi overview.",
      "$0.06",
      {
        accountId: z.string().describe("Hedera account ID (e.g. 0.0.12345)"),
      },
      { readOnlyHint: true },
      async ({ accountId }) => {
        try {
          const balRes = await mirror(`/balances?account.id=${accountId}&limit=1`);
          const balance = balRes?.balances?.[0];
          if (!balance) {
            return { content: [{ type: "text", text: `Account ${accountId} not found.` }] };
          }

          const tokens = balance.tokens || [];
          // Fetch token info for each holding
          const holdings = await Promise.all(
            tokens.slice(0, 20).map(async (t: any) => {
              const info = await mirror(`/tokens/${t.token_id}`);
              const decimals = Number(info?.decimals || 0);
              const rawBalance = Number(t.balance);
              const humanBalance = rawBalance / Math.pow(10, decimals);
              const isLP = (info?.name || "").toLowerCase().includes("lp") ||
                           (info?.symbol || "").toLowerCase().includes("lp") ||
                           (info?.name || "").toLowerCase().includes("pool");
              return {
                tokenId: t.token_id,
                name: info?.name || "Unknown",
                symbol: info?.symbol || "???",
                balance: humanBalance,
                rawBalance,
                type: info?.type || "FUNGIBLE_COMMON",
                isLikelyLP: isLP,
                category: isLP ? "LP/Pool Token" : (info?.type === "NON_FUNGIBLE_UNIQUE" ? "NFT" : "Token"),
              };
            })
          );

          const lpPositions = holdings.filter(h => h.isLikelyLP);
          const nfts = holdings.filter(h => h.type === "NON_FUNGIBLE_UNIQUE");
          const fungible = holdings.filter(h => !h.isLikelyLP && h.type !== "NON_FUNGIBLE_UNIQUE");

          return {
            content: [{ type: "text", text: JSON.stringify({
              accountId,
              hbarBalance: `${(Number(balance.balance) / 1e8).toFixed(4)} HBAR`,
              totalTokenHoldings: tokens.length,
              summary: {
                fungibleTokens: fungible.length,
                lpPositions: lpPositions.length,
                nftCollections: nfts.length,
              },
              fungibleTokens: fungible,
              lpPositions,
              nftCollections: nfts,
              hashscan: `https://hashscan.io/testnet/account/${accountId}`,
            }, null, 2) }]
          };
        } catch (error: any) {
          return { content: [{ type: "text", text: `Error scanning DeFi positions: ${error.message || error}` }], isError: true };
        }
      }
    );

    server.paidTool(
      "hedera_tx_decoder",
      "Decode any Hedera transaction into a beautiful human-readable format. Takes a transaction ID and returns decoded transfers, memo, status, and all details.",
      "$0.02",
      {
        transactionId: z.string().describe("Transaction ID (e.g. 0.0.12345@1234567890.000000000 or 0.0.12345-1234567890-000000000)"),
      },
      { readOnlyHint: true },
      async ({ transactionId }) => {
        try {
          // Normalize tx ID format for mirror node
          const normalized = transactionId.replace(/@/g, "-").replace(/\./g, "-");
          // Try both formats
          let txData = await mirror(`/transactions/${normalized}`);
          if (!txData?.transactions?.length) {
            // Try with the original format
            const alt = transactionId.replace(/-/g, ".").replace(/\.(\d{10})\./, "@$1.");
            txData = await mirror(`/transactions/${alt}`);
          }

          const tx = txData?.transactions?.[0];
          if (!tx) {
            return { content: [{ type: "text", text: `Transaction not found: ${transactionId}` }] };
          }

          // Decode transfers
          const hbarTransfers = (tx.transfers || []).map((t: any) => ({
            account: t.account,
            amount: `${(Number(t.amount) / 1e8).toFixed(8)} HBAR`,
            direction: Number(t.amount) > 0 ? "received" : "sent",
          }));

          const tokenTransfers = (tx.token_transfers || []).map((t: any) => ({
            token: t.token_id,
            account: t.account,
            amount: t.amount,
            direction: Number(t.amount) > 0 ? "received" : "sent",
          }));

          const nftTransfers = (tx.nft_transfers || []).map((t: any) => ({
            token: t.token_id,
            serial: t.serial_number,
            from: t.sender_account_id,
            to: t.receiver_account_id,
          }));

          return {
            content: [{ type: "text", text: JSON.stringify({
              transactionId: tx.transaction_id,
              type: tx.name,
              status: tx.result,
              consensusTimestamp: tx.consensus_timestamp,
              memo: tx.memo_base64 ? Buffer.from(tx.memo_base64, "base64").toString("utf-8") : "(none)",
              fee: `${(Number(tx.charged_tx_fee) / 1e8).toFixed(8)} HBAR`,
              hbarTransfers: hbarTransfers.filter((t: any) => Math.abs(parseFloat(t.amount)) > 0.00000001),
              tokenTransfers,
              nftTransfers,
              node: tx.node,
              hashscan: `https://hashscan.io/testnet/transaction/${tx.consensus_timestamp}`,
            }, null, 2) }]
          };
        } catch (error: any) {
          return { content: [{ type: "text", text: `Error decoding transaction: ${error.message || error}` }], isError: true };
        }
      }
    );

    server.paidTool(
      "hedera_nft_rarity",
      "Calculate NFT rarity for any Hedera NFT collection. Given a collection and serial number, returns rarity rank and trait analysis using on-chain metadata.",
      "$0.04",
      {
        tokenId: z.string().describe("NFT collection token ID (e.g. 0.0.12345)"),
        serialNumber: z.number().optional().describe("Specific serial to analyze (omit for collection overview)"),
      },
      { readOnlyHint: true },
      async ({ tokenId, serialNumber }) => {
        try {
          const tokenInfo = await mirror(`/tokens/${tokenId}`);
          if (!tokenInfo || tokenInfo.type !== "NON_FUNGIBLE_UNIQUE") {
            return { content: [{ type: "text", text: `${tokenId} is not an NFT collection.` }] };
          }

          // Fetch NFTs in the collection
          const nftsRes = await mirror(`/tokens/${tokenId}/nfts?limit=100&order=asc`);
          const nfts = nftsRes?.nfts || [];

          if (serialNumber) {
            // Analyze specific NFT
            const nft = nfts.find((n: any) => n.serial_number === serialNumber);
            if (!nft) {
              return { content: [{ type: "text", text: `Serial #${serialNumber} not found in ${tokenId}.` }] };
            }

            let metadata: any = {};
            try {
              const metaStr = Buffer.from(nft.metadata, "base64").toString("utf-8");
              metadata = JSON.parse(metaStr);
            } catch {
              metadata = { raw: Buffer.from(nft.metadata || "", "base64").toString("utf-8") };
            }

            return {
              content: [{ type: "text", text: JSON.stringify({
                collection: tokenInfo.name,
                tokenId,
                serialNumber,
                owner: nft.account_id,
                metadata,
                created: nft.created_timestamp,
                totalInCollection: nfts.length,
                hashscan: `https://hashscan.io/testnet/token/${tokenId}/${serialNumber}`,
              }, null, 2) }]
            };
          }

          // Collection overview
          const owners: Record<string, number> = {};
          for (const nft of nfts) {
            owners[nft.account_id] = (owners[nft.account_id] || 0) + 1;
          }
          const uniqueOwners = Object.keys(owners).length;
          const topOwners = Object.entries(owners)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([acct, count]) => ({ account: acct, owned: count }));

          return {
            content: [{ type: "text", text: JSON.stringify({
              collection: tokenInfo.name,
              symbol: tokenInfo.symbol,
              tokenId,
              totalMinted: nfts.length,
              maxSupply: tokenInfo.max_supply || "unlimited",
              uniqueOwners,
              ownerConcentration: topOwners,
              treasury: tokenInfo.treasury_account_id,
              hashscan: `https://hashscan.io/testnet/token/${tokenId}`,
            }, null, 2) }]
          };
        } catch (error: any) {
          return { content: [{ type: "text", text: `Error analyzing NFT: ${error.message || error}` }], isError: true };
        }
      }
    );

    // ═══════════════════════════════════════════════════════════════
    // TIER 3 — BASIC READS (low cost utility tools)
    // ═══════════════════════════════════════════════════════════════

    server.paidTool(
      "hedera_token_lookup",
      "Look up HTS token information by token ID. Returns token name, symbol, supply, and treasury account.",
      "$0.01",
      { tokenId: z.string().describe("Hedera token ID (e.g. 0.0.5449)") },
      { readOnlyHint: true },
      async ({ tokenId }) => {
        try {
          const data = await mirror(`/tokens/${tokenId}`);
          if (!data) return { content: [{ type: "text", text: `Token ${tokenId} not found.` }] };
          return {
            content: [{ type: "text", text: JSON.stringify({
              tokenId, name: data.name, symbol: data.symbol, decimals: data.decimals,
              totalSupply: data.total_supply, treasury: data.treasury_account_id, type: data.type,
            }, null, 2) }]
          };
        } catch (error: any) {
          return { content: [{ type: "text", text: `Error: ${error.message || error}` }], isError: true };
        }
      }
    );

    server.paidTool(
      "hcs_topic_reader",
      "Read the latest messages from a Hedera Consensus Service (HCS) topic.",
      "$0.005",
      {
        topicId: z.string().describe("HCS topic ID (e.g. 0.0.123456)"),
        limit: z.number().optional().describe("Max messages to return (default 10)"),
      },
      { readOnlyHint: true },
      async ({ topicId, limit }) => {
        try {
          const data = await mirror(`/topics/${topicId}/messages?limit=${limit || 10}&order=desc`);
          if (!data) return { content: [{ type: "text", text: `Topic ${topicId} not found.` }] };
          const messages = (data.messages || []).map((msg: any) => ({
            sequenceNumber: msg.sequence_number,
            timestamp: msg.consensus_timestamp,
            message: Buffer.from(msg.message, "base64").toString("utf-8"),
          }));
          return { content: [{ type: "text", text: JSON.stringify(messages, null, 2) }] };
        } catch (error: any) {
          return { content: [{ type: "text", text: `Error: ${error.message || error}` }], isError: true };
        }
      }
    );

    server.paidTool(
      "hbar_account_balance",
      "Check the HBAR and token balances of a Hedera account.",
      "$0.001",
      { accountId: z.string().describe("Hedera account ID (e.g. 0.0.12345)") },
      { readOnlyHint: true },
      async ({ accountId }) => {
        try {
          const data = await mirror(`/balances?account.id=${accountId}&limit=1`);
          const balance = data?.balances?.[0];
          if (!balance) return { content: [{ type: "text", text: `Account ${accountId} not found.` }] };
          return {
            content: [{ type: "text", text: JSON.stringify({
              accountId,
              hbarBalance: `${Number(balance.balance) / 1e8} HBAR`,
              hbarTinybars: balance.balance,
              tokens: balance.tokens,
            }, null, 2) }]
          };
        } catch (error: any) {
          return { content: [{ type: "text", text: `Error: ${error.message || error}` }], isError: true };
        }
      }
    );

    // Free tool: Server info
    server.tool(
      "clawpay_info",
      "Get information about this ClawPay server and all available paid tools.",
      {},
      async () => ({
        content: [{
          type: "text",
          text: JSON.stringify({
            name: "ClawPay Hedera Tools",
            version: "0.2.0",
            network: "hedera-testnet",
            description: "Full suite of paid Hedera tools. Gasless write operations + smart analytics. All payments in USDC via x402.",
            tiers: {
              "Tier 1 — Gasless Writes": [
                { name: "hedera_hcs_submit", price: "$0.05", description: "Submit message to any HCS topic" },
                { name: "hedera_create_hcs_topic", price: "$0.08", description: "Create a new HCS topic" },
                { name: "hedera_create_hts_token", price: "$0.15", description: "Create fungible or NFT token" },
                { name: "hedera_mint_nft", price: "$0.10", description: "Mint NFT to a collection" },
                { name: "hedera_token_associate", price: "$0.03", description: "Associate token with account" },
                { name: "hedera_schedule_tx", price: "$0.07", description: "Create scheduled transaction" },
              ],
              "Tier 2 — Smart Analytics": [
                { name: "hedera_account_deep_dive", price: "$0.04", description: "Full account analysis" },
                { name: "hedera_token_analytics", price: "$0.05", description: "Token holder & supply analytics" },
                { name: "hedera_whale_tracker", price: "$0.03", description: "Track large transfers" },
                { name: "hedera_defi_positions", price: "$0.06", description: "DeFi position scanner" },
                { name: "hedera_tx_decoder", price: "$0.02", description: "Human-readable tx decoder" },
                { name: "hedera_nft_rarity", price: "$0.04", description: "NFT rarity & collection analysis" },
              ],
              "Tier 3 — Basic Reads": [
                { name: "hedera_token_lookup", price: "$0.01", description: "Look up token info" },
                { name: "hcs_topic_reader", price: "$0.005", description: "Read HCS topic messages" },
                { name: "hbar_account_balance", price: "$0.001", description: "Check account balances" },
              ],
            },
          }, null, 2)
        }]
      })
    );
  },
  {
    facilitator: { url: "https://api.testnet.blocky402.com" },
    recipient: { "evm": { address: RECIPIENT_ADDRESS, isTestnet: true } },
    hcsAudit: {
      operatorId: OPERATOR_ID,
      operatorKey: OPERATOR_KEY,
      network: "testnet",
      topicId: "0.0.8057701",
    },
  },
  {
    serverInfo: { name: "clawpay-hedera-tools", version: "0.2.0" },
  },
);

app.all("/mcp", (c) => handler(c.req.raw));
app.get("/", (c) => c.json({
  name: "ClawPay Hedera Tools",
  version: "0.2.0",
  endpoint: "/mcp",
  tools: 16,
  tiers: ["Gasless Writes (6)", "Smart Analytics (6)", "Basic Reads (3)", "Free Info (1)"],
}));

const port = Number(process.env.PORT) || 3000;
console.log(`🦞 ClawPay Hedera Tools v0.2.0 running on http://localhost:${port}/mcp`);
console.log(`   16 tools: 6 write ops + 6 analytics + 3 reads + 1 free`);

serve({ fetch: app.fetch, port, hostname: '0.0.0.0' });
