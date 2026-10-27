# apps

Monorepo for Tim's apps. Each app lives in `apps/<name>/` and is deployed to `<name>.trom.dev`.
The design and current status are in `docs/PLAN.md`; read it before changing deploy setup.

## Rules

- Never push to `main`. Work on a branch named `<app>/<short-description>` (or `infra/<...>` for repo-wide changes) and open a PR.
- Each app is self-contained: run `npm` commands from inside `apps/<name>/`, keep its own `package-lock.json`, and do not import from another app.
- Don't change files outside the app you're working on unless the task is about shared setup.
- Firebase project: `apps-97595`. Each app uses its own named Firestore database; previews use `<name>-preview`. Never point preview builds at a prod database.

## After pushing a branch

1. Find the preview run: `gh run list --branch <branch> --workflow preview.yml --limit 1`.
2. Wait for it: `gh run watch <run-id>`.
3. Reply to Tim with the preview link(s) from the run summary, one per changed app, so he can test on his phone.
4. If the run fails, read the logs (`gh run view <run-id> --log-failed`), fix, and push again.

## Before pushing

Run the app's own checks from its folder (typecheck, tests, build) as listed in its `package.json`.

## New apps

1. Create the Google resources first so the first preview works: dispatch `create-app` from `main` (safe to re-run; the app folder doesn't need to exist yet). `gh workflow run` needs GraphQL, which Claude sessions can't use, so call REST:
   `gh api -X POST repos/timperkins/apps/actions/workflows/create-app.yml/dispatches -f ref=main -f 'inputs[name]=<name>' -f 'inputs[type]=hosting' -F 'inputs[firestore]=true' -f 'inputs[ttl_collections]=rooms players rtc'`
   Leave out `firestore` and `ttl_collections` if the app has no database. `ttl_collections` lists the collection groups whose documents carry an `expiresAt` timestamp.
2. Scaffold with `node scripts/new-app.mjs <name>`, or copy the closest app. Phone-controller games with rooms: copy `apps/pong` or `apps/slither` and rename the database ids.
3. Push on `<name>/<short-description>`, open the PR, and send Tim the preview link.
4. After the merge and a green prod run, add the app to `apps/home/src/apps.ts` in a `home/add-<name>` PR.

Raw Actions logs can't be fetched from a Claude session. Read a run's notices with `gh api repos/timperkins/apps/check-runs/<job id>/annotations`.

