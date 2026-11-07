"use client";

import { useMemo, useRef, useState } from "react";
import type { Clip, ClipMediaUrls, Segment, SegmentKind } from "@/lib/types";

const KINDS: { kind: SegmentKind; label: string }[] = [
  { kind: "highlight", label: "Highlights" },
  { kind: "action", label: "Action" },
  { kind: "repetitive", label: "Repetitive" },
  { kind: "idle", label: "Idle" },
];

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

interface Row {
  clip: Clip;
  segment: Segment;
  key: string;
}

/**
 * Every indexed segment in a project, filterable by label and searchable by description, phase
 * and tools. Tapping a segment plays the clip's proxy from that point.
 */
export function FootageBrowser({
  clips,
  loadUrls,
}: {
  clips: Clip[];
  loadUrls: (clipId: string) => Promise<ClipMediaUrls | null>;
}) {
  const [kinds, setKinds] = useState<Set<SegmentKind>>(new Set());
  const [query, setQuery] = useState("");
  const [playing, setPlaying] = useState<{ row: Row; url: string } | null>(null);
  const urls = useRef(new Map<string, ClipMediaUrls>());
  const video = useRef<HTMLVideoElement>(null);

  const rows = useMemo<Row[]>(
    () =>
      clips.flatMap((clip) =>
        (clip.index?.status === "done" ? clip.index.segments : []).map((segment, i) => ({
          clip,
          segment,
          key: `${clip.id}-${i}`,
        })),
      ),
    [clips],
  );

  const counts = useMemo(() => {
    const out = new Map<SegmentKind, number>();
    for (const { segment } of rows) out.set(segment.kind, (out.get(segment.kind) ?? 0) + 1);
    return out;
  }, [rows]);

  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = rows.filter(({ segment, clip }) => {
    if (kinds.size && !kinds.has(segment.kind)) return false;
    if (!words.length) return true;
    const text = [segment.description, segment.phase, ...segment.tools, clip.fileName].join(" ").toLowerCase();
    return words.every((w) => text.includes(w));
  });

  function toggle(kind: SegmentKind) {
    setKinds((current) => {
      const next = new Set(current);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }

  async function play(row: Row) {
    let clipUrls = urls.current.get(row.clip.id);
    if (!clipUrls) {
      const loaded = await loadUrls(row.clip.id);
      if (!loaded?.proxy) return;
      clipUrls = loaded;
      urls.current.set(row.clip.id, loaded);
    }
    const url = clipUrls.proxy!;
    if (playing?.url === url && video.current) {
      video.current.currentTime = row.segment.start;
      video.current.play().catch(() => {});
    }
    setPlaying({ row, url });
  }

  if (!rows.length) return null;

  return (
    <section className="card">
      <h2>Footage</h2>
      {playing && (
        <div className="player">
          <video
            ref={video}
            src={`${playing.url}#t=${playing.row.segment.start}`}
            controls
            playsInline
            autoPlay
            onLoadedMetadata={(e) => {
              e.currentTarget.currentTime = playing.row.segment.start;
            }}
          />
          <p className="small muted">
            {playing.row.clip.fileName} at {formatTime(playing.row.segment.start)}: {playing.row.segment.description}
          </p>
        </div>
      )}
      <div className="chips">
        {KINDS.map(({ kind, label }) => (
          <button
            key={kind}
            className={`chip kind-${kind}${kinds.has(kind) ? " on" : ""}`}
            onClick={() => toggle(kind)}
            aria-pressed={kinds.has(kind)}
          >
            {label} {counts.get(kind) ?? 0}
          </button>
        ))}
      </div>
      <input
        type="search"
        placeholder="Search: sanding, miter saw, reveal…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <ul className="segments">
        {shown.map((row) => (
          <li key={row.key} className={playing?.row.key === row.key ? "active" : undefined}>
            <button className="segment" onClick={() => play(row)}>
              <span className={`tag kind-${row.segment.kind}`}>{row.segment.kind}</span>
              <span className="when muted small">
                {row.clip.fileName} {formatTime(row.segment.start)}–{formatTime(row.segment.end)}
              </span>
              <span className="what">{row.segment.description}</span>
              {(row.segment.phase || row.segment.tools.length > 0 || row.segment.issues.length > 0) && (
                <span className="muted small">
                  {[row.segment.phase, row.segment.tools.join(", "), row.segment.camera !== "steady" ? row.segment.camera : null, ...row.segment.issues]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              )}
            </button>
          </li>
        ))}
        {!shown.length && <li className="muted small">No segments match.</li>}
      </ul>
    </section>
  );
}
