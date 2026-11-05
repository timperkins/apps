// Processes one uploaded clip. The web app starts an execution of this job when an upload
// completes, passing the clip in VIDEO_PROJECT_ID and VIDEO_CLIP_ID.
//
// Phase 2 is a hello-world: it proves the job can run FFmpeg, read the clip's Firestore record
// and see its original in Cloud Storage, then records that on the clip. Proxies, mezzanines and
// scene detection come in phase 3.
import { execFileSync } from "node:child_process";
import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

const { VIDEO_PROJECT_ID, VIDEO_CLIP_ID, FIRESTORE_DATABASE_ID = "video", STORAGE_BUCKET } = process.env;

function log(message, fields = {}) {
  // Cloud Logging reads one JSON object per line as a structured entry.
  console.log(JSON.stringify({ message, clipId: VIDEO_CLIP_ID, projectId: VIDEO_PROJECT_ID, ...fields }));
}

if (!VIDEO_PROJECT_ID || !VIDEO_CLIP_ID || !STORAGE_BUCKET) {
  log("VIDEO_PROJECT_ID, VIDEO_CLIP_ID and STORAGE_BUCKET are required", { severity: "ERROR" });
  process.exit(1);
}

initializeApp();
const ref = getFirestore(FIRESTORE_DATABASE_ID)
  .collection("projects")
  .doc(VIDEO_PROJECT_ID)
  .collection("clips")
  .doc(VIDEO_CLIP_ID);

try {
  const snap = await ref.get();
  if (!snap.exists) throw new Error("clip not found in Firestore");
  const { path } = snap.data();

  const ffmpeg = execFileSync("ffmpeg", ["-version"]).toString().split("\n")[0];
  const [metadata] = await getStorage().bucket(STORAGE_BUCKET).file(path).getMetadata();

  log("hello from the process job", { path, size: Number(metadata.size), ffmpeg });
  await ref.update({
    processing: {
      status: "done",
      execution: process.env.CLOUD_RUN_EXECUTION ?? null,
      ffmpeg,
      finishedAt: FieldValue.serverTimestamp(),
    },
  });
} catch (error) {
  log("processing failed", { severity: "ERROR", error: String(error?.message ?? error) });
  await ref
    .set({ processing: { status: "failed", error: String(error?.message ?? error) } }, { merge: true })
    .catch(() => {});
  process.exit(1);
}
