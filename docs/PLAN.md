# Plan: one repo for all apps on trom.dev

Status: **in progress.** Phases 1–7 are done; next is phase 8 (deleting the old App Hosting backends). This file records the decisions and the order of work.
Update it as phases land.

## Goals

- One repo for every app, so a new app is a folder, not a new repo and Firebase project.
- Each app is independent: its own folder, dependencies, build, deploy and subdomain.
- Pushing any branch gives a preview link that works on a phone within a couple of minutes.
- Merging to `main` deploys to prod only the apps that changed since their last prod deploy.

## Decisions

| Topic | Decision | Why |
|---|---|---|
| Repo | `timperkins/apps`, one folder per app in `apps/<name>/` | Copied in without git history; the old repos stay as they are |
| Package management | Each app keeps its own `package.json` and lockfile (npm). No workspaces for now | The apps share no code, and App Hosting builds cleanly from a self-contained folder. Add workspaces only when shared code appears |
| URLs | Subdomains: `<name>.trom.dev` | Isolated origins, no base-path config, no router |
| `trom.dev` itself | A small static homepage app that links to every app | Replaces Sky Defender at the apex |
| DNS | Move from Namecheap to Google Cloud DNS (nameserver change at Namecheap, once) | Subdomains can then be created by script with the same Google credentials as deploys |
| Firebase project | Keep the existing `apps-97595` for everything | All apps already live here |
| Data | One named Firestore database per app, plus a `<name>-preview` database for previews | Previews never touch prod data; one shared Auth user pool |
| Static apps | Firebase Hosting, one Hosting site per app | Per-branch preview channels, about one minute to a link, CDN, no cold starts |
| Apps with server code | Firebase App Hosting, two backends per app: prod (follows `main`) and preview (CI picks the branch) | Needs a real server; one preview slot per app is an acceptable trade |
| Prod trigger | Merge to `main` | Standard for a solo repo. Release tags can be added later if batching is wanted |
| Change detection | A moving git tag per app, `deployed/<name>`, set after each successful prod deploy; diff `apps/<name>/` against it | A failed deploy is retried automatically on the next merge |

## Inventory

All apps currently live in Firebase project `apps-97595`. Nothing needs a data or user migration.

| App | Source repo | Stack | Firebase use | Target | Subdomain |
|---|---|---|---|---|---|
| Sky Defender | `sky-defender` | Vite + TS | none | Hosting; delete `server.mjs` and `start` script | `sky-defender` |
| Pong | `pong` | Vite + React, PWA | Anonymous Auth, Firestore DB `pong` (database ID hardcoded in `src/net/firebase.ts`) | Hosting; delete `serve` start script; read DB ID from env | `pong` |
| You Have Been Chosen | `you-have-been-chosen` | Vite + React, PWA | none | Hosting; delete `sirv` start script | `chosen` (or full name) |
| Scorched | `scorched` | Vite + TS, PeerJS (public PeerJS server) | none | Hosting; delete `server.mjs`; keep its CI checks | `scorched` |
| Paper Airplane | `paper-airplane` | Next.js + three.js, no API routes, not deployed yet | none | Hosting via Next static export (`output: 'export'`) | `paper-airplane` |
| Tim News | `news` | Next.js, 3 API routes, Gemini, `firebase-admin`, secret `GEMINI_API_KEY` | Auth, Firestore DB `tim-news` | App Hosting (prod + preview backends) | `news` |
| Home | new | Static page | none | Hosting | apex `trom.dev` |

Notes:
- Paper Airplane uses a Next.js version whose APIs differ from common knowledge; read its bundled docs in `node_modules/next/dist/docs/` before changing config (see its `AGENTS.md`).
- Sky Defender and Scorched already use Vite `base: './'`, which works at a subdomain root.
- Basement Preview is out of scope.

## Repo layout

```
apps/
  <name>/
    app.json           # deploy config read by CI (see below)
    firebase.json      # this app's Hosting site and Firestore databases only
    package.json, package-lock.json, src/, ...
    apphosting.yaml    # App Hosting apps only (+ apphosting.preview.yaml for preview env)
templates/
  static-vite/         # starter for new static apps
scripts/
  changed-apps.mjs     # lists apps changed vs a ref
  new-app.mjs          # scaffolds a folder from a template
.github/workflows/
  preview.yml  prod.yml  deploy-app.yml  create-app.yml
docs/PLAN.md
CLAUDE.md
```

`app.json` per app, for example:

```json
{
  "name": "pong",
  "type": "hosting",
  "domain": "pong.trom.dev",
  "hostingSite": "trom-pong",
  "firestore": { "prod": "pong", "preview": "pong-preview" }
}
```

For App Hosting apps: `"type": "apphosting"`, `"backend": "news"`, `"previewBackend": "news-preview"`.

## Deploy flow

**Preview: on push to any branch other than `main`**
1. `changed-apps.mjs` diffs the branch against its merge-base with `main`.
2. For each changed Hosting app: build with preview env (preview database), then deploy a Hosting preview channel named after the branch (expires after 7 days).
3. For each changed App Hosting app: `firebase apphosting:rollouts:create <previewBackend> --git-branch <branch>`.
4. Write the preview URLs to the run's job summary, a commit status, and a PR comment if a PR exists. Claude reads them with `gh run watch` / `gh run view` and replies with the links.

**Prod: on push to `main`**
1. For each app, diff `apps/<name>/` against `deployed/<name>` (missing tag means deploy).
2. Hosting apps: build with prod env, then deploy to the live channel, plus Firestore rules and indexes for that app's databases.
3. App Hosting apps: `firebase apphosting:rollouts:create <backend> --git-commit <sha>` (automatic rollouts off, so CI is the single trigger).
4. On success, move `deployed/<name>` to the deployed commit.

**Manual:** `deploy-app.yml` (workflow_dispatch: app, target prod or preview, optional ref) for redeploys and rollbacks.

**New app:** `create-app.yml` (workflow_dispatch: name, type) runs with the deploy service account, so no Claude session needs Google credentials. It:
- creates the Hosting site (or both App Hosting backends with root directory `apps/<name>`),
- creates the `<name>` and `<name>-preview` Firestore databases if requested,
- creates the Cloud DNS records and attaches `<name>.trom.dev` to the site or backend,
- adds the domain to Auth's authorized domains.
Scaffolding the folder itself is `scripts/new-app.mjs`, committed on a branch like any other change.

## Phases

1. **Prep (needs Tim in the Google Cloud and GitHub consoles)**
   - Create a deploy service account in `apps-97595` with Hosting Admin, App Hosting Admin, Firebase Rules Admin, Cloud Datastore Owner (for creating databases), DNS Administrator, Service Account User, Service Usage Consumer (firebase-tools checks that APIs are enabled), Firebase Authentication Admin (`attach-domain.mjs` adds authorized domains), and Developer Connect User plus Developer Connect Read Token Accessor (App Hosting rollouts read the repo link). Store its key as GitHub secret `FIREBASE_SERVICE_ACCOUNT`. (Workload Identity Federation instead of a key is an optional later hardening.)
   - Install the Firebase App Hosting GitHub app on `timperkins/apps`.
2. **DNS move**
   - Create a Cloud DNS zone for `trom.dev` and recreate every existing Namecheap record (App Hosting A/TXT/CNAME records for Sky Defender, any verification TXT, any mail records).
   - Switch nameservers at Namecheap. Check `trom.dev` still serves Sky Defender.
3. **Skeleton** (done, untested in CI until phase 1): `scripts/changed-apps.mjs`, `scripts/new-app.mjs`,
   `scripts/attach-domain.mjs` (custom domain, Cloud DNS records and Auth domain, used by `create-app.yml`),
   the four workflows, `templates/static-vite`. Builds get `VITE_APP_ENV` / `NEXT_PUBLIC_APP_ENV` and
   `VITE_FIRESTORE_DATABASE_ID` / `NEXT_PUBLIC_FIRESTORE_DATABASE_ID` from `app.json`.
4. **First app, end to end: Sky Defender** (done: `sky-defender.trom.dev`) (simplest; no Firebase use)
   - Copy into `apps/sky-defender`, convert to Hosting, push a branch, open the preview link on a phone, merge, verify `sky-defender.trom.dev`.
5. **Home page** at `trom.dev` (done; apex cut over to Hosting site `trom-home`). Cut the apex over from the old Sky Defender App Hosting backend to the Home Hosting site.
   Order: run `create-app` (name `home`, `attach_domain` off) so the site exists, merge the home page so prod is
   deployed, remove `trom.dev` from the old App Hosting backend, then run `create-app` again with `attach_domain` on.
   When an app goes live, add it to `apps/home/src/apps.ts`.
6. **Remaining static apps**: Pong (add preview database, env-driven DB ID), You Have Been Chosen, Scorched, Paper Airplane (static export). One branch per app.
7. **Tim News on App Hosting**
   - Repoint the existing `news` backend at `apps/news` in this repo (live branch `main`, automatic rollouts off).
   - No preview backend or preview database for now: `app.json` has no `previewBackend`, so previews skip News.
   - The backend already has access to the `GEMINI_API_KEY` secret. `create-app` grants access to new backends,
     which needs Secret Manager Admin on the service account.
8. **Clean up**: delete the old per-repo App Hosting backends once each subdomain is verified. Archive old repos only if Tim wants to (not planned).

## Open items to verify during implementation

- Whether Hosting preview channel domains (`*.web.app`) need adding to Auth's authorized domains for Pong's anonymous sign-in and Tim News's sign-in to work on previews. `hosting:channel:deploy` adds channel domains to Auth by default, so this should already work for Hosting apps; `create-app.yml` authorizes the App Hosting preview backend's URL.
- `apphosting:backends:create --non-interactive` may not connect the GitHub repo or turn off automatic rollouts; `create-app.yml` lists those as console steps.
- The exact API calls for attaching custom domains to Hosting sites and App Hosting backends from a script; fall back to one manual console step per app if needed.
- App Hosting's handling of a root directory inside a repo with no workspace config (expected to work; confirm with Tim News).
- Hosting site IDs are globally unique; `trom-<name>` is the naming pattern, adjust if taken.
