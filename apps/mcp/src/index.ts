import { serve } from "@hono/node-server";
import { oAuthDiscoveryMetadata, oAuthProtectedResourceMetadata, withMcpAuth } from "better-auth/plugins";
import dotenv from "dotenv";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { LoggingHook, withProxy, createMcpHandler, Hook } from "@clawpay-hedera/sdk/handler";
import { AnalyticsHook } from "@clawpay-hedera/sdk/handler";
import { HCSAuditHook } from "@clawpay-hedera/sdk/handler";
import { z } from "zod";
import env, { getPort, getTrustedOrigins, isDevelopment } from "./env.js";
import { auth, db } from "./lib/auth.js";
import { SecurityHook } from "./lib/proxy/hooks/security-hook.js";
import { X402WalletHook } from "./lib/proxy/hooks/x402-wallet-hook.js";
import { VLayerHook } from "./lib/proxy/hooks/vlayer-hook.js";
import { CONNECT_HTML } from "./ui/connect.js";
import { USER_HTML } from "./ui/user.js";
import { analyticsSink } from "./lib/analytics/index.js";
import { encryptKey, decryptKey } from "./lib/crypto.js";
import { userWallets } from "../auth-schema.js";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "node:crypto";

dotenv.config();

// ═══════════════════════════════════════════════════════════════════════
// PLATFORM-LEVEL HCS AUDIT — logs ALL payments flowing through the proxy
// Single ClawPay-owned topic = global audit trail for every server
// ═══════════════════════════════════════════════════════════════════════
const PLATFORM_HCS_OPERATOR_ID = process.env.HEDERA_OPERATOR_ID || "0.0.6514537";
const PLATFORM_HCS_OPERATOR_KEY = process.env.HEDERA_OPERATOR_KEY || "92a9952290387a03bbaa8756366321def94240c1f9a1b0f40ce6606418ee57e2";

const platformHcsHook = new HCSAuditHook({
  operatorId: PLATFORM_HCS_OPERATOR_ID,
  operatorKey: PLATFORM_HCS_OPERATOR_KEY,
  network: "testnet",
  topicId: "0.0.8058213",
});

const TRUSTED_ORIGINS = getTrustedOrigins();
const isDev = isDevelopment();
const DEFAULT_DEV_ORIGINS = [
    "http://localhost:*",
    "http://127.0.0.1:3000",
    "http://localhost:3050",
    "http://127.0.0.1:3050",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:6274"
];
const ALLOWED_ORIGINS = new Set([
    ...(isDev ? DEFAULT_DEV_ORIGINS : []),
    ...TRUSTED_ORIGINS,
]);

const app = new Hono();

app.use("*", cors({
    allowHeaders: [
        "Origin", 
        "Content-Type", 
        "Authorization", 
        "WWW-Authenticate", 
        "x-api-key",
        "X-Wallet-Type",
        "X-Wallet-Address", 
        "X-Wallet-Provider",
        "x-vlayer-enabled",
        "x-clawpay-target-url"
    ],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    origin: (origin) => {
        if (!origin) return "";
        if (ALLOWED_ORIGINS.has(origin)) return origin;
        if (isDev) {
            try {
                const url = new URL(origin);
                if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
                    return origin;
                }
            } catch { }
        }
        return "";
    },
    exposeHeaders: ["WWW-Authenticate"],
}))

// // 1. CORS for all routes (including preflight)
// app.use("*", cors({
// //   origin: (origin) => {
// //     if (!origin) return "";

// //     if (TRUSTED_ORIGINS?.includes(origin)) {
// //       return origin;
// //     }
// //     return "";
// //   },
// origin: "*",
//   allowMethods: ["GET", "POST", "OPTIONS"],
//   allowHeaders: ["Content-Type", "Authorization"],
//   credentials: true,
// }));

// 2. Handle OPTIONS explicitly on auth route (preflight)
app.options("/api/auth/*", (c) => {
    // The cors middleware should already have set the headers
    return c.body(null, 204);
});

// 3. Mount Better Auth for all GET/POST on /api/auth/*
app.on(["GET", "POST"], "/api/auth/*", (c) => {
    return auth.handler(c.req.raw);
});

// 4. (Optional) additional non-auth routes
app.get("/api/me", async (c) => {
    // If you want to inspect session, use auth.api.getSession etc.
    const session = await auth.api.getSession({
        headers: c.req.raw.headers,
    });
    if (!session) {
        return c.json({ user: null }, 401);
    }
    return c.json({ user: session.user });
});

app.get("/health", (c) => {
    return c.json({ status: "ok" });
});


// Onramp - preflight
app.options("/api/onramp/*", (c) => {
    return c.body(null, 204);
});

// Onramp - generate Hedera funding links (Banxa for mainnet, Faucet for testnet)
app.post("/api/onramp/url", async (c) => {
    try {
        const session = await auth.api.getSession({ headers: c.req.raw.headers });
        if (!session) return c.json({ error: "Unauthorized" }, 401);

        type OnrampUrlBody = {
            walletAddress: string;
            network?: string;
        };

        const body = (await c.req.json().catch(() => ({}))) as Partial<OnrampUrlBody>;
        const walletAddress = typeof body.walletAddress === "string" ? body.walletAddress.trim() : "";
        if (!walletAddress) {
            return c.json({ error: "Missing walletAddress" }, 400);
        }

        const network = typeof body.network === "string" ? body.network : "hedera-testnet";
        const isTestnet = network.includes("testnet");

        if (isTestnet) {
            return c.json({
                faucetUrl: "https://portal.hedera.com/faucet",
                swapUrl: "https://testnet.saucerswap.finance/swap/HBAR/0.0.5449",
                network: "hedera-testnet",
                steps: [
                    "Get free testnet HBAR from the Hedera Faucet",
                    "Swap HBAR → USDC on SaucerSwap (testnet)",
                ],
            });
        }

        // Mainnet: Banxa + SaucerSwap
        const banxaParams = new URLSearchParams({
            coinType: "HBAR",
            fiatType: "USD",
            fiatAmount: "20",
            blockchain: "HBAR",
            walletAddress,
        });
        return c.json({
            banxaUrl: `https://banxa.com/?${banxaParams.toString()}`,
            swapUrl: "https://app.saucerswap.finance/swap/HBAR/0.0.5449",
            network: "hedera",
            steps: [
                "Buy HBAR with credit/debit card via Banxa",
                "Swap HBAR → USDC on SaucerSwap",
            ],
        });
    } catch (error) {
        return c.json({ error: (error as Error).message }, 400);
    }
});

// Wallets - handle preflight
app.options("/api/wallets", (c) => {
    return c.body(null, 204);
});

// Wallets - list current user's wallets
app.get("/api/wallets", async (c) => {
    try {
        const session = await auth.api.getSession({ headers: c.req.raw.headers });
        if (!session) return c.json({ error: "Unauthorized" }, 401);

        const includeInactive = c.req.query("includeInactive") === "true";

        const wallets = await db.query.userWallets.findMany({
            where: (t, { and, eq }) => {
                const conditions = [eq(t.userId, session.user.id)];
                if (!includeInactive) {
                    conditions.push(eq(t.isActive, true));
                }
                return and(...conditions);
            },
            orderBy: (t, { desc }) => [desc(t.isPrimary), desc(t.createdAt)],
        });

        return c.json(wallets);
    } catch (error) {
        return c.json({ error: (error as Error).message }, 400);
    }
});

// API Keys - handle preflight
app.options("/api/keys/*", (c) => {
    return c.body(null, 204);
});

// API Keys - list current user's keys
app.get("/api/keys", async (c) => {
    try {
        const session = await auth.api.getSession({ headers: c.req.raw.headers });
        if (!session) return c.json({ error: "Unauthorized" }, 401);

        const keys = await auth.api.listApiKeys({ headers: c.req.raw.headers });
        return c.json(keys);
    } catch (error) {
        return c.json({ error: (error as Error).message }, 400);
    }
});

// API Keys - create new key for current user
app.post("/api/keys", async (c) => {
    try {
        const session = await auth.api.getSession({ headers: c.req.raw.headers });
        if (!session) return c.json({ error: "Unauthorized" }, 401);

        const body = await c.req.json().catch(() => ({} as any)) as any;

        const expiresIn = typeof body.expiresIn === "number"
            ? body.expiresIn
            : (typeof body.expiresInDays === "number" ? Math.floor(body.expiresInDays * 86400) : undefined);

        const payload: any = {
            userId: session.user.id,
            name: body.name,
            prefix: body.prefix,
            remaining: body.remaining,
            metadata: body.metadata,
            permissions: body.permissions,
            expiresIn,
            rateLimitEnabled: body.rateLimitEnabled,
            rateLimitTimeWindow: body.rateLimitTimeWindow,
            rateLimitMax: body.rateLimitMax,
        };

        const created = await auth.api.createApiKey({ body: payload, headers: c.req.raw.headers });
        return c.json(created, 201);
    } catch (error) {
        return c.json({ error: (error as Error).message }, 400);
    }
});

// API Keys - get by id (without returning secret key)
app.get("/api/keys/:id", async (c) => {
    try {
        const session = await auth.api.getSession({ headers: c.req.raw.headers });
        if (!session) return c.json({ error: "Unauthorized" }, 401);

        const id = c.req.param("id");
        const data = await auth.api.getApiKey({ query: { id }, headers: c.req.raw.headers });
        return c.json(data);
    } catch (error) {
        return c.json({ error: (error as Error).message }, 400);
    }
});

// API Keys - update by id
app.put("/api/keys/:id", async (c) => {
    try {
        const session = await auth.api.getSession({ headers: c.req.raw.headers });
        if (!session) return c.json({ error: "Unauthorized" }, 401);

        const id = c.req.param("id");
        const body = await c.req.json().catch(() => ({} as any)) as any;

        const payload: any = {
            keyId: id,
            userId: session.user.id,
            name: body.name,
            enabled: body.enabled,
            remaining: body.remaining,
            refillAmount: body.refillAmount,
            refillInterval: body.refillInterval,
            metadata: body.metadata,
            permissions: body.permissions,
        };

        const updated = await auth.api.updateApiKey({ body: payload, headers: c.req.raw.headers });
        return c.json(updated);
    } catch (error) {
        return c.json({ error: (error as Error).message }, 400);
    }
});

// API Keys - delete by id
app.delete("/api/keys/:id", async (c) => {
    try {
        const session = await auth.api.getSession({ headers: c.req.raw.headers });
        if (!session) return c.json({ error: "Unauthorized" }, 401);

        const id = c.req.param("id");
        const result = await auth.api.deleteApiKey({ body: { keyId: id }, headers: c.req.raw.headers });
        return c.json(result);
    } catch (error) {
        return c.json({ error: (error as Error).message }, 400);
    }
});

// API Keys - verify a presented key
app.post("/api/keys/verify", async (c) => {
    try {
        const body = await c.req.json().catch(() => ({} as any)) as any;
        if (!body.key || typeof body.key !== "string") {
            return c.json({ error: "Missing 'key' in body" }, 400);
        }

        const result = await auth.api.verifyApiKey({ body: { key: body.key, permissions: body.permissions } });
        return c.json(result);
    } catch (error) {
        return c.json({ error: (error as Error).message }, 400);
    }
});

// ═══════════════════════════════════════════════════════════════════════
// HEDERA WALLET — Link wallet + store encrypted private key
// ═══════════════════════════════════════════════════════════════════════

app.options("/api/wallets/hedera", (c) => c.body(null, 204));

// Link a Hedera wallet (MetaMask address + encrypted private key)
app.post("/api/wallets/hedera", async (c) => {
  try {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req.json().catch(() => ({})) as {
      walletAddress?: string;
      hederaAccountId?: string;
      privateKey?: string;
      network?: string;
    };

    const walletAddress = (body.walletAddress || "").trim();
    const hederaAccountId = (body.hederaAccountId || "").trim();
    const privateKey = (body.privateKey || "").trim();
    const network = (body.network || "hedera-testnet").trim();

    if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return c.json({ error: "Invalid EVM wallet address" }, 400);
    }
    if (!hederaAccountId || !/^0\.0\.\d+$/.test(hederaAccountId)) {
      return c.json({ error: "Invalid Hedera account ID (expected 0.0.xxxxx)" }, 400);
    }
    if (!privateKey || privateKey.length < 60) {
      return c.json({ error: "Invalid private key" }, 400);
    }

    // Encrypt the private key
    const { encrypted, iv, tag } = encryptKey(privateKey);

    // Check if wallet already exists for this user
    const existing = await db.query.userWallets.findFirst({
      where: (t, { and, eq }) => and(
        eq(t.userId, session.user.id),
        eq(t.walletAddress, walletAddress.toLowerCase()),
        eq(t.isActive, true),
      ),
    });

    if (existing) {
      // Update existing wallet with new key
      await db.update(userWallets)
        .set({
          walletMetadata: {
            hederaAccountId,
            network,
            encryptedKey: encrypted,
            iv,
            tag,
            keyStoredAt: new Date().toISOString(),
          },
          updatedAt: new Date(),
        })
        .where(eq(userWallets.id, existing.id));

      return c.json({ ok: true, walletId: existing.id, updated: true });
    }

    // Unset any existing primary wallets
    await db.update(userWallets)
      .set({ isPrimary: false })
      .where(and(
        eq(userWallets.userId, session.user.id),
        eq(userWallets.isPrimary, true),
      ));

    // Create new wallet
    const walletId = randomUUID();
    await db.insert(userWallets).values({
      id: walletId,
      userId: session.user.id,
      walletAddress: walletAddress.toLowerCase(),
      walletType: "external",
      provider: "metamask",
      blockchain: network.includes("testnet") ? "hedera-testnet" : "hedera",
      architecture: "evm",
      isPrimary: true,
      isActive: true,
      walletMetadata: {
        hederaAccountId,
        network,
        encryptedKey: encrypted,
        iv,
        tag,
        keyStoredAt: new Date().toISOString(),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return c.json({ ok: true, walletId, updated: false }, 201);
  } catch (error) {
    console.error("[Hedera Wallet] Error:", error);
    return c.json({ error: (error as Error).message }, 400);
  }
});

// Get the decrypted Hedera key for a user (internal use only — called by signing strategy)
// This is NOT exposed publicly — only used server-side
app.get("/api/wallets/hedera/key", async (c) => {
  try {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) return c.json({ error: "Unauthorized" }, 401);

    const wallet = await db.query.userWallets.findFirst({
      where: (t, { and, eq }) => and(
        eq(t.userId, session.user.id),
        eq(t.isActive, true),
        eq(t.isPrimary, true),
      ),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    });

    if (!wallet) return c.json({ error: "No Hedera wallet found" }, 404);

    const meta = wallet.walletMetadata as Record<string, string> | null;
    if (!meta?.encryptedKey || !meta?.iv || !meta?.tag) {
      return c.json({ error: "No encrypted key stored for this wallet" }, 404);
    }

    const privateKey = decryptKey(meta.encryptedKey, meta.iv, meta.tag);

    return c.json({
      privateKey,
      hederaAccountId: meta.hederaAccountId,
      network: meta.network,
      walletAddress: wallet.walletAddress,
    });
  } catch (error) {
    console.error("[Hedera Wallet] Key retrieval error:", error);
    return c.json({ error: (error as Error).message }, 400);
  }
});

// Hedera balance — query Mirror Node (no key needed)
app.options("/api/wallets/hedera/balance", (c) => c.body(null, 204));

app.get("/api/wallets/hedera/balance", async (c) => {
  try {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) return c.json({ error: "Unauthorized" }, 401);

    const accountId = c.req.query("accountId")?.trim();
    if (!accountId || !/^0\.0\.\d+$/.test(accountId)) {
      return c.json({ error: "Invalid accountId" }, 400);
    }

    const network = c.req.query("network") || "testnet";
    const mirrorBase = network === "mainnet"
      ? "https://mainnet.mirrornode.hedera.com"
      : "https://testnet.mirrornode.hedera.com";

    const res = await fetch(`${mirrorBase}/api/v1/accounts/${accountId}`);
    if (!res.ok) {
      return c.json({ error: `Mirror Node error: ${res.status}` }, 502);
    }
    const data = await res.json() as Record<string, unknown>;

    // Extract HBAR balance
    const hbarBalance = data.balance as { balance?: number; tokens?: Array<{ token_id: string; balance: number }> } | undefined;
    const hbarTinybar = hbarBalance?.balance || 0;
    const hbarFormatted = (hbarTinybar / 1e8).toFixed(4);

    // Find USDC token balance (testnet: 0.0.429274, mainnet: 0.0.456858)
    const usdcTokenId = network === "mainnet" ? "0.0.456858" : "0.0.429274";
    const tokens = hbarBalance?.tokens || [];
    const usdcToken = tokens.find((t: { token_id: string }) => t.token_id === usdcTokenId);
    const usdcRaw = usdcToken?.balance || 0;
    const usdcFormatted = (usdcRaw / 1e6).toFixed(2);

    return c.json({
      accountId,
      network,
      hbar: { tinybar: hbarTinybar, formatted: hbarFormatted, symbol: "HBAR" },
      usdc: { raw: usdcRaw, formatted: usdcFormatted, symbol: "USDC", tokenId: usdcTokenId },
    });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 400);
  }
});

app.options(".well-known/oauth-authorization-server", (c) => {
    return c.body(null, 204);
});
app.options(".well-known/oauth-protected-resource", (c) => {
    return c.body(null, 204);
});

app.get(".well-known/oauth-authorization-server", async (c) => {
    return await oAuthDiscoveryMetadata(auth)(c.req.raw);
});
app.get(".well-known/oauth-protected-resource", async (c) => {
    return await oAuthProtectedResourceMetadata(auth)(c.req.raw);
});

// Removed custom /callback handler; Better Auth handles provider callbacks at /api/auth/callback/{provider}

app.get("/connect", async (c) => {
    const currentUrl = new URL(c.req.url);
    const continueParam =
        currentUrl.searchParams.get("continue") ||
        currentUrl.searchParams.get("return_to") ||
        currentUrl.searchParams.get("next");

    // If already authenticated, resume the original authorization flow
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (session) {
        if (continueParam) {
            return c.redirect(continueParam);
        }
        // Fallback: if this looks like an OIDC authorize request, forward it to the authorization endpoint
        const hasAuthorizeParams =
            currentUrl.searchParams.has("response_type") &&
            currentUrl.searchParams.has("client_id");
        if (hasAuthorizeParams) {
            const authorizeUrl = new URL("/api/auth/oauth/authorize", `${currentUrl.protocol}//${currentUrl.host}`);
            authorizeUrl.search = currentUrl.search; // preserve original authorize query
            return c.redirect(authorizeUrl.toString());
        }
        return c.redirect("/");
    }

    // Render a minimal page that initiates social sign-in on the client
    return c.html(
        CONNECT_HTML
    );
});

app.get("/", async (c) => {
    return c.html(
        USER_HTML
    );
});

async function resolveTargetUrl(req: Request, absoluteUrl?: string): Promise<string | null> {
    // First, try to get target URL from header or query param (base64-encoded)
    // Use absoluteUrl if provided (from Hono context), otherwise try to construct from req.url
    let url: URL;
    try {
        if (absoluteUrl) {
            url = new URL(absoluteUrl);
        } else {
            // If req.url is relative, we need to construct an absolute URL
            // Try to use req.url directly first
            try {
                url = new URL(req.url);
            } catch {
                // If that fails, try constructing from headers
                const host = req.headers.get("host") || req.headers.get("x-forwarded-host");
                const protocol = req.headers.get("x-forwarded-proto") || "https";
                if (host) {
                    url = new URL(req.url, `${protocol}://${host}`);
                } else {
                    // Fallback: try req.url as-is (might work in some contexts)
                    url = new URL(req.url, "http://localhost");
                }
            }
        }
    } catch (e) {
        // If URL construction fails, return null
        return null;
    }
    
    // Check header first (case-insensitive)
    const headerValue = req.headers.get("x-clawpay-target-url") 
        ?? req.headers.get("X-CLAWPAY-TARGET-URL")
        ?? req.headers.get("X-Clawpay-Target-Url");
    const queryValue = url.searchParams.get("target-url");
    const directUrlEncoded = headerValue ?? queryValue;

    const allTargetHeaders: string[] = [];
    req.headers.forEach((value, key) => {
        if (key.toLowerCase().includes("target")) {
            allTargetHeaders.push(`${key}: ${value.substring(0, 30)}...`);
        }
    });
    console.log("[MCP] resolveTargetUrl - checking:", {
        hasHeader: !!headerValue,
        hasQuery: !!queryValue,
    });

    if (directUrlEncoded) {
        try {
            // The value is base64-encoded, so decode it
            // decodeURIComponent in case it was URL-encoded as well
            const decoded = decodeURIComponent(atob(directUrlEncoded));
            return decoded;
        } catch (e) {
            // If decoding fails, try treating it as already decoded (for backwards compatibility)
            try {
                // Maybe it's already the actual URL?
                new URL(directUrlEncoded);
                console.log("[MCP] Target-url is already a URL (not base64)");
                return directUrlEncoded;
            } catch {
                // If that also fails, log and fall through
                console.log("[MCP] Failed to decode target-url:", e, "Value:", directUrlEncoded?.substring(0, 50));
            }
        }
    }

    return null;
}

app.all("/mcp", async (c) => {

    const currentUrl = new URL(c.req.url);
    const targetUrlParam = currentUrl.searchParams.get("target-url");
    const hasId = !!currentUrl.searchParams.get("id");
    const hasTargetUrlHeader = !!c.req.raw.headers.get("x-clawpay-target-url");
    const shouldProxy = hasId || !!targetUrlParam || hasTargetUrlHeader;
    const original = c.req.raw;
    
    const isTruthyHeader = (value: string | null) => {
        if (!value) return false;
        const v = value.toLowerCase();
        return v === "1" || v === "true" || v === "yes" || v === "on";
    };
    
    // Control flags via headers:
    // - x-mcp-disable-auth: when truthy, bypasses withMcpAuth entirely
    // - x-mcp-disable-x402: when truthy (or auth disabled), omits X402WalletHook
    const disableMcpAuth = isTruthyHeader(original.headers.get("x-mcp-disable-auth"));
    const disableX402 = isTruthyHeader(original.headers.get("x-mcp-disable-x402")) || disableMcpAuth;

    if (shouldProxy) {
        const targetUrl = await resolveTargetUrl(original, c.req.url);
        if (!targetUrl) {
            console.log("[MCP] Failed to resolve target URL. Headers:", {
                "x-clawpay-target-url": original.headers.get("x-clawpay-target-url"),
                "target-url-query": new URL(c.req.url).searchParams.get("target-url"),
            });
            return new Response("target-url missing", { status: 400 });
        }
        
        // Check if vlayer hook should be enabled via header
        const vlayerEnabledHeader = original.headers.get("x-vlayer-enabled");
        const isVlayerEnabled = vlayerEnabledHeader !== null && 
            (vlayerEnabledHeader.toLowerCase() === "true" || 
             vlayerEnabledHeader === "1" || 
             vlayerEnabledHeader.toLowerCase() === "yes");
        
        const withMcpProxy = (session: any) => {
            const hooks: Hook[] = [
                // AnalyticsHook first so it runs LAST in reverse order (after all hooks modify response)
                new AnalyticsHook(analyticsSink, targetUrl),
                new LoggingHook(),
                // Platform-level HCS audit — logs every payment to a single ClawPay topic
                platformHcsHook,
            ];
            if (!disableX402 && session) {
                hooks.push(new X402WalletHook(session));
            }
            hooks.push(new SecurityHook());
            if (isVlayerEnabled) {
                hooks.push(new VLayerHook({ 
                    enabled: isVlayerEnabled, 
                    targetUrl: targetUrl,
                    logProofs: true, 
                    attachToResponse: true,
                    validateProofs: true,
                    includeRequestDetails: true,
                    includeResponseDetails: true,
                    maxProofSize: 4 * 1024 * 1024, // 4MB
                    timeoutMs: 300000, // 5 minutes
                    retryAttempts: 2,
                    excludeDomains: undefined,//['localhost', '127.0.0.1'],
                    headers: [
                        "Accept: application/json, text/event-stream",
                        "Content-Type: application/json"
                    ],
                    vlayerConfig: {
                        apiEndpoint: env.VLAYER_WEB_PROOF_API,
                        clientId: env.VLAYER_CLIENT_ID,
                        bearerToken: env.VLAYER_BEARER_TOKEN,
                    },
                }));
            }
            return withProxy(targetUrl, hooks);
        };
        
        // Extract API key from various sources
        const apiKeyFromQuery = currentUrl.searchParams.get("apiKey") || currentUrl.searchParams.get("api_key");
        // const authHeader = original.headers.get("authorization");
        // const apiKeyFromHeader = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;
        const apiKeyFromXHeader = original.headers.get("x-api-key");
        
        const apiKey = apiKeyFromQuery || apiKeyFromXHeader; //|| apiKeyFromHeader

        let session = null;
        if (apiKey) {
            session = await auth.api.getSession({
                headers: new Headers({
                      'x-api-key': apiKey,
                }),
          });
        }

        if (!session) {
            session = await auth.api.getSession({ headers: original.headers });
        }

        if (session) {
            return withMcpProxy(session.session)(original);
        }

        if (disableMcpAuth) {
            console.log("[MCP] MCP auth disabled via header; proxying without auth");
            return withMcpProxy(null)(original);
        }

        console.log("[MCP] No authenticated session, using withMcpAuth");
        const handler = withMcpAuth(auth, (req, session) => {
            console.log("[MCP] withMcpAuth session:", session?.userId || session);
            return withMcpProxy(session)(req);
        });

        return handler(original);
    }

    const handler = (session: any) => createMcpHandler(async (server) => {
        server.tool(
            "ping",
            "Health check that echoes an optional message",
            { message: z.string().optional() },
            async ({ message }) => {
                return {
                    content: [
                        { type: "text", text: message ? `pong: ${message}` : "pong" },
                    ],
                };
            }
        );

        server.tool(
            "me",
            "Returns the current authenticated user's basic info if available",
            {},
            async (_args, extra) => {

                console.log(original)

                const session = await auth.api.getSession({ headers: original.headers });

                if (!session) {
                    return { content: [{ type: "text", text: "Not authenticated" }] };
                }
                return {
                    content: [
                        { type: "text", text: JSON.stringify({ ...session.user }) },
                    ],
                };
            }
        );

    });

    if (disableMcpAuth) {
        console.log("[MCP] MCP auth disabled via header; serving MCP without auth");
        return handler(null)(c.req.raw);
    }

    return withMcpAuth(auth, (req, session) => handler(session)(req))(c.req.raw);
});

// app.all("/mcp/*", async (c) => {

//     const withMcpProxy = (session: any) => withProxy([
//         new LoggingHook(),
//         new X402WalletHook(session),
//         new SecurityHook(),
//     ]);

//     const session = await auth.api.getSession({ headers: c.req.raw.headers });
    

//     if(session) {
//         return withMcpProxy(session.session)(c.req.raw);
//     }

//     const handler = withMcpAuth(auth, (req, session) => {
//         return withMcpProxy(session)(req);
//     });

//     return handler(c.req.raw);
// });


const port = parseInt(process.env.PORT || '3050', 10);
console.log(`[MCP] Server starting on port http://localhost:${port}`);

serve({
    fetch: app.fetch,
    port: port,
    hostname: '0.0.0.0'
});