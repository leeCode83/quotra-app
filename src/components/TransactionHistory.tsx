"use client"

import { Badge } from "@/components/ui/badge"
import { formatPrice } from "@/lib/utils"

export interface Transaction {
  id: string
  txHash: string
  amountUsdc: string | number
  modelName: string
  status: "pending" | "completed" | "refund_pending" | "refunded"
  timestamp: string
  completedAt?: string
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
                  <td className="px-4 py-3 font-mono text-xs truncate max-w-[150px]">
                    <a 
                      href={`https://sepolia.basescan.org/tx/${tx.txHash}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {tx.txHash.substring(0, 10)}...{tx.txHash.slice(-8)}
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="font-normal">{tx.modelName}</Badge>
                  </td>
                  <td className="px-4 py-3 font-medium text-green-600 dark:text-green-400">
                    +${formatPrice(amount)}
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
