"use client";

import { doc, onSnapshot } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { clientDb, firebaseConfigured } from "@/lib/firebase/client";
import { followupId } from "@/lib/ids";
import type { Followup } from "@/lib/types";
import { ArticleBody } from "./ArticleBody";
import { useAuth } from "./AuthProvider";
import { LinkedImage } from "./Media";
import { SourceList } from "./SourceList";
import { FollowupList, ReadTracker } from "./StoryExtras";
import { Skeleton } from "./StoryRow";

type StreamEvent =
  | { type: "start"; id: string; title: string }
  | { type: "delta"; text: string }
  | { type: "done"; id: string }
  | { type: "error"; message: string };

/** A follow-up explainer: read from Firestore if it exists, otherwise written live and streamed in. */
export function LearnArticle({ parentId, suggestionId }: { parentId: string; suggestionId: string }) {
  const id = followupId(parentId, suggestionId);
  const router = useRouter();
  const { user, authedFetch } = useAuth();
  const [saved, setSaved] = useState<Followup | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [title, setTitle] = useState("");
  const [streamText, setStreamText] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  const requested = useRef(false);

  useEffect(() => {
    if (!firebaseConfigured) return;
    return onSnapshot(
      doc(clientDb(), "followups", id),
      (snap) => {
        setSaved(snap.exists() ? (snap.data() as Followup) : null);
        setLoaded(true);
      },
      () => setLoaded(true),
    );
  }, [id]);

  const request = async () => {
    const res = await authedFetch("/api/followup", {
      method: "POST",
      body: JSON.stringify({ parentId, suggestionId }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Couldn't load this explainer.");
      return;
    }
    if (!res.headers.get("content-type")?.includes("ndjson") || !res.body) return; // already written; the listener has it
    setStreaming(true);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as StreamEvent;
          if (event.type === "start") setTitle(event.title);
          if (event.type === "delta") setStreamText((t) => t + event.text);
          if (event.type === "error") setError(event.message);
        }
      }
    } finally {
      setStreaming(false);
    }
  };

  useEffect(() => {
    if (!user || !loaded || requested.current) return;
    if (saved?.status === "ready") return;
    if (saved?.status === "generating" && saved.lockedUntil > Date.now()) return;
    requested.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- state changes only after the network responds
    request().catch(() => setError("Couldn't load this explainer."));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once when ready
  }, [user, loaded, saved]);

  const ready = saved?.status === "ready";
  const heading = saved?.title || title;
  const body = ready ? saved.body : streamText;
  const image = ready ? saved.media.find((m) => m.type === "image") : undefined;
  const waitingElsewhere = !streaming && !ready && saved?.status === "generating";

  return (
    <article className="narrow article">
      {ready && <ReadTracker topics={saved.topics} />}
      <header>
        <span className="kicker quiet">
          <button className="linkish" onClick={() => router.back()}>
            ← Back
          </button>{" "}
          · Explainer
        </span>
        {heading ? <h1>{heading}</h1> : <Skeleton rows={1} />}
        <div className="byline">
          {ready
            ? "An AI-written explainer, checked against the sources below."
            : error || saved?.status === "failed"
              ? "This explainer isn't available yet."
              : "Tim News is writing this explainer for you now."}
        </div>
      </header>
      {image && (
        <figure className="figure" style={{ marginBottom: 18 }}>
          <LinkedImage item={image} />
          <figcaption>
            Photo:{" "}
            <a href={image.pageUrl} target="_blank" rel="noopener noreferrer">
              {image.credit}
            </a>
          </figcaption>
        </figure>
      )}
      {body ? <ArticleBody text={body} streaming={streaming} /> : !error && <Skeleton rows={3} />}
      {waitingElsewhere && !body && <p className="meta">Someone else asked for this one too. It will appear here as soon as it&apos;s done.</p>}
      {(error || saved?.status === "failed") && !streaming && !ready && (
        <div className="notice">
          {error || "This explainer couldn't be written."}{" "}
          <button
            className="btn"
            onClick={() => {
              setError("");
              setStreamText("");
              request().catch(() => setError("Couldn't load this explainer."));
            }}
          >
            Try again
          </button>
        </div>
      )}
      {ready && (
        <>
          <SourceList sources={saved.sources} />
          <FollowupList parentId={id} suggestions={saved.followups} topics={saved.topics} />
        </>
      )}
    </article>
  );
}
