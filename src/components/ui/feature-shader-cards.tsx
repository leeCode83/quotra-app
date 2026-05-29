"use client"

import { Warp } from "@paper-design/shaders-react"
import { Shield, Cpu, Zap, Fingerprint, Key, GitMerge } from "lucide-react"

interface Feature {
  title: string
  description: string
  icon: React.ReactNode
  className?: string
}

const features: Feature[] = [
  {
    title: "Escrow Protection",
    description:
      "On-chain escrow ensures providers get paid and consumers get what they pay for. No middlemen, no disputes.",
    icon: <Shield className="w-8 h-8 text-white" />,
    className: "md:row-span-2",
  },
  {
    title: "Direct API Access",
    description:
      "Connect directly to AI model endpoints. No rate-limiting intermediaries or vendor lock-in.",
    icon: <Cpu className="w-8 h-8 text-white" />,
  },
  {
    title: "Instant Settlement",
    description:
      "Payments settle on Base in seconds. Low gas fees, high throughput, reliable execution.",
    icon: <Zap className="w-8 h-8 text-white" />,
  },
  {
    title: "Verifiable Identity",
    description:
      "On-chain identity verification for providers and consumers, building trust in every transaction.",
    icon: <Fingerprint className="w-8 h-8 text-white" />,
  },
  {
    title: "Granular Permissions",
    description:
      "Fine-grained access control for your AI endpoints. Whitelist consumers, set rate limits, and rotate keys.",
    icon: <Key className="w-8 h-8 text-white" />,
  },
  {
    title: "Cross-Chain Ready",
    description:
      "Built on Base with seamless bridging from Ethereum and L2 networks. One interface, multichain reach.",
    icon: <GitMerge className="w-8 h-8 text-white" />,
    className: "md:col-span-3",
  },
]

function getShaderConfig(index: number) {
  const configs = [
    {
      proportion: 0.3, softness: 0.8, distortion: 0.15, swirl: 0.6, swirlIterations: 8,
      shape: "stripes" as const, shapeScale: 0.08,
      colors: ["hsl(270, 100%, 25%)", "hsl(290, 100%, 55%)", "hsl(320, 90%, 35%)", "hsl(280, 100%, 65%)"],
    },
    {
      proportion: 0.4, softness: 1.2, distortion: 0.2, swirl: 0.9, swirlIterations: 12,
      shape: "edge" as const, shapeScale: 0.12,
      colors: ["hsl(190, 100%, 20%)", "hsl(180, 100%, 55%)", "hsl(170, 100%, 30%)", "hsl(185, 100%, 70%)"],
    },
    {
      proportion: 0.35, softness: 0.9, distortion: 0.18, swirl: 0.7, swirlIterations: 10,
      shape: "checks" as const, shapeScale: 0.1,
      colors: ["hsl(280, 100%, 25%)", "hsl(300, 100%, 55%)", "hsl(260, 90%, 30%)", "hsl(290, 100%, 65%)"],
    },
    {
      proportion: 0.45, softness: 1.1, distortion: 0.22, swirl: 0.8, swirlIterations: 15,
      shape: "stripes" as const, shapeScale: 0.09,
      colors: ["hsl(200, 100%, 25%)", "hsl(175, 100%, 55%)", "hsl(190, 90%, 30%)", "hsl(180, 100%, 65%)"],
    },
    {
      proportion: 0.38, softness: 0.95, distortion: 0.16, swirl: 0.85, swirlIterations: 11,
      shape: "edge" as const, shapeScale: 0.11,
      colors: ["hsl(270, 100%, 30%)", "hsl(260, 100%, 60%)", "hsl(250, 90%, 35%)", "hsl(265, 100%, 70%)"],
    },
    {
      proportion: 0.42, softness: 1.0, distortion: 0.19, swirl: 0.75, swirlIterations: 9,
      shape: "checks" as const, shapeScale: 0.13,
      colors: ["hsl(300, 100%, 25%)", "hsl(185, 100%, 50%)", "hsl(280, 90%, 30%)", "hsl(170, 100%, 65%)"],
    },
  ]
  return configs[index % configs.length]
}

export function FeaturesShaderCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl mx-auto md:auto-rows-[180px]">
      {features.map((feature, index) => {
        const shaderConfig = getShaderConfig(index)
        return (
          <div
            key={feature.title}
            className={`group relative h-[220px] md:h-auto rounded-3xl overflow-hidden ${feature.className ?? ""}`}
          >
            <div className="absolute inset-0 z-0">
              <Warp
                style={{ height: "100%", width: "100%" }}
                proportion={shaderConfig.proportion}
                softness={shaderConfig.softness}
                distortion={shaderConfig.distortion}
                swirl={shaderConfig.swirl}
                swirlIterations={shaderConfig.swirlIterations}
                shape={shaderConfig.shape}
                shapeScale={shaderConfig.shapeScale}
                scale={1}
                rotation={0}
                speed={0.8}
                colors={shaderConfig.colors}
              />
            </div>
            <div className="absolute inset-0 z-10 rounded-3xl bg-gradient-to-t from-black/90 via-black/40 to-black/10 pointer-events-none" />
            <div className="relative z-20 p-5 flex flex-col justify-end h-full pointer-events-none">
              <div className="mb-2">{feature.icon}</div>
              <h3 className="text-lg font-bold text-white mb-1.5">{feature.title}</h3>
              <p className="text-sm text-gray-200 leading-snug line-clamp-3 md:line-clamp-none">{feature.description}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
