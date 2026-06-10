"use client";

import { use, useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { ArrowLeft, Send, Loader2, Wallet, AlertCircle, Cpu, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { createClient } from "@/lib/supabase-client";
import type { ListingWithProvider } from "@/types";
import { useWalletConnection } from "@/hooks/useWalletConnection";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function PlaygroundPage({ params }: { params: Promise<{ listingId: string }> }) {
  const { listingId } = use(params);
  const { address, isConnected } = useAccount();
  const { connect } = useWalletConnection();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [trialInfo, setTrialInfo] = useState<{ remaining: number, limit: number, hasTrialRemaining: boolean } | null>(null);

  const checkTrialUsage = async () => {
    if (!address || !listingId) return;
    try {
      const trialRes = await fetch(`/api/playground/usage?listingId=${listingId}&walletAddress=${address}`);
      if (trialRes.ok) {
        const trialData = await trialRes.json();
        setTrialInfo(trialData);
      }
    } catch (err) {
      console.error("Failed to fetch trial usage", err);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    checkTrialUsage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, listingId]);

  const { data: listing, isLoading: listingLoading } = useQuery<ListingWithProvider>({
    queryKey: ["listing", listingId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("listings")
        .select("*, provider:providers(*)")
        .eq("id", listingId)
        .single();
      if (error) throw error;
      return data as ListingWithProvider;
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    if (!trialInfo?.hasTrialRemaining) return;

    setInput("");
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setIsLoading(true);

    try {
      const payload = {
        chat: text,
        ...(systemPrompt.trim() ? { systemPrompt: systemPrompt.trim() } : {}),
      };

      const result = await fetch(`/api/playground/chat?listingId=${listingId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(address ? { "x-wallet-address": address } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (result.ok) {
        setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
        setIsLoading(false);

        const reader = result.body?.getReader();
        const decoder = new TextDecoder();
        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            setMessages((prev) => {
              const newMessages = [...prev];
              newMessages[newMessages.length - 1].content += chunk;
              return newMessages;
            });
          }
        }
        
        // Refresh trial info
        checkTrialUsage();
      } else {
        let errorMsg = `Request failed with status ${result.status}`;
        try {
          const data = await result.json();
          if (data.error) errorMsg = data.error;
        } catch {}
        setError(errorMsg);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  if (listingLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto animate-pulse space-y-4">
          <div className="h-4 w-24 bg-muted rounded" />
          <div className="h-8 w-64 bg-muted rounded" />
          <div className="h-[400px] bg-muted rounded-xl" />
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
          <h2 className="text-xl font-bold">Listing Not Found</h2>
          <p className="text-muted-foreground mt-1">This listing does not exist or has been removed.</p>
          <Button className="mt-4" asChild>
            <Link href="/marketplace">Back to Marketplace</Link>
          </Button>
        </div>
      </div>
    );
  }

  const isActive = listing.status === "active";

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <Button variant="ghost" className="mb-4" asChild>
          <Link href={"/marketplace/" + listingId}>
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Listing
          </Link>
        </Button>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-1 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-primary" />
                  {listing.name}
                </CardTitle>
                <CardDescription>{listing.model_name}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Price</span>
                  <span className="font-semibold text-primary">${parseFloat(listing.price_per_call_usdc).toFixed(4)} USDC</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant={isActive ? "default" : "secondary"} className="text-xs">
                    {isActive ? "Active" : listing.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Calls Left</span>
                  <span>{listing.remaining_calls} / {listing.max_calls}</span>
                </div>
                <div className="border-t my-2" />
                <p className="text-xs text-muted-foreground mb-4">
                  Pay-per-call AI endpoint. Each message costs the listed price.
                </p>

                {/* Collapsible System Prompt */}
                <div className="border rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowSystemPrompt((v) => !v)}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-left hover:bg-muted/50 transition-colors"
                  >
                    <span>System Prompt</span>
                    {showSystemPrompt
                      ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </button>
                  {showSystemPrompt && (
                    <div className="px-3 pb-3">
                      <Textarea
                        placeholder="You are a helpful assistant..."
                        value={systemPrompt}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSystemPrompt(e.target.value)}
                        rows={4}
                        className="text-xs mt-2 resize-none"
                        maxLength={8000}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {systemPrompt.length}/8000 chars
                      </p>
                    </div>
                  )}
                </div>

              </CardContent>
            </Card>
          </div>

          <div className="md:col-span-2">
            <Card className="h-[600px] flex flex-col">
              <CardHeader className="pb-3 border-b shrink-0">
                <CardTitle className="text-base flex items-center gap-2">
                  AI Playground
                  <Badge variant="outline" className="text-xs font-mono ml-auto">
                    {listing.model_name}
                  </Badge>
                </CardTitle>
              </CardHeader>

              <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center max-w-sm">
                      <Wallet className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                      <h3 className="font-semibold text-lg">Start a conversation</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Type a message below to try this AI model.
                      </p>
                      {!isConnected ? (
                        <Button className="mt-4" onClick={() => connect()}>
                          Connect Wallet to Start
                        </Button>
                      ) : !trialInfo?.hasTrialRemaining ? (
                        <div className="mt-4 p-4 border rounded-lg bg-muted/50 text-sm text-muted-foreground">
                          Free trial limit reached. Please purchase the listing to integrate it into your app.
                        </div>
                      ) : (
                         <div className="mt-4 p-4 border rounded-lg bg-muted/50 text-sm text-muted-foreground">
                           You have {trialInfo.remaining} free trial request{trialInfo.remaining > 1 ? 's' : ''} remaining.
                         </div>
                      )}
                    </div>
                  </div>
                )}

                {messages.map((msg, i) => (
                  <div key={i} className={"flex " + (msg.role === "user" ? "justify-end" : "justify-start")}>
                    <div className={"max-w-[80%] rounded-2xl px-4 py-2.5 " + (msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted overflow-hidden")}>
                      {msg.role === "user" ? (
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      ) : (
                        <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-muted/50 prose-pre:border">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-2xl px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Processing...</span>
                      </div>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="flex justify-center">
                    <div className="bg-destructive/10 text-destructive rounded-lg px-4 py-2 text-sm flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span className="break-words">{error}</span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </CardContent>

              <div className="p-4 border-t shrink-0">
                {trialInfo !== null && (
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground">
                      Free Trial Status: {trialInfo.remaining > 0 ? (
                        <span className="text-primary font-medium">{trialInfo.remaining} / {trialInfo.limit} remaining</span>
                      ) : (
                        <span className="text-destructive font-medium">Limit reached</span>
                      )}
                    </span>
                  </div>
                )}
                <div className="flex gap-2">
                  <Input
                    placeholder={!trialInfo?.hasTrialRemaining ? "Free trial limit reached" : "Type your message..."}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                    disabled={isLoading || !isConnected || !trialInfo?.hasTrialRemaining}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleSend}
                    disabled={isLoading || !input.trim() || !isConnected || !trialInfo?.hasTrialRemaining}
                    size="icon"
                  >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
