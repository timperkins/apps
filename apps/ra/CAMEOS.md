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
| power | two cooling towers and a turbine hall | off-white concrete | dusk, grass |
| barracks | Quonset hut, sandbags, flagpole | olive drab | pine forest |
| refinery | long hall, smokestack, unloading pad, gold ore | grey, rusty steel | ore field, mesas |
| silo | two ribbed metal tanks on a pad | aluminium | desert highlands |
| factory | wide saw-tooth-roof hall, big striped bay door | gunmetal | smoky battlefield |
| radar | control bunker with lattice radar mast, walkway to four landing pads | sand concrete, asphalt, yellow marks | dry plateau airfield, midday |
| uplink | huge white dish on a pylon over an equipment block, beam into the sky | white, steel grey | frosty tundra, starry night |
| helipad | round pad with a yellow H, windsock | asphalt | lakeshore |
| lab | building with a big geodesic dome | white panels | summer meadow |
| tower | octagonal bunker with a twin-gun turret | concrete, gunmetal | forest edge |
| depot | asphalt repair pad, wrench mark, steel gantry and hoist | orange girders, asphalt | industrial yard, dusk, floodlights |
| wall | run of crenellated concrete block wall with a corner | grey concrete | autumn hills |
| aa | four-tube missile launcher tilted up, firing, sandbagged pad | khaki, olive | steppe, big cloudy sky |
| prism | slender ribbed tower with a glowing crystal on top | pale concrete, steel | coastal headland, twilight |
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
| lumen | light tank with a glowing crystal turret firing a beam | off-white, grey | snowy mountain pass, night |
| heli | attack copter, rocket pods | olive drab | over a lake |
| heron | tandem-rotor transport, ramp open, door gun | khaki tan, olive stripes | red canyon, golden dust |
| jet | jump jet hovering, missiles launching | light gunmetal, off-white | stormy sea coast |
| mcv | long tracked truck carrying a folded base | grey, hazard stripes | pine forest |

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
