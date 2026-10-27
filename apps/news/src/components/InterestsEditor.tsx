"use client";

import { useState } from "react";
import { TOPICS } from "@/lib/config";
import { firebaseConfigured } from "@/lib/firebase/client";
import { addInterest, effectiveWeight, updateInterest } from "@/lib/interests";
import type { Interest } from "@/lib/types";
import { useAuth } from "./AuthProvider";
import { CityForm, useLocalNews } from "./LocationCard";

export function InterestsEditor() {
  const { user, profile, ready, updateProfile, signInWithGoogle } = useAuth();
  const { status, message, shareLocation, chooseCity } = useLocalNews();
  const [draft, setDraft] = useState("");

  if (!firebaseConfigured) {
    return <div className="notice narrow">Firebase isn&apos;t configured yet, so interests can&apos;t be saved.</div>;
  }
  if (!ready) return null;

  const entries = Object.entries(profile.interests).sort(
    (a, b) => Number(b[1].pinned) - Number(a[1].pinned) || effectiveWeight(b[1]) - effectiveWeight(a[1]),
  );
  const setInterests = (interests: Record<string, Interest>) => updateProfile({ interests });
  const patch = (key: string, change: Partial<Pick<Interest, "pinned" | "muted">>) =>
    setInterests(updateInterest(profile.interests, key, change));
  const remove = (key: string) => {
    const next = { ...profile.interests };
    delete next[key];
    setInterests(next);
  };
  const suggestions = Object.entries(TOPICS).filter(([key]) => !profile.interests[key]);

  return (
    <div className="narrow settings">
      <h1>Your interests</h1>
      <p className="lede">
        Tim News notices which stories you open and read, and uses that to pick sections like &ldquo;Based on your
        interest in&nbsp;…&rdquo;. Only this short list is stored. Pin topics to keep them, or mute ones you don&apos;t
        want.
      </p>

      <section className="section">
        <div className="section-head">
          <span>Topics</span>
        </div>
        {entries.length === 0 && <div className="notice">No interests yet. Add some below, or just start reading.</div>}
        <div className="interest-list">
          {entries.map(([key, interest]) => (
            <div className="interest" key={key}>
              <div>
                <div className="name">
                  {interest.label}
                  {interest.pinned && <small>Pinned</small>}
                  {interest.muted && <small>Muted</small>}
                </div>
                <div className="bar" aria-label={`Strength ${Math.round(effectiveWeight(interest) * 100)}%`}>
                  <i style={{ width: `${Math.round(effectiveWeight(interest) * 100)}%` }} />
                </div>
              </div>
              <div className="actions">
                <button className="linkish" onClick={() => patch(key, { pinned: !interest.pinned, muted: false })}>
                  {interest.pinned ? "Unpin" : "Pin"}
                </button>
                <button className="linkish" onClick={() => patch(key, { muted: !interest.muted, pinned: false })}>
                  {interest.muted ? "Unmute" : "Mute"}
                </button>
                <button className="linkish" onClick={() => remove(key)}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.trim()) return;
            setInterests(addInterest(profile.interests, draft));
            setDraft("");
          }}
        >
          <label htmlFor="new-interest" style={{ position: "absolute", left: -9999 }}>
            Add an interest
          </label>
          <input
            id="new-interest"
            className="input"
            placeholder="Add an interest, like electric cars"
            value={draft}
            maxLength={40}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button className="btn primary" disabled={!draft.trim()}>
            Add
          </button>
        </form>
        {suggestions.length > 0 && (
          <div className="chips" style={{ marginTop: 14 }}>
            {suggestions.map(([key, label]) => (
              <button key={key} className="chip" onClick={() => setInterests(addInterest(profile.interests, label))}>
                + {label}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="section" id="local">
        <div className="section-head">
          <span>Local news</span>
        </div>
        {profile.settings.localEnabled && profile.region ? (
          <p className="lede">
            Showing local news for <strong>{profile.region.label}</strong>. If you allowed location, this follows you
            when you travel to another city.
          </p>
        ) : (
          <p className="lede">Local news is off.</p>
        )}
        <div className="inline-form">
          <button className="btn" onClick={shareLocation} disabled={status === "locating"}>
            {status === "locating" ? "Finding your city…" : "Use my location"}
          </button>
          {profile.settings.localEnabled && (
            <button
              className="btn"
              onClick={() => updateProfile({ region: null, settings: { ...profile.settings, localEnabled: false } })}
            >
              Turn off local news
            </button>
          )}
        </div>
        <CityForm onCity={chooseCity} busy={status === "locating"} />
        {status === "error" && <p className="lede">{message}</p>}
      </section>

      <section className="section">
        <div className="section-head">
          <span>Privacy</span>
        </div>
        <label className="toggle">
          <input
            id="pause-tracking"
            type="checkbox"
            checked={profile.settings.trackingPaused}
            onChange={(e) => updateProfile({ settings: { ...profile.settings, trackingPaused: e.target.checked } })}
          />
          Pause learning from what I read
        </label>
        <div className="inline-form">
          <button className="btn" onClick={() => setInterests({})} disabled={!entries.length}>
            Reset my interests
          </button>
          {user?.isAnonymous && (
            <button className="btn" onClick={() => signInWithGoogle().catch(() => {})}>
              Sign in with Google to keep these on every device
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
