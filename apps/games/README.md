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

## Develop

```
npm install
npm run dev
npm run build
```
