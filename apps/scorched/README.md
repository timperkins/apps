# Scorched

A realtime artillery game for the web, in the spirit of the DOS classic *Scorched Earth*.

Tanks sit on randomly generated, fully destructible terrain. There are no turns: every tank aims whenever it likes, and after firing (or repairing) it reloads for 5 seconds. Wind, gravity and falling dirt all matter. The map wraps around: a shot or tank that leaves one side comes back on the other. Between rounds you spend cash in the shop, and computer players at four difficulty levels fight alongside or against you, 2 to 8 tanks in total.

A round ends when one tank is left. If no tank has been hit for a minute, a draw vote opens, and the round ends in a draw once every living human player agrees (computer players always agree).

## Playing

The computer (or a TV hooked up to it) shows the battle; everyone plays on their own phone.

1. Open the game on the computer and pick **New game** (or **Use last setup**). Set up the match and add any computer players.
2. Each player scans the QR code with their phone, types a name and picks one of 20 colors and 6 tank designs. A color someone else has is greyed out. Designs only change the look.
3. Start the battle on the computer. Everyone shops on their phone at the same time; the round starts when every phone taps Ready.
4. Hold the phone sideways. The controller has angle and power (hold the buttons, or drag on the left panel), weapon select, Repair, Power Cell and a big FIRE button with a reload bar. Phones buzz when you fire or get hit (on Android).

If a phone drops out (screen lock, wifi blip), reopening the page puts it back in the same tank. The room code at the bottom of the big screen works for rejoining too.

On the computer: **F** fast forwards a computer-only game, **M** turns sound on or off and **Esc** opens the pause menu.

### How phones connect

Phones talk to the computer over WebRTC data channels. PeerJS's free public server is used only to set each connection up; game traffic then goes directly between the phone and the computer on the same wifi. Wifi that keeps devices apart (many guest, hotel and office networks) blocks this; home wifi or a hotspot works.

To try the controller on one computer without the PeerJS server, open the game with `?net=tabs` (for example `http://localhost:5173/?net=tabs`); the QR link then opens controllers that talk to it across browser tabs.

### Game setup

Rounds (1 to 20), starting cash, interest on saved cash, terrain (hills, mountains, canyons, flat, random), wind strength and whether it shifts every 10 seconds or once per round, planes, gravity, and the computer players with their difficulty (Easy, Normal, Hard, Expert). The last setup is remembered in the browser.

### Economy

You earn $20 per point of damage dealt to other tanks, $1,500 per kill, $3,000 for winning a round, plus interest on unspent cash. Score is separate from cash: 1 point per kill and 2 for winning a round.

### Weapons and items

Baby Missile (free, unlimited), Missile, Baby Nuke, Nuke, Dirt Clod, MIRV, Leapfrog, Funky Bomb, Roller, Digger, Napalm and Torpedo. A Torpedo rockets your own tank up to the top of the screen, straight through any dirt and drifting the way you aim; there a parachute opens and the controller's move buttons steer it left and right on the way down. A shot that hits the parachute drops the tank hard. Items: Parachute, Shield, Repair Kit and Power Cell (brings your power cap back to max without healing). Prices and effects are listed in the shop and defined in `src/core/weapons.ts`.

## Development

Requires Node 20 or newer.

```sh
npm install
npm run dev        # local dev server
npm test           # unit tests (Vitest)
npm run typecheck
npm run build      # production build in dist/
```

### Layout

| Folder | Contents |
| --- | --- |
| `src/core` | Game rules with no browser APIs: seeded RNG, terrain, physics, weapons, realtime battles, match economy |
| `src/ai` | Computer players: shot search, targeting, weapon choice and shopping |
| `src/render` | Canvas drawing of the battlefield, tank designs and labels |
| `src/net` | Phone connections: message protocol, the host's room, PeerJS and test transports |
| `src/controller` | The phone controller page (`controller.html`) |
| `src/ui` | Menu screens and styles |
| `src/audio` | Sound effects synthesized with WebAudio |
| `src/main.ts` | The big screen: wires screens, the room, the game loop and computer players together |
| `tests` | Unit tests for the core rules, AI and the phone room |

The battlefield is a 640×360 pixel canvas scaled up with crisp pixels. Terrain is a solid/empty bitmap, so explosions carve real craters and loose dirt falls. The physics run at a fixed 60 steps per second, and the computer players aim by running the same physics off screen.

### Deploying

The game is a static site on Firebase Hosting at https://scorched.trom.dev, deployed by the `apps` repo's CI: a preview channel for every branch, prod on merge to `main` (see `docs/PLAN.md` at the repo root). CI runs the typecheck, tests and build first. Cache headers are in `firebase.json`. To try the production build locally, run `npm run build && npm run preview`.
