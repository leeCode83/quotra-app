import Link from "next/link";
import { ArrowRight, Cpu, Shield, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HeroSection } from "@/components/HeroSection";

const features = [
  {
    icon: Shield,
    title: "Escrow Protection",
    description:
      "On-chain escrow ensures providers get paid and consumers get what they pay for. No middlemen, no disputes.",
  },
  {
    icon: Cpu,
    title: "Direct API Access",
    description:
      "Connect directly to AI model endpoints. No rate-limiting intermediaries or vendor lock-in.",
  },
  {
    icon: Zap,
    title: "Instant Settlement",
    description:
      "Payments settle on Base in seconds. Low gas fees, high throughput, reliable execution.",
  },
];

const sampleListings = [
  {
    id: "1",
    name: "GPT-4 Turbo",
    provider_id: "p1",
    description: "High-quality text generation with advanced reasoning capabilities.",
    model_type: "text-generation",
    price_per_request: 0.002,
    endpoint_url: "https://api.example.com/v1/gpt4",
    is_active: true,
    created_at: "2024-01-15T00:00:00Z",
    provider: { id: "p1", wallet_address: "0x1234", name: "AI Labs", encrypted_api_key: null, delegation_json: null, created_at: "2024-01-01T00:00:00Z" },
  },
  {
    id: "2",
    name: "Stable Diffusion XL",
    provider_id: "p2",
    description: "Generate stunning images from text prompts with state-of-the-art quality.",
    model_type: "image-generation",
    price_per_request: 0.005,
    endpoint_url: "https://api.example.com/v1/sdxl",
    is_active: true,
    created_at: "2024-02-10T00:00:00Z",
    provider: { id: "p2", wallet_address: "0x5678", name: "VisionAI", encrypted_api_key: null, delegation_json: null, created_at: "2024-01-05T00:00:00Z" },
  },
  {
    id: "3",
    name: "Whisper Transcribe",
    provider_id: "p3",
    description: "Accurate speech-to-text transcription supporting 50+ languages.",
    model_type: "speech",
    price_per_request: 0.001,
    endpoint_url: "https://api.example.com/v1/whisper",
    is_active: true,
    created_at: "2024-03-01T00:00:00Z",
    provider: { id: "p3", wallet_address: "0x9abc", name: "VoiceTech", encrypted_api_key: null, delegation_json: null, created_at: "2024-01-10T00:00:00Z" },
  },
];

export default function HomePage() {
  return (
    <>
      <HeroSection />

      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight">Why Quotra?</h2>
          <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
            A decentralized marketplace where AI providers and consumers transact directly, secured by blockchain escrow.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feature) => (
            <Card key={feature.title} className="text-center">
              <CardHeader>
                <feature.icon className="h-10 w-10 mx-auto text-primary" />
                <CardTitle className="text-lg">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="container mx-auto px-4 py-16 bg-muted/30">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Featured Listings</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Discover top AI models available on the marketplace
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/marketplace">
              View All
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sampleListings.map((listing) => (
            <Card key={listing.id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-lg leading-tight">{listing.name}</CardTitle>
                  <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    {listing.model_type === "text-generation" ? "Text Gen" : listing.model_type === "image-generation" ? "Image Gen" : listing.model_type === "speech" ? "Speech" : listing.model_type}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">by {listing.provider?.name ?? "Unknown"}</p>
              </CardHeader>
              <CardContent className="flex-1">
                <p className="text-sm text-muted-foreground line-clamp-2">{listing.description}</p>
                <p className="text-sm font-semibold text-primary mt-3">
                  {listing.price_per_request === 0 ? "Free" : `${listing.price_per_request.toFixed(4)} ETH/request`}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="container mx-auto px-4 py-16">
        <div className="rounded-2xl bg-primary/5 border border-primary/10 p-8 md:p-12 text-center space-y-4">
          <h2 className="text-2xl md:text-3xl font-bold">Ready to get started?</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Whether you&apos;re an AI provider looking to monetize your models or a consumer seeking affordable AI access, Quotra has you covered.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
            <Button size="lg" asChild>
              <Link href="/dashboard/provider">
                Start as Provider
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/dashboard/consumer">
                Start as Consumer
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}