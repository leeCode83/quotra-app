import { useCallback, useState, useEffect } from "react";
import { useSignMessage, useAccount } from "wagmi";

export function useAuth() {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("quotra_auth_token");
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState(false);

  // Optional: clear token if wallet address changes to avoid mismatched sessions
  useEffect(() => {
    // Only clear if we actually have an address (connected) and we want to ensure it matches
    // But since the token doesn't expose the address easily on client, a simple way is just 
    // to clear if address becomes undefined (disconnected)
    if (!address && typeof window !== "undefined") {
      const savedToken = localStorage.getItem("quotra_auth_token");
      if (savedToken) {
        /* eslint-disable react-hooks/set-state-in-effect */
        setToken(null);
        /* eslint-enable react-hooks/set-state-in-effect */
        localStorage.removeItem("quotra_auth_token");
      }
    }
  }, [address]);

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
      localStorage.setItem("quotra_auth_token", data.token);
      return data.token;
    } finally {
      setIsLoading(false);
    }
  }, [address, signMessageAsync]);

  const logout = useCallback(() => {
    setToken(null);
    localStorage.removeItem("quotra_auth_token");
  }, []);

  return { token, isLoading, login, logout, isAuthenticated: !!token };
}
