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

## Jobville

A huge village (180 × 180 tiles, about 200 numbered houses, villagers walking the streets). Original code and art; items and icons are emoji.

- **Job board** in the town square: pick a job, switch any time. Street Sweeper and Farmer are open from the start; Fisher, Mail Carrier, Lumberjack, Pizza Delivery and Miner unlock as your total earnings grow.
- **Jobs:** pick up trash, harvest crops on the farms, fish off the dock (press when the ! shows), carry letters from the Post Office to houses, chop trees in the forest, deliver pizzas before they go cold (tips for speed), break rocks in the quarry (sometimes a gem).
- **Shop:** walk inside and up to a podium to buy. 10 podiums, several with tiers: shoes → skates → bike, bags, tools, hats (earn more), magnet, fishing rods, Magic Watch, pets (puppy, dragon), hoverboard (fly over water) and the $10,000 Golden Trophy, which puts a golden statue of you in the square.
- A yellow arrow and the minimap always point to your next task; M or the map button shows the whole village.
- Keyboard (arrows/WASD, E or Space, M, Esc) and touch (drag on the left to walk, big button to act).
- Saves in localStorage under `jobville-save-v1`.

## Develop

```
npm install
npm run dev
npm run build
```
