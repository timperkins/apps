// Helpers for Cloud Storage resumable uploads, shared by the browser and the server.
// https://cloud.google.com/storage/docs/performing-resumable-uploads

/** Chunk size for each PUT. Must be a multiple of 256 KiB, except for the last chunk. */
export const CHUNK_SIZE = 16 * 1024 * 1024;

/**
 * Next byte to send, from the `Range` header of a 308 response ("bytes=0-1234" means 1235 bytes
 * are stored). No header means nothing is stored yet. Returns null if the header is malformed.
 */
export function offsetFromRange(range: string | null): number | null {
  if (!range) return 0;
  const match = /^bytes=0-(\d+)$/.exec(range.trim());
  return match ? Number(match[1]) + 1 : null;
}

/** The byte range of the next chunk, given what's stored and the file size. */
export function nextChunk(offset: number, size: number, chunkSize = CHUNK_SIZE) {
  const start = offset;
  const end = Math.min(offset + chunkSize, size); // exclusive
  return { start, end, contentRange: `bytes ${start}-${end - 1}/${size}` };
}

/** Same file picked again: matched by name and size, since iOS can change lastModified. */
export function clipKey(fileName: string, size: number): string {
  return `${fileName}:${size}`;
}

/** Storage path for a clip's original, keeping the file's extension. */
export function originalPath(prefix: string, projectId: string, clipId: string, fileName: string) {
  const ext = /\.([A-Za-z0-9]{1,8})$/.exec(fileName)?.[1]?.toLowerCase();
  return `${prefix}/projects/${projectId}/originals/${clipId}${ext ? `.${ext}` : ""}`;
}
