"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import { TOPICS } from "@/lib/config";
import { addInterest, effectiveWeight, interestMatch } from "@/lib/interests";
import { slugify } from "@/lib/text";
import type { FollowupSuggestion } from "@/lib/types";
import { useAuth } from "./AuthProvider";

/** Records that the reader opened, and then actually read, a story. */
export function ReadTracker({ topics }: { topics: string[] }) {
  const { user, recordSignal } = useAuth();
  const done = useRef({ open: false, read: false });
  const topicsKey = topics.join(",");

  useEffect(() => {
    if (!user) return;
    const list = topicsKey ? topicsKey.split(",") : [];
    if (!done.current.open) {
      done.current.open = true;
      recordSignal(list, "open");
    }
    const markRead = () => {
      if (done.current.read) return;
      done.current.read = true;
      recordSignal(list, "read");
    };
    const timer = window.setTimeout(markRead, 30_000);
    const onScroll = () => {
      const scrolled = (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight;
      if (scrolled > 0.6) markRead();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
    };
  }, [user, topicsKey, recordSignal]);
  return null;
}

/** Topic chips under a story. Tapping one follows that topic. */
export function TopicChips({ topics, tags }: { topics: string[]; tags: string[] }) {
  const { profile, updateProfile, recordSignal } = useAuth();
  const items = [
    ...topics.map((t) => ({ key: t, label: TOPICS[t] ?? t })),
    ...tags.slice(0, 3).map((t) => ({ key: slugify(t), label: t })),
  ].filter((t, i, all) => t.key && all.findIndex((x) => x.key === t.key) === i);
  if (!items.length) return null;
  return (
    <div className="topic-chips">
      <div className="chips">
        {items.map((t) => {
          const interest = profile.interests[t.key];
          // Light reading signals don't count as following; tapping or pinning does.
          const following = Boolean(interest && !interest.muted && effectiveWeight(interest) >= 0.3);
          return (
            <button
              key={t.key}
              className="chip"
              aria-pressed={following}
              onClick={() => {
                if (following) return;
                recordSignal([t.key], "topicTap");
                updateProfile({ interests: addInterest(profile.interests, t.label) });
              }}
            >
              {following ? `Following ${t.label}` : `+ ${t.label}`}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** "Keep learning" suggestions, ordered by the reader's interests. */
export function FollowupList({
  parentId,
  suggestions,
  topics,
}: {
  parentId: string;
  suggestions: FollowupSuggestion[];
  topics: string[];
}) {
  const router = useRouter();
  const { profile, recordSignal } = useAuth();
  const ordered = useMemo(() => {
    // Suggestions mentioning an interest come first.
    const score = (s: FollowupSuggestion) =>
      interestMatch({ topics: [], tags: `${s.title} ${s.blurb}`.toLowerCase().split(/\W+/) }, profile.interests);
    return [...suggestions].sort((a, b) => score(b) - score(a));
  }, [suggestions, profile.interests]);

  if (!suggestions.length) return null;
  return (
    <section className="followups">
      <h2>Keep learning</h2>
      <p className="hint">Tap a topic and Tim News will write a short explainer about it.</p>
      <div className="followup-list">
        {ordered.map((s) => (
          <button
            key={s.id}
            className="followup"
            onClick={() => {
              recordSignal(topics, "followupTap");
              router.push(`/learn/${parentId}/${s.id}`);
            }}
          >
            <strong>{s.title}</strong>
            <span>{s.blurb}</span>
            <em>Read the explainer →</em>
          </button>
        ))}
      </div>
    </section>
  );
}
