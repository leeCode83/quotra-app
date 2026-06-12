"use client";

import { useCallback, useMemo, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { apiClient, getJWT, setJWT, clearJWT } from "@/lib/api-client";

export interface AuthState {
  isAuthenticated: boolean;
  isLoggingIn: boolean;
  error: string | null;
  login: () => Promise<void>;
  logout: () => void;
}

function getInitialJWT(): string | null {
  if (typeof window === "undefined") return null;
  return getJWT();
}

export function useAuth(): AuthState {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storedJwt, setStoredJwt] = useState<string | null>(getInitialJWT);

  const jwt = useMemo(() => {
    if (!isConnected || !address) return null;
    return storedJwt;
  }, [isConnected, address, storedJwt]);

  const login = useCallback(async () => {
    if (!address) return;
    setIsLoggingIn(true);
    setError(null);

    try {
      const nonceRes = await apiClient("/api/auth/nonce", {
        method: "POST",
        body: JSON.stringify({ address }),
        skipAuth: true,
      });

      if (!nonceRes.ok) {
        throw new Error("Failed to get nonce");
      }

      const { message } = await nonceRes.json();

      const signature = await signMessageAsync({ message });

      const loginRes = await apiClient("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ address, signature, message }),
        skipAuth: true,
      });

      if (!loginRes.ok) {
        const body = await loginRes.json().catch(() => ({}));
        throw new Error(body.error || "Login failed");
      }

      const { jwt: token } = await loginRes.json();
      setJWT(token);
      setStoredJwt(token);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Authentication failed";
      setError(message);
    } finally {
      setIsLoggingIn(false);
    }
  }, [address, signMessageAsync]);

  const logout = useCallback(() => {
    clearJWT();
    setStoredJwt(null);
    setError(null);
  }, []);

  return {
    isAuthenticated: !!jwt,
    isLoggingIn,
    error,
    login,
    logout,
  };
}
