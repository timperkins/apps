# apps

Monorepo for Tim's apps. Each app lives in `apps/<name>/` and is deployed to `<name>.trom.dev`.
The design and current status are in `docs/PLAN.md`; read it before changing deploy setup.

## Rules

- Never push to `main`. Work on a branch named `<app>/<short-description>` (or `infra/<...>` for repo-wide changes) and open a PR.
- Each app is self-contained: run `npm` commands from inside `apps/<name>/`, keep its own `package-lock.json`, and do not import from another app.
- Don't change files outside the app you're working on unless the task is about shared setup.
- Firebase project: `apps-97595`. Every app uses the shared `apps` web app for its client config (these values are public):
  `apiKey: "AIzaSyDqgldIcbiEGPtlDoVVohbwuyKBiWZq3Qc"`, `authDomain: "apps-97595.firebaseapp.com"`, `projectId: "apps-97595"`, `storageBucket: "apps-97595.firebasestorage.app"`, `messagingSenderId: "769532990756"`, `appId: "1:769532990756:web:db61ccd442333d635c8fb1"`. Each app uses its own named Firestore database. A preview database (`<name>-preview`) is optional: by default previews get one, but an app scaffolded with `--no-preview-db` (a single-user tool) has none, and its previews use the prod database. Branch previews never deploy Firestore rules to a prod database.

## After pushing a branch

1. Find the preview run: `gh run list --branch <branch> --workflow preview.yml --limit 1`.
2. Wait for it: `gh run watch <run-id>`.
3. Reply to Tim with the preview link(s) from the run summary, one per changed app, so he can test on his phone.
   Every push to `next` deploys each changed app straight to its prod domain from its `app.json` (`deploy-next.yml`), e.g. RA to https://ra.trom.dev, Sky Defender to https://sky-defender.trom.dev. Main has no deploys for now (`prod.yml` is disabled).
4. If the run fails, read the logs (`gh run view <run-id> --log-failed`), fix, and push again.

## Before pushing

Run the app's own checks from its folder (typecheck, tests, build) as listed in its `package.json`.

## New apps

1. Use the `new-app` skill (`.claude/skills/new-app/`) first: it asks Tim the setup questions (URL, server code, database, preview database) before anything is scaffolded. Then scaffold with `node scripts/new-app.mjs <name>` (add `--type apphosting`, `--firestore`, `--no-preview-db` and `--ttl-collections "rooms players rtc"` as needed), or copy the closest app and fix its `app.json`. Phone-controller games with rooms: copy `apps/pong` or `apps/slither` and rename the database ids. `ttlCollections` in `app.json` lists the collection groups whose documents carry an `expiresAt` timestamp.
2. Push on `<name>/<short-description>` and open the PR. The preview run sees the new `app.json` and runs `create-app` first (site or backends, databases, TTL policies, domain and DNS), then deploys. Send Tim the preview link.
3. For App Hosting apps, `create-app` also connects both backends to this repo, sets the preview backend's environment to `preview` and turns automatic rollouts off, so no console steps are needed.

To re-run `create-app` by hand (for an app added before this, or to change a setting), call REST, since `gh workflow run` needs GraphQL, which Claude sessions can't use:
`gh api -X POST repos/timperkins/apps/actions/workflows/create-app.yml/dispatches -f ref=main -f 'inputs[name]=<name>' -f 'inputs[type]=hosting' -F 'inputs[firestore]=true' -f 'inputs[ttl_collections]=rooms players rtc'`

Raw Actions logs can't be fetched from a Claude session. Read a run's notices with `gh api repos/timperkins/apps/check-runs/<job id>/annotations`.

