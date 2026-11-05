"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SignInGate, useAuth } from "@/components/AuthProvider";
import type { Project } from "@/lib/types";

export default function Home() {
  return (
    <SignInGate>
      <Projects />
    </SignInGate>
  );
}

function Projects() {
  const { authedFetch } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    authedFetch("/api/projects")
      .then((res) => res.json())
      .then((body: { projects?: Project[]; error?: string }) => {
        if (body.projects) setProjects(body.projects);
        else setError(body.error ?? "Couldn't load projects.");
      })
      .catch(() => setError("Couldn't load projects."));
  }, [authedFetch]);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    const res = await authedFetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const body = (await res.json().catch(() => ({}))) as { project?: Project; error?: string };
    setBusy(false);
    if (body.project) router.push(`/projects/${body.project.id}`);
    else setError(body.error ?? "Couldn't create the project.");
  }

  return (
    <>
      <form className="card row" onSubmit={create}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New project, e.g. Deck rebuild"
          aria-label="Project name"
        />
        <button className="primary" disabled={busy || !name.trim()}>
          Create
        </button>
      </form>
      {error && <p className="error">{error}</p>}
      {projects === null ? (
        <p className="muted">Loading projects…</p>
      ) : projects.length === 0 ? (
        <p className="muted">No projects yet.</p>
      ) : (
        <ul className="list">
          {projects.map((p) => (
            <li key={p.id}>
              <Link href={`/projects/${p.id}`}>
                <strong>{p.name}</strong>
                <span className="muted">
                  {p.uploadedCount} of {p.clipCount} clips uploaded
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
