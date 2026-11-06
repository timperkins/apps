# Sky Defender 2: Your worst nightmare

A portrait-locked WWII anti-aircraft PWA. Turn the phone like a steering wheel to aim (aim gain 1.4x, so the horizon is reached at about 60 degrees of tilt); tap or hold anywhere on the screen to fire.

On a computer (a mouse and no touch screen, or a device with no motion sensors) the left and right arrow keys (or A and D) aim, space fires, Enter or a click opens a landed crate, and `z`/`x` move between turrets in war mode.

Upgrades: each wave has a 20% chance that the resupply plane is a gold plane (gold marker, gold arrow). Its gold pack offers a choice of every permanent upgrade you don't have yet, including two that only come in gold packs: **Leeching** (each kill heals every standing building by 2% of its max) and **Upgrade shifter** (cargo planes and falling crates dodge your shots). Any enemy plane you shoot down has a 3% chance to drop a **diamond pack** (shielded for its first 5 seconds, so it can't be shot down), which offers only **Ghost shot** (light blue shells that pass through enemy planes, hitting each one, and never harm friendly planes) and **Drop shot** (at the end of its flight a shell falls back down through the sky, harmless to friendly planes and the base). Gold packs also offer eight more gold-only permanents: Armor plating (buildings take 25% less damage), Bounty (double points per kill), Swift shells (33% faster shells), Mending (standing buildings heal 0.5% of max a second), Lucky star (gold plane chance 40%), Clean intercepts (shot-down bombs don't scorch the base), Heavy air (bombs and missiles fall 30% slower) and Last stand (once a game the turret holds at half strength instead of falling). Diamond packs also offer eight more diamond-only permanents: Homing shells, Spark jump (a kill zaps the nearest enemy plane within 280), Exploding wrecks (a kill hits enemy planes within 50), Headwind (enemy planes 20% slower), Mirror gun (each volley also fires mirrored across the middle), Boss breaker (triple damage to bosses), Point defense (every 6 s a zap destroys the bomb or missile closest to landing) and Overcharge (double ammo on special weapons). Pack cards show in two columns. **Rebuild** is a one-off card in normal crates that brings every destroyed building back at full health.

Built from the final game mechanics plan and the approved Alpine Dusk (realistic) art.

## Run it

TypeScript, built with Vite. It is a static site on Firebase Hosting at https://sky-defender-2.trom.dev. CI runs `npm run build` (typecheck, then `vite build` into `dist/`) and deploys `dist/`: a preview channel for every branch, prod on merge to `main` (see the repo's `docs/PLAN.md`). Cache headers are in `firebase.json`. Motion sensors only work over HTTPS.

```sh
npm install
npm run dev        # local dev server
npm run typecheck
npm run build && npm run preview
```

- iPhone: Safari asks for motion access on the first tap. Add to Home Screen for full screen, and turn on Portrait Orientation Lock.
- iPhone status bar: works like Google Flights. The manifest says `display: standalone`, so iOS draws an opaque status bar. iOS 26 still fades the top ~36pt of an installed app whatever the settings, so on iOS a solid fixed header strip (`#topbar`, `GLASS_BAND` = 44px tall, black) sits under the status bar and the game starts below it. The fade only has one flat colour to work on, and iOS takes the status bar colour from that strip. Don't use `display: fullscreen` or the `black-translucent` meta tag: both put the page under the status bar, where iOS 26.1+ draws a visible scrim. iOS reads these settings when the app is added, so after changing them, delete the home-screen icon and add it again.
- Build stamp: the bottom-left corner shows the version and UTC build time (`MMDD.HHMM`), so a phone can tell which deploy it runs. Settings adds the display mode and status bar inset, which shows whether iOS put the page under the status bar.
- Android (Chrome): install from the browser menu; the installed app is locked to portrait.

If the screen rotates anyway, the game counter-rotates so it always stays upright relative to the phone.

Local testing on a desktop: run `npm run dev` and open the printed URL with `?debug` added. The `?debug` flag is for development only: the mouse (or arrow keys) stands in for the phone's tilt, space fires, and `F` toggles "laid flat".

## Upgrades

Once every wave the friendly cargo plane flies over high on its own. It drops a small crate that steers onto a landing zone on the pad, picked at random left of the depot or right of the hangar; if the player doesn't shoot the plane (which then goes down) or the crate, it lands, pulses, and shows "Upgrade ready". A new cargo plane waits until the last crate has been opened. Tapping the crate opens a choice of three upgrades, and the pick takes effect at once.

Perks last the whole game or act at once: dual shot, then triple shot (a fan of three shells), fast loader (fires half as fast again), heavy flak (much wider shell bursts), repair crew (standing buildings back to full, ruined ones rebuilt to half) and shield dome (25 seconds in which bombs and missiles burst on a dome over the base and nothing gets through). A perk is only offered while it would do something, and a badly damaged base is always offered the repair crew.

Special weapons replace the gun until their ammo or time runs out: guided missiles (the only thing that fires until they are spent), laser (a solid beam while the finger is down), rockets, fireballs, sonic pulse, nuke, rapid fire, chain lightning (hits the plane nearest the aim, then jumps to up to four more planes or bombs) and cluster shells (each bursts into a spray of bomblets). Ammo and timings are in `AMMO` in `src/game.ts`.

## Game modes and difficulty

Both are picked on the title screen and remembered, and every mode and difficulty keeps its own high scores.

- **Original** is the game as it has always been: endless waves defending one turret.
- **War** (level 1): the base sits in the middle of a wider map with three turrets: the base's own, where you start, and one out on its own either side. Swipe left or right to move to the turret on that side (in debug, `z` and `x`); the camera slides over and the gun fires again once it arrives. A touch waits 90 ms before it fires so the start of a swipe doesn't loose a shot. Enemy planes come in from beyond either edge, so they can be shot on the way in. They mostly go for the base, but fighters and light planes sometimes hit an outlying turret; if the turret in use falls you move to the nearest one left. Friendly planes (olive green with a roundel and a green marker above them) fly through often, and the challenge is not to hit them: three friendly planes shot down loses the level, and the HUD shows the three marks. Some friendly planes drop an upgrade crate beside a turret; move there and tap it to open it. Friendly and enemy planes trade bursts of fire for show; it does no real damage. Survive 3 minutes to pass. The level is also lost if every base building or every turret is destroyed. The numbers are near `WAR_TIME` in `src/game.ts`, and the turret positions are `WAR_POSTS` in `src/art.ts`.
- **Adventure**: the original endless waves, but only the turret is built, and it starts at only 20% of a normal turret's health. Its health label shows that share, so it reads 20% until Max health is upgraded. Every enemy plane shot down earns **1 iron**, shown with a Shop button in the top right corner. Tap it (the game pauses) to spend iron in the **iron shop**: Max health (+10% of a normal turret per level, up to 10 levels), Damage (+25% shell damage, 8 levels), Fire rate (+15%, 6 levels), Extra turret (80 iron, then 150; up to two more turrets, east and west of the base, that aim and fire with yours and can fall without ending the game) and, during a game, Repair turrets (3 iron). Iron and levels are saved on the device and carry over between games, so each run starts a little stronger; the shop is also on the title screen and the results screen, with **Start adventure over** to reset. The other buildings are expensive **base parts** in the shop: Searchlight (40 iron), Radar (50, bomb shadows and plane arrows), Repair yard (60, the turret slowly repairs itself), Weapons depot (75, 50% more special weapon ammo) and Resupply hangar (100, supply crates). Until a part is bought, its job doesn't happen. Bought parts go up at once and are built at the start of every later game. Prices are `SHOP` and `PARTS` in `src/game.ts`.
- **Hard** (was Expert) has about twice the planes per wave, mixes in fighters and heavy bombers from the start, sends them in bigger groups with shorter gaps, and they drop, fire and dive more often. Everything that hits the base does 1.6x the damage. Points are worth 1.5x. In War it means bigger, more frequent enemy groups. The numbers are in `DIFFICULTY` in `src/game.ts`.

## Survival

The **Survival** row on the title screen (below the mode and difficulty rows) opens a separate top-down game. First you get your little guy ready: a name (or the dice for a random one), a shirt colour, a hat (none, cap, helmet or crown) and an ammo type, all remembered on the device. Then he walks around a walled camp (arrow keys on a computer, drag anywhere on a phone) while slow bears come out of the woods and wait outside the gate. A ring and a countdown over each waiting bear show its 30 seconds; when they run out the gate swings open and that bear comes in after you.

- You have 1,000,000 health, shown in a bar at the top, and heal 1.2% of that (12,000) every second.
- A bear's hit takes 8% of your max health (80,000), at most once every 5 seconds per bear. Health lost pops up in red bubbles.
- The crossbow is always in hand. Space (or **Shoot bear**) fires at the nearest bear within range, and does nothing if none is close; Z (or **Shoot**) fires straight ahead with no target. Bolts fly over the walls.
- Bears have 10.5 health. Normal ammo reloads in 3 seconds and does 3.5 damage (three hits a bear); Quick reloads in 1.5 s for 2.1 damage, and Heavy in 5 s for 5.25.
- A bear inside also throws rocks when it isn't close enough to swipe: each rock that hits takes 9% (90,000), one throw every 5 seconds per bear. Rocks fly straight, so they can be dodged.
- Once you've defeated 4 bears, "Bears in base in 20 seconds" shows for 4 seconds and from then on bears only wait 20 seconds at the gate. A **mine** and a **machine** pop up in the camp at the same time.
- Press M (or **Mine**) next to the mine and your guy hits it with the crossbow: one stone every 4 seconds until you walk away or press M again. Click or tap the machine (or press M) when you're next to it: it takes all your stone, and each stone is a batch that gives 5 stone ammo after 4 seconds, one batch after another.
- S (or the ammo button) switches between your loadout ammo and stone ammo. Stone ammo does 1.7x normal damage (5.95), and each shot uses one up; when it runs out you go back to your loadout ammo.
- Bears come more often as time goes on. The run ends when your health hits zero; the score is the time survived, and the best time is kept.

Numbers are in `SURVIVAL` and `AMMO` at the top of `src/survival.ts`; the screens are wired up in `src/main.ts` under "survival".

## Co-op

Turn on **Co-op** (the switch beside Normal and Hard on the title screen) and tap to open the lobby. Co-op works with Original and with Adventure (the same weak turret, iron and shop, saved on the host screen, with the Bomber and Sniper attacking it); War has no co-op, so picking one turns the other off. It shows a QR code (and a 4-letter room code); a phone that scans it joins the game, and **Join** lets the host device play too. Every player gets a random call sign, and **New name** (the dice) picks another. The host picks each player's role: **Base** (the normal game: tilt to aim, tap or the phone's FIRE button to shoot, open crates), **Bomber** or **Sniper**. Two players can both be the **Base**: the second one gets an extra turret just east of the base, with its own aim and the plain gun (crates still open from the main turret), so two Bases and nobody else is a game too. Up to three players can join; Start needs a Base and at least one of Bomber or Sniper, so Base and Sniper alone is a two-player game too (with no Bomber plane, just the usual waves).

The Bomber flies one enemy plane at a time (red marker and name over it). The plane flies left and right by itself and turns at the edges; the Bomber's buttons (on the phone, or beside the game when the host plays the Bomber, with keys in brackets):

- **Up** / **Down** (held; ↑ or W, ↓): climb or descend slowly.
- **Missile** (M): drops a normal missile at the building below, every 8 seconds.
- **Nuke** (N): only at 3/4 of the sky's height or higher, every 22 seconds. A big slow bomb that takes three hits to shoot down and wrecks most of the base if it lands.
- **Dive** (D): 6 seconds of firing, then a 15 second cooldown. At 7/15 of the sky or higher the plane stays up high and strafes the base as it flies; lower down it dives close to the base and fires, then climbs back.
- **Switch plane** (S): take over the next enemy plane along. The old plane flies itself again.
- **Grab** (G, or click a pack on the host screen): a metal arm reaches anywhere on the map, closes on an upgrade pack (plain, gold or diamond, falling or already on the pad) and reels it in over 12 seconds. Touching a falling pack does the same. The arm has a fifth of a boss's health; shoot it and it lets go, and the pack floats back down to the pad. A stolen pack becomes a plane upgrade: from a plain crate a plane shield (10 s), missile barrage (5 missiles), quick reload or Turbo (much faster for 15 s); from a gold pack heavy armor (twice the hits), rapid missiles (one every 2 s for 20 s) or a mega nuke (any height, twice the blast); from a diamond pack a Firestorm (mega nuke plus eight missiles behind a 10 s shield).
- **Upgrade** (U): use it.

Touching the cargo plane wears it down until it falls. The Bomber's plane takes six hits (twelve with heavy armor); when it goes down the phone says "You died" and a new plane comes in 5 seconds later. The game ends when the main turret falls, as usual, and the results show the Bomber's damage, planes lost and upgrades stolen. Co-op keeps its own high scores.

The **Sniper** plays on the Bomber's side. They see the whole map on their phone (or click on the host screen) and tap anywhere to point a red laser there. The laser does nothing for 3 seconds, then fires and takes 8% of the strength of any building under it. The Sniper has a metal arm too: **Grab** (G, or click a falling pack) sends it down from the top of the sky to the best pack anywhere, and it takes the same 12 seconds and can be shot off the same way. After an arm brings a pack in or is shot off, Grab waits 10 seconds (for the Bomber too). Sniper upgrades make the laser better: a plain pack gives Quick laser (the next 3 hit after 1 second), gold gives Heavy laser (the next 3 take 20%), and diamond gives Laser volley (the next laser is 5 in a row). **Use upgrade** (U) turns it on. The Sniper can also call in a **Missile** (M, every 8 seconds) and a **Nuke** (N, every 22 seconds). Both fall from the top of the sky onto the last spot the laser pointed at. A Base on a phone turns the phone to aim (it turns the gun further than the solo game, so the screen stays easy to see) or drags left and right on the map; phones without motion access aim by dragging. **Protection** cuts the damage you take by 65% for 5 seconds, with a 20 second wait after. The Base uses it with Q, the shield button or the phone's Protection button, and the Bomber with R or the pad.

Both phones also show the map above their buttons: the host sends a snapshot of the game about 20 times a second and the phone draws it with the same renderer (`src/coop/mirror.ts`). The Base's phone sees what the big screen sees; the Bomber's phone stays level and follows its own plane. The Bomber's missiles and nukes are always aimed at the standing building nearest their path, so they land on the base.

The phones talk to the host screen directly over WebRTC; the free public PeerJS server only introduces them (as in Scorched). Code is in `src/coop/` (`host.ts` lobby and players, `controller.ts` the phone, `pad.ts` the Bomber's buttons, `net.ts` PeerJS) and the Bomber's rules are in `src/game.ts` under "co-op". `src/boot.ts` sends a `?join=CODE` link to the phone controller. For local testing without the public server, run a PeerJS server and start Vite with `VITE_PEER_HOST=127.0.0.1:9000`.

## Enemies

Every plane goes down with one hit, so waves grow quickly (`waveSpec` in `src/game.ts`). A falling plane can be hit once more, which blows it apart in the air so it does no damage when it would have hit the base. Heavy bombers drop big bombs over the middle of the base that soon fall almost straight down and hit very hard; light planes fire long, skinny missiles on a slower arc aimed at standing buildings; fighters dive and strafe.

Every fourth wave (4, 8, 12, ...) has a boss: a much bigger dark bomber with red bands, twin tails and gun turrets that flies in on its own about a third of the way into the wave, which brings fewer planes than usual. It always shows a health bar and takes 20 hits on wave 4, 8 more for each boss after that, and half as much again on hard (`bossHp` in `src/game.ts`). It fires two missiles at a time, aimed at the two standing buildings nearest where they would come down. The laser burns it down while the beam stays on it, and the nuke takes off 12 hits.

## Code map

- `src/palettes.ts` lighting palettes (Golden Hour, Storm Light, Rose Dusk, Blue Hour, Night) and the 10-wave day cycle
- `src/art.ts` the mockup's SVG planes and base buildings (intact, damaged, ruined), rasterised per palette; landscape paths
- `src/input.ts` tilt reading from device orientation, One Euro smoothing
- `src/game.ts` rules and entity types: waves, planes, bombs, fighter dives, shells, missiles, upgrades, scoring
- `src/render.ts` canvas renderer (world rotates around the turret; barrel and HUD stay in screen space)
- `src/audio.ts` synthesised sound and music (no audio files)
- `src/survival.ts` Survival mode: the base, bears, crossbow and its own canvas
- `src/main.ts` screens, settings, high scores, portrait handling, game loop, and the co-op lobby on the host screen
- `src/coop/` co-op: rooms and players, the phone controller, the Bomber's buttons
- `public/` service worker, web manifest and icons, copied into the build as-is
- `app.json`, `firebase.json` deploy config (Hosting site `trom-sky-defender-2`)

All tuning numbers (speeds, fall times, HP, damage, meter thresholds) are starting points from the plan, meant for playtesting.
