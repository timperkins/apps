# Escape the Mansion

A top-down pixel-art stealth game. Lenny wakes up in Jeff's dungeon and has to sneak through 50 levels to get out of the mansion.

- **Controls:** move (arrow keys / WASD, or drag anywhere on a phone) and one action button (Space, or the round button) to throw or use what Lenny is holding.
- **Areas:** every 5 levels is a new part of the mansion: Dungeon Cells, Wine Cellar, Servants' Kitchen, Grand Hall, Library, Portrait Gallery, Master Bedrooms, Conservatory, Hedge Maze, and the Grounds at Night.
- **Hazards:** guards with vision cones, dogs that sniff you out, lasers, spike traps and security cameras (level 14+). Getting caught or losing all hearts restarts the level.
- **Items:** rocks (knock out guards and dogs, crack cameras), bottles (loud distraction), meat (distracts dogs), wind-up toys (keep rattling), smoke bombs (hide), bandages (heal).
- **Levelling:** XP from knockouts, distractions and finishing levels (bonus for going unseen). Each level-up offers 4 powerups: item-odds boosts or stat boosts.
- **Story:** Jeff shows up to taunt Lenny at the start of each area and now and then mid-level. Lenny gets cleaner, more confident and more muscular every 10 levels; Jeff gets more frazzled. On level 50 Jeff chases Lenny himself.

Static site on Firebase Hosting, no database. Progress is saved in `localStorage`.

## Develop

```sh
npm install
npm run dev        # http://localhost:5173, add ?level=N to jump to a level
npm test           # every level is solvable, simulation smoke tests
npm run build
```

Art is painted in code (`src/sprites.ts`, `src/themes.ts`); `public/lenny.png` is the original Lenny drawing used on the title and dialog screens.
