import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, ApiError, onUnauthorized, tokenStore, type AuthResponse, type User } from "../lib/api.ts";
import { setErrorReportingUser } from "../lib/sentry.ts";

type Status = "loading" | "authenticated" | "anonymous";

interface AuthContextValue {
  status: Status;
  user: User | null;
  signup: (input: { name: string; email: string; password: string }) => Promise<void>;
  login: (input: { email: string; password: string }) => Promise<void>;
  /** Sign in with a Google Identity Services credential. `created` is true for a brand-new account. */
  loginWithGoogle: (credential: string) => Promise<{ created: boolean }>;
  /** Set a new password from an emailed reset link; signs you in. */
  resetPassword: (input: { token: string; password: string }) => Promise<void>;
  logout: () => void;
  /** Replace the cached user after a profile change. */
  updateUser: (user: User) => void;
  /** Swap in a new session token (after a password change) without logging out. */
  replaceToken: (token: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
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

  // Any request rejected with 401 means the session is over.
  useEffect(() => {
    onUnauthorized(() => {
      tokenStore.clear();
      queryClient.clear();
      setUser(null);
      setStatus("anonymous");
    });
    return () => onUnauthorized(null);
  }, [queryClient]);

  // Tag error reports with the account id (never the email) so they can be traced to a user.
  useEffect(() => {
    setErrorReportingUser(user ? { id: user.id } : null);
  }, [user]);

  const accept = useCallback(
    ({ user: next, token }: AuthResponse) => {
      // A reset link opened while someone else is signed in on this browser: drop their cached data.
      if (user && user.id !== next.id) queryClient.clear();
      tokenStore.set(token);
      setUser(next);
      setStatus("authenticated");
    },
    [user, queryClient],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      signup: async input => accept(await api.signup(input)),
      login: async input => accept(await api.login(input)),
      loginWithGoogle: async credential => {
        const { created, ...session } = await api.google(credential);
        accept(session);
        return { created };
      },
      resetPassword: async input => accept(await api.resetPassword(input)),
      updateUser: setUser,
      replaceToken: token => tokenStore.set(token),
      logout: () => {
        tokenStore.clear();
        // Drop cached data so the next person on this browser never sees it.
        queryClient.clear();
        setUser(null);
        setStatus("anonymous");
      },
    }),
    [status, user, accept, queryClient],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
