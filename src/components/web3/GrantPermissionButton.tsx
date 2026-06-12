"use client";

import { usePermissions } from "@/hooks/usePermissions";
import { Shield, Loader2, Check } from "lucide-react";
import { useState } from "react";
import { apiClient } from "@/lib/api-client";

interface GrantPermissionButtonProps {
  listingId: string;
  onGranted?: () => void;
}

export function GrantPermissionButton({ listingId, onGranted }: GrantPermissionButtonProps) {
  const { requestPermission, isLoading, error: permissionError } = usePermissions();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGrant = async () => {
    try {
      setStatus("loading");
      setErrorMsg(null);
      
      const result = await requestPermission();
      
      if (result?.error) {
        throw new Error(result.error);
      }

      if (!result?.permissions || result.permissions.length === 0) {
        throw new Error("No permissions returned from wallet");
      }

      const permission = result.permissions[0];
      
      // Save permission to backend
      const res = await apiClient("/api/permissions", {
        method: "POST",
        body: JSON.stringify({
          listing_id: listingId,
          permission_context: permission.context,
          session_account_address: result.sessionAccount?.address || "",
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to save permission");
      }

      setStatus("success");
      
      if (onGranted) {
        onGranted();
      }
      
      setTimeout(() => {
        setStatus("idle");
      }, 3000);
      
    } catch (err: unknown) {
      console.error("Grant permission error:", err);
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : permissionError || "Failed to grant permission");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleGrant}
        disabled={status === "loading" || status === "success" || isLoading}
        className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors w-full"
      >
        {status === "loading" || isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Requesting...
          </>
        ) : status === "success" ? (
          <>
            <Check className="w-4 h-4" />
            Permission Active
          </>
        ) : (
          <>
            <Shield className="w-4 h-4" />
            Grant Session Permission
          </>
        )}
      </button>
      
      {(status === "error" || permissionError) && (
        <p className="text-xs text-red-500 text-center">
          {errorMsg || permissionError}
        </p>
      )}
      
      <p className="text-xs text-gray-500 text-center">
        Session-only auth. Payments handled via x402.
      </p>
    </div>
  );
}
