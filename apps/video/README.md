# Video Deluxe Maker

Turns iPhone footage of home projects into narrated YouTube videos. So far: sign in, make a project, upload clips from the phone straight to Cloud Storage, and process each clip in the cloud. The full plan, with later phases (processing, Gemini indexing, rough cut, Remotion render), is in the Video Deluxe Maker plan doc.

- **Sign-in:** Google, through Firebase Auth. Every API route checks the ID token and the `ALLOWED_EMAILS` list (only `tjp503@gmail.com` for now).
- **Uploads:** the browser asks the server for a resumable upload session, then sends the file to Cloud Storage in 16 MB chunks. If the phone sleeps or loses signal, the upload retries and continues from what Cloud Storage already has. If the page is closed, picking the same file again (same name and size) continues the same upload.
- **Screen:** the page keeps the screen awake with the Wake Lock API while uploads run.
- **Data:** Firestore database `video`, with `projects/{id}` and `projects/{id}/clips/{clipId}`. All reads and writes go through the API, and `firestore.rules` denies direct client access.
- **Processing:** when an upload completes, the server starts an execution of the `video-process` Cloud Run job (`jobs/process`, deployed by CI) for that clip. The job downloads the original and, in one FFmpeg pass, writes a 720p proxy and a 1080p mezzanine (H.264, SDR Rec.709, constant 30 fps, a keyframe every second). HDR clips are tone-mapped with zscale and Hable. It then finds scene changes on the proxy, saves a poster frame, uploads everything next to the original and writes `media` (source details, outputs, scene times, drift) on the clip. Each clip shows its progress, a summary, a Watch proxy player and a Process again link.
- **Indexing:** after processing, the job uploads the proxy to the Gemini Files API and asks `INDEX_MODEL` (default `gemini-flash-latest`, at low media resolution) for a summary and consecutive segments labeled action, idle, repetitive or highlight, with a description, phase, tools, camera motion and quality issues. Boundaries within a second of a scene change are snapped to it. The result is `index` on the clip. "Index again" re-runs only this step (the job with `INDEX_ONLY=1`). The Footage section lists every segment in a project, with label filters, search, and a player that starts at the segment. The job has 8 vCPU, 32 GiB and 3 hours; `/tmp` is in memory, so the original and outputs must fit in 32 GiB.
- **Storage:** originals go to `gs://apps-97595-video/video/projects/{projectId}/originals/{clipId}.{ext}`, a bucket just for this app. The job writes `proxies/{clipId}.mp4`, `mezzanines/{clipId}.mp4` and `posters/{clipId}.jpg` beside `originals/`. The app plays them through two-hour signed links.

## Setup

Runs on Firebase App Hosting in project `apps-97595`, from the `apps` repo:

- Backend `video` serves https://video.trom.dev. Merging to `main` rolls it out.
- **There is no preview database.** Tim is the only user, so the preview backend and local development use the same `video` database and storage prefix as prod (the app was scaffolded with `--no-preview-db`).
- `apphosting.yaml` holds the allowlist, bucket, database and the public web app config.
- The bucket is created once by hand, and the App Hosting service account gets access to it:

  ```bash
  gcloud storage buckets create gs://apps-97595-video --project apps-97595 \
    --location us-central1 --uniform-bucket-level-access
  gcloud storage buckets add-iam-policy-binding gs://apps-97595-video \
    --member=serviceAccount:firebase-app-hosting-compute@apps-97595.iam.gserviceaccount.com \
    --role=roles/storage.objectAdmin
  ```

- Cloud Run jobs need a one-time setup: `scripts/setup-jobs.sh video <deploy service account> apps-97595-video` from the repo root.
- Signed links need the App Hosting service account to sign as itself:
  `gcloud iam service-accounts add-iam-policy-binding firebase-app-hosting-compute@apps-97595.iam.gserviceaccount.com --member=serviceAccount:firebase-app-hosting-compute@apps-97595.iam.gserviceaccount.com --role=roles/iam.serviceAccountTokenCreator`
- The Gemini key is the Secret Manager secret `video-gemini-api-key`, made with `firebase apphosting:secrets:set video-gemini-api-key` (grant both backends), plus `roles/secretmanager.secretAccessor` for `video-jobs@`. Jobs list secrets under `secrets` in `app.json`.
- Job helpers have their own tests: `cd jobs/process && npm test`.

## Local development

```bash
npm install
cp .env.example .env.local   # add a service account for server access
npm run dev
```

Checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.
