"use client";

import { useAuth } from "./AuthProvider";

export function Account() {
  const { user, signOut } = useAuth();
  if (!user) return null;
  return (
    <button className="link" onClick={signOut} title={user.email ?? undefined}>
      Sign out
    </button>
  );
}
