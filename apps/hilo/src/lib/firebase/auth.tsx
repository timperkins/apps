'use client';

import {
  Auth,
  connectAuthEmulator,
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
} from 'firebase/auth';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { app, useEmulators } from './firebase';

const auth = getAuth(app);

if (useEmulators && typeof window !== 'undefined' && !auth.emulatorConfig) {
  connectAuthEmulator(auth, `http://${window.location.hostname}:9099`, { disableWarnings: true });
}

const AuthContext = createContext<Auth | undefined>(undefined);

export const useAuth = () => {
  const auth = useContext(AuthContext);
  if (auth === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return auth;
};

/** Signs every visitor in anonymously; their uid is their player id. */
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setReady(true);
        return;
      }
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error('Failed to sign in anonymously:', error);
        setReady(true);
      }
    });
  }, []);

  if (!ready) return null;

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
};
