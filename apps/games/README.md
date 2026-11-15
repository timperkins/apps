# Games

A cosy cabin launcher at `games.trom.dev` for picking a game. Each game lives in `src/games/<id>/` and is listed in `src/games/registry.ts`; adding one is a folder plus a registry entry (see `src/games/types.ts`).

## Factori-owen

A factory-building game in the automation genre, with Owen in place of iron (Owen ore, Owen plates, Owen gear wheels…). Original code, art and sounds.

- Mine by hand, then automate with drills, conveyor belts, robo arms, furnaces, assemblers, power poles and coal generators.
- Research in labs with red and green science packs, up to rail guns and the Great Owen Monument (the win).
- Bugs named Calvin, Archie, Mom, Dad and Roger live in nests, get angry from pollution and attack. Fight back with your pistol, gun turrets, walls, the rail gun and rail gun turrets.
- Title screen with scenes from the game, save slots, a character customizer, and multiplayer: press Esc and "Open to join", then friends pick your game under "Join a game".

Multiplayer uses Firestore (`games` / `games-preview` databases) only to list hosts and exchange WebRTC connection details; the game itself runs peer to peer, with the host's game as the real one. Documents carry `expiresAt` and are cleaned up by TTL policies.

Saves stay in the browser (localStorage).

## Space Defender

The Space game from Ground Defender (as of its play-together branch) on its own: a platform floating among the stars, a big chest in the middle, asteroids to shoot, catchers that grab the little ones, platform tiles to grow it, and the whole crafting, factory and research system, plus playing together with a code (PeerJS, prefix `trom-space-defender-`). There's no Ground choice; everything else plays the same.

It is its own page, `space-defender.html` (code in `src/games/space-defender/`), which the hub runs in a frame, so Ground Defender's page-wide styles and key handlers stay out of the launcher. "Back to games" on its start screen returns to the hub. Saves, settings and blueprints are kept under `spacedef.` in localStorage. It's a copy, so later Ground Defender changes don't show up here by themselves.

## Survivle

An open-world adventure designed by Tim (original code and art). Name your hero, then defeat the Dark Beast in the castle at the middle of the map before 4 hours of play run out, or the world goes black.

- The land is 10,000 × 10,000 tiles, generated from a seed one 32 × 32 chunk at a time as you explore (`src/games/survivle/world.ts`), with forests, lakes, snowy plateaus and cliffs. A road with a narrow bridge runs from the starting camp to the castle.
- Isometric view. Arrows/WASD walk, Space swings your sword (and chops trees for wood and an acorn), Shift shoots your bow at the mouse, Z jumps, E opens chests, trades, uses job boards and starts challenges, C builds a campfire (heals, and you wake up there if knocked out), H eats (acorn ¼ heart, apple or bread 1 heart), I opens gear and clothes, Esc pauses (Save, Load, Save and quit, narrator voice).
- Walk into a cliff to climb, and walk into water to swim. Both drain 12% of the stamina ring per second. Run out climbing and you fall; run out swimming and you wash back to shore. Falls of more than 4 levels hurt, more the higher you fall.
- 3 hearts to start. Glowing blue-patterned rocks start a challenge fight (like two greens or a bunch of oranges); winning adds a permanent ¼ heart, up to 20 hearts.
- Murks: 95% orange (¼ heart, 10 health), 4% blue (½ heart, 25), 1% green (¾ heart, 35). They only come after you within 30 tiles or once you hurt them.
- 10 chests at a time hide on cliff tops and in deep forest near you. Each holds a sword or bow at most 5 damage better than your best; the best sword (Starfall Blade) does 15.
- A trader follows you around. Trade wood for coins, and buy arrows, apples and outfits. You start in green: green shirt, green pants, dark green hood.
- Two villages (Willowby and Stonebrook) have job boards with 7 jobs: farmer (plant and harvest the village farm), lumberjack, guard, fisher, miner, baker and courier.
- A narrator calls out chests, enemies, challenges, villages and the time left, with subtitles. It uses the browser's speech voices; pick the voice and pitch (or words only, or off) on the title screen or the pause menu.
- The Dark Beast (500 health) gives off black and purple gas and locks the doors when you enter its room. Its normal attack does 1 heart; its heavy attack takes 4× as long to charge and does 1½.

Saves and narrator settings stay in the browser (localStorage, `survivle-` keys).

## Develop

```
npm install
npm run dev
npm run build
```
