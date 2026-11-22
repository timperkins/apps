# Build menu pictures and tab icons

The build menu's pictures (`public/cameos/<id>.png`, one per entry in `TECH`
in `src/v2/tech.ts`) and the tab buttons' icons (`public/tabs/<tab>.png`) are
photo-like renders made once with an image model, then shrunk and cut down to
48 colors so they sit with the pixel art. The game only loads the files
(`src/v2/cameo.ts`); nothing is drawn at run time.

## Rules for every picture

- **Neutral colors.** The same picture is shown whatever color you play, so
  no team blue or red: concrete grey, steel, off-white, olive drab, khaki,
  sand tan, gunmetal, safety yellow, with yellow-black hazard stripes as
  accents.
- **Easy to tell apart at a glance.** Each one gets its own silhouette, main
  color and setting, so you know it without reading the small details. Pick a
  combination nothing else in the menu already has.
- **Based on the game's own design.** Describe the shape the thing has on the
  map (render the current sprite if it helps), not some other game's art.

What is used now, so a new one can be different:

| id | subject | main color | setting |
|---|---|---|---|
| power | tall cooling tower, domed reactor with glowing ports, barrel-roofed hall | off-white concrete, amber glow | dusk, grass |
| barracks | Quonset hut, sandbags, flagpole | olive drab | pine forest |
| refinery | domed drum with chimney, ore tank, vaulted bay, conveyor, unloading pad, gold ore | off-white, rusty steel | ore field, mesas |
| silo | tall domed tank and a small one, glowing gauge windows, catwalk | aluminium, amber glow | desert highlands |
| factory | huge arched barrel-vault hangar, big striped door, rounded wings with stacks | gunmetal, off-white | smoky battlefield |
| radar | long runway in front, apron with parked jets, barrel-vault hangar with open lit door, control tower with dish, fuel tanks | off-white concrete, asphalt, yellow marks | dry grassland, late afternoon |
| uplink | huge white dish on a tall pylon over a domed drum, beam into the sky | white, steel grey | frosty tundra, starry night |
| helipad | round pad with a yellow H, windsock | asphalt | lakeshore |
| lab | one great geodesic glass dome glowing from inside | clear glass, silver, warm white light | summer meadow, dusk |
| tower | tall round bunker with firing slits and a twin-gun turret | pale concrete, gunmetal | forest edge |
| depot | round repair pad, four arched orange pylons meeting in a ring, hoist | orange girders, asphalt | industrial yard, dusk, floodlights |
| wall | run of crenellated concrete block wall with a corner | grey concrete | autumn hills |
| aa | four-tube missile launcher tilted up, firing, sandbagged pad | khaki, olive | steppe, big cloudy sky |
| prism | very tall spire with four swept fins, ring coil topped by a blazing ball | pale concrete, steel, copper | coastal headland, twilight |
| navy | piers with rounded ends, domed control tower, tall arched gantry crane | grey concrete, orange girders | misty harbor, morning |
| inf | rifleman, chest up | olive drab | burning ruins |
| gren | grenadier throwing, waist up | desert tan | mountain ridge |
| rocket | soldier aiming a shoulder launcher | grey urban camo | dusk |
| eng | engineer in a hard hat, wrench on shoulder, striped toolbox | khaki, safety yellow | river bank, broken stone bridge |
| dog | guard dog leaping at the viewer, teeth bared | tan and black fur | snowy birch woods, dawn |
| flamer | soldier in gas mask and fire suit, flame jet across the frame | ash grey | ruined trench, smoke |
| cmdo | operative in beret and bandoliers, two pistols raised | black, charcoal | night docks, orange lights, rain |
| buggy | open dune buggy, roll cage, gun | sand tan | desert, dust |
| apc | eight-wheeled armored carrier | olive green | meadow |
| light | medium tank, one gun | green-grey | meadow |
| hauler | tracked mining truck full of ore | safety yellow | ore field |
| arty | tracked howitzer, barrel raised, firing | desert camo | mountain ridge |
| heavy | huge tank, two guns at the viewer | charcoal gunmetal | battlefield |
| scorch | dome-turret tank spraying two jets of fire | dark olive | burning wheat field, sunset |
| lumen | tank with a tall finned mast, ring coil and blazing ball firing a beam | off-white, grey, copper | snowy mountain pass, night |
| heli | attack copter, rocket pods | olive drab | over a lake |
| heron | tandem-rotor transport, ramp open, door gun | khaki tan, olive stripes | red canyon, golden dust |
| jet | jump jet hovering, missiles launching | light gunmetal, off-white | stormy sea coast |
| plane | big high-winged four-engined propeller transport in flight, rear door open | olive drab, khaki | golden wheat-field valley, hazy evening |
| para | (the paratroopers, top of the Defense tab) five round parachutes with soldiers drifting down, a tiny plane far off | off-white canopies, olive drab | green farmland from high up, morning cumulus |
| mcv | long tracked truck carrying a folded base | grey, hazard stripes | pine forest |
| otter | hovercraft on a black skirt coming up a beach | sand tan, black | tropical beach |
| destroyer | lean warship at speed, bow gun firing | haze grey | rough ocean, sunset |
| cruiser | warship with radar panels, missiles launching straight up | light grey, white | arctic sea, ice floes |
| carrier | flat-deck carrier, drones taking off | dark gunmetal deck | ocean, cumulus clouds |
| sub | half-submerged submarine, split above and below the water | black, charcoal | night, moonlight |

## Making a build menu picture

1. **Generate** with the ElevenLabs connector: `creative_generate_image`,
   model `gpt-image-2.5-sunburst`, `generations_count: 1` (each one costs
   about 190 credits, so don't make extras). Put every image in one flow so
   they stay together. The model makes 1280x720 (16:9). Prompt template:

   > Photorealistic 3D render, late-1990s CGI real-time-strategy build-menu
   > thumbnail style. Composition: the whole subject is centered and fits
   > inside the middle 70% of the frame width (the image will be
   > center-cropped to 4:3), large, high three-quarter isometric view, bold
   > readable silhouette. Neutral colors only: *(two or three colors)*; no
   > blue, no red team colors. Subject: *(NAME IN CAPITALS: what it looks
   > like, part by part)*. Setting: *(landscape, sky, light)*. No text, no
   > people, no logos.

   For a vehicle say "three-quarter front view from slightly above". For a
   soldier say "Photorealistic portrait ... soldier centered, chest-up" (or
   waist-up) and give him something to do that shows his weapon.
2. **Download** the finished image: poll `creative_get_flow_run_status`, then
   fetch its `content_url`.
3. **Shrink** it:

   ```
   python3 tools/cameo.py cameo render.png public/cameos/<id>.png
   ```

   This takes a 4:3 crop (centered; move it with `--x0 <left edge>` when the
   subject sits off center, e.g. `--x0 90` moves it left), shrinks it to
   240x180, adds a little contrast and cuts it to 48 colors with dithering.
4. **Check** it next to the others: put all the pictures on one sheet and make
   sure the new one doesn't look like any of them. Then run the game and look
   at the build menu. A new `TECH` entry needs nothing else in the code: its
   picture is found by its id.

## Making a tab icon

The tab buttons show a cut-out subject with no background (power plant, gun
tower, soldier's head and shoulders, tank).

1. Generate a render as above, but on a plain background, which cuts out
   cleanly: "isolated on a plain flat light grey studio background with
   nothing else in the frame, soft even lighting", with a compact silhouette
   (for a soldier, "head and shoulders only, rifle held close to the chest").
   A render with a busy background can work too, if the subject stands out
   from it (the tower and tank icons came from their menu pictures).
2. Remove the background: put the render on the flow
   (`creative_add_flow_asset_node` with its `generation_id`), then
   `creative_edit_image` with model `birefnet-v2-bg-removal` and that node in
   `connect_from` (about 30 credits). Download the transparent PNG.
3. Shrink it:

   ```
   python3 tools/cameo.py tab cutout.png public/tabs/<tab>.png
   ```

   This trims to the subject, fits it in 68x56 (twice the button's image box),
   cuts it to 48 colors and gives it a hard edge. `--top 0.6` keeps only the
   top 60% of the subject (for a soldier who was rendered down to the waist).
