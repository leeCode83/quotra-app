import { NextResponse } from "next/server";
import { getRelayerCapabilities } from "@/lib/oneshot";

export const revalidate = 300; // Cache for 5 minutes

export async function GET() {
  try {
    // For now we hardcode Base Sepolia (84532) as per requirements
    const chainId = "84532";
    const caps = await getRelayerCapabilities([chainId]);
    
    if (!caps || !caps[chainId]) {
      throw new Error(`Chain ${chainId} not supported by relayer or invalid response`);
    }

    const { targetAddress, feeCollector, tokens } = caps[chainId];
    const usdcToken = tokens.find((t: { symbol: string, address: string, decimals: number }) => t.symbol === "USDC");

    if (!usdcToken) {
      throw new Error("USDC token not supported by relayer on this chain");
    }

    return NextResponse.json({
      success: true,
      config: {
        chainId,
        targetAddress,
        feeCollector,
        usdcAddress: usdcToken.address,
        usdcDecimals: usdcToken.decimals,
      }
    });
  } catch (err) {
    console.error("[relayer-config] GET Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch relayer config", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
