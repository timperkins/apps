# Ground Defender

A top-down survival game: a little guy with a crossbow defends a walled camp from bears. It started as a copy of Sky Defender 2's Survival mode (without the planes) with Tim's paper spec on top.

## Run it

TypeScript, built with Vite. It is a static site on Firebase Hosting at https://ground-defender.trom.dev (Hosting site `trom-ground-defender`, no database). CI runs `npm run build` and deploys `dist/`: a preview channel for every branch, prod on merge to `main`.

```sh
npm install
npm run dev        # local dev server; add ?debug to get the game as window.__gd
npm run typecheck
npm run build && npm run preview
```

Walk with the arrow keys on a computer, or drag anywhere on a phone. Space shoots the nearest bear (or spawner) in range, Z shoots straight ahead.

## What's new compared with Sky Defender 2 Survival

- **Bigger map.** The map is 6600 × 6600 world units and the camera follows the guy; the camp stays the same size in the middle. A small map in the top-right corner shows the fence, spawners, bears and you. You can walk out of the camp through any gate, and bears outside come for you when you get close (`chaseRange`).
- **Bear spawners.** Bears only come from 4 to 6 spawners far out in the woods, about 2,000 to 3,100 units from the camp (100 health each). For the first 15 minutes each spawner makes a bear every 50 seconds, then every 5 seconds, while there are fewer than 6 bears on the map. Tapping a spawner makes it send a bear right away; huge waves come out of the spawners on top of that. A destroyed spawner comes back somewhere else in the woods 30 seconds later, so there is no winning: the score is how long you survive.
- **Gates and waves.** Huge waves at 8, 13 and 18 minutes (then every 5 minutes), 12 bears and 2 more each time. At 8 minutes gates open on the other 3 sides of the camp. At 20 minutes 3 more gates open and bears take 40 seconds at a gate to get in. Bears go to the gate nearest their spawner, and walk round the fence to get there.
- **Metal mines.** You can craft an iron mine (100 stone), a copper mine (100 stone, 75 iron), a gold mine (125 stone, 100 iron, 50 copper) and a diamond mine (150 stone, 100 iron, 75 copper, 50 gold). Dig with M or hire miners as with the stone mine; belts, grabbers, chests and robots carry metal like stone.
- **Metal ammo.** Metal put into a machine makes ammo: 1 iron makes 6 ammo (9.5 damage), 1 copper 8 (8.55), 1 gold 12 (11.5), 1 diamond 16 (15). S cycles your crossbow through loadout, stone and metal ammo; turrets take any of them (best first).
- **Research.** Two more lab upgrades. *Rapid crossbow* (60 packs) unlocks a turret for 10 iron and 50 stone that does 0.75 damage every 0.05 seconds and uses 0.8% of one ammo per shot. *Rocket launcher* (80 packs) unlocks a turret for 40 stone and 20 iron that fires rockets for 70 damage: each rocket swirls round a loop, then homes in on its bear or spawner. Once rockets are researched, tapping a machine opens a recipe picker: ammo, or rocket ammo (10 stone per rocket).
- **Save and load.** Esc (or the pause button) pauses. The pause screen has Save, which keeps the run on this device (up to 12 saves, newest first), and Load, which lists every save to carry on from or delete. The title screen has Load too.
- **Inventory and crafting.** There is no shop. Shift (or the Inventory button) opens your inventory: the left half is a grid of slots with everything you carry, and the right half has the crafting recipes in four tabs (Logistics, Production, Combat, Science). Tap a recipe to see what it costs, tap it again or press Craft to make it. Tap something placeable in your inventory to put it down. The game keeps running while it is open.
- **Turret targeting.** Tap a turret, then tap a bear or spawner: the turret shoots only that target (when in range) until it is destroyed. Tap the turret again to pick it up.

## Guesses we made

The paper didn't say these, so they are starting points to change:

- **Diamonds:** a diamond mine (150 stone, 100 iron, 75 copper, 50 gold) whose diamonds make 16 ammo at 15 damage each, carrying on the pattern of the other metals.
- **"Takes .8% of an ammo":** read as 0.8% of one ammo per rapid crossbow shot, so one ammo lasts 125 shots.
- **Max of 6 bears:** read as 6 bears on the map at once from all spawners together (huge waves come on top).
- **Research costs** (60 and 80 packs), the rocket launcher's price (40 stone, 20 iron), its range (620) and reload (3 s), and which side the extra gates go on.

## Code map

- `src/game.ts` the game: rules, the map, bears, spawners, gates, mines, machines, turrets, rockets and drawing. All the numbers are in `SURVIVAL`, `METAL`, `AMMO` and `RESEARCH` at the top.
- `src/main.ts` screens (title and loadout, how to play, pause, results), settings, saved best time, the loop.
- `src/audio.ts` synthesised sound (copied from Sky Defender 2).
- `src/names.ts` random names for your guy.
- `public/` service worker, web manifest and icons (Sky Defender 2's icons for now).
