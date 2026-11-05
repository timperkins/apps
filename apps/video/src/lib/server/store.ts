import "server-only";
import { FieldValue, type DocumentSnapshot } from "firebase-admin/firestore";
import { adminDb, footageBucket, storagePrefix } from "../firebase/admin";
import { startProcessJob } from "./jobs";
import { clipKey, offsetFromRange, originalPath } from "../resumable";
import type { Clip, ClipProcessing, Project, UploadTicket } from "../types";

const projects = () => adminDb().collection("projects");
const clips = (projectId: string) => projects().doc(projectId).collection("clips");

function millis(value: unknown): number {
  return value && typeof value === "object" && "toMillis" in value
    ? (value as { toMillis: () => number }).toMillis()
    : 0;
}

function toProject(snap: DocumentSnapshot): Project {
  const d = snap.data() ?? {};
  return {
    id: snap.id,
    name: d.name ?? "",
    notes: d.notes ?? "",
    clipCount: d.clipCount ?? 0,
    uploadedCount: d.uploadedCount ?? 0,
    createdAt: millis(d.createdAt),
    updatedAt: millis(d.updatedAt),
  };
}

function toClip(snap: DocumentSnapshot): Clip {
  const d = snap.data() ?? {};
  return {
    id: snap.id,
    fileName: d.fileName ?? "",
    size: d.size ?? 0,
    contentType: d.contentType ?? "",
    status: d.status ?? "uploading",
    createdAt: millis(d.createdAt),
    uploadedAt: d.uploadedAt ? millis(d.uploadedAt) : null,
    processing: d.processing
      ? { status: d.processing.status ?? "queued", error: d.processing.error ?? null }
      : null,
  };
}

export async function listProjects(): Promise<Project[]> {
  const snap = await projects().orderBy("createdAt", "desc").limit(200).get();
  return snap.docs.map(toProject);
}

export async function createProject(name: string, notes: string, uid: string): Promise<Project> {
  const ref = projects().doc();
  await ref.set({
    name,
    notes,
    clipCount: 0,
    uploadedCount: 0,
    createdBy: uid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return toProject(await ref.get());
}

export async function getProject(projectId: string): Promise<{ project: Project; clips: Clip[] } | null> {
  const snap = await projects().doc(projectId).get();
  if (!snap.exists) return null;
  const clipSnap = await clips(projectId).orderBy("createdAt", "asc").get();
  return { project: toProject(snap), clips: clipSnap.docs.map(toClip) };
}

export async function updateProject(projectId: string, patch: { name?: string; notes?: string }) {
  await projects().doc(projectId).update({ ...patch, updatedAt: FieldValue.serverTimestamp() });
}

/**
 * Starts or resumes the upload of one file. The same file (name and size) picked again gets its
 * existing session back, so an interrupted upload continues where it stopped. A fresh session is
 * made when there is none yet, or when `restart` is set because the old one expired.
 */
export async function startUpload(
  projectId: string,
  file: { fileName: string; size: number; contentType: string },
  origin: string,
  restart: boolean,
): Promise<UploadTicket | null> {
  const projectRef = projects().doc(projectId);
  if (!(await projectRef.get()).exists) return null;

  const key = clipKey(file.fileName, file.size);
  const existing = await clips(projectId).where("key", "==", key).limit(1).get();
  let ref = existing.docs[0]?.ref;

  if (ref) {
    const data = existing.docs[0].data();
    if (data.status === "uploaded") return { clip: toClip(existing.docs[0]), sessionUri: null };
    if (data.sessionUri && !restart) return { clip: toClip(existing.docs[0]), sessionUri: data.sessionUri };
  } else {
    ref = clips(projectId).doc();
    await ref.set({
      key,
      fileName: file.fileName,
      size: file.size,
      contentType: file.contentType,
      status: "uploading",
      path: originalPath(storagePrefix(), projectId, ref.id, file.fileName),
      createdAt: FieldValue.serverTimestamp(),
      uploadedAt: null,
    });
    await projectRef.update({ clipCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
  }

  const path = (await ref.get()).data()!.path as string;
  // The origin makes Cloud Storage answer the browser's requests to this session with CORS headers.
  const [sessionUri] = await footageBucket()
    .file(path)
    .createResumableUpload({
      origin,
      metadata: {
        contentType: file.contentType || "application/octet-stream",
        metadata: { projectId, clipId: ref.id, fileName: file.fileName },
      },
    });
  await ref.update({ sessionUri });
  return { clip: toClip(await ref.get()), sessionUri };
}

/**
 * How many bytes of a clip Cloud Storage has, asked from the server so the browser doesn't need
 * to read the `Range` header itself. `expired` means the session is gone and must be restarted.
 */
export async function uploadStatus(
  projectId: string,
  clipId: string,
): Promise<{ offset: number; complete: boolean; expired: boolean } | null> {
  const snap = await clips(projectId).doc(clipId).get();
  if (!snap.exists) return null;
  const d = snap.data()!;
  if (d.status === "uploaded") return { offset: d.size, complete: true, expired: false };
  if (!d.sessionUri) return { offset: 0, complete: false, expired: true };
  const res = await fetch(d.sessionUri, {
    method: "PUT",
    headers: { "Content-Range": `bytes */${d.size}`, "Content-Length": "0" },
  });
  if (res.status === 200 || res.status === 201) return { offset: d.size, complete: true, expired: false };
  if (res.status === 308) {
    return { offset: offsetFromRange(res.headers.get("range")) ?? 0, complete: false, expired: false };
  }
  if (res.status === 404 || res.status === 410) return { offset: 0, complete: false, expired: true };
  throw new Error(`Cloud Storage answered ${res.status} for the upload status`);
}

/** Marks a clip uploaded once the object is in the bucket at full size. */
export async function completeUpload(projectId: string, clipId: string): Promise<Clip | null> {
  const ref = clips(projectId).doc(clipId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const d = snap.data()!;
  if (d.status === "uploaded") return toClip(snap);
  const [metadata] = await footageBucket().file(d.path).getMetadata();
  if (Number(metadata.size) !== d.size) {
    throw new Error(`Stored ${metadata.size} of ${d.size} bytes`);
  }
  await ref.update({
    status: "uploaded",
    sessionUri: FieldValue.delete(),
    uploadedAt: FieldValue.serverTimestamp(),
  });
  await projects()
    .doc(projectId)
    .update({ uploadedCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
  await processClip(projectId, clipId);
  return toClip(await ref.get());
}

/**
 * Starts the processing job for an uploaded clip and records that on the clip. A job that can't
 * be started doesn't fail the upload: the clip shows the error and can be processed again.
 */
export async function processClip(projectId: string, clipId: string): Promise<ClipProcessing | null> {
  const ref = clips(projectId).doc(clipId);
  const snap = await ref.get();
  if (!snap.exists || snap.data()!.status !== "uploaded") return null;
  let processing: { status: ClipProcessing["status"]; error: string | null; execution: string | null };
  try {
    const execution = await startProcessJob(projectId, clipId);
    processing = execution
      ? { status: "queued", error: null, execution }
      : { status: "failed", error: "No processing job is configured (PROCESS_JOB).", execution: null };
  } catch (error) {
    console.error("Couldn't start the processing job", error);
    processing = { status: "failed", error: `Couldn't start processing: ${(error as Error).message}`, execution: null };
  }
  await ref.update({ processing: { ...processing, startedAt: FieldValue.serverTimestamp() } });
  return { status: processing.status, error: processing.error };
}
