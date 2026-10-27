# Tim News

A news site that writes today's stories with AI, grounded in real reporting. It's built with Next.js, Firestore and Gemini, and installs as a PWA on phones and desktops.

- **Breaking news first,** followed by top stories, "Local news in …" and "Based on your interest in …" sections.
- **Stories are cached in Firestore.** A visit shows what is already saved. If a feed is stale, the server writes new stories in the background, and a lock makes sure only one visitor triggers that.
- **Every story cites its sources,** which come from Gemini's Google Search grounding.
- **Media is linked, never copied.** Images come from the source articles' preview images and from Wikipedia, and video is embedded from YouTube. All of it loads straight from its original host, and the service worker doesn't cache it either.
- **Follow-up explainers are written on demand.** They stream in when a reader taps one, and are saved for the next reader.
- **Interests are small and editable.** Each reader has a short weighted topic list that fades over time, managed at `/interests`.
- **Local news uses location only with consent.** Location is turned into a city, and exact coordinates are never stored.
- **Readers sign in anonymously by default,** and can switch to Google sign-in to keep their interests across devices.

## How it fits together

| Piece | Where |
|---|---|
| Home page (breaking and top stories, server-rendered) | `src/app/page.tsx`, `src/components/GlobalSections.tsx` |
| Local and interest sections (client, live from Firestore) | `src/components/PersonalSections.tsx` |
| Story generation pipeline | `src/lib/server/pipeline.ts` |
| Follow-up explainers (streaming) | `src/app/api/followup/route.ts`, `src/lib/server/followups.ts` |
| Feed refresh with lock and daily budget | `src/app/api/refresh/route.ts`, `src/lib/server/store.ts` |
| Location to city | `src/app/api/location/route.ts` (OpenStreetMap Nominatim) |
| Linked media (Open Graph, Wikipedia, YouTube) | `src/lib/server/media.ts` |
| Interest weights and decay | `src/lib/interests.ts` |
| PWA | `src/app/manifest.ts`, `public/sw.js`, `public/icons/` |
| Security rules | `firestore.rules` |

Firestore collections: `feeds` (one doc per feed, with ordered `storyIds`), `stories`, `followups`, `users` (each reader's interests, region and settings), `regions` (known cities) and `meta` (daily budget counters).

## Setup

Tim News runs on Firebase App Hosting in project `apps-97595`, from the `apps` repo (see `docs/PLAN.md` at the repo root):

- Backend `news` serves https://news.trom.dev and uses the `tim-news` database. Merging to `main` rolls it out (CI runs `firebase apphosting:rollouts:create`; automatic rollouts are off).
- Backend `news-preview` (environment name `preview`) serves branch previews from the `tim-news-preview` database. `apphosting.preview.yaml` overrides the database ID. Each push to a branch rolls that branch out there, so there is one preview at a time.
- CI deploys `firestore.rules` and indexes to the target database before each rollout.
- `apphosting.yaml` holds the web app config (public by design) and references the `GEMINI_API_KEY` secret. Both backends are granted access to it by the `create-app` workflow.
- Under **Authentication**, the **Anonymous** and **Google** providers are enabled. Optionally, add a Firestore TTL policy on `expireAt` for `stories` and `followups` in both databases.

Local development defaults to `tim-news-preview` unless `NEXT_PUBLIC_FIRESTORE_DATABASE_ID` is set.

Cost controls: `DAILY_STORY_LIMIT` and `DAILY_FOLLOWUP_LIMIT` (default 200 each) cap generation per day, and feeds refresh at most every 15 minutes (top stories), 30 minutes (topics) or 60 minutes (local). The model is set with `GEMINI_MODEL` (default `gemini-flash-latest`). `GEMINI_THINKING` sets how much the model thinks before writing (default `low`, which keeps a refresh fast; `default` leaves it to the model).

## Local development

```bash
npm install
cp .env.example .env.local   # fill in the values
npm run dev
```

To develop without a real Firebase project, run the emulators and point the app at them:

```bash
npx firebase-tools emulators:start --only firestore,auth --project demo-tim-news
```

Then add these to `.env.local`:

```
NEXT_PUBLIC_FIREBASE_API_KEY=demo-key
NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-tim-news
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=demo-tim-news.firebaseapp.com
NEXT_PUBLIC_FIREBASE_APP_ID=demo-app
NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
GCLOUD_PROJECT=demo-tim-news
```

Story generation still needs a real `GEMINI_API_KEY`.

## Checks

```bash
npm run lint
npm test
npm run build
```
