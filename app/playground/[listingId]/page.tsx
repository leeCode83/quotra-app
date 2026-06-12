"use client";

import { use, useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { ArrowLeft, Send, Loader2, Wallet, AlertCircle, Sparkles, Code, PenLine, Eraser } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { CallsBar } from "@/components/CallsBar";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { createClient } from "@/lib/supabase-client";
import type { ListingWithProvider } from "@/types";
import { useWalletConnection } from "@/hooks/useWalletConnection";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const ROLE_PRESETS: Record<string, string> = {
  "General Assistant": "You are a helpful, accurate, and concise AI assistant.",
  "Code Expert": "You are an expert software engineer. Provide clean, well-documented code with examples. Explain your reasoning clearly.",
  "Creative Writer": "You are a creative writer. Use vivid language and engaging storytelling. Be imaginative and descriptive.",
};

const SUGGESTIONS = [
  "Explain quantum computing simply",
  "Write a haiku about AI",
  "What are the best practices for REST APIs?",
];

export default function PlaygroundPage({ params }: { params: Promise<{ listingId: string }> }) {
  const { listingId } = use(params);
  const { address, isConnected } = useAccount();
  const { connect } = useWalletConnection();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [trialInfo, setTrialInfo] = useState<{ remaining: number; limit: number; hasTrialRemaining: boolean } | null>(null);

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
    if (messagesEndRef.current) {
      const container = messagesEndRef.current.parentElement;
      if (container) {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: "smooth"
        });
      }
    }
  }, [messages]);

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    autoResize(e.target);
  };

  const handlePresetClick = (name: string) => {
    if (activePreset === name) {
      setSystemPrompt("");
      setActivePreset(null);
    } else {
      setSystemPrompt(ROLE_PRESETS[name]);
      setActivePreset(name);
    }
  };

  const handleSuggestionClick = (text: string) => {
    setInput(text);
    if (textareaRef.current) {
      textareaRef.current.value = text;
      autoResize(textareaRef.current);
    }
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    if (!trialInfo?.hasTrialRemaining) return;

    setInput("");
    setError(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
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
          <div className="h-[500px] bg-muted rounded-xl" />
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
  const price = parseFloat(listing.price_per_call_usdc);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-5xl mx-auto">
        <Button variant="ghost" className="mb-4 -ml-3 text-muted-foreground hover:text-foreground" asChild>
          <Link href={"/marketplace/" + listingId}>
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Listing
          </Link>
        </Button>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Sidebar */}
          <div className="space-y-4">
            {/* Listing Info */}
            <Card>
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base truncate">{listing.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{listing.model_name}</p>
                  </div>
                  {isActive ? (
                    <span className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse shrink-0 mt-1.5" />
                  ) : (
                    <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/50 shrink-0 mt-1.5" />
                  )}
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Price</span>
                  <span className="font-semibold tabular-nums">${price.toFixed(4)} <span className="text-xs text-muted-foreground font-normal">USDC</span></span>
                </div>

                <div className="pt-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                    <span>Calls remaining</span>
                    <span className="tabular-nums">{Number(listing.remaining_calls)} / {Number(listing.max_calls)}</span>
                  </div>
                  <CallsBar used={Number(listing.remaining_calls)} total={Number(listing.max_calls)} />
                </div>
              </CardContent>
            </Card>

            {/* System Prompt */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                  System Prompt
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {Object.keys(ROLE_PRESETS).map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => handlePresetClick(name)}
                      className={
                        "inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full border transition-colors " +
                        (activePreset === name
                          ? "bg-primary/10 border-primary/30 text-primary font-medium"
                          : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground")
                      }
                    >
                      {name === "General Assistant" ? (
                        <Sparkles className="h-3 w-3" />
                      ) : name === "Code Expert" ? (
                        <Code className="h-3 w-3" />
                      ) : (
                        <PenLine className="h-3 w-3" />
                      )}
                      {name}
                    </button>
                  ))}
                  {systemPrompt && (
                    <button
                      type="button"
                      onClick={() => { setSystemPrompt(""); setActivePreset(null); }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full border border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground transition-colors"
                    >
                      <Eraser className="h-3 w-3" />
                      Clear
                    </button>
                  )}
                </div>

                <Textarea
                  placeholder="You are a helpful assistant..."
                  value={systemPrompt}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                    setSystemPrompt(e.target.value);
                    if (e.target.value === "") setActivePreset(null);
                  }}
                  rows={5}
                  className="text-xs resize-none"
                  maxLength={8000}
                />
                <p className="text-xs text-muted-foreground text-right">{systemPrompt.length}/8000 chars</p>
              </CardContent>
            </Card>

            {/* Trial Status */}
            <Card className={trialInfo?.hasTrialRemaining === false ? "border-destructive/30" : ""}>
              <CardContent className="p-4">
                {!isConnected ? (
                  <Button size="sm" className="w-full" onClick={() => connect()}>
                    <Wallet className="h-3.5 w-3.5 mr-1.5" />
                    Connect Wallet
                  </Button>
                ) : trialInfo === null ? (
                  <div className="h-8 bg-muted rounded animate-pulse" />
                ) : trialInfo.hasTrialRemaining ? (
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Free trial</span>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-lg font-bold tabular-nums text-green-500">{trialInfo.remaining}</span>
                      <span className="text-muted-foreground">/ {trialInfo.limit} requests remaining</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-destructive flex items-center gap-2">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>Free trial limit reached. Purchase this listing to continue.</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Chat Panel */}
          <div className="lg:col-span-2">
            <Card className="h-[554px] flex flex-col">
              <CardHeader className="pb-3 border-b shrink-0 px-5 py-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs font-mono">{listing.model_name}</Badge>
                  {isLoading && (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground ml-auto">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                      Generating
                    </span>
                  )}
                </div>
              </CardHeader>

              <CardContent className="flex-1 overflow-y-auto p-5 space-y-4">
                {messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center max-w-sm">
                      <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                        <Sparkles className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <h3 className="font-semibold text-lg">Test this model</h3>
                      <p className="text-sm text-muted-foreground mt-1 mb-6">
                        {isConnected && trialInfo?.hasTrialRemaining
                          ? `You have ${trialInfo.remaining} free trial request${trialInfo.remaining > 1 ? "s" : ""}. Try a prompt below.`
                          : "Type a message to try this AI model."}
                      </p>

                      {!isConnected ? (
                        <Button onClick={() => connect()}>
                          <Wallet className="h-4 w-4 mr-1.5" />
                          Connect Wallet to Start
                        </Button>
                      ) : trialInfo?.hasTrialRemaining ? (
                        <div className="flex flex-wrap justify-center gap-2">
                          {SUGGESTIONS.map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => handleSuggestionClick(s)}
                              className="px-3 py-1.5 text-xs rounded-full border border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground transition-colors"
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      ) : trialInfo?.hasTrialRemaining === false ? (
                        <div className="p-4 border rounded-lg bg-muted/50 text-sm text-muted-foreground">
                          Free trial limit reached. Please purchase the listing to integrate it into your app.
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <>
                    {messages.map((msg, i) => (
                      <div key={i} className={"flex " + (msg.role === "user" ? "justify-end" : "justify-start")}>
                        <div className={"max-w-[80%] rounded-2xl px-4 py-2.5 " + (msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted")}>
                          {msg.role === "user" ? (
                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          ) : (
                            <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-background prose-pre:border prose-code:text-primary">
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
                  </>
                )}

                <div ref={messagesEndRef} />
              </CardContent>

              <div className="p-4 border-t shrink-0 space-y-2">
                {messages.length > 0 && input.trim() === "" && !isLoading && (
                  <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => handleSuggestionClick(s)}
                        className="shrink-0 px-2.5 py-1 text-xs rounded-full border border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex gap-2 items-end">
                  <textarea
                    ref={textareaRef}
                    placeholder={
                      !trialInfo?.hasTrialRemaining
                        ? "Free trial limit reached"
                        : "Type your message..."
                    }
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    disabled={isLoading || !isConnected || !trialInfo?.hasTrialRemaining}
                    rows={1}
                    className="flex-1 bg-transparent border border-input rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-input disabled:opacity-50 resize-none max-h-[200px]"
                  />
                  <Button
                    onClick={handleSend}
                    disabled={isLoading || !input.trim() || !isConnected || !trialInfo?.hasTrialRemaining}
                    size="icon"
                    className="shrink-0 mb-px"
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
