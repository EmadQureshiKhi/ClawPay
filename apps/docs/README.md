# ClawPay Docs

Documentation site for ClawPay — built with [Fumadocs](https://fumadocs.dev) + Next.js.

## Pages

| Page | File | What It Covers |
|------|------|----------------|
| Introduction | `content/docs/index.mdx` | What is ClawPay, why Hedera, payment flow diagram |
| Monetize | `content/docs/quickstart/monetize.mdx` | How to add x402 paywalls to your MCP server |
| SDK | `content/docs/quickstart/sdk.mdx` | TypeScript SDK, client wrapper, CLI usage |
| Clients | `content/docs/quickstart/integrate.mdx` | Connect from ChatGPT/Cursor/Claude, API keys |
| Examples | `content/docs/examples.mdx` | Hedera tools server, vlayer client, ChatGPT Apps SDK |
| Facilitator | `content/docs/x402/facilitator.mdx` | Blocky402 facilitator on Hedera |
| vlayer | `content/docs/partners/vlayer.mdx` | zkTLS web proofs integration |
| FAQ | `content/docs/faq.mdx` | Common questions about ClawPay + Hedera |
| About | `content/docs/more-about/index.mdx` | About ClawPay |
| Roadmap | `content/docs/more-about/roadmap.mdx` | What's next |

## Structure

```
apps/docs/
├── app/                  # Next.js App Router
│   ├── layout.tsx        # Root layout (favicon, metadata)
│   └── (docs)/           # Docs layout + catch-all page
├── content/docs/         # MDX content files
├── components/           # LLMCopyButton, UI components
├── lib/
│   ├── source.ts         # Fumadocs content source adapter
│   └── layout.shared.tsx # Nav config (logo, GitHub link)
└── public/               # Static assets (logo, OG image, favicon)
```
