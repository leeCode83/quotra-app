import { useCallback, useState } from "react";
import { useSignMessage, useAccount } from "wagmi";

export function useAuth() {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const login = useCallback(async () => {
    if (!address) return;
    setIsLoading(true);
    try {
      const message = `Quotra authentication for ${address}. Sign this message to prove wallet ownership.`;
      const signature = await signMessageAsync({ message });
      const res = await fetch("/api/auth/siwe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet_address: address, message, signature }),
      });
      if (!res.ok) throw new Error("Auth failed");
      const data = await res.json();
      setToken(data.token);
      return data.token;
    } finally {
      setIsLoading(false);
    }
  }, [address, signMessageAsync]);

  const logout = useCallback(() => setToken(null), []);

  return { token, isLoading, login, logout, isAuthenticated: !!token };
}
