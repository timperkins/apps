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

## North Pole Village

Build a village at the North Pole and keep the polar bears out. Code in `src/games/north-pole/`.

- Chop trees for wood; 30 trees chopped gives you a base. Fences cost 1 wood: bears can't get through them, but you can.
- Two minutes after the base, polar bears come in waves. They don't hurt fences, only you, and only when no fence is between you. If you get knocked out, the nearest villager walks out, carries you back to base and you're healed.
- Shoot bears with the crossbow for meat, sell meat to villagers for gold coins, and buy crossbow towers (load them with L), conveyor belts, grabbers and new villagers (10,000 gold; they chop trees for you).
- A stick pile in the back never runs out; the arrow machine turns each stick into two arrows. Grabbers take from behind and put in front, so sticks → machine → towers can run by itself.
- Touch controls on phones (joystick, Use, Shoot/Place, Load, Turn, Pick up). Saves in localStorage under `north-pole-save-v1`.

## Develop

```
npm install
npm run dev
npm run build
```
