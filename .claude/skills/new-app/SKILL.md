---
name: new-app
description: Set up a new app in this repo. Use whenever Tim asks for a new app, before scaffolding anything, to ask the setup questions (URL, server code, database, preview database) and then scaffold, push and open the PR.
---

# New app

Ask the setup questions first, then scaffold. Don't guess answers Tim hasn't given.

## 1. Ask

Ask all the questions in one go. Use the AskUserQuestion tool if you have it, with a short option list for each. Otherwise ask them in a single numbered message. Skip any question Tim already answered, and offer the default shown.

1. **Name and URL.** The name is the folder `apps/<name>/` and the subdomain `<name>.trom.dev`. It must be 2 to 30 lowercase letters, digits and dashes (names under 4 characters only work for static hosting apps without Firestore). Default: a short name from his description. A different host needs `--domain <host>`.
2. **Server code.** Does the app need a backend: API routes, secrets such as `GEMINI_API_KEY`, or server-side Firebase Admin?
   - No (default): static site on Firebase Hosting (`--type hosting`).
   - Yes: Next.js on Firebase App Hosting (`--type apphosting`), with prod and preview backends.
3. **Database.** Does it store data in Firestore? Default: no. Yes adds `--firestore`.
4. **Preview database.** Only if question 3 is yes. Should branch previews get their own `<name>-preview` database?
   - Yes (default for anything other people use): previews never touch prod data.
   - No (fine for a tool only Tim uses): `--no-preview-db`. Previews read and write the prod database, and branches never deploy Firestore rules.
5. **Expiring data.** Only if question 3 is yes. Do any collections hold short-lived documents, such as rooms or players, that should be deleted at an `expiresAt` time? Default: none. Otherwise use `--ttl-collections "<group> ..."`.
6. **Starting point.** Which starting point fits best?
   - The `static-vite` template (default for static apps).
   - A copy of the closest app: `apps/pong` or `apps/slither` for phone-controller games with rooms, or `apps/news` for Next.js, Gemini and Firebase Auth.

Before running anything, repeat the answers back in one short line with the command you'll run.

## 2. Scaffold

- From the template: `node scripts/new-app.mjs <name> [--type apphosting] [--domain <host>] [--firestore] [--no-preview-db] [--ttl-collections "..."]`
- From a copy: copy the app folder, rename its database ids and names, then run the same command with `--config-only` to rewrite `app.json` and `firebase.json`.
- For App Hosting apps that use secrets, list them in `apphosting.yaml` (see `apps/news/apphosting.yaml`). Tell Tim which secrets to create with `firebase apphosting:secrets:set <NAME>`, since `create-app` only grants access to secrets that already exist.
- If the app has no preview database, say so in its README.

## 3. Ship

Follow the repo's CLAUDE.md:

1. Run the app's checks (typecheck, tests, build) from `apps/<name>/`.
2. Push on `<name>/<short-description>` and open a PR.
3. Wait for the preview run (`gh run list --branch <branch> --workflow preview.yml --limit 1`, then `gh run watch <run-id>`). The run calls `create-app` first, which sets up the site or backends, databases, TTL policies, domain and DNS.
4. Send Tim the preview link.
