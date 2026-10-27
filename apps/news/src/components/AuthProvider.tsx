"use client";

import {
  GoogleAuthProvider,
  linkWithPopup,
  onAuthStateChanged,
  signInAnonymously,
  signInWithCredential,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { clientAuth, clientDb, firebaseConfigured } from "@/lib/firebase/client";
import { applySignal, type Signal } from "@/lib/interests";
import type { UserProfile } from "@/lib/types";

const EMPTY_PROFILE: UserProfile = {
  interests: {},
  region: null,
  settings: { trackingPaused: false, localEnabled: false },
};

interface AuthState {
  user: User | null;
  profile: UserProfile;
  /** True once the profile has loaded from Firestore (or there is nothing to load). */
  ready: boolean;
  updateProfile: (patch: Partial<UserProfile>) => Promise<void>;
  recordSignal: (topics: string[], signal: Signal) => void;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  /** fetch() with the reader's Firebase ID token attached. */
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
  const [profile, setProfile] = useState<UserProfile>(EMPTY_PROFILE);
  const [ready, setReady] = useState(!firebaseConfigured);

  useEffect(() => {
    if (!firebaseConfigured) return;
    const auth = clientAuth();
    return onAuthStateChanged(auth, (next) => {
      if (!next) {
        // Drop the old account first so its profile listener stops before access is lost.
        setUser(null);
        // Everyone gets an anonymous account so interests can be saved without signing up.
        signInAnonymously(auth).catch((error) => {
          console.error("Anonymous sign-in failed", error);
          setReady(true);
        });
        return;
      }
      setUser(next);
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      doc(clientDb(), "users", user.uid),
      (snap) => {
        const data = snap.data() as Partial<UserProfile> | undefined;
        setProfile({
          interests: data?.interests ?? {},
          region: data?.region ?? null,
          settings: { ...EMPTY_PROFILE.settings, ...(data?.settings ?? {}) },
        });
        setReady(true);
      },
      (error) => {
        console.error("Couldn't load profile", error);
        setReady(true);
      },
    );
  }, [user]);

  const updateProfile = useCallback(
    async (patch: Partial<UserProfile>) => {
      if (!user) return;
      setProfile((p) => ({ ...p, ...patch }));
      // Each field is replaced whole, so interests removed by the reader disappear.
      await setDoc(doc(clientDb(), "users", user.uid), patch, { mergeFields: Object.keys(patch) });
    },
    [user],
  );

  const recordSignal = useCallback(
    (topics: string[], signal: Signal) => {
      if (!user || profile.settings.trackingPaused || !topics.length) return;
      const interests = applySignal(profile.interests, topics, signal);
      setProfile((p) => ({ ...p, interests }));
      setDoc(doc(clientDb(), "users", user.uid), { interests }, { mergeFields: ["interests"] }).catch(
        (error) => console.error("Couldn't save interests", error),
      );
    },
    [user, profile],
  );

  const signInWithGoogle = useCallback(async () => {
    const auth = clientAuth();
    const provider = new GoogleAuthProvider();
    if (auth.currentUser?.isAnonymous) {
      try {
        // Keeps this device's interests by upgrading the anonymous account.
        await linkWithPopup(auth.currentUser, provider);
        setUser(auth.currentUser);
        return;
      } catch (error) {
        const credential = GoogleAuthProvider.credentialFromError(error as never);
        if (!credential) throw error;
        // That Google account already exists; switch to it.
        await signInWithCredential(auth, credential);
        return;
      }
    }
    // No anonymous account to upgrade (for example, anonymous sign-in failed).
    await signInWithPopup(auth, provider);
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(clientAuth());
    setProfile(EMPTY_PROFILE);
  }, []);

  const authedFetch = useCallback(
    async (input: string, init: RequestInit = {}) => {
      const token = user ? await user.getIdToken() : "";
      return fetch(input, {
        ...init,
        headers: {
          "content-type": "application/json",
          ...(init.headers ?? {}),
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
      });
    },
    [user],
  );

  const value = useMemo(
    () => ({ user, profile, ready, updateProfile, recordSignal, signInWithGoogle, signOut, authedFetch }),
    [user, profile, ready, updateProfile, recordSignal, signInWithGoogle, signOut, authedFetch],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
