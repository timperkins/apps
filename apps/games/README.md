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

## Explorer

A 3D open-world game designed by Tim on two handwritten pages (original code, models and sounds). Code in `src/games/explorer/`; it's the only hub game that uses three.js (lazy-loaded with the game).

- **The world** is a round earth 1,000,000 tiles each way: go straight for a million tiles and you're back where you started (`world.ts` wraps every noise layer exactly). It's made from a seed in 32 × 32 chunks as you go: grassland, forests, deserts, snowy land, mountains with terraced cliffs, beaches, oceans, lakes, and the North Pole ice sheet a few thousand tiles north of the start (a striped pole marks the very top). Trees, cacti, palms, rocks, flowers, iron/copper/coal/stone ore patches, oil puddles, cave entrances and mine shafts are everywhere; a pond, an oil spot and one patch of each ore are always close to the start.
- **Caves and mine shafts** are their own little underground maps with walls full of ore and crystals that you dig out, plus bats, cave spiders and bugs.
- **Animals**: chill ones (pandas, deer, rabbits, cows, camels, penguins, goats, dolphins) and hostile ones (lions, polar bears, sharks). At night wolves, bears, snow wolves, scorpions and snakes come out depending on the biome. Alien bugs live around purple nests: they hurt you and come for factories near them; wolves and other hunters attack bugs, and bugs fight back at whatever hurts them. No blood: things vanish in a puff.
- **Villages** (one right next to the start) have roads, street lamps, villagers and cops, a General Store (buy and sell), a Restaurant (food heals), Car Rental & Sales (rent for a 30-day game month or buy: buggy, hatchback, pickup, sports car; press E to drive), Houses for Sale big to little (you wake up there and it has storage), a Pet Shop (cat, dog, parrot, tiger, robot dog follow and protect you) and a Police Station. Hitting people in town gets a fine.
- **Crafting** in the Factori-owen style: Shift opens the inventory and the crafting list, no research needed, and parts (gears, circuits, pipes…) are made along the way. Everything on Tim's list is there: roads, houses, roundabouts, stop lights, steam engine, rocket silo (1000 stone + 1000 iron), space starter, oil refinery, pipes, underground pipes and belts, space platform, turrets, ammo (1 iron → 1 ammo), advanced ammo, grabbers (long and bulk too), grenades, sniper, flamethrower, rocket launcher and rockets (10 stone + 1 iron), power poles, big power poles, substations, water pumps, pumpjacks, furnaces, miners and steel furnaces (iron → steel), plus chests, belts, assembling machines, walls, campfires and torches.
- **Factories**: drills run on electricity or coal; grabbers, assemblers, pumpjacks and refineries need electricity (water pump → pipes → steam engine with coal → power poles). Pumpjacks send oil through pipes to refineries for fuel and plastic; ice in a refinery makes 96 water.
- **Space**: put 10 space units (10 iron + 1 copper each) in a rocket silo, carry a space starter and ride up (a rocket holds 100 items or 1 you). In space you grow the ship with platform tiles; asteroid grabbers catch little asteroids for crushers (rusty → copper ore 96% / iron ore 80%, carbon → carbon 98% + stone, cryser → ice + crystals 80%); turrets shoot medium, big and huge asteroids, which split into two of the next size down; medium and bigger ones only show up while flying. Thrusters burn thruster fuel (1 crystal + 100 water): pick a destination (Moon, Mars, the asteroid belt, Jupiter) and press Start. Fly back to Earth orbit to drop down again.
- Sound effects for everything (Web Audio, `audio.ts`), day and night, a map (M), touch controls on phones.
- **Ghosts, robots and blueprints** (Tim's page 3): hold Ctrl while placing to put down a ghost (a see-through plan that uses nothing and does nothing; building the real thing on it replaces it, X removes it). Roboports (2 × 2, need power) send flying robots to build ghosts within 25 tiles, taking the buildings from the roboport itself and chests, or off belts too if you switch that on. Hold B over one corner and let go over the other to copy a blueprint, then click to paste it as ghosts (R turns it, Esc drops it).
- **Bug damage**: when alien bugs destroy a building it explodes (rocket silos and steam engines 4× bigger) and an alert shows above the hotbar.
- **Bug spawners** (the old nests, `World.nestsNear`) send out a new bug every 9–16 seconds while you're within 110 tiles, up to 5 each. Bugs are armored with pincers and six jointed legs (an original design).
- **Time**: 10 real seconds is 1 game hour, so a day is 4 minutes (`DAY_LEN = 240`).
- **2D or 3D**: the start screen (and the Esc menu) switches between the 3D chase camera and a 2D isometric view (orthographic camera at 35°, turns in quarter steps with Z/C). Remembered in `explorer-view`.
- **Research** (`TECHS` in `data.ts`): only new things are researched, nothing from Tim's pages. Labs (2×2, power) use red/green/blue science packs to unlock fast/express belts, fast grabbers, steel chests, solar panels (power by daylight), electric furnaces, laser turrets, plus quick hands, long arms, faster robots and super roboports. Press T for the research list.
- **Items** have drawn SVG icons (`icons.ts`) for materials, parts and packs, and shaped 3D models on belts (`itemModel` in `models.ts`).
- **Parts**: gear, copper cable, iron stick, circuit (iron + 3 cable), electric motor, engine, battery, advanced circuit. Crafting by hand takes 1.6× the recipe time (at least 0.6 s).
- **Menu (Esc)**: Save & quit, Save, Load, Quit without saving, Join game, Host world.
- Play together with up to 4 players, hosted the Factori-owen way (`explorer/net.ts`, a copy of the M.D. one): Host world lists your world in the `hosts` collection with `game: 'explorer'`; friends pick it from the Join game list and connect over WebRTC. The host's game runs the world; friends' things live in the host's game while they play.
- Saves in localStorage under `explorer-save-v1` (autosaves every minute).

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
- Co-op for up to 4 players, each on their own phone or computer: tap 👥 while playing to get a code; friends tap Join a friend on the start screen. Wood, sticks, arrows, meat and gold are shared. Each bear goes after the nearest player who is still up, and a villager carries whoever gets knocked out back to base. Friends wear their own coat colors and have a number over their head. The host's game runs the village (using the shared module in `src/games/coop/`) and only the host saves.

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
- Play together with up to 4 players, each on their own phone or computer: ⏸ menu → 👥 Play with friends, then Host (you get a code) or type a friend's code to join. You all walk the same village and see each other, with a tag showing each player's number, job and money (and 🏆 once they have the trophy). Everyone keeps their own job, money, shop and save. G waves; next to a friend, G gives them $10. When someone buys the Golden Trophy, everyone hears about it.

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
- Co-op for up to 4 miners, each on their own phone or computer: the host picks 👥 Play with friends in the menu and gets a code; friends pick Join a friend on the title screen. Money, the bag, machines and robots are shared. Each miner has a colored helmet and a number. The host's game runs the mine and sends it out about 12 times a second; friends walk on their own screen and send their spot, mining, building and shop buttons to the host. Only the host saves.

## Survivle (Long Edition)

A separate copy of Survivle (`src/games/survivle-long/`, hub id `survivle-long`) with the second half of Tim's handwritten note added. Its saves use `survivle-long-` keys and its co-op codes use their own PeerJS prefix, so it never mixes with the first Survivle.

- The Dark Beast is 3× harder: 1,500 health (was 500), hits harder, attacks faster, and splits three times.
- The Sword of Light (T.S.O.L.) stands in a ring of trees south-east of the camp (a gold arrow points to it). It does 30 damage, and double to bosses (the Dark Beast and the mini bosses). You need 10 full hearts to pull it out.
- Shift changes weapons: sword, bow, spear, and the Sword of Light. Space (or click) uses the one in your hand.
- Raider camps (`world.ts` sites, `long.ts`): a fire with 4 spears with apples on them, tents and a flag. Press E by a spear to take it and its apple. Raiders carry swords, bows and spears, some have armor and shields, big camps have a captain. Their shields break, and so does yours (hold F, right mouse, or 🛡 to block). Armor from the blacksmith, captains and camp loot chests soaks up part of each hit.
- 25 open-world extras (listed in `LONG_FEATURES` in `data.ts` and on the title screen): shrines with spirit orbs and fast travel, watchtowers that fill in the big map (M), a glider, sprint (X), horses, day and night, rain, bombs (G), fire arrows, mushrooms, cooking at any fire, camp loot chests, captains, camp alarms, sleeping raiders (sneak attacks ×3), weapon and shield drops, blacksmiths, healing springs, cold in the snow, ore rocks with gems, falling stars, village elder quests and wolf packs.
- In co-op, the host runs camps and raiders; friends see the raiders and fight them, but camp spears and loot are tracked on each player's own game.

## Tiny Kingdoms

A small real-time castle battle made with the [Tiny Swords](https://pixelfrog-assets.itch.io/tiny-swords) free asset pack by Pixel Frog (the art; code, rules and sounds are original). Code in `src/games/tiny-kingdoms/`, art in its `assets/` folder.

- You are the hero of a little kingdom in a corner of a generated island (110 × 72 tiles). The Black kingdom sits in the middle and sends bigger and bigger attacks (Easy, Normal, Hard). Knock down the Black castle to win; lose when every player's castle falls.
- Pawns chop trees, mine gold and catch sheep by themselves (more go to whatever has the fewest workers). The hero can chop, mine and catch sheep with the sword too.
- Build anywhere there's open grass (B or 🔨, pick a building; it goes right behind your hero, shown green when it fits and red when it doesn't; E, Space or a click puts it down): walls (6 wood a block; placing keeps going so you can lay a long wall; your own units walk through your walls like gates, enemies have to break them), houses (+5 room), mansions (+15 room), sheep farms (2 meat; a sheep every second, up to 12 around it, for pawns to herd; upgrade one for 30 gold and 30 wood into a Super Sheep Farm that makes a sheep "every 0.0001 seconds", which in practice fills its 30 sheep straight away; at most 300 sheep on the map), tiny houses (they "hold 1,000,000,000,000,000 tiny warriors" and train a crowd of 1,000,000 for 1 wood, meat or gold; each crowd is one small warrior on the map with 14 hp and 1 damage, takes no room, and for speed the map fits 30 crowds per tiny house and 90 in all), barracks (fighters, warriors, lancers, giants: 140,000 hp, 1000 times a warrior, but 0.015 damage, 0.1% of a warrior, 40 gold and 40 meat, 3 room; a fighter costs just 1 wood, meat or gold, whichever you have most of, but is small and weak), archery range (archers), towers (shoot arrows), double arrow towers (two towers, two arrows at once, longer range) and a monastery (monks heal). Mansions and double towers are drawn from the pack's houses and towers; walls are drawn in code in the castle colors. The map keeps open ground around each castle. Walk up to a building and press E to train. The castle trains pawns and shoots arrows too.
- Selling: walk up to any of your buildings (not the castle) and press E to sell it, or to sell one of the units it trains (the castle sells pawns, the barracks warriors and lancers, and so on), for half the price back.
- Press 1 (🍖 on phones) to eat: 5 meat heals the hero by 80.
- Playing together, heroes can hit each other's heroes and buildings, castles too (60% of a normal swing); armies and pawns stay friends.
- Army orders (Q or the button): Follow me, Guard castle, Attack! (march on the Black castle).
- Keyboard (WASD, Space or click to swing, Shift to block, 1 to eat, B, E, Q, Esc) and touch (stick plus Swing, Use, Block, Army, Build, Eat buttons).
- Play together with up to 4 players, each with their own kingdom and color in a corner: Esc → Play with friends gives a code, friends pick Join a friend on the title screen. The host's game runs the island (`game.ts`) and sends snapshots about 12 times a second through the shared `src/games/coop/` module (PeerJS prefix `trom-tiny-kingdoms-`); friends send their stick and buttons and draw the snapshots smoothed (`render.ts`). Attacks get bigger with more players.
- No saves (a game is 15–25 minutes); best winning times per difficulty are kept in localStorage (`tiny-kingdoms-best-<difficulty>`).
- Asset license: free for personal and commercial use, credit welcome (shown on the title and help screens). The pack may not be redistributed or resold on its own, so only the pictures the game uses are here, not the whole pack.

## Archenimys

An archer tower climb designed by Tim on a handwritten page (original code, art and sounds). Code in `src/games/archenimys/`.

- Climb 50 stages of a tower. Beat every monster on a stage and the stairs at the top open; walk onto them to go up (with friends, a 5-second countdown starts once one archer is on the stairs).
- Monsters: **Boom Pot** (a teapot with a fuse that blows up when it gets near you, or when it gets destroyed), **Sharp Cactus** (shoots a fan of thorns), **Acid Stew** (a mostly black, a little gray pot of bubbling green goo with acid drizzling down; it spits globs that leave a splotch for 5 seconds that hurts if you step in it) and **Snapping Crab** (scuttles sideways, then dashes in and pinches).
- A boss every 5 stages: the Crab King, Thornlord, Teapot Titan and the Witch Cauldron take turns, and the Archenemy waits at stage 50.
- The stage before each boss has a loot chest (a lucky upgrade pick, never Common) and a health chest (Heal to full, or +½ full health and +25 max health).
- Levelling up shows 3 upgrade cards. Each card's quality word counts up Common → Uncommon → Rare → Epic → Legendary → Mythical until it lands. There are 18 permanent upgrades (`UPGRADES` in `data.ts`); every quality has at least 8, and higher qualities give bigger numbers (Life Steal: Rare gains 3 health per monster destroyed, Epic gains 5). Picking one again stacks. You can't be hurt while choosing; when playing alone the tower waits.
- Up to 4 players, each an archer or a monster (Boom Pot, Sharp Cactus, Acid Stew or Snapping Crab). Monster players attack archers with click or Space, switch monster with Q or 1–4, and when knocked out wait 5 seconds and come back as a different monster. Archers who go down come back on the next stage if another archer makes it.
- Hosting works like M.D. (`archenimys/net.ts` is a copy with `game: 'archenimys'`): Host a game (or Shift+Esc, from the title or during a game) lists you in the `hosts` collection; Join a game searches that list every 3 seconds and connects over WebRTC. The host's game runs the tower and sends it out about 15 times a second; each player moves their own body.
- Keyboard and mouse (WASD, aim with the mouse, hold click or Space to shoot, Esc menu) or touch (stick on the left, shoot button aims at the closest monster).
- Best stage reached is kept in localStorage (`archenimys-best`).

## Antpoculeps

An ant evolution game designed by Tim on a handwritten page (original code and art, all drawn in code). Code in `src/games/antpoculeps/`.

- You start as an egg in a big back yard (4,200 × 4,200, made from a seed in `world.ts`): big trees whose canopies go see-through when you walk under them, plants, little beaches around water puddles, big leaves, flowers and grass. Tree trunks block you; water slows you down (bigger ants wade better).
- Roll over food (crumbs, seeds, berries, sugar cubes, cookies, apple slices) to fill your food bar. The egg hatches by itself into a Baby Ant; after that a glowing Evolve button (or E) upgrades you through 20 ants: Baby, Worker, Black, Red, Fire, Sugar, Carpenter, Leafcutter, Weaver, Bullet, Army, Soldier, Bulldog, Trap-Jaw, Crystal, Thunder, Lava, Shadow, Galaxy and the huge Cosmic Ant at level 20 (`STAGES` in `data.ts`). Each is bigger, tougher and bites harder, with its own look (flames, a leaf, crystal, lightning, glowing lava, stars).
- Bite any ant at any stage (Space, click, or the BITE button on phones). Destroyed ants drop meat, more for bigger ants. Wild ants wander and eat; about a third pick on players their size or smaller, and the rest only fight back. You heal a little every second. Dying drops you 3 levels.
- At level 20, fill the food bar once more to rebirth: back to an egg with 1.25x power, then 1.5x, 1.75x and so on forever (gold stars circle reborn ants).
- Up to 6 players, hosted the Factori-owen way (`net.ts`, a copy of Explorer's with `game: 'antpoculeps'`): Host a game on the title screen (or Esc → Open to join) lists your yard in the `hosts` collection; friends pick it under Join a game and connect over WebRTC. The host's game runs the yard and sends it out 15 times a second; friends move their own ant and send where it is. Each player keeps their own progress.
- Progress (level, food, rebirths) is saved in localStorage under `antpoculeps-save-v1`, solo or in someone else's yard.

## Develop

```
npm install
npm run dev
npm run build
```


### Playing together (`src/games/coop/`)

Shared by the games that got co-op later (Robopoculeps first): `net.ts` is the PeerJS link (each game passes its own code prefix, up to 4 players), `session.ts` gives each player a slot (0 is the host) and turns away a fifth player, and `ui.ts` has the Play with friends panel and the badge with the code and the players' colored numbers. To try it on one computer, run a PeerJS server (`npx peerjs --port 9000 --path /myapp`) and open the game with `?peer=localhost:9000/myapp`.
## Emberwild

An open-world adventure with block mining and building and factory automation. Original code, art and sounds. Code in `src/games/emberwild/`.

- A 340 × 340 tile land generated from a seed: meadows, deep forest, snowy peaks in the north, desert in the south, lakes and rocky highlands. Fog of war, a minimap and a full map (M).
- Mine and chop by holding click (or tap and hold): trees, rocks, coal, copper, iron and sky crystal seams. Mining a seam uncovers its vein. Place blocks (planks, stone bricks, glass, cobblestone); cobblestone fills shallow water to make paths.
- Craft in your bag (Tab): pickaxes and swords in three tiers, a bow and arrows, campfires, lamps, furnaces, belts, drills, assemblers and chests. Cook roasts and stew at a campfire.
- Automation: drills on a vein dig forever and push ore out of their arrow side; belts carry things (and you); furnaces take ore and fuel from belts; assemblers make any picked recipe; chests collect. R turns machines.
- The goal: four Ember Beacons (meadows, deep forest, desert, snowy peaks) each guarded by three Rustguards and each asking for a load of goods. Relighting one gives a heart, an Ember core, a map reveal and a travel point. With all four lit, craft and place the Sky Engine to win.
- Explore: 9 waystones to wake and travel between, 48 treasure chests (hearts, gear and relics: Swift boots, Otter fins, Ember lantern, Wind kite), stamina for sprinting and swimming, day and night. Bramblebacks roam; gloomlings come out at night but keep away from lamps, fires and lit beacons. Knocked out, you wake at your last campfire or waystone.
- Keyboard and mouse, or touch (stick, buttons, tap to mine and build). Saves in localStorage under `emberwild-save-v1` (autosave every 45 seconds).
- Co-op for up to 4 explorers, each on their own phone or computer: the host picks 👥 Play with friends in the menu and gets a code; friends pick Join a friend on the title screen. The world, machines, beacons, chests and creatures are shared; each explorer has their own bag, hotbar, hearts, relics and campfire to wake at, and wears their own color with a number overhead. Creatures go after whoever is closest. The host's game runs everything (it swaps each friend's hero into the game to mine, fight, craft and use machines for them) and sends the world out about 12 times a second, with tile changes as they happen and machines 4 times a second. Friends walk on their own screen. Only the host saves, and friends' heroes start fresh each time.

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
- **Difficulties:** I to VIII on the mission map. Each one unlocks per dungeon after beating the one before it there. Higher numbers mean more monster health, damage and numbers, and better loot: more coins and reward, more gear in chests, found gear starting at a higher level (up to Lv 28 on VIII), and more xp.
- **Hero level and enchanting:** the same xp also levels your hero (up to 100). Each hero level is an enchant point. In the inventory, every item has ✨ Enchant: up to 3 enchantments per item, each with tiers I–III (1, 2 and 3 points). Melee: Keen Edge, Swift Strikes, Wide Sweep, Wildfire, Chilling, Lifesteal. Bows: Power Draw, Quick Nock, Piercing, Flame Tips, Frost Tips. Armor: Toughness, Quickstep, Mending, Nimble. Taking enchantments off gives the points back.
- **Story:** an original storyline (`story.ts`): a prologue about the Hollow Crown and its four shards, a scene before and after each dungeon told by the camp traders, and an epilogue after the final boss. Scenes play once (Space/Enter next, Esc skip) and can be replayed from Esc → Story so far. Trader greetings change as the story moves on.
- **Length and speed:** dungeons have 16 to 20 areas (about 5–10 minutes each). The world is drawn at half resolution with hard pixel edges for a blocky look and far less work per frame; the minimap is its own small canvas redrawn a few times a second.
- **Outdoors and indoors:** every dungeon starts outside and mixes outdoor areas (grass, snow or ash in each dungeon's colors, hedges, trees, flowers and daylight) with indoor stone rooms. The guardian's room is always indoors.
- **Lava:** stepping on lava sets you on fire. You burn for a few seconds (damage over time, no knockback) instead of taking one big hit. Dragonscale armor still makes you lavaproof.
- **Reviving:** on a team, a fallen player stays down until their teammate stands next to them and holds E for 1.5 seconds (or 30 seconds pass).
- **Weapons:** 27 melee weapons and 15 bows and crossbows, including the 20 added later: Bone Club, Coral Cutlass, Spiked Mace, Shadow Katana, Moon Sickle, Frostbite Daggers, Cinder Claws, Venom Spear, Thunder Pike, Blizzard Axe, Magma Axe, Soul Scythe, Crystal Greatsword, Volcano Hammer, Hunter's Longbow, Twinstring Bow, Ember Crossbow, Frost Repeater, Thunderclap Crossbow and Phoenix Bow.
- **Healing Draught:** you carry at most 1, and a new one brews every 20 seconds after you drink it. Traders don't sell them.
- **Saves:** Esc → Save, Load or Save & quit, with 3 save slots that keep coins, all owned gear, artifacts, arrows and cleared dungeons. The game also autosaves for Continue.
- **Team play (up to 4 players):** built like Factori-owen. Esc → Open to join lists your game in the shared `hosts` collection (tagged `game: 'md'`); a friend picks Join a friend on the title screen. WebRTC carries the game, and the host's game runs monsters, loot and the level. Each player keeps their own gear and coins. Monsters chase the closest player; a fallen player is revived by any teammate (hold E next to them), and if everyone falls the host picks what's next.
- Saves in localStorage under `md-save-v1` (settings under `md-settings`). Falling in a dungeon sends you back to camp with everything you found.

## Mob Delvers

An action dungeon crawler made from Tim's kid's notes. Original code, names, monsters, bosses, art and sounds. Code in `src/games/mob-delvers/` (started from a copy of M.D.).

- **Camp and mission map:** you start at camp with a campfire, tents and the mission table. The mission map has camp in the middle and 8 missions around it: Ruined Village, Pumpkin Trail, Canyon of Doom, Ember Mines, Great Halls, Deep Caves, Fizzler Creek and The Void Realm. Beat the Ruined Village first, then play the rest in any order.
- **Difficulties 1–10:** every map starts on difficulty 1. Beating difficulty 1 on a map opens all 10 difficulties on that map.
- **Harder and longer at higher difficulties:** on top of the higher monster level, D10 monsters have about 5.6× the health and 3.3× the damage of D1, there are more of them per room, more come enchanted, and missions get up to 6 more areas. Every mission is 20–26 areas long.
- **Surprise mini-bosses:** any mission can have a Void Stalker, Ember Golem or Hex Lord waiting on the way (35% on D1 up to 89% on D10, with a chance of a second one from D7). The mission map shows the odds.
- **Half outside:** the first half of every level is outdoors, then you go into the dungeon for the second half and the boss.
- **Modes:** Easy and Normal from the start, Hard after beating The Void Realm, Nightmare after beating it on Hard. Higher modes and difficulties have tougher mobs (Hard and Nightmare add enchanted mobs) and better drops.
- **Power and drops:** gear never levels up. Your power is (sword level + bow level + armor level) ÷ 3, and each drop's level is rolled from your power, the mode and the difficulty, using the formulas and max-level tables from the notes (`dropRange` in `data.ts`). The mission map shows the drop range before you start. Drops are at least level 3 from difficulty 3 and at least level 6 from difficulty 6. Beating a mission always drops gear, and sometimes an artifact. In co-op each player gets their own drop, rolled from their own power.
- **Inventory (Shift):** 6 slots (bow, sword, armor and 3 artifacts) plus all your items. Shows your power, each item's level and how it compares with what you have on. Salvage gives back enchanting points.
- **Enchanting:** one point per hero level. Every item has 3 random enchantments to pick from, each with tiers I–III (1, 2 and 3 points). Every enchantment has its own picture (`enchart.ts`). Besides the stat ones there are 10 effect enchantments you can see happen: bows get Boom Shot (every 4th arrow sticks in and explodes 3 seconds later), Chain Zap, Seeker and Bounce Shot; swords get Thunder Strike (every 5th hit), Whirlwind (every 3rd swing spins), Frost Bite (freezes) and Shockwave (every 4th swing); armor gets Frost Nova and Blast Back (when you get hit).
- **Souls:** beaten mobs drop souls (up to 100). Soul artifacts use them: Soul Beacon (beam), Soul Mender (heals near you) and Soul Quiver (3 bouncing soul arrows).
- **Artifacts:** Soul Beacon, Healing Totem, Hay Bundle (a llama ally), Old Bone (a wolf ally), Soul Mender, Firework Arrow, Charm Medallion (5 mobs fight for you for 10 s), Soul Quiver, Fire Quiver, Poison Quiver, Gust Horn, Thunder Charm, Ghost Boots and Ironhide Charm. Artifacts have levels too.
- **Weapons:** 26 melee weapons, 15 bows and crossbows, and a set of armors.
- **Mobs:** shamblers, rattlers, gloops (split in two), fizzlers (hiss, then explode), bog riders, marauders, armored shamblers and rattlers, hexers (enchant other mobs) and the loot hog (chase it for gear). Mini-bosses: the Void Stalker (blinks behind you), the Ember Golem and the Hex Lord. Final bosses: the Gloomguard in the Deep Caves and Nyxwing, the Void Wyrm, in The Void Realm.
- **HUD:** a big 100 HP heart (armor adds more), soul bar, power and hero level, the artifact bar with soul costs, and damage numbers over everything you hit.
- **Controls:** WASD walk, Space melee, click or F bow, Z/X/C or 1/2/3 artifacts, Q or Alt potion, V or right click roll, E use, Shift inventory, M map, Esc menu. Phones get a stick and buttons.
- **Team play (up to 4 players):** built like Factori-owen. Esc → Open to join lists your game in the `hosts` collection (tagged `game: 'mob-delvers'`); friends pick it from Join a friend. The host's game runs the level over WebRTC; each player keeps their own gear.
- Saves in localStorage under `dv-save-v1`, with 3 save slots.
