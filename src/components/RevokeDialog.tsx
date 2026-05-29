"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface RevokeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => Promise<void>
}

export function RevokeDialog({ open, onOpenChange, onConfirm }: RevokeDialogProps) {
  const [isRevoking, setIsRevoking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleRevoke = async () => {
    setIsRevoking(true)
    setError(null)
    
    try {
      await onConfirm()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke permission")
    } finally {
      setIsRevoking(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Revoke Permission</DialogTitle>
          <DialogDescription>
            Are you sure you want to revoke this session? 
            This will immediately prevent the key from being used for further transactions.
            Active in-flight transactions may still complete.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="text-red-500 text-sm py-2">
            {error}
          </div>
        )}

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isRevoking}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleRevoke} disabled={isRevoking}>
            {isRevoking ? "Revoking..." : "Revoke Access"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
