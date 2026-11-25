# O&D

An isometric cartoon heist game at [od.trom.dev](https://od.trom.dev). Built from a handwritten design page: steal cars, rob the bank, outrun the cops, take over a ship. Realistic-ish, but no blood and no bad words: enemies get knocked out with cartoon stars and wander off.

## Controls

- **Computer:** WASD or arrows to move, **Shift** to punch, **Space** to jump, **F** for the flamethrower, **E** to use, **P** for the phone.
- **Phone/tablet:** joystick on the left half of the screen, red **Punch**, green **Jump** and blue **Use** buttons on the right, phone button top right.

## What's in it

- **Big city:** 14 x 14 blocks with 4 banks, 5 shops, 3 car lots, 4 police stations, parks, a beach and a sea with little islands. Roads, traffic (cars and buses that can bonk you), townspeople who say "Hi", "Hello" and "Didn't see you there", and bullies who try to punch you.
- **Steal cars:** walk up to a car and Use to pick the driver up, put them on the ground and drive off.
- **Car lot:** rent a car ($100 for 3 minutes), buy a sports car ($1500, call it from your phone any time) or steal one off the lot.
- **Shop:** screwdriver, wrench, sandwich, a cartoon **flamethrower** ($800, hold F or the orange button), upgrades (fast shoes, boxing gloves, padded vest) and disguises (cap & shades, fake mustache, cowboy hat, clown wig, top hat & suit).
- **Bank heist:** guards chase you if they see you in the back rooms. You need a screwdriver or wrench to open the vent grate (sneak through the ducts to the vault) or the locked door (a guard might see). In the vault room, parkour across the crates: the floor is covered in lasers that zap you and set off the alarm. The vault pays $2500 and refills after 5 minutes.
- **Police** walk the beat calmly and only get angry when one sees you commit a crime or you hit one; robbing a bank or taking the ship always counts.
- **Cops:** wanted stars go up for crimes they see. Knock one out and they drop $50 to $100 (more as cops get tougher). Cops chase on foot and in cars, get tired after chasing too long ("You too fast") and slow down. Every 10 minutes of play they get 25% tougher. Stars cool down when nobody is close, or change your disguise on the phone while no one is looking.
- **Army:** at 4 stars military buses drop off troops: **Greniders** (throw grenades), **Heaters** (flamethrowers) and **Lazors** (laser blasters). At 5 stars, tanks.
- **Jail parkour:** the JAIL by Home has a HUGE course: 34 numbered platforms over a deep pit, with blinking platforms that vanish and springy pads that throw you up high. Fall in and you start over. Reach platform 34 and grab the golden trophy for $1000 (once a minute).
- **Ship:** walk down the dock, beat the captain and his sailors, then take the wheel and sail.
- **Phone:** map with your location (zoomed in, or the whole city), outfits, your car and help.
- **2 players:** tap **Play with a friend** and the other phone scans the QR code (or taps **Join a friend's game** and types the 4 number code). You share money, stars and shop stuff; Player 2 wears the red shirt. Going into the bank takes you both in. Invite later from the phone's Car tab.

Progress (money, items, upgrades, car, play time) is saved in the browser. In 2 player mode the host's phone runs the game and keeps the save; the friend's phone keeps its own save untouched.

## Code

Plain TypeScript + Canvas 2D, no game engine. `src/map.ts` builds the city and bank, `src/game.ts` is the simulation, `src/draw.ts` the isometric renderer, `src/main.ts` input, HUD and menus. `src/net.ts` is 2 player mode: PeerJS (WebRTC) between the phones, with the host sending what is near the friend about 20 times a second. `npm test` runs a few map and rule checks.
