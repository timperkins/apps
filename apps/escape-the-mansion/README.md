# Escape the Mansion

A top-down pixel-art stealth game. Lenny wakes up in Jeff's dungeon and has to sneak through 50 levels to get out of the mansion.

- **Controls:** move (arrow keys / WASD, or drag anywhere on a phone) and one action button (Space, or the round button) to throw or use what Lenny is holding.
- **Areas:** every 5 levels is a new part of the mansion: Dungeon Cells, Wine Cellar, Servants' Kitchen, Grand Hall, Library, Portrait Gallery, Master Bedrooms, Conservatory, Hedge Maze, and the Grounds at Night.
- **Hazards:** guards with vision cones, dogs that sniff you out, lasers, spike traps, security cameras (level 14+) and armoured guards with glowing red eyes (level 36+, rocks only stagger them). Getting caught or losing all hearts restarts the level.
- **Items:** rocks (knock out guards and dogs, crack cameras), bottles (loud distraction), meat (distracts dogs), wind-up toys (keep rattling), smoke bombs (hide), bandages (heal).
- **Levelling:** XP from knockouts, distractions and finishing levels (bonus for going unseen). Each level-up offers 4 powerups: item-odds boosts or stat boosts.
- **Story:** Jeff taunts Lenny at the start of each area, now and then mid-level and over the intercom; his lines don't repeat until they've all been used (tracked in `localStorage`). Lenny stays terrified (and tiptoes) until level 20, then gets tidier, more confident and more muscular every 5 levels, and walks with more swagger in the second half. Jeff gets more frazzled. On level 50 Jeff chases Lenny himself.
- **Bonus:** after level 50, Lenny takes Jeff's limo down the drive while the mansion burns (steer, floor it, honk).
- **Music:** `public/music/main-theme.mp3` (Tim's "Escape Mansion 3") plays on the title, levels 1-5, level 50 and the bonus; `mansion-escape-2.mp3` ("Mansion Escape2") loops from level 6. Levels 15-25 and 26-36 use `levels-15-25.mp3` and `levels-26-36.mp3`; if a file is missing they fall back to the loop theme.

Static site on Firebase Hosting, no database. Progress is saved in `localStorage`.

## Develop

```sh
npm install
npm run dev        # http://localhost:5173, add ?level=N to jump to a level
npm test           # every level is solvable, simulation smoke tests
npm run build
```

Art is painted in code (`src/sprites.ts`, `src/themes.ts`); `public/lenny.png` is the original Lenny drawing used on the title and dialog screens.
