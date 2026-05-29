import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function DocsPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="mb-12">
        <h1 className="text-4xl font-bold tracking-tight mb-2">API Documentation</h1>
        <p className="text-xl text-muted-foreground">
          Integrate with Quotra Gateway to access decentralized AI models.
        </p>
      </div>

      <div className="space-y-12">
        <section>
          <h2 className="text-2xl font-semibold mb-4 border-b pb-2">Authentication</h2>
          <p className="text-muted-foreground mb-4">
            All requests to the Quotra Gateway require a valid JWT token obtained through the 
            Marketplace after a successful 1Shot payment delegation.
          </p>
          <Card>
            <CardHeader className="bg-muted/30">
              <CardTitle className="text-sm font-mono text-primary">Headers</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <pre className="text-sm">
<code>{`Authorization: Bearer <YOUR_JWT_TOKEN>
Content-Type: application/json`}</code>
              </pre>
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
                the underlying provider&apos;s Venice AI API.
              </p>

              <Card className="mb-4">
                <CardHeader className="bg-muted/30">
                  <CardTitle className="text-sm font-mono text-primary">Request Body</CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <pre className="text-sm overflow-x-auto">
<code>{`{
  "messages": [
    { "role": "system", "content": "You are a helpful assistant." },
    { "role": "user", "content": "Hello!" }
  ],
  "max_tokens": 100
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
  "id": "chatcmpl-...",
  "object": "chat.completion",
  "created": 1677652288,
  "model": "gpt-4o-mini",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": "Hello there, how may I assist you today?"
    },
    "finish_reason": "stop"
  }]
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
                <CardTitle className="text-lg">401 Unauthorized</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Missing or invalid JWT token.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">402 Payment Required</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">1Shot verification failed or delegation limit reached.</p>
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
                <p className="text-sm text-muted-foreground">Rate limit exceeded for the provider&apos;s Venice AI endpoint.</p>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
}
