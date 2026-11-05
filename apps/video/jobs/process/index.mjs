// Processes one uploaded clip. The web app starts an execution of this job when an upload
// completes, passing the clip in VIDEO_PROJECT_ID and VIDEO_CLIP_ID.
//
// Steps: download the original, probe it, write a 720p proxy and a 1080p mezzanine (both SDR
// Rec.709 at a constant 30 fps, tone-mapped when the clip is HDR), detect scene changes on the
// proxy, save a poster frame, upload the outputs next to the original and record it all on the
// clip's Firestore document.
//
// Cloud Run's /tmp is in memory, so the original and both outputs have to fit in the job's 16 GiB.
import { execFile, spawn } from "node:child_process";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import {
  FPS,
  describeSource,
  outputPaths,
  parseScenes,
  posterArgs,
  progressSeconds,
  sceneArgs,
  transcodeArgs,
} from "./lib.mjs";

const run = promisify(execFile);
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
const bucket = getStorage().bucket(STORAGE_BUCKET);
const ref = getFirestore(FIRESTORE_DATABASE_ID)
  .collection("projects")
  .doc(VIDEO_PROJECT_ID)
  .collection("clips")
  .doc(VIDEO_CLIP_ID);
const execution = process.env.CLOUD_RUN_EXECUTION ?? null;

/** Records the current step (and percent, while transcoding) for the app to show. */
async function setStep(step, percent = null) {
  await ref.update({ "processing.status": "running", "processing.step": step, "processing.percent": percent });
}

/** Runs the transcode, reporting progress at most every 15 seconds. */
function transcode(args, durationSec) {
  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    let lastReport = Date.now();
    child.stdout.on("data", (chunk) => {
      const done = progressSeconds(chunk.toString());
      if (done == null || !durationSec || Date.now() - lastReport < 15_000) return;
      lastReport = Date.now();
      setStep("transcoding", Math.min(99, Math.round((done / durationSec) * 100))).catch(() => {});
    });
    child.stderr.on("data", (chunk) => {
      stderr = (stderr + chunk.toString()).slice(-4000);
    });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}: ${stderr.trim().split("\n").slice(-3).join(" | ")}`)),
    );
  });
}

async function probe(file) {
  const { stdout } = await run("ffprobe", ["-v", "error", "-show_format", "-show_streams", "-of", "json", file], {
    maxBuffer: 16 * 1024 * 1024,
  });
  return JSON.parse(stdout);
}

const work = await mkdtemp(join(tmpdir(), "process-"));
const started = Date.now();

try {
  const snap = await ref.get();
  if (!snap.exists) throw new Error("clip not found in Firestore");
  const { path } = snap.data();
  const paths = outputPaths(path);
  const local = {
    original: join(work, "original"),
    proxy: join(work, "proxy.mp4"),
    mezzanine: join(work, "mezzanine.mp4"),
    poster: join(work, "poster.jpg"),
  };

  await ref.update({
    processing: { status: "running", step: "downloading", percent: null, execution, error: null },
  });
  await bucket.file(path).download({ destination: local.original });

  await setStep("probing");
  const source = describeSource(await probe(local.original));
  log("source", { source });

  await setStep("transcoding", 0);
  await transcode(transcodeArgs(local.original, source, local), source.durationSec);
  await rm(local.original);

  await setStep("detecting scenes");
  const proxyInfo = describeSource(await probe(local.proxy));
  const { stdout: sceneOutput } = await run("ffmpeg", sceneArgs(local.proxy), { maxBuffer: 64 * 1024 * 1024 });
  const scenes = parseScenes(sceneOutput);
  await run("ffmpeg", posterArgs(local.proxy, proxyInfo.durationSec, local.poster));

  await setStep("uploading");
  const upload = (file, destination, contentType) =>
    bucket.upload(file, { destination, metadata: { contentType, cacheControl: "private, max-age=86400" } });
  await Promise.all([
    upload(local.proxy, paths.proxy, "video/mp4"),
    upload(local.mezzanine, paths.mezzanine, "video/mp4"),
    upload(local.poster, paths.poster, "image/jpeg"),
  ]);
  const mezzanineInfo = describeSource(await probe(local.mezzanine));
  const sizes = {
    proxy: (await stat(local.proxy)).size,
    mezzanine: (await stat(local.mezzanine)).size,
  };

  const output = (info, size, storagePath) => ({
    path: storagePath,
    width: info.width,
    height: info.height,
    fps: FPS,
    durationSec: info.durationSec,
    size,
  });
  const result = {
    source,
    proxy: output(proxyInfo, sizes.proxy, paths.proxy),
    mezzanine: output(mezzanineInfo, sizes.mezzanine, paths.mezzanine),
    posterPath: paths.poster,
    scenes,
    // How far the proxy's length is from the original's. Near zero means timestamps line up.
    driftSec: Number(((proxyInfo.durationSec ?? 0) - (source.durationSec ?? 0)).toFixed(3)),
  };
  await ref.update({
    media: result,
    processing: {
      status: "done",
      step: null,
      percent: null,
      execution,
      error: null,
      seconds: Math.round((Date.now() - started) / 1000),
      finishedAt: FieldValue.serverTimestamp(),
    },
  });
  log("processed", { ...result, seconds: Math.round((Date.now() - started) / 1000) });
} catch (error) {
  const message = String(error?.message ?? error);
  log("processing failed", { severity: "ERROR", error: message });
  await ref
    .set({ processing: { status: "failed", step: null, percent: null, execution, error: message } }, { merge: true })
    .catch(() => {});
  process.exitCode = 1;
} finally {
  await rm(work, { recursive: true, force: true });
}
