"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { signJWT } from "@/lib/jwt";

export type SessionStatus =
  | "idle"
  | "requesting"
  | "signing"
  | "storing"
  | "active"
  | "error"
  | "expired";

export interface SessionPermission {
  /** Unique session identifier */
  sessionId: string;
  /** Consumer wallet address */
  consumerAddress: `0x${string}`;
  /** Listing ID this session is authorized for */
  listingId: string;
  /** Session key address for signing requests */
  sessionKey: `0x${string}`;
  /** ERC-7715 permission scope */
  permissions: {
    /** Allowed operations */
    allowedOperations: string[];
    /** Spending limit per request */
    spendingLimit: string;
    /** Time-bound expiry in seconds */
    expiry: number;
    /** Specific resource (listing) authorization */
    resource: string;
  };
  /** Wallet signature over the session data */
  signature: `0x${string}`;
  /** When the session was created */
  createdAt: number;
  /** When the session expires */
  expiresAt: number;
}

export interface UseSessionPermissionsReturn {
  requestSession: (listingId: string, spendingLimit?: string) => Promise<void>;
  sessionStatus: SessionStatus;
  activeSessions: SessionPermission[];
  currentSession: SessionPermission | null;
  isRequesting: boolean;
  error: string | null;
  revokeSession: (sessionId: string) => void;
  reset: () => void;
}

const SESSIONS_STORAGE_KEY = "quotra_sessions";

function loadSessionsFromStorage(): SessionPermission[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SESSIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SessionPermission[];
    const now = Date.now();
    return parsed.filter((s) => s.expiresAt > now);
  } catch {
    return [];
  }
}

function saveSessionsToStorage(sessions: SessionPermission[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // Storage might be full or unavailable
  }
}

function generateSessionKey(): `0x${string}` {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `0x${hex}`;
}

export function useSessionPermissions(): UseSessionPermissionsReturn {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("idle");
  const [activeSessions, setActiveSessions] = useState<SessionPermission[]>(() =>
    loadSessionsFromStorage()
  );
  const [currentSession, setCurrentSession] = useState<SessionPermission | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Clean up expired sessions periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveSessions((prev) => {
        const now = Date.now();
        const valid = prev.filter((s) => s.expiresAt > now);
        if (valid.length !== prev.length) {
          saveSessionsToStorage(valid);
        }
        return valid;
      });
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const requestSession = useCallback(
    async (listingId: string, spendingLimit = "0.001") => {
      if (!isConnected || !address) {
        setError("Wallet not connected");
        setSessionStatus("error");
        return;
      }

      setError(null);
      setSessionStatus("requesting");

      try {
        const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const sessionKey = generateSessionKey();
        const now = Date.now();
        const expirySeconds = 3600; // 1 hour default
        const expiresAt = now + expirySeconds * 1000;

        const permissions = {
          allowedOperations: ["call_api", "pay_per_request"],
          spendingLimit,
          expiry: expirySeconds,
          resource: `listing:${listingId}`,
        };

        const message = JSON.stringify(
          {
            types: {
              SessionPermission: [
                { name: "sessionId", type: "string" },
                { name: "consumerAddress", type: "address" },
                { name: "listingId", type: "string" },
                { name: "sessionKey", type: "address" },
                { name: "permissions", type: "string" },
                { name: "expiresAt", type: "uint256" },
              ],
            },
            primaryType: "SessionPermission",
            message: {
              sessionId,
              consumerAddress: address,
              listingId,
              sessionKey,
              permissions: JSON.stringify(permissions),
              expiresAt: Math.floor(expiresAt / 1000),
            },
          },
          null,
          2
        );

        setSessionStatus("signing");
        const signature = await signMessageAsync({ message });

        const session: SessionPermission = {
          sessionId,
          consumerAddress: address,
          listingId,
          sessionKey,
          permissions,
          signature,
          createdAt: now,
          expiresAt,
        };

        setSessionStatus("storing");

        const token = await signJWT({
          wallet_address: address,
          session_type: "erc7715",
          listing_id: listingId,
        });

        const response = await fetch("/api/consumers/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            wallet_address: address,
          }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          // 409 is acceptable - consumer already exists
          if (response.status !== 409) {
            throw new Error(data.error || "Failed to register consumer session");
          }
        }

        // Also store session permissions in a dedicated table via API
        const permResponse = await fetch("/api/consumers/permissions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            listing_id: listingId,
            session_key: sessionKey,
            permissions_json: session as unknown as Record<string, unknown>,
            expires_at: new Date(expiresAt).toISOString(),
          }),
        });

        if (!permResponse.ok && permResponse.status !== 404) {
          console.warn("[useSessionPermissions] Permissions API returned:", permResponse.status);
        }

        setActiveSessions((prev) => {
          const updated = [...prev, session];
          saveSessionsToStorage(updated);
          return updated;
        });
        setCurrentSession(session);
        setSessionStatus("active");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Session request failed";
        setError(message);
        setSessionStatus("error");
      }
    },
    [address, isConnected, signMessageAsync]
  );

  const revokeSession = useCallback((sessionId: string) => {
    setActiveSessions((prev) => {
      const updated = prev.filter((s) => s.sessionId !== sessionId);
      saveSessionsToStorage(updated);
      return updated;
    });
    setCurrentSession((prev) => (prev?.sessionId === sessionId ? null : prev));
  }, []);

  const reset = useCallback(() => {
    setSessionStatus("idle");
    setError(null);
  }, []);

  return {
    requestSession,
    sessionStatus,
    activeSessions,
    currentSession,
    isRequesting: sessionStatus === "requesting" || sessionStatus === "signing",
    error,
    revokeSession,
    reset,
  };
}
