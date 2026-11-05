export type ClipStatus = "uploading" | "uploaded";

export interface Project {
  id: string;
  name: string;
  notes: string;
  clipCount: number;
  uploadedCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface ClipProcessing {
  status: "queued" | "running" | "done" | "failed";
  error: string | null;
  /** What the job is doing while running: downloading, probing, transcoding, … */
  step: string | null;
  /** Transcoding progress, 0 to 100. */
  percent: number | null;
}

/** What the processing job found and made, without storage paths. */
export interface ClipMedia {
  durationSec: number | null;
  /** The original, as shown (after the phone's rotation flag). */
  width: number | null;
  height: number | null;
  fps: number | null;
  codec: string | null;
  hdr: boolean;
  recordedAt: string | null;
  device: string | null;
  /** Seconds of each scene change. */
  scenes: number[];
  /** Proxy length minus original length, in seconds. */
  driftSec: number | null;
}

export interface Clip {
  id: string;
  fileName: string;
  size: number;
  contentType: string;
  status: ClipStatus;
  createdAt: number;
  uploadedAt: number | null;
  processing: ClipProcessing | null;
  media: ClipMedia | null;
}

/** Short-lived signed links for watching a processed clip. */
export interface ClipMediaUrls {
  proxy: string | null;
  poster: string | null;
  original: string;
}

/** What the server hands the browser to upload one file. */
export interface UploadTicket {
  clip: Clip;
  /** Resumable upload session URL, or null when the clip is already uploaded. */
  sessionUri: string | null;
}
