"use client"

import Footer from "@/components/custom-ui/footer"
import { mcpDataApi, McpServer } from "@/lib/client/utils"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, LayoutGrid, List, X, Copy, Check } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { useEffect, useMemo, useState, useCallback } from "react"
import { cn } from "@/lib/utils"

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════

type DisplayTool = {
  id: string
  name: string
  category: string
  price: string
  priceUnit: string
  maxRes: string
  maxDur: string
  capabilities: string[]
  description: string
  output: string
  source: "live" | "showcase"
  serverId?: string
  serverOrigin?: string
  network: "Mainnet" | "Testnet"
  logo?: string
}

// Map provider prefix → logo path
const PROVIDER_LOGOS: Record<string, string> = {
  "google": "/logos/providers/google.svg",
  "openai": "/logos/providers/openai.svg",
  "runwayml": "/logos/providers/runway.svg",
  "kwaivgi": "/logos/providers/kling.svg",
  "bytedance": "/logos/providers/bytedance.svg",
  "xai": "/logos/providers/xai.svg",
  "ideogram": "/logos/providers/ideogram.svg",
  "flux": "/logos/providers/flux.svg",
  "nightmareai": "/logos/providers/nightmareai.svg",
  "minimax": "/logos/providers/minimax.svg",
  "qwen": "/logos/providers/qwen.svg",
  "wan-video": "/logos/providers/wan.svg",
  "prunaai": "/logos/providers/prunaai.svg",
  "exa": "/logos/providers/exa.svg",
  "twitter": "/logos/providers/twitter.svg",
  "veed": "/logos/providers/veed.svg",
  "tencent": "/logos/providers/tencent.svg",
  "firtoz": "/logos/providers/firtoz.svg",
}

function getProviderLogo(toolName: string): string {
  const provider = toolName.split("/")[0]
  return PROVIDER_LOGOS[provider] || "/logos/hedera-icon.svg"
}

// ═══════════════════════════════════════════════════════════════════════
// SHOWCASE DATA (static tools for demo — these don't actually run)
// ═══════════════════════════════════════════════════════════════════════

const SHOWCASE_TOOLS: DisplayTool[] = [
  { id:"s-1", name:"google/nano-banana-pro", category:"IMAGE", price:"$0.18", priceUnit:"image", maxRes:"4096x4096", maxDur:"—", capabilities:["text-to-image","image-to-image"], description:"High quality with multi-image input (up to 14), resolution control", output:"IMAGE", source:"showcase", network:"Mainnet" },
  { id:"s-2", name:"openai/sora-2-pro", category:"VIDEO", price:"$0.36", priceUnit:"second", maxRes:"—", maxDur:"12s", capabilities:["text-to-video","image-to-video"], description:"Higher quality Sora with standard (720p) and high (1024p) resolution modes", output:"VIDEO", source:"showcase", network:"Mainnet" },
  { id:"s-3", name:"google/veo-3.1", category:"VIDEO", price:"$0.48", priceUnit:"second", maxRes:"—", maxDur:"8s", capabilities:["text-to-video","image-to-video"], description:"Top-tier video with audio, interpolation, and reference-to-video (R2V) support", output:"VIDEO", source:"showcase", network:"Mainnet" },
  { id:"s-4", name:"openai/sora-2", category:"VIDEO", price:"$0.12", priceUnit:"second", maxRes:"—", maxDur:"12s", capabilities:["text-to-video","image-to-video"], description:"Text/image-to-video with synchronized audio, dialogue, and sound effects", output:"VIDEO", source:"showcase", network:"Mainnet" },
  { id:"s-5", name:"google/veo-3", category:"VIDEO", price:"$0.48", priceUnit:"second", maxRes:"—", maxDur:"8s", capabilities:["text-to-video","image-to-video"], description:"Premium video with native audio generation, lip-sync, and dialogue support", output:"VIDEO", source:"showcase", network:"Mainnet" },
  { id:"s-6", name:"runwayml/gen4-aleph", category:"VIDEO", price:"$0.22", priceUnit:"second", maxRes:"—", maxDur:"10s", capabilities:["video-to-video"], description:"Video editing from video input with reference images", output:"VIDEO", source:"showcase", network:"Mainnet" },
  { id:"s-7", name:"kwaivgi/kling-v2.6-motion-control", category:"VIDEO", price:"$0.09", priceUnit:"second", maxRes:"—", maxDur:"10s", capabilities:["image-to-video"], description:"Motion transfer from reference video to image", output:"VIDEO", source:"showcase", network:"Mainnet" },
  { id:"s-8", name:"openai/dall-e-3", category:"IMAGE", price:"$0.15", priceUnit:"image", maxRes:"2048x2048", maxDur:"—", capabilities:["text-to-image"], description:"OpenAI's image generation with style and quality control", output:"IMAGE", source:"showcase", network:"Mainnet" },
  { id:"s-9", name:"google/imagen-4-fast", category:"IMAGE", price:"$0.03", priceUnit:"image", maxRes:"2048x2048", maxDur:"—", capabilities:["text-to-image"], description:"Speed-optimized Imagen 4, ~2.9s generation time", output:"IMAGE", source:"showcase", network:"Mainnet" },
  { id:"s-10", name:"xai/grok-2-image", category:"IMAGE", price:"$0.09", priceUnit:"image", maxRes:"2048x2048", maxDur:"—", capabilities:["text-to-image"], description:"xAI's image generation model", output:"IMAGE", source:"showcase", network:"Mainnet" },
  { id:"s-11", name:"bytedance/seedream-4", category:"IMAGE", price:"$0.04", priceUnit:"image", maxRes:"4096x4096", maxDur:"—", capabilities:["text-to-image","image-to-image"], description:"Up to 4K resolution with prompt enhancement and multi-image editing", output:"IMAGE", source:"showcase", network:"Mainnet" },
  { id:"s-12", name:"ideogram/v3-turbo", category:"IMAGE", price:"$0.04", priceUnit:"image", maxRes:"1536x1536", maxDur:"—", capabilities:["text-to-image","image-to-image"], description:"Fastest Ideogram with 62 style presets and style reference images", output:"IMAGE", source:"showcase", network:"Mainnet" },
  { id:"s-13", name:"flux/2-pro", category:"IMAGE", price:"$0.02", priceUnit:"run", maxRes:"2048x2048", maxDur:"—", capabilities:["text-to-image","image-to-image"], description:"High quality image generation with multi-image input support", output:"IMAGE", source:"showcase", network:"Mainnet" },
  { id:"s-14", name:"flux/kontext-pro", category:"IMAGE", price:"$0.05", priceUnit:"image", maxRes:"2048x2048", maxDur:"—", capabilities:["text-to-image","image-to-image"], description:"Cost-effective image editing with style transfer and text replacement", output:"IMAGE", source:"showcase", network:"Mainnet" },
  { id:"s-15", name:"nightmareai/real-esrgan", category:"IMAGE", price:"$0.01", priceUnit:"image", maxRes:"4096x4096", maxDur:"—", capabilities:["image-to-image"], description:"Image upscaling with optional face enhancement", output:"IMAGE", source:"showcase", network:"Mainnet" },
  { id:"s-16", name:"firtoz/trellis", category:"3D", price:"$0.06", priceUnit:"run", maxRes:"—", maxDur:"—", capabilities:["image-to-3d"], description:"Image-to-3D model generation with mesh, color, and normal map output", output:"3D", source:"showcase", network:"Mainnet" },
  { id:"s-17", name:"minimax/music-01", category:"AUDIO", price:"$0.05", priceUnit:"run", maxRes:"—", maxDur:"—", capabilities:["text-to-audio"], description:"AI music generation from lyrics with voice and instrumental input", output:"AUDIO", source:"showcase", network:"Mainnet" },
  { id:"s-18", name:"qwen/qwen-image-edit-2511", category:"IMAGE", price:"$0.04", priceUnit:"image", maxRes:"2048x2048", maxDur:"—", capabilities:["text-to-image","image-to-image"], description:"Advanced image editing with multi-image input support", output:"IMAGE", source:"showcase", network:"Mainnet" },
  { id:"s-19", name:"wan-video/wan-2.5-i2v-fast", category:"VIDEO", price:"$0.09", priceUnit:"second", maxRes:"—", maxDur:"10s", capabilities:["image-to-video"], description:"Speed-optimized image animation with audio sync, 720p-1080p", output:"VIDEO", source:"showcase", network:"Mainnet" },
  { id:"s-20", name:"bytedance/seedance-1.5-pro", category:"VIDEO", price:"$0.04", priceUnit:"second", maxRes:"—", maxDur:"12s", capabilities:["text-to-video","image-to-video"], description:"Enhanced pro video with camera control and audio generation", output:"VIDEO", source:"showcase", network:"Mainnet" },
  { id:"s-21", name:"runwayml/gen4-turbo", category:"VIDEO", price:"$0.06", priceUnit:"second", maxRes:"—", maxDur:"10s", capabilities:["image-to-video"], description:"Fast video generation from image input", output:"VIDEO", source:"showcase", network:"Mainnet" },
  { id:"s-22", name:"google/veo-3-fast", category:"VIDEO", price:"$0.18", priceUnit:"second", maxRes:"—", maxDur:"8s", capabilities:["text-to-video","image-to-video"], description:"Faster, cheaper Veo 3 with native audio generation", output:"VIDEO", source:"showcase", network:"Mainnet" },
  { id:"s-23", name:"google/veo-3.1-fast", category:"VIDEO", price:"$0.18", priceUnit:"second", maxRes:"—", maxDur:"8s", capabilities:["text-to-video","image-to-video"], description:"Fast Veo 3.1 with audio, interpolation, and last-frame support", output:"VIDEO", source:"showcase", network:"Mainnet" },
  { id:"s-24", name:"kwaivgi/kling-v2.6", category:"VIDEO", price:"$0.09", priceUnit:"second", maxRes:"—", maxDur:"10s", capabilities:["text-to-video","image-to-video"], description:"High quality cinematic text-to-video generation", output:"VIDEO", source:"showcase", network:"Mainnet" },
  { id:"s-25", name:"kwaivgi/kling-v2.5-turbo-pro", category:"VIDEO", price:"$0.09", priceUnit:"second", maxRes:"—", maxDur:"10s", capabilities:["text-to-video","image-to-video"], description:"Fast cinematic video with advanced prompt understanding and motion dynamics", output:"VIDEO", source:"showcase", network:"Mainnet" },
  { id:"s-26", name:"wan-video/wan-2.2-t2v-fast", category:"VIDEO", price:"$0.12", priceUnit:"video", maxRes:"—", maxDur:"7s", capabilities:["text-to-video"], description:"Budget option with dual LoRA support, up to 720p", output:"VIDEO", source:"showcase", network:"Mainnet" },
  { id:"s-27", name:"wan-video/wan-2.2-i2v-fast", category:"VIDEO", price:"$0.07", priceUnit:"video", maxRes:"—", maxDur:"7s", capabilities:["image-to-video"], description:"Ultra-popular budget I2V with LoRA and last-frame support", output:"VIDEO", source:"showcase", network:"Mainnet" },
  { id:"s-28", name:"bytedance/seedance-1-pro", category:"VIDEO", price:"$0.08", priceUnit:"second", maxRes:"—", maxDur:"12s", capabilities:["text-to-video","image-to-video"], description:"Premium video with multi-shot narrative coherence, last-frame control, up to 1080p", output:"VIDEO", source:"showcase", network:"Mainnet" },
  { id:"s-29", name:"bytedance/seedance-1-pro-fast", category:"VIDEO", price:"$0.03", priceUnit:"second", maxRes:"—", maxDur:"12s", capabilities:["text-to-video","image-to-video"], description:"30-60% faster than Pro with reduced cost, optimized for 2D cinematic content", output:"VIDEO", source:"showcase", network:"Mainnet" },
  { id:"s-30", name:"bytedance/seedance-1-lite", category:"VIDEO", price:"$0.05", priceUnit:"second", maxRes:"—", maxDur:"12s", capabilities:["text-to-video","image-to-video"], description:"Budget video with reference image support (1-4 images) for character consistency", output:"VIDEO", source:"showcase", network:"Mainnet" },
  { id:"s-31", name:"google/nano-banana", category:"IMAGE", price:"$0.05", priceUnit:"image", maxRes:"2048x2048", maxDur:"—", capabilities:["text-to-image","image-to-image"], description:"Fast image generation with image input support", output:"IMAGE", source:"showcase", network:"Mainnet" },
  { id:"s-32", name:"flux/schnell", category:"IMAGE", price:"$0.01", priceUnit:"image", maxRes:"1440x1440", maxDur:"—", capabilities:["text-to-image"], description:"Ultra-fast image generation, 4 steps, great for prototyping", output:"IMAGE", source:"showcase", network:"Mainnet" },
  { id:"s-33", name:"prunaai/z-image-turbo", category:"IMAGE", price:"$0.01", priceUnit:"image", maxRes:"2048x2048", maxDur:"—", capabilities:["text-to-image"], description:"Ultra-fast budget image generation", output:"IMAGE", source:"showcase", network:"Mainnet" },
  { id:"s-34", name:"prunaai/p-image", category:"IMAGE", price:"$0.01", priceUnit:"image", maxRes:"2048x2048", maxDur:"—", capabilities:["text-to-image"], description:"Budget image generation with prompt upsampling", output:"IMAGE", source:"showcase", network:"Mainnet" },
  { id:"s-36", name:"openai/whisper", category:"AUDIO", price:"$0.01", priceUnit:"run", maxRes:"—", maxDur:"—", capabilities:["audio-to-text"], description:"Speech-to-text transcription with language detection", output:"AUDIO", source:"showcase", network:"Mainnet" },
  { id:"s-37", name:"minimax/speech-02-hd", category:"AUDIO", price:"$0.01", priceUnit:"run", maxRes:"—", maxDur:"—", capabilities:["text-to-audio"], description:"High-definition text-to-speech with voice control and emotion", output:"AUDIO", source:"showcase", network:"Mainnet" },
  { id:"s-38", name:"minimax/speech-02-turbo", category:"AUDIO", price:"$0.01", priceUnit:"run", maxRes:"—", maxDur:"—", capabilities:["text-to-audio"], description:"Fast text-to-speech with voice control and emotion", output:"AUDIO", source:"showcase", network:"Mainnet" },
  { id:"s-39", name:"qwen/qwen3-tts", category:"AUDIO", price:"$0.01", priceUnit:"run", maxRes:"—", maxDur:"—", capabilities:["text-to-audio"], description:"Multi-mode text-to-speech with voice cloning via reference audio", output:"AUDIO", source:"showcase", network:"Mainnet" },
  { id:"s-40", name:"exa/answer", category:"DATA", price:"$0.01", priceUnit:"call", maxRes:"—", maxDur:"—", capabilities:[], description:"AI-powered answer", output:"DATA", source:"showcase", network:"Mainnet" },
  { id:"s-41", name:"exa/search", category:"DATA", price:"$0.01", priceUnit:"call", maxRes:"—", maxDur:"—", capabilities:[], description:"Semantic web search", output:"DATA", source:"showcase", network:"Mainnet" },
  { id:"s-42", name:"exa/find-similar", category:"DATA", price:"$0.01", priceUnit:"call", maxRes:"—", maxDur:"—", capabilities:[], description:"Find similar pages", output:"DATA", source:"showcase", network:"Mainnet" },
  { id:"s-43", name:"exa/contents", category:"DATA", price:"$0.002", priceUnit:"call", maxRes:"—", maxDur:"—", capabilities:[], description:"Extract URL contents", output:"DATA", source:"showcase", network:"Mainnet" },
  { id:"s-44", name:"twitter/trends", category:"DATA", price:"$0.01", priceUnit:"call", maxRes:"—", maxDur:"—", capabilities:[], description:"Get trending topics by location", output:"DATA", source:"showcase", network:"Mainnet" },
  { id:"s-45", name:"twitter/search-tweets", category:"DATA", price:"$0.01", priceUnit:"call", maxRes:"—", maxDur:"—", capabilities:[], description:"Advanced tweet search with filters", output:"DATA", source:"showcase", network:"Mainnet" },
  { id:"s-46", name:"twitter/search-users", category:"DATA", price:"$0.01", priceUnit:"call", maxRes:"—", maxDur:"—", capabilities:[], description:"Search for users by keyword", output:"DATA", source:"showcase", network:"Mainnet" },
  { id:"s-47", name:"twitter/user-tweets", category:"DATA", price:"$0.01", priceUnit:"call", maxRes:"—", maxDur:"—", capabilities:[], description:"Get user's recent tweets", output:"DATA", source:"showcase", network:"Mainnet" },
  { id:"s-48", name:"twitter/user-info", category:"DATA", price:"$0.005", priceUnit:"call", maxRes:"—", maxDur:"—", capabilities:[], description:"Get user info by username", output:"DATA", source:"showcase", network:"Mainnet" },
  { id:"s-49", name:"twitter/user-followers", category:"DATA", price:"$0.01", priceUnit:"call", maxRes:"—", maxDur:"—", capabilities:[], description:"Get user's followers", output:"DATA", source:"showcase", network:"Mainnet" },
  { id:"s-50", name:"twitter/user-following", category:"DATA", price:"$0.01", priceUnit:"call", maxRes:"—", maxDur:"—", capabilities:[], description:"Get users that user follows", output:"DATA", source:"showcase", network:"Mainnet" },
  { id:"s-51", name:"twitter/user-mentions", category:"DATA", price:"$0.01", priceUnit:"call", maxRes:"—", maxDur:"—", capabilities:[], description:"Get tweets mentioning a user", output:"DATA", source:"showcase", network:"Mainnet" },
  { id:"s-52", name:"twitter/tweet-thread", category:"DATA", price:"$0.01", priceUnit:"call", maxRes:"—", maxDur:"—", capabilities:[], description:"Get tweet thread context", output:"DATA", source:"showcase", network:"Mainnet" },
  { id:"s-53", name:"twitter/tweet-replies", category:"DATA", price:"$0.01", priceUnit:"call", maxRes:"—", maxDur:"—", capabilities:[], description:"Get replies to a tweet", output:"DATA", source:"showcase", network:"Mainnet" },
  { id:"s-54", name:"twitter/tweet-quotes", category:"DATA", price:"$0.01", priceUnit:"call", maxRes:"—", maxDur:"—", capabilities:[], description:"Get quote tweets of a tweet", output:"DATA", source:"showcase", network:"Mainnet" },
  { id:"s-55", name:"twitter/tweets-by-ids", category:"DATA", price:"$0.01", priceUnit:"call", maxRes:"—", maxDur:"—", capabilities:[], description:"Get tweets by their IDs", output:"DATA", source:"showcase", network:"Mainnet" },
  { id:"s-56", name:"twitter/batch-users", category:"DATA", price:"$0.02", priceUnit:"call", maxRes:"—", maxDur:"—", capabilities:[], description:"Batch get users by IDs", output:"DATA", source:"showcase", network:"Mainnet" },
  { id:"s-57", name:"twitter/check-follow", category:"DATA", price:"$0.005", priceUnit:"call", maxRes:"—", maxDur:"—", capabilities:[], description:"Check if one user follows another", output:"DATA", source:"showcase", network:"Mainnet" },
  { id:"s-58", name:"twitter/list-tweets", category:"DATA", price:"$0.01", priceUnit:"call", maxRes:"—", maxDur:"—", capabilities:[], description:"Get tweets from a Twitter List", output:"DATA", source:"showcase", network:"Mainnet" },
  { id:"s-59", name:"veed/fabric-1.0", category:"VIDEO", price:"$0.18", priceUnit:"second", maxRes:"—", maxDur:"60s", capabilities:["image-to-video"], description:"Talking head generation from image + audio input", output:"VIDEO", source:"showcase", network:"Mainnet" },
  { id:"s-60", name:"minimax/video-01", category:"VIDEO", price:"$0.60", priceUnit:"video", maxRes:"—", maxDur:"6s", capabilities:["text-to-video","image-to-video"], description:"Text-to-video with cinematic effects, 720p @ 25fps, up to 6 seconds", output:"VIDEO", source:"showcase", network:"Mainnet" },
  { id:"s-61", name:"google/nano-banana-2", category:"IMAGE", price:"$0.09", priceUnit:"image", maxRes:"4096x4096", maxDur:"—", capabilities:["text-to-image","image-to-image"], description:"Fast image generation with conversational editing, multi-image fusion, character consistency, and up to 4K resolution", output:"IMAGE", source:"showcase", network:"Mainnet" },
  { id:"s-62", name:"tencent/hunyuan-3d-3.1", category:"3D", price:"$0.20", priceUnit:"run", maxRes:"—", maxDur:"—", capabilities:["image-to-3d"], description:"Text-to-3D and image-to-3D generation with PBR materials and configurable mesh complexity", output:"3D", source:"showcase", network:"Mainnet" },
]

const CATEGORY_COLORS: Record<string, string> = {
  IMAGE: "bg-purple-500/15 text-purple-400",
  VIDEO: "bg-rose-500/15 text-rose-400",
  AUDIO: "bg-amber-500/15 text-amber-400",
  DATA: "bg-blue-500/15 text-blue-400",
  "3D": "bg-emerald-500/15 text-emerald-400",
  HEDERA: "bg-teal-500/15 text-teal-400",
  WRITE: "bg-orange-500/15 text-orange-400",
  ANALYTICS: "bg-cyan-500/15 text-cyan-400",
  READ: "bg-sky-500/15 text-sky-400",
  FREE: "bg-white/[0.06] text-white/50",
}

// ═══════════════════════════════════════════════════════════════════════
// PROMPT MODAL (shown when clicking RUN)
// ═══════════════════════════════════════════════════════════════════════

function PromptModal({ tool, onClose }: { tool: DisplayTool; onClose: () => void }) {
  const [copied, setCopied] = useState(false)

  const isLive = tool.source === "live"
  const endpoint = isLive
    ? `POST ${tool.serverOrigin || "http://localhost:3000/mcp"}`
    : `POST https://registry.clawpay.tech/api/service/ai-gen/api/invoke`
  const skillUrl = isLive ? "https://clawpay.tech/skill.md" : "https://clawpay.tech/skill.md"
  const docsUrl = isLive
    ? `https://clawpay.tech/api/service/${tool.serverId}/skill.md`
    : `https://registry.clawpay.tech/api/service/ai-gen/skill.md`

  const prompt = isLive
    ? `Skill: ${skillUrl}\nDocs: ${docsUrl}\nEndpoint: ${endpoint}\nModel: ${tool.name}\nPrice: ${tool.price} per ${tool.priceUnit}\n\n${tool.description}. Use the ClawPay SDK to invoke this tool with x402 payment on Hedera. Ask me what to do.`
    : `Skill: ${skillUrl}\nDocs: ${docsUrl}\nEndpoint: ${endpoint}\nModel: ${tool.name}\nPrice: ${tool.price} per ${tool.priceUnit}\n\n${tool.description}. Use x402/fetch from the clawpay skill to invoke this model. Ask me what to generate.`

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [prompt])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg rounded-lg bg-[#0a0a0a] border border-white/[0.1] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <div className="flex items-center gap-3 min-w-0">
            <Image src={isLive ? "/logos/hedera-icon.svg" : getProviderLogo(tool.name)} alt="" width={24} height={24} className="rounded-full flex-shrink-0" />
            <h3 className="text-base font-medium text-white truncate">{tool.name}</h3>
          </div>
          <button onClick={onClose} className="p-1 text-white/40 hover:text-white transition-colors flex-shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="h-px bg-white/[0.06]" />

        {/* Prompt content */}
        <div className="px-5 py-4">
          <div className="rounded bg-white/[0.04] border border-white/[0.06] p-4">
            <pre className="text-xs font-mono text-white/70 whitespace-pre-wrap leading-relaxed">{prompt}</pre>
          </div>
        </div>

        {/* Copy button */}
        <div className="px-5 pb-4">
          <button
            onClick={handleCopy}
            className="w-full py-3 rounded bg-white text-black text-[10px] font-mono font-medium uppercase tracking-wider hover:bg-white/90 transition-colors flex items-center justify-center gap-2"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "COPIED" : "PASTE THE PROMPT ON ANY CLIENT (LIKE CLAUDE CODE)"}
          </button>
        </div>

        <div className="h-px bg-white/[0.06]" />

        {/* Footer info */}
        <div className="px-5 py-3.5 flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-wider text-white/30">
            PRICES MAY VARY DEPENDING ON PARAMETERS
          </span>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono uppercase tracking-wider text-white/40">OUTPUT</span>
            <span className={cn(
              "text-[10px] font-mono font-medium uppercase tracking-wider px-2 py-0.5 rounded",
              CATEGORY_COLORS[tool.output] || CATEGORY_COLORS[tool.category] || "bg-white/[0.06] text-white/50"
            )}>
              {tool.output}
            </span>
          </div>
        </div>

        <div className="h-px bg-white/[0.06]" />

        <div className="px-5 py-3.5 flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-wider text-white/40">PRICE</span>
          <span className="text-xs font-mono text-white">{tool.price} per {tool.priceUnit}</span>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════

function formatRelative(dateString?: string) {
  if (!dateString) return ""
  const ms = Date.now() - new Date(dateString).getTime()
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

export default function ClientServersPage() {
  const [servers, setServers] = useState<McpServer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("ALL")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [modalTool, setModalTool] = useState<DisplayTool | null>(null)

  useEffect(() => {
    mcpDataApi.getServers(100, 0, "all")
      .then((data) => setServers(Array.isArray(data.servers) ? data.servers : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Convert live servers into single server cards (not individual tools)
  const liveServerCards: DisplayTool[] = useMemo(() => {
    return servers.map((server) => {
      const sName = server?.server?.info?.name || "Unknown"
      const desc = server?.server?.info?.description || ""
      // Compute price range
      const prices: number[] = []
      for (const t of server.tools) {
        const ann = t.annotations as Record<string, unknown> | undefined
        const p = ann?.paymentPriceUSD
        if (p) {
          const num = parseFloat(String(p).replace("$", ""))
          if (!isNaN(num)) prices.push(num)
        }
      }
      let priceStr = "Free"
      if (prices.length > 0) {
        const min = Math.min(...prices)
        const max = Math.max(...prices)
        priceStr = min === max ? `$${min}` : `$${min} – $${max}`
      }
      const toolNames = server.tools.slice(0, 5).map(t => t.name)
      const moreCount = Math.max(0, server.tools.length - 5)

      // Auto-detect category from tool names and descriptions
      const allText = server.tools.map((t: any) => `${t.name} ${t.description || ""}`).join(" ").toLowerCase()
      let detectedCategory = "UTILITY"
      if (/image|photo|picture|dall-e|stable.?diffusion|flux|imagen/.test(allText)) detectedCategory = "IMAGE"
      else if (/video|animation|animate|sora|veo|kling/.test(allText)) detectedCategory = "VIDEO"
      else if (/audio|music|voice|speech|tts|transcri/.test(allText)) detectedCategory = "AUDIO"
      else if (/3d|mesh|model.*generat/.test(allText)) detectedCategory = "3D"
      else if (/search|scrape|crawl|web|browse|fetch.*url/.test(allText)) detectedCategory = "DATA"
      else if (/token|nft|hcs|hbar|account|balance|whale|defi|swap|mint|transfer|consensus/.test(allText)) detectedCategory = "BLOCKCHAIN"
      else if (/code|review|lint|debug|compile|deploy/.test(allText)) detectedCategory = "DEV"
      else if (/translate|summar|sentiment|classify|embed/.test(allText)) detectedCategory = "AI/ML"

      // Build description from server info or tool summary
      const autoDesc = desc
        || (server.tools.length > 0
          ? `${server.tools.length} tools: ${server.tools.slice(0, 3).map((t: any) => t.name).join(", ")}${server.tools.length > 3 ? ` +${server.tools.length - 3} more` : ""}`
          : "MCP server")

      return {
        id: `live-${server.id}`,
        name: sName,
        category: detectedCategory,
        price: priceStr,
        priceUnit: "call",
        maxRes: `${server.tools.length} tools`,
        maxDur: "—",
        capabilities: toolNames,
        description: autoDesc,
        output: "DATA",
        source: "live" as const,
        serverId: server.id,
        serverOrigin: server.origin,
        network: "Testnet" as const,
        _moreCount: moreCount,
      }
    })
  }, [servers])

  const allTools = useMemo(() => [...liveServerCards, ...SHOWCASE_TOOLS], [liveServerCards])

  const categories = useMemo(() => {
    const cats = new Set<string>()
    for (const t of allTools) cats.add(t.category)
    return ["ALL", ...Array.from(cats).sort()]
  }, [allTools])

  const filtered = useMemo(() => {
    let result = allTools
    if (categoryFilter !== "ALL") result = result.filter(t => t.category === categoryFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.capabilities.some(c => c.toLowerCase().includes(q))
      )
    }
    return result
  }, [allTools, categoryFilter, search])

  return (
    <div className="bg-background min-h-screen">
      {/* Hero */}
      <div className="pt-20 sm:pt-28 pb-14 text-center px-4">
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold font-host text-foreground leading-[1.1] tracking-tight">
          The best tools<br />for superagents
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-5 max-w-lg mx-auto leading-relaxed">
          No subscriptions, no credits and no API keys required. Make your agent be the most powerful in the room.
        </p>
      </div>

      {/* Search + Filter + Toggle */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tools..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-11 h-12 bg-card border-border/30 rounded-[4px] font-mono text-sm placeholder:text-muted-foreground/50"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-12 w-auto min-w-[130px] bg-card border-border/30 rounded-[4px] font-mono text-xs uppercase tracking-wider">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories.map(c => (
                <SelectItem key={c} value={c}>{c === "ALL" ? "ANY OUTPUT" : c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex border border-border/30 rounded-[4px] overflow-hidden bg-card">
            <button onClick={() => setViewMode("grid")} className={cn("p-3 transition-colors", viewMode === "grid" ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground")} aria-label="Grid view">
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button onClick={() => setViewMode("list")} className={cn("p-3 transition-colors", viewMode === "list" ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground")} aria-label="List view">
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Tools */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-lg text-foreground mb-2">No tools found</p>
            <p className="text-sm text-muted-foreground">{search ? "Try a different search" : "No tools available"}</p>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map(t => <ToolCard key={t.id} tool={t} onRun={setModalTool} />)}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(t => <ToolCardList key={t.id} tool={t} onRun={setModalTool} />)}
          </div>
        )}
      </div>

      <Footer />

      {/* Modal */}
      {modalTool && <PromptModal tool={modalTool} onClose={() => setModalTool(null)} />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// TOOL CARD — GRID (Frames.ag style)
// ═══════════════════════════════════════════════════════════════════════

function ToolCard({ tool, onRun }: { tool: DisplayTool & { _moreCount?: number }; onRun: (t: DisplayTool) => void }) {
  const isServer = tool.source === "live"

  const inner = (
    <div className="rounded-lg bg-black dark:bg-[#0a0a0a] border border-white/[0.08] hover:border-white/[0.16] transition-all duration-200 h-full flex flex-col overflow-hidden">
      {/* Header: icon + name + category badge */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-4">
        <Image src={isServer ? "/logos/hedera-icon.svg" : getProviderLogo(tool.name)} alt="" width={28} height={28} className="rounded-full flex-shrink-0" />
        <h3 className="text-[14px] font-medium text-white truncate flex-1">{tool.name}</h3>
        <span className={cn("text-[10px] font-mono font-medium uppercase tracking-wider px-2 py-0.5 rounded flex-shrink-0", CATEGORY_COLORS[tool.category] || "bg-white/[0.06] text-white/50")}>
          {tool.category}
        </span>
      </div>

      <div className="h-px bg-white/[0.06]" />

      {/* Spec rows */}
      <div className="px-5 py-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono uppercase tracking-[0.12em] text-white/40">PRICE</span>
          <span className="text-[13px] font-mono text-white">{tool.price} <span className="text-white/40 text-[11px]">/ {tool.priceUnit}</span></span>
        </div>
        {isServer ? (
          <>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-[0.12em] text-white/40">TOOLS</span>
              <span className="text-[13px] font-mono text-white">{tool.maxRes}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-[0.12em] text-white/40">NETWORK</span>
              <span className="text-[13px] font-mono text-white">Hedera Testnet</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-[0.12em] text-white/40">MAX RES</span>
              <span className="text-[13px] font-mono text-white">{tool.maxRes}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-[0.12em] text-white/40">MAX DUR</span>
              <span className="text-[13px] font-mono text-white">{tool.maxDur}</span>
            </div>
          </>
        )}
      </div>

      {/* Capabilities / Tool names */}
      {tool.capabilities.length > 0 && (
        <>
          <div className="h-px bg-white/[0.06]" />
          <div className="px-5 py-3.5">
            <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-white/40 mb-2">
              {isServer ? "AVAILABLE TOOLS" : "CAPABILITIES"}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {tool.capabilities.map(c => (
                <span key={c} className="text-[11px] font-mono px-2 py-0.5 rounded bg-white/[0.06] text-white/60">{c}</span>
              ))}
              {(tool as DisplayTool & { _moreCount?: number })._moreCount ? (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-white/[0.06] text-white/60">
                  +{(tool as DisplayTool & { _moreCount?: number })._moreCount} more
                </span>
              ) : null}
            </div>
          </div>
        </>
      )}

      <div className="h-px bg-white/[0.06]" />

      {/* Description */}
      <div className="px-5 py-3.5 flex-1">
        <p className="text-xs text-white/50 leading-relaxed line-clamp-2">{tool.description}</p>
      </div>

      {/* Network badge + RUN/VIEW */}
      <div className="h-px bg-white/[0.06]" />
      <div className="flex items-center">
        <div className="px-5 py-1">
          <span className={cn(
            "text-[9px] font-mono font-medium uppercase tracking-wider px-2 py-0.5 rounded",
            tool.network === "Mainnet" ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"
          )}>
            {tool.network}
          </span>
        </div>
        <div className="flex-1" />
        {isServer ? (
          <div className="flex-1 py-3.5 text-sm font-mono font-medium uppercase tracking-wider text-white bg-white/[0.04] hover:bg-white/[0.08] border-l border-white/[0.06] transition-colors text-center">
            VIEW →
          </div>
        ) : (
          <button
            onClick={(e) => { e.preventDefault(); onRun(tool) }}
            className="flex-1 py-3.5 text-sm font-mono font-medium uppercase tracking-wider text-white bg-white/[0.04] hover:bg-white/[0.08] border-l border-white/[0.06] transition-colors text-center"
          >
            RUN
          </button>
        )}
      </div>
    </div>
  )

  if (isServer && tool.serverId) {
    return <Link href={`/servers/${tool.serverId}`} className="block">{inner}</Link>
  }
  return <div>{inner}</div>
}

// ═══════════════════════════════════════════════════════════════════════
// TOOL CARD — LIST
// ═══════════════════════════════════════════════════════════════════════

function ToolCardList({ tool, onRun }: { tool: DisplayTool; onRun: (t: DisplayTool) => void }) {
  const isServer = tool.source === "live"

  const inner = (
    <div className="rounded-lg bg-black dark:bg-[#0a0a0a] border border-white/[0.08] hover:border-white/[0.16] transition-all duration-200 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Image src={isServer ? "/logos/hedera-icon.svg" : getProviderLogo(tool.name)} alt="" width={22} height={22} className="rounded-full flex-shrink-0" />
        <span className="text-sm font-medium text-white truncate">{tool.name}</span>
        <span className={cn("text-[10px] font-mono font-medium uppercase tracking-wider px-2 py-0.5 rounded flex-shrink-0", CATEGORY_COLORS[tool.category] || "bg-white/[0.06] text-white/50")}>
          {tool.category}
        </span>
        <span className={cn(
          "text-[9px] font-mono font-medium uppercase tracking-wider px-2 py-0.5 rounded flex-shrink-0",
          tool.network === "Mainnet" ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"
        )}>
          {tool.network}
        </span>
      </div>
      <div className="flex items-center gap-4 flex-shrink-0">
        <span className="text-xs font-mono text-white/50 hidden sm:inline line-clamp-1 max-w-[200px]">{tool.description}</span>
        <span className="text-sm font-mono font-medium text-white min-w-[70px] text-right">{tool.price}</span>
        {isServer ? (
          <span className="px-4 py-2 text-xs font-mono font-medium uppercase tracking-wider text-white bg-white/[0.04] border border-white/[0.08] rounded">
            VIEW →
          </span>
        ) : (
          <button
            onClick={(e) => { e.preventDefault(); onRun(tool) }}
            className="px-4 py-2 text-xs font-mono font-medium uppercase tracking-wider text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] rounded transition-colors"
          >
            RUN
          </button>
        )}
      </div>
    </div>
  )

  if (isServer && tool.serverId) {
    return <Link href={`/servers/${tool.serverId}`} className="block">{inner}</Link>
  }
  return <div>{inner}</div>
}

// ═══════════════════════════════════════════════════════════════════════
// SKELETON
// ═══════════════════════════════════════════════════════════════════════

function SkeletonCard() {
  return (
    <div className="rounded-lg bg-black dark:bg-[#0a0a0a] border border-white/[0.08] p-5 space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-7 w-7 rounded-full bg-white/[0.06]" />
        <Skeleton className="h-4 w-40 bg-white/[0.06]" />
      </div>
      <div className="h-px bg-white/[0.06]" />
      <div className="space-y-3">
        <Skeleton className="h-3.5 w-full bg-white/[0.06]" />
        <Skeleton className="h-3.5 w-full bg-white/[0.06]" />
        <Skeleton className="h-3.5 w-3/4 bg-white/[0.06]" />
      </div>
      <div className="h-px bg-white/[0.06]" />
      <Skeleton className="h-10 w-full bg-white/[0.06]" />
    </div>
  )
}
