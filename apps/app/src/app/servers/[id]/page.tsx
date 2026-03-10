import { Metadata } from "next"
import { notFound } from "next/navigation"
import { mcpDataApi } from "@/lib/client/utils"
import { ServerPageClient } from "@/components/custom-ui/server-page-client"

type ServerDetail = {
  serverId: string
  origin: string
  originRaw?: string
  status?: string
  moderationStatus?: 'pending' | 'approved' | 'rejected' | 'disabled' | 'flagged'
  qualityScore?: number
  lastSeenAt?: string
  indexedAt?: string
  info: { name?: string; description?: string; icon?: string }
  tools: Array<Record<string, unknown>>
  summary: { lastActivity?: string; totalTools: number; totalRequests: number; totalPayments: number }
  dailyAnalytics: Array<{ date: string; totalRequests: number }>
  recentPayments: Array<{ 
    id: string; 
    createdAt: string; 
    status: 'completed' | 'failed'; 
    network?: string; 
    transactionHash?: string;
    amountFormatted?: string;
    currency?: string;
    vlayerProof?: {
      success: boolean;
      version?: string;
      notaryUrl?: string;
      valid: boolean;
      generatedAt?: string;
    };
  }>
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  try {
    const { id } = await params;
    const data = await mcpDataApi.getServerById(id)
    
    const name = data?.info?.name || data?.origin || id || "Server"
    const description = data?.info?.description || `MCP server with ${data?.summary?.totalTools || 0} tools`
    
    return {
      title: `${name} — ClawPay`,
      description,
      openGraph: {
        title: `${name} — ClawPay`,
        description,
        type: "website",
        images: [
          {
            url: `/api/og/server/${id}`,
            width: 1200,
            height: 630,
            alt: `${name} — ClawPay`,
          }
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: `${name} — ClawPay`,
        description,
        images: [`/api/og/server/${id}`],
      },
    }
  } catch (error) {
    const { id } = await params;
    return {
      title: `Server ${id} — ClawPay`,
      description: "MCP server on ClawPay",
      openGraph: {
        title: `Server ${id} — ClawPay`,
        description: "MCP server on ClawPay",
        type: "website",
        images: [
          {
            url: `/api/og/server/${id}`,
            width: 1200,
            height: 630,
            alt: `Server ${id} — ClawPay`,
          }
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: `Server ${id} — ClawPay`,
        description: "MCP server on ClawPay",
        images: [`/api/og/server/${id}`],
      },
    }
  }
}

export default async function ServerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let data: ServerDetail | null = null
  
  try {
    data = await mcpDataApi.getServerById(id) as ServerDetail
  } catch (error) {
    // If server not found, return 404
    notFound()
  }

  return <ServerPageClient serverId={id} initialData={data} />
}