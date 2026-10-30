# Where u at

A world map with a timeline for showing where a group of friends was born, married, moved and had
kids over time. Live at https://trom-where-u-at.web.app (no trom.dev domain).

## Data

Everything lives in `src/data/people.json` and `src/data/events.json` and is bundled into the app;
there is no database. Dates are `YYYY-MM`. Events in the same month play in list order.

- `people`: friends (`kind: "friend"`, unique `color`, `photo` under `public/faces/`) and children
  (`kind: "child"`, `sex`, `motherId`). Children always stay with their mother.
- `events`: `birth` (a place for friends, none for children), `marriage` (two people and a place) and
  `move` (everyone who moves together, and the new place).

`npm test` checks the data: ids resolve, dates are valid, everyone is born once and before anything
else, children have a mother, and friend colors are distinct and neither pink nor blue.

The current data is made up by `npm run fake-data` (10 couples). Replace both JSON files and the faces
with the real thing.

## Develop

```
npm install
npm run dev
npm test
```

Keys: Space play/pause, Left/Right one year, F fit everyone, W whole world, T traces, L pause for
life events.
