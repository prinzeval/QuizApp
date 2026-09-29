import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, ApiError, tokenStore, type AuthResponse, type User } from "../lib/api.ts";

type Status = "loading" | "authenticated" | "anonymous";

interface AuthContextValue {
  status: Status;
  user: User | null;
  signup: (input: { name: string; email: string; password: string }) => Promise<void>;
  login: (input: { email: string; password: string }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<Status>(() => (tokenStore.get() ? "loading" : "anonymous"));

  // Restore the session from a saved token on first load.
  useEffect(() => {
    if (status !== "loading") return;
    let cancelled = false;
    api
      .me()
      .then(({ user }) => {
        if (cancelled) return;
        setUser(user);
        setStatus("authenticated");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        // Only forget the token when the server says it's bad, not when it's unreachable.
        if (error instanceof ApiError && error.status === 401) tokenStore.clear();
        setStatus("anonymous");
      });
    return () => {
      cancelled = true;
    };
  }, [status]);

  const accept = useCallback(({ user, token }: AuthResponse) => {
    tokenStore.set(token);
    setUser(user);
    setStatus("authenticated");
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      signup: async input => accept(await api.signup(input)),
      login: async input => accept(await api.login(input)),
      logout: () => {
        tokenStore.clear();
        setUser(null);
        setStatus("anonymous");
      },
    }),
    [status, user, accept],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
