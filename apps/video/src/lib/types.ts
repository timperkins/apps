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

export interface Clip {
  id: string;
  fileName: string;
  size: number;
  contentType: string;
  status: ClipStatus;
  createdAt: number;
  uploadedAt: number | null;
}

/** What the server hands the browser to upload one file. */
export interface UploadTicket {
  clip: Clip;
  /** Resumable upload session URL, or null when the clip is already uploaded. */
  sessionUri: string | null;
}
