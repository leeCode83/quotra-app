"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatPrice, cn } from "@/lib/utils"
import { ExternalLink } from "lucide-react"

export interface Transaction {
  id: string
  txHash?: string
  amountUsdc: string | number
  modelName?: string
  status: "pending" | "completed" | "refund_pending" | "refunded" | "failed" | string
  timestamp: string
  completedAt?: string
  type?: "income" | "expense"
}

interface TransactionHistoryProps {
  transactions: Transaction[]
  title?: string
}

export function TransactionHistory({ transactions, title = "Recent Transactions" }: TransactionHistoryProps) {
  if (transactions.length === 0) {
    return (
      <div className="rounded-md border border-muted p-8 text-center bg-card">
        <h3 className="text-lg font-medium">{title}</h3>
        <p className="text-muted-foreground mt-2">No transactions found.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">{title}</h3>
      <div className="rounded-md border bg-card overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground bg-muted/50 uppercase border-b">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Tx Hash</th>
              <th className="px-4 py-3 font-medium">Model</th>
              <th className="px-4 py-3 font-medium">Amount (USDC)</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {transactions.map((tx) => {
              const amount = typeof tx.amountUsdc === 'string' ? parseFloat(tx.amountUsdc) : tx.amountUsdc;
              
              return (
                <tr key={tx.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-3">
                    {new Date(tx.timestamp).toLocaleDateString()} {new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs flex items-center gap-2">
                    {tx.txHash ? (
                      <>
                        <span className="truncate max-w-[120px]" title={tx.txHash}>
                          {tx.txHash.substring(0, 10)}...{tx.txHash.slice(-8)}
                        </span>
                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" asChild>
                          <a 
                            href={`https://base-sepolia.blockscout.com/tx/${tx.txHash}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            title="View on Blockscout"
                          >
                            <ExternalLink className="h-3 w-3" />
                            <span className="sr-only">View on Blockscout</span>
                          </a>
                        </Button>
                      </>
                    ) : (
                      <span className="text-muted-foreground italic">x402 settled</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {tx.modelName ? (
                      <Badge variant="outline" className="font-normal">{tx.modelName}</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className={cn(
                    "px-4 py-3 font-medium",
                    tx.type === "expense" ? "text-destructive" : "text-green-600 dark:text-green-400"
                  )}>
                    {tx.type === "expense" ? "-" : "+"}${formatPrice(amount)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge 
                      variant={
                        tx.status === "completed" ? "success" : 
                        tx.status === "pending" ? "secondary" : "destructive"
                      }
                      className="capitalize"
                    >
                      {tx.status.replace("_", " ")}
                    </Badge>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
