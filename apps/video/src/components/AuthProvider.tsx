"use client";

import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { clientAuth, firebaseConfigured } from "@/lib/firebase/client";

type Access = "loading" | "signed-out" | "allowed" | "denied";

interface AuthState {
  user: User | null;
  access: Access;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  /** fetch() with the user's Firebase ID token attached. */
  authedFetch: (input: string, init?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [access, setAccess] = useState<Access>(firebaseConfigured ? "loading" : "signed-out");
  const [error, setError] = useState<string | null>(
    firebaseConfigured ? null : "Firebase isn't configured. Copy .env.example to .env.local.",
  );

  useEffect(() => {
    if (!firebaseConfigured) return;
    return onAuthStateChanged(clientAuth(), async (next) => {
      setUser(next);
      if (!next) {
        setAccess("signed-out");
        return;
      }
      // The server decides who's allowed, from the email allowlist.
      try {
        const res = await fetch("/api/me", {
          headers: { Authorization: `Bearer ${await next.getIdToken()}` },
        });
        setAccess(res.ok ? "allowed" : "denied");
        if (!res.ok) setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? null);
      } catch {
        setAccess("denied");
        setError("Couldn't reach the server. Check your connection and reload.");
      }
    });
  }, []);

  const signIn = useCallback(async () => {
    setError(null);
    try {
      await signInWithPopup(clientAuth(), new GoogleAuthProvider());
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(clientAuth());
  }, []);

  const authedFetch = useCallback(
    async (input: string, init: RequestInit = {}) => {
      const token = await user?.getIdToken();
      const headers = new Headers(init.headers);
      if (token) headers.set("Authorization", `Bearer ${token}`);
      return fetch(input, { ...init, headers });
    },
    [user],
  );

  const value = useMemo(
    () => ({ user, access, error, signIn, signOut, authedFetch }),
    [user, access, error, signIn, signOut, authedFetch],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Shows children only to an allowed, signed-in user. */
export function SignInGate({ children }: { children: React.ReactNode }) {
  const { access, error, user, signIn, signOut } = useAuth();
  if (access === "loading") return <p className="muted">Loading…</p>;
  if (access === "allowed") return <>{children}</>;
  return (
    <section className="card">
      <h2>{access === "denied" ? "No access" : "Sign in"}</h2>
      {access === "denied" ? (
        <>
          <p>{error ?? `${user?.email ?? "This account"} isn't allowed to use this app.`}</p>
          <button onClick={signOut}>Sign out</button>
        </>
      ) : (
        <>
          <p>Sign in with Google to upload footage.</p>
          <button className="primary" onClick={signIn}>
            Sign in with Google
          </button>
          {error && <p className="error">{error}</p>}
        </>
      )}
    </section>
  );
}
