"use client";

import { use, useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { ArrowLeft, Send, Loader2, Wallet, DollarSign, AlertCircle, Cpu } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

import { createClient } from "@/lib/supabase-client";
import { x402Fetch, type X402PaymentRequired } from "@/lib/x402-fetch";
import type { ListingWithProvider } from "@/types";
import { useWalletConnection } from "@/hooks/useWalletConnection";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

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
  const [isLoading, setIsLoading] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentRequired, setPaymentRequired] = useState<X402PaymentRequired | null>(null);
  const [pendingMessage, setPendingMessage] = useState("");
  const [paymentPending, setPaymentPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  const delegationId = listing?.delegation_id;
  const chatEndpoint = delegationId ? "/api/v1/" + delegationId + "/chat" : null;

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading || !chatEndpoint) return;

    setInput("");
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setIsLoading(true);
    setPendingMessage(text);

    try {
      const result = await x402Fetch(chatEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat: text }),
      });

      if (result.status === 402 && !result.ok) {
        const pr = (result.data as { paymentRequired?: X402PaymentRequired }).paymentRequired;
        if (pr) {
          setPaymentRequired(pr);
          setShowPaymentDialog(true);
          return;
        }
      }

      if (result.ok) {
        const responseText = (result.data as { text?: string })?.text || JSON.stringify(result.data);
        setMessages((prev) => [...prev, { role: "assistant", content: responseText }]);
      } else {
        setError(
          result.data && typeof result.data === "object" && "error" in (result.data as object)
            ? (result.data as { error: string }).error
            : "Request failed with status " + result.status
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsLoading(false);
      setPendingMessage("");
    }
  };

  const handlePayAndRetry = async () => {
    if (!paymentRequired || !chatEndpoint || !address) return;

    setPaymentPending(true);
    setShowPaymentDialog(false);

    try {
      // For MVP demo: simulate payment proof
      // In production, use x402/evm client to create payment payload
      const txHash = "demo_tx_" + Date.now();

      const retryResult = await x402Fetch(chatEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-PAYMENT": txHash,
        },
        body: JSON.stringify({ chat: pendingMessage }),
      });

      if (retryResult.ok) {
        const responseText = (retryResult.data as { text?: string })?.text || JSON.stringify(retryResult.data);
        setMessages((prev) => [...prev, { role: "assistant", content: responseText }]);
      } else {
        setError(
          retryResult.data && typeof retryResult.data === "object" && "error" in (retryResult.data as object)
            ? (retryResult.data as { error: string }).error
            : "Request failed after payment"
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setPaymentPending(false);
      setPaymentRequired(null);
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
                <p className="text-xs text-muted-foreground">
                  Pay-per-call AI endpoint. Each message costs the listed price.
                </p>
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
                      {!isConnected && (
                        <Button className="mt-4" onClick={() => connect()}>
                          Connect Wallet to Start
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {messages.map((msg, i) => (
                  <div key={i} className={"flex " + (msg.role === "user" ? "justify-end" : "justify-start")}>
                    <div className={"max-w-[80%] rounded-2xl px-4 py-2.5 " + (msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted")}>
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
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
                      <AlertCircle className="h-4 w-4" />
                      {error}
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </CardContent>

              <div className="p-4 border-t shrink-0">
                <div className="flex gap-2">
                  <Input
                    placeholder="Type your message..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                    disabled={isLoading || paymentPending || !isConnected || !chatEndpoint}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleSend}
                    disabled={isLoading || paymentPending || !input.trim() || !isConnected || !chatEndpoint}
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

      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Payment Required
            </DialogTitle>
            <DialogDescription>
              This AI model requires payment per request. Confirm to continue.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-semibold">${paymentRequired?.amount || "0"} USDC</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Network</span>
                <span className="font-mono text-xs">{paymentRequired?.network || "eip155:84532"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Recipient</span>
                <span className="font-mono text-xs">
                  {(paymentRequired?.payTo || "").slice(0, 6)}...{(paymentRequired?.payTo || "").slice(-4)}
                </span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Your wallet will prompt you to confirm this transaction.
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowPaymentDialog(false); setPaymentRequired(null); }}>
              Cancel
            </Button>
            <Button onClick={handlePayAndRetry} disabled={paymentPending}>
              {paymentPending ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Processing...</>
              ) : (
                <><Wallet className="h-4 w-4 mr-1" /> Pay & Send</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
