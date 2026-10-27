"use client";

import { useState } from "react";
import type { MediaItem } from "@/lib/types";

/** An image loaded straight from its original host. Hides itself if the host refuses it. */
export function LinkedImage({ item, className }: { item: MediaItem; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- media is linked, never proxied or copied
    <img
      src={item.url}
      alt=""
      className={className}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

/** Lead media for an article: a YouTube embed or an image, with a credit line. */
export function MediaFigure({ media }: { media: MediaItem[] }) {
  const [index, setIndex] = useState(0);
  const item = media[index];
  if (!item) return null;
  return (
    <figure className="figure">
      {item.type === "youtube" ? (
        <div className="video">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${item.url}`}
            title="Video"
            loading="lazy"
            allow="encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- media is linked, never proxied or copied
        <img
          src={item.url}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setIndex((i) => i + 1)}
        />
      )}
      <figcaption>
        {item.type === "youtube" ? "Video" : "Photo"}:{" "}
        <a href={item.pageUrl} target="_blank" rel="noopener noreferrer">
          {item.credit}
        </a>
      </figcaption>
    </figure>
  );
}
