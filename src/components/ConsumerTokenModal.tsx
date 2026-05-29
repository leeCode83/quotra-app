"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Copy, Check } from "lucide-react"

interface ConsumerTokenModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  jwt: string
  endpoint: string
  expiresAt: string
}

export function ConsumerTokenModal({ open, onOpenChange, jwt, endpoint, expiresAt }: ConsumerTokenModalProps) {
  const [copiedToken, setCopiedToken] = useState(false)
  const [copiedEndpoint, setCopiedEndpoint] = useState(false)

  const copyToClipboard = async (text: string, isToken: boolean) => {
    try {
      await navigator.clipboard.writeText(text)
      if (isToken) {
        setCopiedToken(true)
        setTimeout(() => setCopiedToken(false), 2000)
      } else {
        setCopiedEndpoint(true)
        setTimeout(() => setCopiedEndpoint(false), 2000)
      }
    } catch (err) {
      console.error("Failed to copy", err)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Permission Granted Successfully</DialogTitle>
          <DialogDescription>
            You can now use the following credentials to access the Venice AI model through Quotra. 
            Store this token securely; it won&apos;t be shown again.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Gateway Endpoint</h4>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-muted p-2 rounded-md text-xs font-mono break-all border">
                {endpoint}
              </code>
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(endpoint, false)}
                title="Copy endpoint"
              >
                {copiedEndpoint ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center justify-between">
              <span>Access Token (JWT)</span>
              <span className="text-xs text-muted-foreground font-normal">
                Expires: {new Date(expiresAt).toLocaleString()}
              </span>
            </h4>
            <div className="flex items-start gap-2">
              <code className="flex-1 bg-muted p-2 rounded-md text-xs font-mono break-all h-24 overflow-y-auto border">
                {jwt}
              </code>
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(jwt, true)}
                title="Copy JWT"
              >
                {copiedToken ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close & Continue</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
