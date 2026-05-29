"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Coins, ArrowRightLeft, DollarSign } from "lucide-react"
import { formatPrice } from "@/lib/utils"

interface EarningsPanelProps {
  pendingEarnings: number | string
  totalEarned: number | string
  onWithdraw?: () => void
}

export function EarningsPanel({ pendingEarnings, totalEarned, onWithdraw }: EarningsPanelProps) {
  const [isWithdrawing, setIsWithdrawing] = useState(false)

  const handleWithdraw = async () => {
    setIsWithdrawing(true)
    if (onWithdraw) {
      try {
        await onWithdraw()
      } catch (err) {
        console.error(err)
      }
    }
    setIsWithdrawing(false)
  }

  const pending = typeof pendingEarnings === 'string' ? parseFloat(pendingEarnings) : pendingEarnings;
  const total = typeof totalEarned === 'string' ? parseFloat(totalEarned) : totalEarned;

  return (
    <Card className="shadow-sm border-muted">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-primary" />
          Provider Earnings
        </CardTitle>
        <CardDescription>
          Your earnings from AI model access provision
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4 py-4">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <Coins className="h-4 w-4" /> Pending Earnings
          </p>
          <p className="text-3xl font-bold text-primary">
            ${formatPrice(pending)}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <ArrowRightLeft className="h-4 w-4" /> Lifetime Earned
          </p>
          <p className="text-3xl font-bold text-foreground">
            ${formatPrice(total)}
          </p>
        </div>
      </CardContent>
      <CardFooter>
        <Button 
          className="w-full" 
          disabled={pending <= 0 || isWithdrawing} 
          onClick={handleWithdraw}
        >
          {isWithdrawing ? "Processing..." : "Withdraw USDC to Wallet"}
        </Button>
      </CardFooter>
    </Card>
  )
}
