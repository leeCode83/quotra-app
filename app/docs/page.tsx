import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function DocsPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="mb-12">
        <h1 className="text-4xl font-bold tracking-tight mb-2">API Documentation</h1>
        <p className="text-xl text-muted-foreground">
          Integrate with Quotra Gateway to access decentralized AI models via pay-per-call (x402).
        </p>
      </div>

      <div className="space-y-12">
        <section>
          <h2 className="text-2xl font-semibold mb-4 border-b pb-2">Authentication & Payment</h2>
          <p className="text-muted-foreground mb-4">
            Quotra uses <strong>x402</strong> (HTTP 402 Payment Required) for pay-per-call authentication.
            No JWT tokens or API keys are required. Simply make a request, and if payment is needed,
            the server will respond with a <code>402 Payment Required</code> status and payment headers.
          </p>
          <Card className="mb-4">
            <CardHeader className="bg-muted/30">
              <CardTitle className="text-sm font-mono text-primary">Request Flow</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <pre className="text-sm whitespace-pre-wrap">{`1. Send POST request to the chat endpoint with your message
2. If payment is required, server responds with 402 + headers:
   - x-402-accept: payment requirements (amount, token)
   - x-402-pay-to: treasury address
   - x-402-network: chain (e.g. eip155:84532)
3. Send USDC payment via your wallet to the facilitator
4. Retry the request with X-PAYMENT header containing the payment proof`}</pre>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="bg-muted/30">
              <CardTitle className="text-sm font-mono text-primary">Headers</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <pre className="text-sm whitespace-pre-wrap">{`Content-Type: application/json
X-PAYMENT: <payment_tx_hash>  (only on retry after 402)`}</pre>
            </CardContent>
          </Card>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 border-b pb-2">Endpoints</h2>

          <div className="space-y-8">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Badge variant="default" className="text-sm px-2 py-1 bg-green-600">POST</Badge>
                <code className="text-lg font-semibold">/api/v1/[delegationId]/chat</code>
              </div>
              <p className="text-muted-foreground mb-4">
                OpenAI-compatible chat completions endpoint. Proxies your request securely to
                the underlying provider AI model.
              </p>

              <Card className="mb-4">
                <CardHeader className="bg-muted/30">
                  <CardTitle className="text-sm font-mono text-primary">Request Body</CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <pre className="text-sm overflow-x-auto">
<code>{`{
  "chat": "Hello!",
  "systemPrompt": "You are a helpful assistant.",
  "maxOutputTokens": 1500
}`}</code>
                  </pre>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="bg-muted/30">
                  <CardTitle className="text-sm font-mono text-primary">Response</CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <pre className="text-sm overflow-x-auto">
<code>{`{
  "text": "Hello there, how may I assist you today?",
  "usage": {
    "prompt_tokens": 12,
    "completion_tokens": 18
  }
}`}</code>
                  </pre>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 border-b pb-2">Errors</h2>
          <p className="text-muted-foreground mb-4">
            Standard HTTP status codes are used to indicate success or failure.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">402 Payment Required</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Payment is required to process the request. Check response headers for payment details.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">410 Gone</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Listing is expired, inactive, or out of quota.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">429 Too Many Requests</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Rate limit exceeded for the provider endpoint.</p>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
}
