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

- **Bears only attack when provoked.** Bears wait by their spawner. A base attacks only if you hurt its spawner or one of its bears (its bears come for you, and new ones come straight away, until 60 s after your last hit; `angryTime`), or because of pollution: every 30 s (`smogCheck`), once pollution is 1000 or more one base attacks, and below 1000 pollution never sets them off (`smogAttack`). Huge waves just fill the bases. The top right shows how many bears are after you and how many are waiting at their bases.
- **Weapon and ammo slots.** Bottom left, above the quickbar: 3 weapon slots on top, 3 ammo slots underneath. Tap a slot to use it, and tap it again to take it out. Hold something from your inventory, then tap a slot to put it in, or press G to put in one ammo. Tab switches weapon, S switches ammo. You start with a crossbow and 100 stone ammo. Each ammo has 100 usage points: a crossbow shot or a rocket uses one whole ammo; with no ammo the crossbow fires your loadout bolts.
- **Rapid crossbow.** A weapon you hold, craftable without research for 100 stone and 10 iron plates. While you hold Space (or the Shoot bear button) it streams a yellow line at the nearest bear in range: 0.3 damage every 0.1 seconds, using 4.62 usage points a second. Holding Space with any weapon keeps firing.
- **Acid fish.** 9.9% of what spawners make (`fishChance`) is an acid fish (green and dark green). It keeps its distance and spits slime from 10 tiles (`fishRange`): 10,000 damage on a hit plus a burn of 10,000 a second for 5 s. Each slime leaves a puddle for 10 s that does 20,000 a second while you stand in it (puddles stack) and burns you at half strength. Spawners have 55.5 health.
- **Machine recipes.** The ammo machine takes nothing until you pick a recipe in its panel. Ammo can also be crafted by hand (Combat tab), giving 1 less than the machine.
- **Crafting machines.** Assemblers are now crafting machines: no research needed. Set a recipe, put the ingredients in, and it crafts 4 times slower than by hand, over and over, until the recipe changes.
- **Speed research.** *Crafting speed* (hand and crafting machines) and *Furnace speed* level up again and again, 1.25× each. Level 1 costs 30 packs, each level 20 more, up to 980 (49 levels).
- **Sounds and art.** Footsteps, a dink when mining, growls from close bears, turret shots, a rattle for the rapid crossbow. Furnaces look like stone furnaces. Drills are heavy industrial mining drills (a weathered housing with bolts, pumping pistons, a spiral cutter that turns and kicks up dust while it digs, and a striped output chute). A Mine button shows on ore patches. The rapid crossbow fires with no ammo but does 0 damage.
- **Cheat mode.** The start screen has a Mode choice: Survival or Cheat. In Cheat mode, the pause menu (Esc) has Survival and Creative to choose between while you play. Creative tops everything up to 9,999 (`creativeStock`), crafts instantly for free, and nothing hurts you. Switching back to Survival gives you back exactly what you had (things you placed in Creative stay). A save made in Creative keeps your Survival inventory.
- **Endless ore.** Ore patches never run out, for drills or digging by hand (old saves' patches come back full).
- **Turret ammo limit.** Tap a turret to open its panel: it shows the ammo in it and lets you set the most it holds, 0 to 10,000 (slider, number box or quick buttons; `turretMaxAmmo`). Loading by hand, belts, grabbers and robots all stop at that limit. New turrets start at 10,000. Lowering it doesn't remove ammo already inside.
- **Bear drops.** Killing a bear puts 5 stone in your pocket (`bearDrop`), and an acid fish 1 iron ore (`fishDrop`).
- **Crafting machines hold 50.** With a recipe set, a crafting machine holds up to 50 of each ingredient (`asmHold`).
- **Drill info.** Tapping a drill (or T next to it) shows what it digs, its status, mining speed, power, what's waiting in its output and which way it goes, pollution, and a progress bar to the next ore. Take out and Pick up are there too.
- **Turret shots.** Turrets (and brick turrets) fire every 0.2 s for 1 damage a shot, whatever the ammo, using 16% of an ammo a shot (`turretShot`, `turretEvery`, `turretUse`). The heavy turret research still multiplies the damage. Rapid and rocket turrets are unchanged.
- **Bears don't shoot.** Bears only swipe up close; they no longer throw rocks. Acid fish still spit.
- **Safe start.** You start on a 10 × 10 tile stone patch, with a 5 × 5 iron patch touching its right side and a 5 × 5 copper patch its left (square, lined up with the tiles; `startStone`, `startOre`). No spawners for the first 10 minutes (`spawnerDelay`): they appear in the woods at 10:00, then spawn as usual.
- **The machine gun.** A weapon you hold, 1000 stone and 500 iron plates (exact, not halved). While you hold Space it fires a bolt every 0.2 s (`mgunEvery`), using 0.5 of an ammo's 100 usage points a shot (`mgunUse`). Damage a shot (`mgunDamage`): 1.4 stone, 1.5 copper, 1.8 iron, 2 gold, 2.25 diamond. With no ammo it still fires, for no damage.
- **Crafting machine cost.** 10 iron plates and 5 stone (exact), no research needed.
- **Walls stop shots.** Your walls and gates stop bolts, rockets, the rapid crossbow's stream, bears' rocks and acid slime, from both sides; the wall takes no damage. Shots fired from a wall tile you're standing on still go out.
- **G loads the gun.** With ammo in your hand, G puts one in your ammo slots, and D drops one where the mouse points (or in front of you), into a building, chest or turret there or onto the ground.
- **Fills the window.** The game uses the whole window in any shape, portrait or landscape, on phones and computers (it no longer squeezes into a portrait column).

- **No camp.** There is no fence and no gates (`NO_BASE` in `game.ts`; set it to false for the old walled camp). Bears come straight for you from the spawners, and have 5 health. You start with a drill, 10 power poles, a generator, an ammo machine, 2 turrets, 100 stone ammo, a furnace and 8 iron plates. Belts cost 2 stone and 1 gear (for 2).

- **Bigger map.** The map is 6600 × 6600 world units and the camera follows the guy; the camp stays the same size in the middle. A small map in the top-right corner shows the ore patches (in their colours), the fence, spawners, bears and you. You can walk out of the camp through any gate, and bears outside come for you when you get close (`chaseRange`).
- **Bear spawners.** Bears only come from 4 to 6 spawners far out in the woods, about 2,000 to 3,100 units from the camp (100 health each). For the first 15 minutes each spawner makes a bear every 100 seconds, then every 12 seconds, while there are fewer than 6 bears on the map. Tapping a spawner makes it send a bear right away; huge waves come out of the spawners on top of that. A destroyed spawner comes back somewhere else in the woods 30 seconds later, so there is no winning: the score is how long you survive.
- **Gates and waves.** Huge waves at 12, 20 and 28 minutes (then every 8 minutes), 12 bears and 2 more each time. At 8 minutes gates open on the other 3 sides of the camp. At 20 minutes 3 more gates open and bears take 40 seconds at a gate to get in. Bears go to the gate nearest their spawner, and walk round the fence to get there.
- **Ore patches.** Patches (wobbly stains of dug-up earth with jagged chunks of ore, thickest in the middle; gold and diamonds glint) of stone, iron, copper, gold and gems lie in the woods. Stand on one and press M (or Dig) to dig by hand, or put a drill on it: drills need power and push ore onto the belt in front of them. Patches run out.
- **Smelting.** A furnace turns ore into plates (iron, copper), gold bars and cut gems. Furnaces burn nothing; they just take a few seconds per plate.
- **Parts.** Gears (1 iron plate makes 2), wire (1 copper plate makes 4) and circuits (1 iron plate and 2 wire) go into most buildings.
- **Cheap recipes.** Every recipe costs half of what `RECIPES` lists (rounded up) and takes half the time; the `half()` helper does it.
- **Timed crafting.** Each recipe takes time. Crafting adds it to a queue on the left of the screen, and any missing parts are queued and made first. Tap a queued item to cancel it and get its things back.
- **Assemblers.** An assembler can be set to any recipe it can make. Tap it to pick the recipe and fill it; grabbers and robots feed it and take out what it makes. It needs power.
- **Power.** Generators burn stone. Poles carry power to each other (7 tiles) and power drills, assemblers and labs within 2 tiles. Unpowered buildings show a red bolt.
- **Science and research.** Labs use science packs (copper plate and gear) and, for later research, logistic packs (grabber and belt). The lab screen shows the research tree; each item needs the ones before it.
- **Quickbar and your hand.** Ten slots at the bottom-left. Placeable things you get go in the first empty slot. In the inventory, tap anything to hold it, then tap a quickbar slot to keep it there; a slot stays put even when you run out. Tap a slot (or press 1-0) to place that thing or hold it. D (or the Put 1 button) puts one of what you hold into whatever is on the tile in front of you (furnace, assembler, generator, chest, turret, lab, ammo machine), puts a placeable thing down, or drops it on the ground or a belt. Underground belts moved to Q.
- **Building panels.** Tapping a furnace or assembler shows your inventory too: tap a thing to put in all of it that fits. Things it can't use are faded and do nothing. Furnaces hold 50 ore. Walking over a furnace picks up whatever it has smelted.
- **Pollution.** Drills, furnaces, assemblers, generators and machines pollute. The more pollution, the more often spawners send bears, the more bears there can be, and the tougher they are. It fades slowly.
- **Your own walls.** Walls (3 stone) and gates (1 wall and 1 gear) are in the Combat tab. Place them on tiles anywhere (drag to lay a row) to build your own base. You can walk through your own walls and gates; bears can't. A gate is just a stronger wall. A bear pushing on a wall or gate bites it (15 damage a second; walls have 150 health, gates 200) until it breaks.
- **Picking up buildings.** Double-tap (or double-click) anything you built, or use its panel's Pick up button, to pick it up with what is in it. One tap still opens a building's panel or picks a turret.
- **Blueprints.** The Blueprint button (Ctrl+C) lets you drag a box over what you built and saves it as a blueprint (kept on this device). It then follows your finger or mouse; let go to put it down as light blue ghosts that do nothing and don't block anything. R turns it, Ctrl+V puts the last one down again. Building on a ghost makes it go away (and faces the thing the ghost's way). Double-tap a ghost to remove it, or remove them all from the Blueprint panel.
- **Metal ammo.** Plates put into a machine make ammo (a machine works on one material at a time, so it only takes more of what is already in it): 1 iron plate makes 6 ammo (9.5 damage), 1 copper 8 (8.55), 1 gold bar 12 (11.5), 1 gem 16 (15). S cycles your crossbow through loadout, stone and metal ammo; turrets take any of them (best first).
- **Research.** *Rapid crossbow* unlocks a turret that does 0.75 damage every 0.05 seconds and uses 0.8% of one ammo per shot. *Rocket launcher* unlocks a turret that fires rockets for 70 damage: each rocket swirls round a loop, then homes in on its bear or spawner. It also unlocks a *rocket gun* you carry (5 iron plates, 3 gears, 2 circuits): once you have one and some rockets, S switches to rockets and each shot fires one (every 1.5 seconds). Once rockets are researched, a machine's panel can switch to rocket ammo (10 stone per rocket).
- **Space.** A Game choice on the start screen (Ground or Space). In Space you start on a 10 by 10 tile platform floating among the stars, with no ground, ore or bears; you can't walk off it, and you build only on it. In the middle is a 2 by 2 chest: tap it to open it. It holds 100 stacks of up to 100 of a thing (`SPACE`); tap something of yours to put it all in, Put everything in, or tap a stack to take it out. A small bar on the chest shows how full it is. Small asteroids fly in from all round (one every 2.5 s or so): Space aims the crossbow at the nearest one. A shot asteroid breaks into 3 stone that drifts; stone that drifts onto the platform stops there and you pick it up by walking over it, the rest floats away after a while. An asteroid that hits you takes 5% of your health; one that hits the platform cracks a tile, and a second hit breaks it off with whatever was built on it (the chest's tiles hold). A platform tile costs 15 stone and goes next to the platform to make it bigger. Numbers are in `SPACE`.
- **Exploding rockets.** Once rockets are researched you can craft an exploding rocket from 2 rockets. It fires from the rocket gun and rocket launchers (which use exploding rockets before plain ones) and, where it hits, does rocket damage (70) to every bear and spawner in a 5 by 5 tile square (`xrocketTiles`).
- **Save and load.** Esc (or the pause button) pauses. The pause screen has Save, which keeps the run on this device (up to 12 saves, newest first), and Load, which lists every save to carry on from or delete. The title screen has Load too.
- **Inventory and crafting.** There is no shop. Shift (or the Inventory button) opens your inventory: the left half is a grid of slots with everything you carry, and the right half has the crafting recipes in four tabs (Logistics, Production, Parts, Combat). Only researched recipes show. Tap a recipe to see what it costs (yellow means missing parts will be made first), tap it again or press Craft to queue it. Tap something placeable in your inventory to put it down. The game keeps running while it is open.
- **Turret targeting.** Tap a turret, then tap a bear or spawner: the turret shoots only that target (when in range) until it is destroyed. Double-tap the turret to pick it up.

## Guesses we made

The paper didn't say these, so they are starting points to change:

- **Gems:** gems make 16 ammo at 15 damage each, carrying on the pattern of the other metals.
- **Factory numbers:** recipe costs and times, drill speed, pole reach and pollution amounts are all first guesses in `SURVIVAL` and `RECIPES`.
- **"Takes .8% of an ammo":** read as 0.8% of one ammo per rapid crossbow shot, so one ammo lasts 125 shots.
- **Max of 6 bears:** read as 6 bears on the map at once from all spawners together (huge waves come on top).
- **Research costs**, the rocket launcher's price, its range (620) and reload (3 s), and which side the extra gates go on.

## Code map

- `src/game.ts` the game: rules, the map, bears, spawners, gates, ore patches, crafting, furnaces, assemblers, power, machines, turrets, rockets and drawing. All the numbers are in `SURVIVAL`, `METAL`, `AMMO`, `RECIPES` and `RESEARCH` at the top.
- `src/main.ts` screens (title and loadout, how to play, pause, results), settings, saved best time, the loop.
- `src/audio.ts` synthesised sound (copied from Sky Defender 2).
- `src/names.ts` random names for your guy.
- `public/` service worker, web manifest and icons (Sky Defender 2's icons for now).
