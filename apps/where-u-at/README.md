# Where u at

A world map with a timeline for showing where a group of friends was born, married, moved and had
kids over time. Live at https://trom-where-u-at.web.app (no trom.dev domain).

## Data

Everything lives in `src/data/people.json` and `src/data/events.json` and is bundled into the app;
there is no database. Dates are `YYYY-MM`. Events in the same month play in list order.

- `people`: friends (`kind: "friend"`, unique `color`, optional `photo` under `public/faces/`;
  initials show until there is one; a friend with no birth joins at their wedding, wherever their
  partner lives) and children
  (`kind: "child"`, `sex`, `motherId`). Children always stay with their mother (or their father,
  when the mother isn't in the app).
- `events`: `birth` (a place for friends, none for children), `marriage` (two people; shown wherever the
  couple lives, and nobody moves) and and
  `move` (everyone who moves together, and the new place).

`npm test` checks the data: ids resolve, dates are valid, everyone is born once and before anything
else, children have a mother, and friend colors are distinct and neither pink nor blue.


## Develop

```
npm install
npm run dev
npm test
```

Keys: Space play/pause, Left/Right one year, F fit everyone, W whole world, T traces, L pause for
life events.
