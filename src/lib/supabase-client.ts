import { createBrowserClient } from "@supabase/ssr";

export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          if (typeof document !== "undefined") {
            return document.cookie.split("; ").map((c) => {
              const [name, value] = c.split("=");
              return { name, value };
            }).filter((c) => c.name && c.value);
          }
          return [];
        },
        setAll(cookies) {
          cookies.forEach(({ name, value, options }) => {
            document.cookie = `${name}=${value}; path=/; max-age=${options?.maxAge ?? 31536000}`;
          });
        },
      },
    },
  );
