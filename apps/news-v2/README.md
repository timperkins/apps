# News v2

A fresh take on Tim News. For now it only shows headlines: every visit loads the latest items from the RSS and Atom feeds the reader has picked, merged newest first. It doesn't write articles yet.

It's a Next.js app on Firebase App Hosting (backend `news-v2`, preview backend `news-v2-preview`), served at https://news-v2.trom.dev. There's no database.

## How it works

| Piece | Where |
|---|---|
| Source list and defaults | `src/lib/sources.ts` |
| Feed fetching and RSS/Atom parsing | `src/lib/server/feeds.ts` |
| Headlines page (server-rendered on each visit) | `src/app/page.tsx` |
| Source picker | `src/app/sources/page.tsx`, `src/app/actions.ts` |

- The reader's chosen sources are kept in a `sources` cookie, so there's no sign-in. With no cookie, the defaults in `DEFAULT_SOURCE_IDS` are used.
- Each feed is fetched on the server with an 8 second timeout and cached for 60 seconds, so a burst of visits doesn't hit the feeds each time. A feed that fails is named at the top of the page and the rest still show.
- Google News titles end with " - Publisher"; that's stripped and the publisher is shown under the headline instead.
- To add a source, add an entry to `SOURCES`.

## Local development

```bash
npm install
npm run dev
npm test && npm run typecheck && npm run lint && npm run build
```
