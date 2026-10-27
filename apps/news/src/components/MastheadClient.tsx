"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useAuth } from "./AuthProvider";

const noSubscribe = () => () => {};
const todayLabel = () =>
  new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

/** Today's date in the reader's time zone. Empty during server rendering. */
export function TodayDate() {
  return <>{useSyncExternalStore(noSubscribe, todayLabel, () => "")}</>;
}

/** The reader's avatar in the top right; tapping it opens the account menu. */
export function AccountMenu() {
  const { user, signInWithGoogle, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const signedIn = Boolean(user && !user.isAnonymous);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const name = signedIn ? user?.displayName || user?.email || "" : "";
  return (
    <div className="account" ref={rootRef}>
      <button
        className="avatar"
        aria-label={signedIn ? `Account menu for ${name}` : "Account menu"}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Avatar photoURL={signedIn ? user?.photoURL : null} name={name} />
      </button>
      {open && (
        <div className="account-menu" role="menu">
          {signedIn && name && <div className="account-name">{name}</div>}
          <Link href="/interests" role="menuitem" onClick={() => setOpen(false)}>
            Your interests
          </Link>
          {signedIn ? (
            <button
              role="menuitem"
              onClick={() => {
                setOpen(false);
                signOut().catch(() => setError("Sign-out didn't finish"));
              }}
            >
              Sign out
            </button>
          ) : (
            <button
              role="menuitem"
              title="Keep your interests on every device"
              onClick={() => {
                setError("");
                signInWithGoogle()
                  .then(() => setOpen(false))
                  .catch(() => setError("Sign-in didn't finish"));
              }}
            >
              Sign in
            </button>
          )}
          {error && <div className="account-error">{error}</div>}
        </div>
      )}
    </div>
  );
}

function Avatar({ photoURL, name }: { photoURL?: string | null; name: string }) {
  const [broken, setBroken] = useState(false);
  if (photoURL && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Google profile photos are linked, never proxied
      <img src={photoURL} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
    );
  }
  if (name) return <span aria-hidden="true">{name.trim().charAt(0).toUpperCase()}</span>;
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="9" r="4" fill="currentColor" />
      <path d="M4 20c1.2-3.6 4.3-5.5 8-5.5s6.8 1.9 8 5.5" fill="currentColor" />
    </svg>
  );
}

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

/** Shows "Install app" when the browser offers PWA installation. */
export function InstallButton() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);
  if (!prompt) return <span />;
  return (
    <button
      className="linkish"
      onClick={async () => {
        await prompt.prompt();
        setPrompt(null);
      }}
    >
      Install app
    </button>
  );
}
