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

The Space game from Ground Defender (as of its play-together branch) on its own: a platform floating among the stars, a big chest in the middle, asteroids to shoot, catchers that grab the little ones, platform tiles to grow it, and the whole crafting, factory and research system, plus playing together with a code for up to 8 players (PeerJS, prefix `trom-space-defender-`). There's no Ground choice; everything else plays the same.

It is its own page, `space-defender.html` (code in `src/games/space-defender/`), which the hub runs in a frame, so Ground Defender's page-wide styles and key handlers stay out of the launcher. "Back to games" on its start screen returns to the hub. Saves, settings and blueprints are kept under `spacedef.` in localStorage. It's a copy, so later Ground Defender changes don't show up here by themselves.

## North Pole Village

Build a village at the North Pole and keep the polar bears out. Code in `src/games/north-pole/`.

- Chop trees for wood; 30 trees chopped gives you a base. Fences cost 1 wood: bears can't get through them, but you can.
- Two minutes after the base, polar bears come in waves. They don't hurt fences, only you, and only when no fence is between you. If you get knocked out, the nearest villager walks out, carries you back to base and you're healed.
- Shoot bears with the crossbow for meat, sell meat to villagers for gold coins, and buy crossbow towers (load them with L), conveyor belts, grabbers and new villagers (10,000 gold; they chop trees for you).
- A stick pile in the back never runs out; the arrow machine turns each stick into two arrows. Grabbers take from behind and put in front, so sticks → machine → towers can run by itself.
- Touch controls on phones (joystick, Use, Shoot/Place, Load, Turn, Pick up). Saves in localStorage under `north-pole-save-v1`.

## Jobville

A huge village (180 × 180 tiles, about 200 numbered houses, villagers walking the streets). Original code and art; items and icons are emoji.

- **Job board** in the town square: pick a job, switch any time. Street Sweeper and Farmer are open from the start; Fisher, Mail Carrier, Lumberjack, Pizza Delivery and Miner unlock as your total earnings grow.
- **Jobs:** pick up trash, harvest crops on the farms, fish off the dock (press when the ! shows), carry letters from the Post Office to houses, chop trees in the forest, deliver pizzas before they go cold (tips for speed), break rocks in the quarry (sometimes a gem).
- **Shop:** walk inside and up to a podium to buy. 10 podiums, several with tiers: shoes → skates → bike, bags, tools, hats (earn more), magnet, fishing rods, Magic Watch, pets (puppy, dragon), hoverboard (fly over water) and the $10,000 Golden Trophy, which puts a golden statue of you in the square.
- **Your own shop:** a fenced lot west of town. Press 🔨 (or B), name your shop and type any kind of job for it. Buy bricks for walls, then place things in front of you: 145 items in 10 groups (walls, floors, kitchen, food, shop, furniture, work, fun, decor, nature). Customers walk in (they need a way in) and pay into the 💰 money box, which you walk up to and collect; the amount stays hidden until you do.
- **Workers:** with a money box down, job seekers turn up at your gate with a diploma that says their job, skill and the pay they want. Hire them, promote them (more pay, more work), change their job to any listed one or anything you type, or fire them. Each job works twice as well next to its tool (a Baker by an oven). Wages come out every minute.
- **Rivals:** 12 rival workers sweep trash, harvest crops, chop trees and mine rocks too, so they take things before you. Walk up and prank them with a banana peel to stop them for 25 seconds (sometimes they catch you and you pay a $10 fine).
- **Menu and cooking:** pick up to 8 dishes for your menu (20 recipes). Customers sit at your tables and chairs and order from it. Gather the ingredients (harvest wheat, carrots and pumpkins, go fishing, pick apples, collect milk and eggs at the barn), cook each dish on the right machine (Cooked Fish goes in the oven), then carry it to the customer before they lose patience. Chefs and waiters can cook and serve for you.
- **Rival stores:** Rex's Diner, Bea's Bakery and Gus's Fish Fry build their own shops brick by brick on lots near yours and steal customers. Sneak up and throw a stink bomb to scare their customers away.
- **More fun:** day and night with street lamps, rain and snow, daily quests, 23 achievements, player levels with gifts, customer star reviews, Shop of the Week prize, treasure chests, golden trash, festivals, sales and parades, a car, a pet that digs up coins, your own house with a bed, a fishing reel meter, robbers and pranksters (hire a guard), worker moods, neon and gold shop signs, the mayor election at Town Hall, background music and a photo mode.
- A yellow arrow and the minimap always point to your next task; M or the map button shows the whole village.
- Keyboard (arrows/WASD, E or Space, M, Esc) and touch (drag on the left to walk, big button to act).
- Saves in localStorage under `jobville-save-v1`.

## Survivle

An open-world adventure designed by Tim (original code and art). Name your hero, then defeat the Dark Beast in the castle at the middle of the map before 4 hours of play run out, or the world goes black.

- The land is 10,000 × 10,000 tiles, generated from a seed one 32 × 32 chunk at a time as you explore (`src/games/survivle/world.ts`), with forests, lakes, snowy plateaus and cliffs. A road with a narrow bridge runs from the starting camp to the castle.
- Isometric view. Arrows/WASD walk, Space swings your sword in a wide arc, hitting up to 10 things at once (Murks, bosses, and trees for wood and an acorn each), Shift shoots your bow at the mouse, Q switches to ice arrows (the trader sells 10 for 20 coins; they freeze a Murk for 10 seconds but do a tenth of the damage), Z jumps, E opens chests, trades, uses job boards and starts challenges, B builds a wooden wall in front of you (5 wood, 12 hearts; you can walk through your own walls but friends and Murks can't, Murks chew through them, and your sword takes yours down), C builds a campfire (heals, and you wake up there if knocked out), H eats (acorn ¼ heart, apple or bread 1 heart), I opens gear and clothes, Esc pauses (Save, Load, Save and quit, narrator voice).
- Walk into a cliff to climb, and walk into water to swim. Both drain 12% of the stamina ring per second. Run out climbing and you fall; run out swimming and you wash back to shore. Falls of more than 4 levels hurt, more the higher you fall.
- 3 hearts to start. Glowing blue-patterned rocks start a challenge fight (like two greens or a bunch of oranges); winning adds a permanent ¼ heart, up to 20 hearts. There are 10 rocks at a time around you; a beaten rock goes away and a new one appears somewhere else, each a little harder (one more Murk and tougher Murks per win).
- Murks: 95% orange (¼ heart, 10 health), 4% blue (½ heart, 25), 1% green (¾ heart, 35). They only come after you within 30 tiles or once you hurt them.
- 25 chests at a time hide on cliff tops and in deep forest near you. Each holds a sword or bow at most 5 damage better than your best; the best sword (Starfall Blade) does 15.
- A trader follows you around. Trade wood for coins, and buy arrows, apples and outfits. You start in green: green shirt, green pants, dark green hood.
- Two villages next to the starting camp (Willowby and Stonebrook), plus one more for each friend in a co-op game, have job boards with 8 jobs: farmer (plant and harvest the village farm), lumberjack, guard, fisher, miner, baker, courier and grocery store. The grocer farms, mines ore, chops wood and gets meat from Murks, stocks the shelves at the village store stall (E), and villagers walk over, take things and pay (veggies 4, ore 5, wood 3, meat 6 coins).
- A narrator calls out chests, enemies, challenges, villages and the time left, with subtitles. It uses the browser's speech voices; pick the voice and pitch (or words only, or off) on the title screen or the pause menu.
- Four mini bosses guard lairs in the corners of the map, each with its own look and attacks: the Frost Golem (stomps and ice shards), the Ember Toad (jumps on you, then spits fireballs), the Thorn King (roots from the ground and little helpers) and the Storm Eye (teleports, lightning lines and spark spirals). Beating one gives a permanent heart and 60 coins. Run away and it heals up. Four warp pads at the starting camp take you straight to each lair, and a pad in each lair brings you back.
- The Dark Beast (500 health) gives off black and purple gas and locks the doors when you enter its room, which is 61 × 61 tiles with low stone barricades to hide behind (they stop its orbs). Its normal attack does 1 heart; its heavy attack takes 4× as long to charge and does 1½. Beating it gives 50 coins. It also has a gloom nova (a ring of orbs in every direction), a shadow dash (a red warning line, then a rush), and at 350 and 150 health it splits into three for 40 seconds (hit any of them; they share one health bar).
- Co-op for up to 8 heroes, on computers or phones (phones get a joystick and touch buttons, and the bow shoots the way you face) (`src/games/survivle/coop.ts`). The host presses Esc, then Play with friends, and gets a code; friends pick Join a friend on the title screen. The host's game runs the world (enemies, bosses, chests, challenges and the clock) and sends it out about 12 times a second over PeerJS, and each friend's hits and arrows go to the host. Multiplayer is for fighting each other: swords and arrows hit other players for the weapon's damage in quarter hearts (a 4-damage sword takes 1 heart), while Murk and boss hits only do ¼ heart. Beating a mini boss or a challenge rewards everyone. The game keeps running while a menu is open, and friends can't save (their hero lives in the host's world).

Saves and narrator settings stay in the browser (localStorage, `survivle-` keys).

## Robopoculeps

A mining game designed by Tim (original code and art). You're in a mine: dig stone, trade it to the shopkeeper in the shop in the wall, and build flying robots that mine for you. Code in `src/games/robopoculeps/`.

- Hold E or Space (⛏️ on phones) next to a rock to mine it. Walk up to the shop and the shopkeeper says "Stars and the moon, sun in the sky, hey baby hey, what do you want?" (with the browser's speech voice, and in a bubble), then the shop opens.
- The shop buys stone ($5), coal ($12), iron ($30), gold ($80) and diamond ($300), and sells robots: a stone-mining robot costs $50, then coal $300, iron $1,000, gold $3,500, diamond $12,000.
- Robots fly to the nearest rock of their ore, mine it, and drop what they carry in the nearest crate (or bring it to you if you have no crates). E by a crate takes what's in it.
- Machines: belts ($5, drag to lay a line), grabbers ($20, pick up from the crate or belt behind them and drop in front), payers ($40, pay the store price for every thing they get) and crates ($30). 1–4 picks one, R turns it, 5 or right-click removes it (you get it back).
- Five caves in a row (Stone Hollow, Coal Cavern, Iron Depths, Gold Grotto, Diamond Deep), each blocked by boulders. Dynamite from the shop ($150, $600, $2,000, $6,000) blasts them open and unlocks that cave's robots. Rocks grow back over time.
- Upgrades: turbo propellers (faster robots) and bigger robot bags. The $50,000 Golden Robot King mines every ore 3× faster and wins the game.
- 💾 saves (localStorage, `robopoculeps-save-v1`); Continue on the title screen loads it. Phones get a joystick, a mine button, and tap-to-build.

## Survivle (Long Edition)

A separate copy of Survivle (`src/games/survivle-long/`, hub id `survivle-long`) with the second half of Tim's handwritten note added. Its saves use `survivle-long-` keys and its co-op codes use their own PeerJS prefix, so it never mixes with the first Survivle.

- The Dark Beast is 3× harder: 1,500 health (was 500), hits harder, attacks faster, and splits three times.
- The Sword of Light (T.S.O.L.) stands in a ring of trees south-east of the camp (a gold arrow points to it). It does 30 damage, and double to bosses (the Dark Beast and the mini bosses). You need 10 full hearts to pull it out.
- Shift changes weapons: sword, bow, spear, and the Sword of Light. Space (or click) uses the one in your hand.
- Raider camps (`world.ts` sites, `long.ts`): a fire with 4 spears with apples on them, tents and a flag. Press E by a spear to take it and its apple. Raiders carry swords, bows and spears, some have armor and shields, big camps have a captain. Their shields break, and so does yours (hold F, right mouse, or 🛡 to block). Armor from the blacksmith, captains and camp loot chests soaks up part of each hit.
- 25 open-world extras (listed in `LONG_FEATURES` in `data.ts` and on the title screen): shrines with spirit orbs and fast travel, watchtowers that fill in the big map (M), a glider, sprint (X), horses, day and night, rain, bombs (G), fire arrows, mushrooms, cooking at any fire, camp loot chests, captains, camp alarms, sleeping raiders (sneak attacks ×3), weapon and shield drops, blacksmiths, healing springs, cold in the snow, ore rocks with gems, falling stars, village elder quests and wolf packs.
- In co-op, the host runs camps and raiders; friends see the raiders and fight them, but camp spears and loot are tracked on each player's own game.

## Develop

```
npm install
npm run dev
npm run build
```

## Emberwild

An open-world adventure with block mining and building and factory automation. Original code, art and sounds. Code in `src/games/emberwild/`.

- A 340 × 340 tile land generated from a seed: meadows, deep forest, snowy peaks in the north, desert in the south, lakes and rocky highlands. Fog of war, a minimap and a full map (M).
- Mine and chop by holding click (or tap and hold): trees, rocks, coal, copper, iron and sky crystal seams. Mining a seam uncovers its vein. Place blocks (planks, stone bricks, glass, cobblestone); cobblestone fills shallow water to make paths.
- Craft in your bag (Tab): pickaxes and swords in three tiers, a bow and arrows, campfires, lamps, furnaces, belts, drills, assemblers and chests. Cook roasts and stew at a campfire.
- Automation: drills on a vein dig forever and push ore out of their arrow side; belts carry things (and you); furnaces take ore and fuel from belts; assemblers make any picked recipe; chests collect. R turns machines.
- The goal: four Ember Beacons (meadows, deep forest, desert, snowy peaks) each guarded by three Rustguards and each asking for a load of goods. Relighting one gives a heart, an Ember core, a map reveal and a travel point. With all four lit, craft and place the Sky Engine to win.
- Explore: 9 waystones to wake and travel between, 48 treasure chests (hearts, gear and relics: Swift boots, Otter fins, Ember lantern, Wind kite), stamina for sprinting and swimming, day and night. Bramblebacks roam; gloomlings come out at night but keep away from lamps, fires and lit beacons. Knocked out, you wake at your last campfire or waystone.
- Keyboard and mouse, or touch (stick, buttons, tap to mine and build). Saves in localStorage under `emberwild-save-v1` (autosave every 45 seconds).

## M.D. (Monster Dungeons)

A blocky action dungeon crawler. Original code, art, monsters and sounds. Code in `src/games/md/`.

- **Camp (Hearthstead):** four traders. Bram the Weaponsmith sells melee weapons and bows, Tilda the Armorer sells armor, Old Pip the Peddler sells plain, fire, frost and boom arrows, Fizz Bombs and Mystery Crates (a random piece of gear you don't own), and Mira the Mystic sells artifacts. The mission table by the fire opens the mission map.
- **Mission map:** five dungeons on a parchment map, each unlocked by clearing the one before: Mossy Crypt, Shroom Hollow, Frostdeep Halls, Cinder Forge and the Obsidian Throne. Each shows its monsters, its guardian and the reward.
- **Dungeons:** generated fresh each run from rooms and corridors, with torches, pillars, pools of water, ice or lava, crates and barrels to smash, and chests with coins, supplies, special arrows and sometimes new gear. The last room holds the guardian; beating it opens a portal home. M shows the dungeon map and a minimap sits in the corner.
- **Monsters:** Mosslings, Lantern Monks, Sporecaps, Rustknights, Gloomwings, Frost Wisps and Cinder Hounds. Guardians: Old Boulderback, Queen Puffshroom, the Frozen Warden, Magmajaw, and the final boss, the Hollow Crown.
- **Melee weapons:** Rusty Sword, Twin Daggers, Sickle, Long Spear, Battle Axe, Scythe, Frost Glaive, Thunder Hammer, Obsidian Cleaver, Ember Blade and Dragonfang. With nothing equipped you punch.
- **Bows:** Shortbow, Heavy Crossbow, Fan Bow, Thornspike Bow, Starlight Bow, Dragonbone Longbow, and two auto-fire bows (Rapid Repeater, Storm Bow) that shoot by themselves when an enemy is close.
- **Armor:** Traveler's Tunic, Scout's Cloak, Leather Jerkin, Chainmail, Shadowweave, Mossguard Plate, Knight's Plate, Obsidian Plate and Dragonscale Armor (lavaproof).
- **Gold and diamond:** every new item (bought, from a chest or a Mystery Crate) has a 0.5% chance to be Golden and a 0.05% chance to be Diamond. They glow and recolor (gold or diamond blades, bows, helmets and trims) and have much better stats.
- **Artifacts** (keys 1–3): Healing Totem, Gust Horn, Thunder Charm, Ghost Boots, Ironhide Charm and Firework Crown.
- **Controls:** WASD walk (you turn the way you walk), mouse aims the bow, Space melee attack (the weapon is held and swung from the right hand), click or hold Shift to fire the bow, click a monster to lock on and . (period) to stop, Z/X/C the 3 artifacts, right click or V dodge roll, Tab switch arrows, Option/Alt drink the Healing Draught, B bomb, E use, Ctrl or I inventory, M map, Esc menu. The HUD has only the 3-artifact row at the bottom. Settings pick where bows aim (mouse, in front, nearest enemy) and turn auto-fire on or off. Phones get a stick and buttons, with auto-aim.
- **Fire and ice:** fire weapons and arrows (Ember Blade, Dragonfang, Dragonbone Longbow, fire arrows) burn and do +60% damage to ice monsters (Frost Wisps). Ice ones (Frost Glaive, Rimeblade, Glacier Bow, frost arrows) slow enemies for 3 seconds and do +60% to fire monsters (Cinder Hounds, Lantern Monks).
- **The set levels:** the equipped weapon, bow and armor each level from 1 to 100, and only from beating mobs (1 xp, guardians 20) and opening chests (5 xp). Each level adds damage and speed (up to ×3 damage and 35% faster at Lv 100), a bit of melee reach (+20%) and barely any bow range (+6%). Armor gets more block and healing.
- **Difficulties:** Easy, Normal, Hard and Nightmare on the mission map. Hard unlocks per dungeon after beating it on Normal, and Nightmare after Hard. Harder means more health, damage and monsters, plus more coins, gear xp and reward.
- **Healing Draught:** you carry at most 1, and a new one brews every 20 seconds after you drink it. Traders don't sell them.
- **Saves:** Esc → Save, Load or Save & quit, with 3 save slots that keep coins, all owned gear, artifacts, arrows and cleared dungeons. The game also autosaves for Continue.
- **Team play (2 players):** built like Factori-owen. Esc → Open to join lists your game in the shared `hosts` collection (tagged `game: 'md'`); a friend picks Join a friend on the title screen. WebRTC carries the game, and the host's game runs monsters, loot and the level. Each player keeps their own gear and coins. Monsters chase the closest player; a fallen player gets up next to their teammate after 8 seconds, and if both fall the host picks what's next.
- Saves in localStorage under `md-save-v1` (settings under `md-settings`). Falling in a dungeon sends you back to camp with everything you found.
