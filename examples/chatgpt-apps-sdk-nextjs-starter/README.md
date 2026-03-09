# ChatGPT Apps SDK — ClawPay Example

A Next.js app demonstrating how to build an [OpenAI Apps SDK](https://developers.openai.com/apps-sdk) compatible MCP server with widget rendering in ChatGPT, integrated with ClawPay for paid tool calls.

## Overview

This example shows how to connect a Next.js MCP server to ChatGPT using the Apps SDK. Tools are exposed via MCP, and ChatGPT renders responses as native widgets (iframes). ClawPay's `createMcpHandler` is used for the server handler.

## Key Components

- `app/mcp/route.ts` — MCP server with tool/resource registration and OpenAI widget metadata
- `middleware.ts` — CORS handling for cross-origin RSC fetching (ChatGPT iframe)
- `next.config.ts` — `assetPrefix` for correct `/_next/` loading inside iframes
- `app/layout.tsx` — `<NextChatSDKBootstrap>` patches browser APIs for iframe compatibility

## Setup

```bash
pnpm install
pnpm dev
```

MCP server available at `http://localhost:3000/mcp`.

## Connecting to ChatGPT

1. Deploy to Vercel
2. In ChatGPT: Settings → Connectors → Create → add your `/mcp` URL
3. Requires developer mode access ([connection guide](https://developers.openai.com/apps-sdk/deploy/connect-chatgpt))

## How It Works

1. ChatGPT calls a tool registered in `app/mcp/route.ts`
2. Tool response includes `templateUri` pointing to a registered resource
3. ChatGPT fetches the resource HTML and renders it in an iframe
4. Next.js hydrates inside the iframe with patched APIs

## Learn More

- [OpenAI Apps SDK Docs](https://developers.openai.com/apps-sdk)
- [MCP Server Guide](https://developers.openai.com/apps-sdk/build/mcp-server)
- [ClawPay GitHub](https://github.com/EmadQureshiKhi/ClawPay)
