import { createClient as createSupabaseClient } from "@supabase/supabase-js";

let cachedAnonClient: ReturnType<typeof createSupabaseClient> | null = null;

export async function createClient(jwt?: string) {
  if (jwt) {
    return createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${jwt}`,
          },
        },
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  }

  if (!cachedAnonClient) {
    cachedAnonClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  }

  return cachedAnonClient;
}
