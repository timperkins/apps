"use client";

import { nextChunk, offsetFromRange } from "./resumable";
import type { Clip, UploadTicket } from "./types";

type AuthedFetch = (input: string, init?: RequestInit) => Promise<Response>;

export interface Progress {
  sent: number;
  total: number;
}

const MAX_ATTEMPTS = 8;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
  return body as T;
}

/**
 * Uploads one file to Cloud Storage in chunks through a resumable session. Network errors and
 * pauses (screen lock, app switch) are retried with backoff, continuing from what Cloud Storage
 * already has, so a picked file never starts over.
 */
export async function uploadFile(
  file: File,
  projectId: string,
  authedFetch: AuthedFetch,
  onProgress: (p: Progress) => void,
): Promise<Clip> {
  const base = `/api/projects/${projectId}/clips`;
  const start = (restart: boolean) =>
    authedFetch(base, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: file.name, size: file.size, contentType: file.type, restart }),
    }).then((res) => json<UploadTicket>(res));

  let ticket = await start(false);
  if (!ticket.sessionUri) {
    onProgress({ sent: file.size, total: file.size });
    return ticket.clip;
  }
  const clipId = ticket.clip.id;

  const status = async () => {
    const s = await json<{ offset: number; complete: boolean; expired: boolean }>(
      await authedFetch(`${base}/${clipId}`),
    );
    if (s.expired) {
      ticket = await start(true);
      return 0;
    }
    return s.complete ? file.size : s.offset;
  };

  let offset = await status();
  let failures = 0;
  while (offset < file.size) {
    onProgress({ sent: offset, total: file.size });
    const chunk = nextChunk(offset, file.size);
    try {
      const res = await fetch(ticket.sessionUri!, {
        method: "PUT",
        headers: { "Content-Range": chunk.contentRange },
        body: file.slice(chunk.start, chunk.end),
      });
      if (res.status === 200 || res.status === 201) {
        offset = file.size;
      } else if (res.status === 308) {
        // The Range header isn't always readable across origins, so ask the server when it isn't.
        const fromHeader = res.headers.get("range") ? offsetFromRange(res.headers.get("range")) : null;
        offset = fromHeader ?? (await status());
      } else if (res.status === 404 || res.status === 410) {
        ticket = await start(true);
        offset = 0;
      } else {
        throw new Error(`Cloud Storage answered ${res.status}`);
      }
      failures = 0;
    } catch (error) {
      failures += 1;
      if (failures >= MAX_ATTEMPTS) throw error;
      await sleep(Math.min(30_000, 1000 * 2 ** failures));
      offset = await status().catch(() => offset);
    }
  }
  onProgress({ sent: file.size, total: file.size });

  const done = await json<{ clip: Clip }>(await authedFetch(`${base}/${clipId}`, { method: "POST" }));
  return done.clip;
}

/** Keeps the screen on while uploads run, re-taking the lock when the page becomes visible again. */
export function keepScreenOn(): () => void {
  type Sentinel = { release: () => Promise<void> };
  const nav = navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<Sentinel> } };
  if (!nav.wakeLock) return () => {};
  let sentinel: Sentinel | null = null;
  let active = true;
  const take = () => {
    if (!active || document.visibilityState !== "visible") return;
    nav.wakeLock!.request("screen").then(
      (s) => {
        sentinel = s;
      },
      () => {},
    );
  };
  take();
  document.addEventListener("visibilitychange", take);
  return () => {
    active = false;
    document.removeEventListener("visibilitychange", take);
    sentinel?.release().catch(() => {});
  };
}
