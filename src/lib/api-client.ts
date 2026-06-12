const API_BASE = process.env.NEXT_PUBLIC_APP_URL || "";

const JWT_KEY = "quotra_jwt";

export function getJWT(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(JWT_KEY);
  } catch {
    return null;
  }
}

export function setJWT(token: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(JWT_KEY, token);
  } catch {
    /** noop */
  }
}

export function clearJWT(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(JWT_KEY);
  } catch {
    /** noop */
  }
}

export interface ApiClientOptions extends RequestInit {
  skipAuth?: boolean;
}

export async function apiClient(
  path: string,
  options: ApiClientOptions = {},
): Promise<Response> {
  const { skipAuth, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(fetchOptions.headers as Record<string, string>),
  };

  if (!skipAuth) {
    const jwt = getJWT();
    if (jwt) {
      headers["Authorization"] = `Bearer ${jwt}`;
    }
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...fetchOptions,
    headers,
  });

  if (res.status === 401) {
    clearJWT();
  }

  return res;
}
