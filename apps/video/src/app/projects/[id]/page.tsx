"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { SignInGate, useAuth } from "@/components/AuthProvider";
import { FootageBrowser } from "@/components/FootageBrowser";
import type { Clip, ClipMediaUrls, Project } from "@/lib/types";
import { keepScreenOn, uploadFile, type Progress } from "@/lib/uploader";

export default function ProjectPage() {
  return (
    <SignInGate>
      <ProjectView />
    </SignInGate>
  );
}

interface QueueItem {
  file: File;
  state: "waiting" | "uploading" | "done" | "failed";
  progress: Progress;
  error?: string;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1e3))} KB`;
}

function clipState(c: Clip): string {
  if (c.status !== "uploaded") return "Not finished";
  switch (c.processing?.status) {
    case "done":
      return "Processed";
    case "queued":
      return "Processing…";
    case "running": {
      const { step, percent } = c.processing;
      return `Processing: ${step ?? "starting"}${percent != null ? ` ${percent}%` : ""}`;
    }
    case "failed":
      return "Processing failed";
    default:
      return "Uploaded";
  }
}

function formatDuration(seconds: number): string {
  const s = Math.round(seconds);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

function resolution(width: number | null, height: number | null): string {
  const short = Math.min(width ?? 0, height ?? 0);
  if (short >= 2160) return "4K";
  if (short >= 1080) return "1080p";
  if (short >= 720) return "720p";
  return short ? `${short}p` : "";
}

/** One line about a processed clip: "4K HDR 30 fps · 1:23 · 4 scene changes". */
function mediaSummary(c: Clip): string {
  const m = c.media;
  if (!m) return "";
  const parts = [
    [resolution(m.width, m.height), m.hdr ? "HDR" : "SDR", m.fps ? `${Math.round(m.fps)} fps` : ""].filter(Boolean).join(" "),
    m.durationSec != null ? formatDuration(m.durationSec) : "",
    `${m.scenes.length} scene ${m.scenes.length === 1 ? "change" : "changes"}`,
  ];
  if (m.driftSec != null && Math.abs(m.driftSec) > 0.1) parts.push(`proxy off by ${m.driftSec.toFixed(2)} s`);
  return parts.filter(Boolean).join(" · ");
}

function indexState(c: Clip): string {
  switch (c.index?.status) {
    case "done": {
      const n = c.index.segments.length;
      return `Indexed: ${n} ${n === 1 ? "segment" : "segments"}`;
    }
    case "running":
      return "Indexing with Gemini…";
    case "failed":
      return `Indexing failed: ${c.index.error ?? "unknown error"}`;
    case "skipped":
      return c.index.error ?? "Not indexed";
    default:
      return "Not indexed";
  }
}

function ProjectView() {
  const { id } = useParams<{ id: string }>();
  const { authedFetch } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [notes, setNotes] = useState("");
  const [savedNotes, setSavedNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [watching, setWatching] = useState<{ clipId: string; urls: ClipMediaUrls } | null>(null);
  const running = useRef(false);
  const queueRef = useRef<QueueItem[]>([]);

  const fetchProject = useCallback(
    async () =>
      (await (await authedFetch(`/api/projects/${id}`)).json().catch(() => ({}))) as {
        project?: Project;
        clips?: Clip[];
        error?: string;
      },
    [authedFetch, id],
  );

  const apply = useCallback((body: { project?: Project; clips?: Clip[]; error?: string }) => {
    if (!body.project) {
      setError(body.error ?? "Couldn't load the project.");
      return;
    }
    setProject(body.project);
    setClips(body.clips ?? []);
    setNotes((current) => (current === "" ? body.project!.notes : current));
    setSavedNotes(body.project.notes);
  }, []);

  const load = useCallback(() => fetchProject().then(apply), [fetchProject, apply]);

  useEffect(() => {
    fetchProject().then(apply);
  }, [fetchProject, apply]);

  // While a clip is processing, check on it every 10 seconds.
  const processing = clips.some(
    (c) => c.processing?.status === "queued" || c.processing?.status === "running" || c.index?.status === "running",
  );
  useEffect(() => {
    if (!processing) return;
    const timer = setInterval(load, 10_000);
    return () => clearInterval(timer);
  }, [processing, load]);

  const update = (index: number, patch: Partial<QueueItem>) => {
    queueRef.current = queueRef.current.map((item, i) => (i === index ? { ...item, ...patch } : item));
    setQueue(queueRef.current);
  };

  // Uploads one file at a time, which suits a phone's connection best.
  const run = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    const release = keepScreenOn();
    try {
      for (let i = 0; i < queueRef.current.length; i++) {
        const item = queueRef.current[i];
        if (item.state !== "waiting") continue;
        update(i, { state: "uploading" });
        try {
          await uploadFile(item.file, id, authedFetch, (progress) => update(i, { progress }));
          update(i, { state: "done" });
        } catch (e) {
          update(i, { state: "failed", error: (e as Error).message });
        }
        load();
      }
    } finally {
      release();
      running.current = false;
    }
  }, [authedFetch, id, load]);

  function pick(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    queueRef.current = [
      ...queueRef.current,
      ...files.map((file) => ({ file, state: "waiting" as const, progress: { sent: 0, total: file.size } })),
    ];
    setQueue(queueRef.current);
    run();
  }

  function retry(index: number) {
    update(index, { state: "waiting", error: undefined });
    run();
  }

  async function startProcessing(clipId: string) {
    const res = await authedFetch(`/api/projects/${id}/clips/${clipId}/process`, { method: "POST" });
    if (!res.ok) setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Couldn't start processing.");
    load();
  }

  const loadUrls = useCallback(
    async (clipId: string): Promise<ClipMediaUrls | null> => {
      const res = await authedFetch(`/api/projects/${id}/clips/${clipId}/media`);
      const body = (await res.json().catch(() => ({}))) as ClipMediaUrls & { error?: string };
      if (res.ok) return body;
      setError(body.error ?? "Couldn't load the clip.");
      return null;
    },
    [authedFetch, id],
  );

  async function watch(clipId: string) {
    if (watching?.clipId === clipId) {
      setWatching(null);
      return;
    }
    const urls = await loadUrls(clipId);
    if (urls) setWatching({ clipId, urls });
  }

  async function reindex(clipId: string) {
    const res = await authedFetch(`/api/projects/${id}/clips/${clipId}/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ indexOnly: true }),
    });
    if (!res.ok) setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Couldn't start indexing.");
    load();
  }

  async function saveNotes() {
    const res = await authedFetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    if (res.ok) setSavedNotes(notes);
    else setError("Couldn't save the notes.");
  }

  // Leaving the page mid-upload loses the picked files, so warn first.
  const uploading = queue.some((item) => item.state === "waiting" || item.state === "uploading");
  useEffect(() => {
    if (!uploading) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [uploading]);

  if (error && !project) return <p className="error">{error}</p>;
  if (!project) return <p className="muted">Loading…</p>;

  const inQueue = new Set(queue.map((q) => `${q.file.name}:${q.file.size}`));
  const unfinished = clips.filter((c) => c.status !== "uploaded" && !inQueue.has(`${c.fileName}:${c.size}`));

  return (
    <>
      <h1>{project.name}</h1>
      <p className="muted">
        {project.uploadedCount} of {project.clipCount} clips uploaded
      </p>

      <section className="card">
        <label className="picker primary">
          Add clips
          <input type="file" accept="video/*" multiple onChange={pick} />
        </label>
        <p className="muted small">
          In the photo picker, tap Options and choose <strong>Current</strong> so clips upload without
          recompression. Keep this page open until uploads finish.
        </p>
        {queue.length > 0 && (
          <ul className="queue">
            {queue.map((item, i) => {
              const pct = item.progress.total ? Math.floor((item.progress.sent / item.progress.total) * 100) : 0;
              return (
                <li key={`${item.file.name}-${i}`}>
                  <div className="row between">
                    <span className="name">{item.file.name}</span>
                    <span className="muted small">
                      {item.state === "done"
                        ? "Uploaded"
                        : item.state === "failed"
                          ? "Failed"
                          : item.state === "waiting"
                            ? "Waiting"
                            : `${pct}% of ${formatBytes(item.file.size)}`}
                    </span>
                  </div>
                  <progress max={100} value={item.state === "done" ? 100 : pct} />
                  {item.state === "failed" && (
                    <p className="error small">
                      {item.error} <button className="link" onClick={() => retry(i)}>Try again</button>
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {unfinished.length > 0 && (
          <p className="warning small">
            {unfinished.length === 1 ? "1 clip didn't" : `${unfinished.length} clips didn't`} finish uploading:{" "}
            {unfinished.map((c) => c.fileName).join(", ")}. Pick {unfinished.length === 1 ? "it" : "them"} again
            and the upload continues where it stopped.
          </p>
        )}
      </section>

      <section className="card">
        <h2>Notes</h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="What's this project about? Anything the rough cut should know."
        />
        <button onClick={saveNotes} disabled={notes === savedNotes}>
          {notes === savedNotes ? "Saved" : "Save notes"}
        </button>
      </section>

      <FootageBrowser clips={clips} loadUrls={loadUrls} />

      <section className="card">
        <h2>Clips</h2>
        {clips.length === 0 ? (
          <p className="muted">No clips yet.</p>
        ) : (
          <ul className="list plain">
            {clips.map((c) => (
              <li key={c.id}>
                <div className="row between">
                  <span className="name">{c.fileName}</span>
                  <span className="muted small">
                    {formatBytes(c.size)} · {clipState(c)}
                  </span>
                </div>
                {c.processing?.status === "done" && c.media && (
                  <p className="small">
                    <span className="muted">{mediaSummary(c)} </span>
                    <button className="link" onClick={() => watch(c.id)}>
                      {watching?.clipId === c.id ? "Hide" : "Watch proxy"}
                    </button>
                  </p>
                )}
                {c.processing?.status === "done" && c.media && (
                  <p className="small">
                    <span className={c.index?.status === "failed" ? "error" : "muted"}>{indexState(c)} </span>
                    {c.index?.status !== "running" && (
                      <button className="link" onClick={() => reindex(c.id)}>
                        {c.index?.status === "done" ? "Index again" : "Index"}
                      </button>
                    )}
                  </p>
                )}
                {c.index?.status === "done" && c.index.summary && <p className="small">{c.index.summary}</p>}
                {watching?.clipId === c.id && (
                  <div className="player">
                    {watching.urls.proxy ? (
                      <video
                        src={watching.urls.proxy}
                        poster={watching.urls.poster ?? undefined}
                        controls
                        playsInline
                        preload="metadata"
                      />
                    ) : (
                      <p className="muted small">No proxy yet. Process the clip again.</p>
                    )}
                    <p className="small">
                      <a href={watching.urls.original} target="_blank" rel="noreferrer">
                        Open the original
                      </a>{" "}
                      to compare.
                    </p>
                  </div>
                )}
                {c.status === "uploaded" && c.processing?.status !== "queued" && c.processing?.status !== "running" && (
                  <p className="small">
                    {c.processing?.error && <span className="error">{c.processing.error} </span>}
                    <button className="link" onClick={() => startProcessing(c.id)}>
                      {c.processing?.status === "done" ? "Process again" : "Process"}
                    </button>
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      {error && <p className="error">{error}</p>}
    </>
  );
}
