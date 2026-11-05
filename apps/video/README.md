# Video Deluxe Maker

Turns iPhone footage of home projects into narrated YouTube videos. This is phase 1, the upload app: sign in, make a project and upload clips from the phone straight to Cloud Storage. The full plan, with later phases (processing, Gemini indexing, rough cut, Remotion render), is in the Video Deluxe Maker plan doc.

- **Sign-in:** Google, through Firebase Auth. Every API route checks the ID token and the `ALLOWED_EMAILS` list (only `tjp503@gmail.com` for now).
- **Uploads:** the browser asks the server for a resumable upload session, then sends the file to Cloud Storage in 16 MB chunks. If the phone sleeps or loses signal, the upload retries and continues from what Cloud Storage already has. If the page is closed, picking the same file again (same name and size) continues the same upload.
- **Screen:** the page keeps the screen awake with the Wake Lock API while uploads run.
- **Data:** Firestore database `video`, with `projects/{id}` and `projects/{id}/clips/{clipId}`. All reads and writes go through the API, and `firestore.rules` denies direct client access.
- **Storage:** originals go to `gs://apps-97595.firebasestorage.app/video/projects/{projectId}/originals/{clipId}.{ext}`.

## Setup

Runs on Firebase App Hosting in project `apps-97595`, from the `apps` repo:

- Backend `video` serves https://video.trom.dev. Merging to `main` rolls it out.
- **There is no preview database.** Tim is the only user, so the preview backend and local development use the same `video` database and storage prefix as prod (the app was scaffolded with `--no-preview-db`).
- `apphosting.yaml` holds the allowlist, bucket, database and the public web app config.
- The App Hosting service account needs to create objects in the bucket. If uploads fail with a permission error, grant it access once:

  ```bash
  gcloud storage buckets add-iam-policy-binding gs://apps-97595.firebasestorage.app \
    --member=serviceAccount:firebase-app-hosting-compute@apps-97595.iam.gserviceaccount.com \
    --role=roles/storage.objectAdmin
  ```

## Local development

```bash
npm install
cp .env.example .env.local   # add a service account for server access
npm run dev
```

Checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.
