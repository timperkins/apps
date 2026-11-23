# O&D

An isometric cartoon heist game at [od.trom.dev](https://od.trom.dev). Built from a handwritten design page: steal cars, rob the bank, outrun the cops, take over a ship. Realistic-ish, but no blood and no bad words: enemies get knocked out with cartoon stars and wander off.

## Controls

- **Computer:** WASD or arrows to move, **Shift** to punch, **E** to use, **P** for the phone.
- **Phone/tablet:** joystick on the left half of the screen, red **Punch** and blue **Use** buttons on the right, phone button top right.

## What's in it

- **City** with roads, traffic (cars and buses that can bonk you), townspeople who say "Hi", "Hello" and "Didn't see you there", and bullies who try to punch you.
- **Steal cars:** walk up to a car and Use to pick the driver up, put them on the ground and drive off.
- **Car lot:** rent a car ($100 for 3 minutes), buy a sports car ($1500, call it from your phone any time) or steal one off the lot.
- **Shop:** screwdriver, wrench, sandwich, upgrades (fast shoes, boxing gloves, padded vest) and disguises (cap & shades, fake mustache, cowboy hat, clown wig, top hat & suit).
- **Bank heist:** guards chase you if they see you in the back rooms. You need a screwdriver or wrench to open the vent grate (sneak through the ducts to the vault) or the locked door (a guard might see). The vault pays $2500 and refills after 5 minutes.
- **Cops:** wanted stars go up for crimes. Cops chase on foot and in cars, get tired after chasing too long ("You too fast") and slow down. Every 10 minutes of play they get 25% tougher. Stars cool down when nobody is close, or change your disguise on the phone while no one is looking.
- **Army:** at 4 stars military buses drop off troops: **Greniders** (throw grenades), **Heaters** (flamethrowers) and **Lazors** (laser blasters). At 5 stars, tanks.
- **Ship:** walk down the dock, beat the captain and his sailors, then take the wheel and sail.
- **Phone:** map with your location, outfits, your car and help.

Progress (money, items, upgrades, car, play time) is saved in the browser.

## Code

Plain TypeScript + Canvas 2D, no game engine. `src/map.ts` builds the city and bank, `src/game.ts` is the simulation, `src/draw.ts` the isometric renderer, `src/main.ts` input, HUD and menus. `npm test` runs a few map and rule checks.
