"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { SignInGate, useAuth } from "@/components/AuthProvider";
import type { Clip, Project } from "@/lib/types";
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

function ProjectView() {
  const { id } = useParams<{ id: string }>();
  const { authedFetch } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [notes, setNotes] = useState("");
  const [savedNotes, setSavedNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
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

      <section className="card">
        <h2>Clips</h2>
        {clips.length === 0 ? (
          <p className="muted">No clips yet.</p>
        ) : (
          <ul className="list plain">
            {clips.map((c) => (
              <li key={c.id} className="row between">
                <span className="name">{c.fileName}</span>
                <span className="muted small">
                  {formatBytes(c.size)} · {c.status === "uploaded" ? "Uploaded" : "Not finished"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      {error && <p className="error">{error}</p>}
    </>
  );
}
