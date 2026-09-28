import type { LoginResponse, User } from "./types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/** Resolve a media field (e.g. `user.avatar`) to a full URL the browser can load. */
export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const prefix = path.startsWith("/") ? "" : "/";
  return `${API_URL}${prefix}${path}`;
}

/** Extract a display filename from a storage path or URL. */
export function fileNameFromPath(path: string | null | undefined): string {
  if (!path) return "Document";
  const name = path.split("/").pop() || "Document";
  return name.split("?")[0];
}

/** Build "First Middle Last", skipping any empty parts. */
export function formatFullName(user: Partial<Pick<User, "first_name" | "middle_name" | "last_name" | "full_name" | "email">> | null | undefined): string {
  if (!user) return "";
  if (user.full_name && user.full_name.trim()) return user.full_name.trim();
  const parts = [user.first_name, user.middle_name, user.last_name].filter((p): p is string => !!p && p.trim().length > 0);
  return parts.join(" ").trim() || user.email || "";
}

/** Two-letter initials from a user, ignoring middle name. */
export function userInitials(user: Partial<Pick<User, "first_name" | "last_name" | "email">> | null | undefined): string {
  if (!user) return "?";
  const a = (user.first_name?.[0] || "").toUpperCase();
  const b = (user.last_name?.[0] || "").toUpperCase();
  return (a + b) || (user.email?.[0] || "?").toUpperCase();
}

// ─── Token helpers ───────────────────────────────────────────────────────────

function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("refresh_token");
}

function setTokens(access: string, refresh: string): void {
  localStorage.setItem("access_token", access);
  localStorage.setItem("refresh_token", refresh);
}

function clearTokens(): void {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
}

// ─── Token refresh ───────────────────────────────────────────────────────────

let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  // Deduplicate concurrent refresh calls
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refresh = getRefreshToken();
    if (!refresh) return false;

    try {
      const res = await fetch(`${API_URL}/api/v1/auth/token/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });

      if (!res.ok) {
        clearTokens();
        return false;
      }

      const data = await res.json();
      setTokens(data.access, refresh);
      return true;
    } catch {
      clearTokens();
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// ─── Generic fetch wrapper ───────────────────────────────────────────────────

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);

  const token = getAccessToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const url = path.startsWith("http") ? path : `${API_URL}${path}`;

  let res = await fetch(url, { ...options, headers });

  // On 401, attempt one token refresh then retry
  if (res.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      const newToken = getAccessToken();
      if (newToken) {
        headers.set("Authorization", `Bearer ${newToken}`);
      }
      res = await fetch(url, { ...options, headers });
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    // Build a human-readable error message from DRF responses
    let msg = "";
    if (body.detail) {
      msg = body.detail;
    } else if (body.message) {
      msg = body.message;
    } else if (body.error) {
      msg = body.error;
    } else if (typeof body === "object" && body !== null) {
      // DRF field validation errors: { "email": ["already exists"], "name": ["required"] }
      const fieldErrors = Object.entries(body)
        .map(([key, val]) => {
          const msgs = Array.isArray(val) ? val.join(", ") : String(val);
          return `${key}: ${msgs}`;
        })
        .join("; ");
      if (fieldErrors) msg = fieldErrors;
    }
    if (!msg) msg = `Request failed with status ${res.status}`;
    const error = new Error(msg) as Error & { status: number; body: unknown };
    error.status = res.status;
    error.body = body;
    throw error;
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json();
}

// ─── Public API ──────────────────────────────────────────────────────────────

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),

  post: <T>(path: string, data?: unknown) =>
    apiFetch<T>(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: data !== undefined ? JSON.stringify(data) : undefined,
    }),

  patch: <T>(path: string, data: unknown) =>
    apiFetch<T>(path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),

  put: <T>(path: string, data: unknown) =>
    apiFetch<T>(path, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),

  delete: (path: string) =>
    apiFetch<void>(path, { method: "DELETE" }),

  /** Upload a file via FormData (no JSON content-type header). */
  upload: <T>(path: string, formData: FormData) =>
    apiFetch<T>(path, {
      method: "POST",
      body: formData,
    }),

  /** PATCH with FormData (for file uploads via PATCH). */
  patchFormData: <T>(path: string, formData: FormData) =>
    apiFetch<T>(path, {
      method: "PATCH",
      body: formData,
    }),

  // ── Auth shortcuts ───────────────────────────────────────────────────────

  login: async (email: string, password: string): Promise<User> => {
    const tokens = await apiFetch<LoginResponse>("/api/v1/auth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    setTokens(tokens.access, tokens.refresh);

    // Fetch and return the current user profile
    const user = await apiFetch<User>("/api/v1/accounts/users/me/");
    return user;
  },

  logout: (): void => {
    clearTokens();
  },

  /** Check whether tokens exist (does NOT validate them). */
  hasTokens: (): boolean => !!getAccessToken(),

  /** Fetch the current authenticated user. */
  me: (): Promise<User> => apiFetch<User>("/api/v1/accounts/users/me/"),
};
