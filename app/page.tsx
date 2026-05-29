import { HeroSection } from "@/components/HeroSection";
import { FeaturesSection } from "@/components/sections/FeaturesSection";
import { ListingsSection } from "@/components/sections/ListingsSection";
import { createClient } from "@/lib/supabase-server";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: listings } = await supabase
    .from("listings")
    .select("id, name, description, model_name, price_per_call_usdc, providers ( wallet_address )")
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(3);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const featuredListings = (listings ?? []).map((item: any) => {
    const wallet = item.providers?.[0]?.wallet_address;
    return {
      id: item.id,
      name: item.name,
      description: item.description,
      modelName: item.model_name,
      pricePerCallUsdc: parseFloat(item.price_per_call_usdc || 0),
      providerWallet: wallet ? `${wallet.slice(0, 6)}...${wallet.slice(-4)}` : "Unknown",
    };
  });

  return (
    <>
      <HeroSection />
      <FeaturesSection />
      <ListingsSection listings={featuredListings} />
    </>
  );
}
