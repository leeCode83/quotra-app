import { HeroSection } from "@/components/HeroSection";
import { FeaturesSection } from "@/components/sections/FeaturesSection";
import { ListingsSection } from "@/components/sections/ListingsSection";
import { createClient } from "@/lib/supabase-server";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: listings, error } = await supabase
    .from("listings")
    .select("id, name, model_name, price_per_call_usdc, remaining_calls, max_calls")
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString())
    .order("remaining_calls", { ascending: true })
    .limit(3);

  if (error) throw error;

  const featuredListings = listings.map((item) => ({
    id: item.id,
    name: item.name,
    modelName: item.model_name,
    pricePerCallUsdc: parseFloat(item.price_per_call_usdc || 0),
    remainingCalls: item.remaining_calls,
    maxCalls: item.max_calls,
  }));

  return (
    <>
      <HeroSection />
      <FeaturesSection />
      <ListingsSection listings={featuredListings} />
    </>
  );
}
