# Sky Defender 2: Your worst nightmare

A portrait-locked WWII anti-aircraft PWA. Turn the phone like a steering wheel to aim (aim gain 1.4x, so the horizon is reached at about 60 degrees of tilt); tap or hold anywhere on the screen to fire.

On a computer (a mouse and no touch screen, or a device with no motion sensors) the left and right arrow keys (or A and D) aim, space fires, Enter or a click opens a landed crate, and `z`/`x` move between turrets in war mode.

Upgrades: each wave has a 20% chance that the resupply plane is a gold plane (gold marker, gold arrow). Its gold pack offers a choice of every permanent upgrade you don't have yet, including two that only come in gold packs: **Leeching** (each kill heals every standing building by 2% of its max) and **Upgrade shifter** (cargo planes and falling crates dodge your shots). Any enemy plane you shoot down has a 3% chance to drop a **diamond pack**, which offers only **Ghost shot** (light blue shells that pass through enemy planes, hitting each one, and never harm friendly planes) and **Drop shot** (at the end of its flight a shell falls back down through the sky, harmless to friendly planes and the base). Gold packs also offer eight more gold-only permanents: Armor plating (buildings take 25% less damage), Bounty (double points per kill), Swift shells (33% faster shells), Mending (standing buildings heal 0.5% of max a second), Lucky star (gold plane chance 40%), Clean intercepts (shot-down bombs don't scorch the base), Heavy air (bombs and missiles fall 30% slower) and Last stand (once a game the turret holds at half strength instead of falling). Diamond packs also offer eight more diamond-only permanents: Homing shells, Spark jump (a kill zaps the nearest enemy plane within 280), Exploding wrecks (a kill hits enemy planes within 50), Headwind (enemy planes 20% slower), Mirror gun (each volley also fires mirrored across the middle), Boss breaker (triple damage to bosses), Point defense (every 6 s a zap destroys the bomb or missile closest to landing) and Overcharge (double ammo on special weapons). Pack cards show in two columns. **Rebuild** is a one-off card in normal crates that brings every destroyed building back at full health.

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
- **Hard** (was Expert) has about twice the planes per wave, mixes in fighters and heavy bombers from the start, sends them in bigger groups with shorter gaps, and they drop, fire and dive more often. Everything that hits the base does 1.6x the damage. Points are worth 1.5x. In War it means bigger, more frequent enemy groups. The numbers are in `DIFFICULTY` in `src/game.ts`.

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
- `src/main.ts` screens, settings, high scores, portrait handling, game loop
- `public/` service worker, web manifest and icons, copied into the build as-is
- `app.json`, `firebase.json` deploy config (Hosting site `trom-sky-defender-2`)

All tuning numbers (speeds, fall times, HP, damage, meter thresholds) are starting points from the plan, meant for playtesting.
