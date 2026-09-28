"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { api } from "./api";
import type { User, Organisation } from "./types";

// ─── Context shape ───────────────────────────────────────────────────────────

interface AuthContextValue {
  user: User | null;
  organisation: Organisation | null;
  loading: boolean;
  isAuthenticated: boolean;
  isSetupComplete: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshOrganisation: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ─── Provider ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [organisation, setOrganisation] = useState<Organisation | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchOrganisation = useCallback(async () => {
    try {
      const org = await api.get<Organisation>("/api/v1/organisations/my-org/");
      setOrganisation(org);
      return org;
    } catch {
      setOrganisation(null);
      return null;
    }
  }, []);

  // On mount, try to hydrate user from stored tokens
  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      if (!api.hasTokens()) {
        setLoading(false);
        return;
      }

      try {
        const [me, org] = await Promise.all([
          api.me(),
          api.get<Organisation>("/api/v1/organisations/my-org/"),
        ]);
        if (!cancelled) {
          setUser(me);
          setOrganisation(org);
        }
      } catch {
        // Token invalid / expired and refresh failed
        api.logout();
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const me = await api.login(email, password);
      setUser(me);
      // Fetch org data after login
      await fetchOrganisation();
    },
    [fetchOrganisation]
  );

  const logout = useCallback(() => {
    api.logout();
    setUser(null);
    setOrganisation(null);
    router.push("/login");
  }, [router]);

  const refreshOrganisation = useCallback(async () => {
    await fetchOrganisation();
  }, [fetchOrganisation]);

  return (
    <AuthContext.Provider
      value={{
        user,
        organisation,
        loading,
        isAuthenticated: !!user,
        isSetupComplete: organisation?.is_setup_complete ?? false,
        login,
        logout,
        refreshOrganisation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
