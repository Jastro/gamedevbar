# Systems

Detail notes per system. Last updated 2026-10-20. Structure and extension points:
[Architecture.md](Architecture.md). Messages: [Protocol.md](Protocol.md).

## Appearance (accessories, color, size, name color)

- **Data:** `{ head, face, hand, tint, scale, nameColor }`, saved in `PlayerProfile` (`playerAppearance`),
  sent with `setUsername`/`initCompleted` and relayed in `userJoined`/`userUsername`.
  - The server only checks the shape (`cleanAppearance`).
  - Clients normalize against `src/appearance/catalog.js` and drop unknown ids. Never rename an id.
- **Accessories:** about 27, built from Three.js primitives in `items.js`, so no assets or licenses.
  - Slots: head (hats), face (glasses, mustache, VR), right hand (drinks, a gamepad, a sword...).
  - Attachment (`Accessories.js`): avatar-space anchors (skull top and face front per character in
    `HEADS`, palm offset from `HandR`) are turned into bone-local transforms once per model in the rest
    pose, so items follow the animations.
  - They're re-applied after every model load and ignored by raycasts.
- **Tint:** it pulls the texture 60% toward the color (`TINT_STRENGTH`); accessories keep their own colors.
- **Size:** it scales the model 0.85–1.15 (feet stay on the ground, the collision box doesn't change). The
  name tag moves with it.
- **Menu:** 👤 has Personaje / Accesorios / Color tabs. On wide screens the panel sits on the left so you
  can watch your avatar.
- **Adding an item:** a builder in `items.js` (origin on the anchor) plus an entry in `ITEMS`.

## Controls and movement

- **Keys** (the full list is in the ❔ panel, `src/ui/ControlsHelpUI.js`; keep it in sync):
  - WASD walk (Shift runs, 6.5 vs 3.7 units/s), Space jump, F interact (`INTERACT_KEY` in
    `InteractionSystem.js`). F picks the best interactable over every type: near and in front of you
    (custom `findNearby` for doors and the Vircon32, otherwise each type's `range`);
  - Q/E rotate the camera, right-drag rotates, a right click (moving under 5 px) opens the emojis at the
    cursor;
  - wheel zoom, middle-drag pan, R re-center;
  - V push to talk, also passed on from the Vircon32 iframe together with R.
- **Movement** (`LocalPlayer`): speeds are per second, so it no longer depends on the frame rate.
  - The velocity eases toward the input (`ACCELERATION`/`DECELERATION`) and the avatar turns smoothly
    (`TURN_RATE`).
  - Steps are collision-checked in pieces of at most 0.15. A blocked step slides along the free axis; when
    fully blocked, a sideways nudge of up to 0.45 eases you round door frames.
  - The player's collision box is 0.8 wide (it was 1.0).
- **Colliders** (`CollisionManager`):
  - each box is tested in its own frame (the player's position goes into the collider's local space),
    so rooms can turn by any angle around the plaza; heights use the world box (only y rotations);
  - blockers (walls, bar, cabinets, door) block at any height, so a jump can't land you inside
    one;
  - the map is a disc: `setBoundary` keeps everyone inside the wall at its edge;
  - tables are round platforms: they block walking, but you can jump onto one, stand on it
    (`getGroundHeight`) and fall off it. The bar counter is a box platform (`addBoxPlatform`, top at 1.3)
    and works the same way;
  - chairs have no collider.
- **Seats:** stools, chairs (sit lower, facing their table) and the toilet. Clicking or F sits you down,
  Every seat shows the seated pose (feet forward, `Player.setPose('sit')`) to everyone: `userSat` carries
  the pose (`stand` only at the toilet's pee spot) and late joiners get it in `userJoined.seatPose`.
  and WASD stands you up.
- **Network smoothing.** The position goes out at most 20 times a second. Other players ease toward the
  latest position and rotation (`RemotePlayer`, frame-rate independent) and snap after a teleport (> 5).
- **Colliders** are static and measured once (`CollisionManager`). Before, every collider's box was
  recomputed on every check and every frame.

## Drivable cars

- **Nitro:** Shift while accelerating, like sprinting, as long as you hold it: top speed 22 (14
  without), quicker acceleration; letting go eases back down. Flames out of both exhausts, a whoosh
  as it kicks in and a roaring loop while it lasts, and the driver's view widens 12°. `driveUpdate`
  carries `nitro`, so everyone sees and hears it.
- **Passenger:** F next to an open-top car someone drives takes the seat beside them (`driveRide`): you
  ride along seated, F or Esc gets you out on your side (else wherever is free). One passenger per
  car; they stay in if the driver gets out, but can't board a car nobody drives. Not the Uber (its
  five seats are its own).
- **Eight open-top cars** (`src/world/DrivableCar.js`: red, blue, yellow, green, orange, purple, white,
  cyan) parked along the ring road beside the road junctions (`CARS` in `DrivingSync.js`). F next to one to drive: W/S speed up and brake (then reverse,
  max 14 forward / 5 back), A/D steer, F or Esc to get out (on the driver's side, else the other side
  or behind, wherever is free). A low engine hum (an oscillator through a low-pass, pitch with speed)
  while someone drives it, a thunk on a crash.
- **The driver's client runs the car** (`DrivingSync`): a bicycle model (wheelbase 2.5), stepped in
  0.25 pieces; three points along its length are checked against the colliders (walls, lamp posts,
  the fountain, the edge wall) and against the bars' footprints, so it never gets into a bar. A crash
  bounces it back at a quarter speed. Cars don't collide with people (they drive through them).
- **Car hits:** driving into another car shoves it out of the way along the contact and kicks it
  with 85% of your speed along the hit (`pushCars`, sample points as circles); you lose 70% of what
  you gave, and a car you keep pushing slows you to ~3.5. The shoved car slides on, slowing
  (`SLIDE_FRICTION`, ~4 m after a full-speed hit), and stops at whatever it meets. A car that can't
  move (against a wall or another car) stops you like a wall. Parked cars are slid by the pusher's
  client, which reports where they are (`drivePush`, also after you get out); a car someone drives
  gets the shove and the kick relayed to its driver (`drivePushed`). Cars already touching (a late
  remote pose) may pull apart.
- A car that already overlaps something (a door shut on it) hops to the nearest
  free spot within 3 (`DrivingSync.unstick`), or it could never move again.
- **Sync** (`server/features/driving.js`): one driver per car; the pose goes out 20 times a second,
  the server keeps the last one (a car stays where it was left, also for late joiners) and relays it;
  other clients carry it along its heading and ease to it. Everyone puts the driver's avatar in the
  seat with the seated pose; the camera swings in behind a moving car.
- **Uber Suicida** (below) is the fifth car, `'uber'`: its driver's seat drives it.

## Uber Suicida (the smoke car)

A black car parked on the plaza by the road between Gamedev and Desarrollo (`src/world/Car.js`,
`hubPoint(roadAngle(0), PLAZA_RADIUS - 5)`, tangent to the plaza). No collider: people walk through it,
like the other cars.
- **Getting in:** click it or press F next to it to take the first free of its 5 seats. The server
  (`server/features/car.js`) owns who sits where, and `CarSync` sits you down once `carState` lists you.
  WASD gets you out (`carLeave`).
- **Driving:** seat 0 (front left) is the driver's: sitting there sends `driveStart` for car `'uber'`
  (`DrivingSync.updateUberDriver`) and you drive it like the other cars, still seated; F or Esc stands
  you up beside it and frees the seat. Everyone in it stays in their seat as it moves
  (`updateUberSeats`). Frames: `Car.group` is placed and turned like the other cars (+z forward), the
  car itself sits in `Car.body`, built with its front at +x.
- **The ride:** with 2+ inside, a 5 s countdown starts, shown to the passengers as "🚗💨 N". It's
  cancelled if they drop below 2. Then `carSmoke`:
  - everyone sees smoke particles fill the cabin and spill out, and hears a synthesized positional hiss;
  - passengers fade to black after 3 s, each lands at a random free spot (either bar in front of the
    counter, or anywhere on the plaza), and fades back in;
  - the server clears the seats when the smoke starts and keeps the car closed (`riding`) for 6 s;
    the clients keep everyone in their seat until the teleport (`CarSync.seatedSlots`), since the
    car may still be moving. A driver loses the wheel when the teleport stands them up.

## Bathroom

Each bar has a bathroom in its front-left corner (`src/world/Bathroom.js`, room-local x -15..-10,
z 5..10, so about 4.8 × 4.8 inside). The partitions are 3.2 m high, with a ceiling. The walls, ceiling and
closed door, including the lintel above the door, are camera occluders, so the camera stays inside (and
under the ceiling) or outside the walls. The ceiling overlaps the partition tops so there's no seam.
The three bar paintings over that corner were raised to y 4.6 so they clear the ceiling.
- **Door:** it swings inward, with a blocker while closed and a 🟢 Libre / 🔴 Ocupado sign outside. A latch
  knob is inside, and it clicks when used. While latched, only whoever latched it, or anyone inside, can
  open the door; opening unlatches it.
- **Toilet** (centered on the left wall, scaled 1.25): F or click → "¿Qué vas a hacer, guarro?" →
  *💧 Mear* (you stand at the bowl, trickle sound, yellow water) or *💩 Cagar* (you sit with your hips on
  the seat in a procedural seated pose, `Player.setPose('sit')`: feet moved forward and up and tilted, since
  the rig has no sit animation and only foot bones below the body. Other players see it through the
  bathroom state's `occupantKind`. Then
  sit, a fart from `cacota1-4.mp3`, a swirl in the bowl, and a green stink haze with flies for 10 min).
  - The handle on the tank flushes: a whoosh, and the bowl's content spins away.
  - The other sounds are synthesized noise (`src/audio/synth.js`), so there are no new files.
- **Sink:** washes your hands. The mirror above it is a `Reflector`, rendered only while you're inside.
  Its shaders (and what it reflects) compile once as you enter the bar (`Game.warmUpBathrooms`: each
  bathroom drawn once from inside), and the walls' drawings upload on joining, so stepping into the
  cubicle doesn't hitch (it was ~120 ms).
- **Air freshener:** a spray hiss and particles; the stink is gone.
- **Powder table:** a small table in the corner right of the mirror (as you face it) with a mirror tray, a
  white line and a rolled-up note. F → "Esnifar": a sniff and a video-game power-up for everyone near, you
  lean in (the `snort` gesture), and the line is gone for everyone for 45 s (`powderEmptyUntil`).
- **Toilet paper** on a holder on the side wall next to the toilet.
- **Light:** the cubicle's own lamp and switch. While you're inside, `RoomLighting` follows that switch
  instead of the bar's (on = normal, off = dark, no disco). The lamp is a bathroom-only light in the
  shaders (`Bathroom.lampLight` → `RegionLights`), not a three.js light, so it never shines through
  the partitions or the ceiling into the bar, and it shows for everyone looking in. Its space ends at
  the ceiling (3.2): the bar's walls above the cubicle get the bar's light.
- **Dirty hands:** using the toilet dirties them. Outside any bathroom, a dirty-handed player gets rising
  green smell lines at the hands and a "🤢 No se ha lavado las manos" tag (`src/entities/Shame.js`), until
  they wash or 10 min pass.
- **Graffiti:** each of the cubicle's four walls is drawable, floor to ceiling and corner to corner
  (`GraffitiWall.WALLS`, id `<roomId>:<0-3>`); the fixtures stand in front, and the door's wall has the
  doorway cut out of its panel (shaded "puerta" on the canvas). F → a panel with the wall's own canvas (it's also the texture): 6
  colors, a 🧽 eraser (wall white), 3 sizes, mouse/pen/touch. Segments are drawn locally at once and sent
  in batches (`GraffitiSync`, one message per 100 ms, ≤ 60 segments); the server keeps the last 3000 per
  wall in memory (a restart wipes it) and late joiners get them all. Walking out closes the panel.
- **Reaching things:** fixtures only respond from inside the cubicle (the interaction's `canReach`); the
  door works from both sides.
- **State:** server-side in `server/features/bathroom.js` (see Protocol.md). Disconnecting frees the latch
  and the toilet.
- **Leftover removed:** the old empty "Bathroom" group in `level.json` (an invisible seat by the Vircon32)
  is removed when the level loads.

## Bar service and drinks

- **Ordering:** a beer tap on each counter (`src/world/BarTap.js`, room-local (5, 1.3, `BAR_COUNTER_Z` - 0.2), past the last
  stool so F picks it over a seat). F or click → "🍺 ¿Qué te pongo?" → Caña, Vino, Chupito, Cubata, Café,
  Refresco (`src/bar/drinks.js`). The drink shows in your right hand through the appearance hand slot
  (`Player.setHeldItem` overrides `hand` without touching your saved appearance).
- **Drinking:** B takes a sip (3 per drink, positional `sip` sound for everyone). The last sip empties
  your hand; ordering again replaces the drink.
- **Drunk level** 0..6: each sip adds a third of the drink's alcohol (beer/wine 1, shot 1.5, cubata 2,
  coffee -1.5, soda 0); it drops 1 per 2 min. The server keeps `{level, at}` and clients compute the
  current value with `drunkLevelAt` (no timers).
- **Effects** (`src/bar/DrinkSync.js`), scaled from 0 at level 1.5 to full at 6:
  - the camera rolls and sways (`Camera.drunk`; never on a locked view, so arcade screens stay readable);
  - walking weaves from side to side (`LocalPlayer.getInputDirection`);
  - from level 2, chat text gets doubled vowels and swapped letters, and from 4, sometimes a "*hic*"
    (emoji-menu emotes stay intact);
  - from level 3, everyone sees a "🍺 Borracho/a" tag over you.
- **State:** `server/features/drinks.js` (cooldowns: order 2 s, sip 0.8 s). It lives on the connection, so
  reconnecting sobers you up.

## Darts

- **Where:** each bar's right wall, past the projector screen (`src/world/Dartboard.js`): the board at
  room-local (14.8, 2.1, 8), a yellow throw line 4.4 in front, and a chalkboard at z 6.2 with the current
  thrower's darts, the last 6 turns and the day's best (Madrid date).
- **Playing:** F or click at the line asks the server for the board (one thrower per board, and one board
  per player). Once you're the thrower (`DartsSync`): you stand at the line, the camera locks on a close
  aiming view (`Camera.setView`), the mouse aims and a crosshair sways around the aim (more when drunk:
  `SWAY` 0.14 + `DRUNK_SWAY` 0.45 × the drink effect, at `SWAY_SPEED` 1.35; release jitter 0.06). Click or Space throws, Esc leaves. Three darts per turn; the
  turn ends 2.5 s after the third, or after 30 s without throwing.
- **Scoring** is only on the server (`scoreAt` in `server/features/darts.js`): the client sends where the
  dart hit in board units (1 = outer edge of the double ring), the server answers with sector, double,
  triple, 25 or bull (50). Everyone sees the dart fly from the thrower's hand (whoosh, then a thunk).
- **Board size:** about 1.3× a real one to match the avatars (2.15 tall), and the darts 1.8×.

## Karaoke stage

- **Stage** (`src/world/KaraokeStage.js`): a 0.25-high box platform in front of each projector screen
  (room-local x 11.6..14.7, z -2.6..2.6) with a glowing front edge, a mic stand and a stage light on a
  stand. Jump onto it, or F at the mic to be placed 1.0 behind it (`SINGER_DISTANCE`) facing the room;
  F offers nothing more while you're on the stage.
- **No server state:** "on stage" (`KaraokeStage.contains`: inside the rectangle, feet on top) is worked out
  from positions on every client. `Environment.updateStages` fades the stage light in while anyone is up.
- **Voice:** `VoiceChat.update` gives a singer's voice a ref distance of 25 instead of 4 for listeners in
  the same bar (about full volume anywhere inside); outside the bar the usual distance and muffling apply.
- **Lyrics:** the shared projector. Its panel has a "🎤 Buscar karaoke en YouTube" link (a search for
  karaoke videos with lyrics); paste the chosen link into the projector as usual.

## Pong (two players)

- **Who plays** is the server's (`server/features/pong.js`, one machine per room, id = room id): F at the
  cabinet → `pongJoin`. The first player plays the CPU; a second one joins (hint "Retar a …") and the match
  restarts 1 vs 1; a third gets "ya hay dos jugando". Esc, disconnecting or the end of a match frees it.
- **Host-run:** player 1's client runs the game (`ArcadePong.simulate`, per second, so frame rate doesn't
  change the speed) and sends a snapshot 20 times a second (ball, paddles, score, phase, sound events).
  Player 2 moves its own paddle locally and sends it (`pongPaddle`). Everyone else draws the snapshots and
  carries the ball on between them. Sounds play for the players and for watchers within 8 units.
- **Match:** 3 s countdown, first to 5, the bounce angle depends on where the ball hits the paddle and it
  speeds up 10% per hit. After "¡FIN DEL JUEGO!" (4 s) the host sends `pongOver` and the machine is free.
- While you play, `game.playMode` holds the hint (W/S or ↑/↓, Esc) and blocks walking and world keys.

## Real time and weather (Spain outside, yours on the clock)

- **Outside: Spain in general.** `server/features/weather.js` asks Open-Meteo (free, no key) every 10 min
  for 8 cities in one request (Madrid, Barcelona, Sevilla, Valencia, Bilbao, A Coruña, Zaragoza, Málaga).
  Rain/drizzle/snow/storm if at least 3 of 8 have one (the most common; storms win ties), fog if 3 have
  fog, otherwise clouds from the average cover. Sunrise/sunset are Madrid's → `weatherState` to all and
  on join. A failed request keeps the last state (clear sky before the first answer).
- **Time** is Madrid's, from the server clock (`Weather.madridTime`). `daylight()` goes 0 → 1 through a
  45-min twilight around sunrise/sunset.
- **Sky** (`src/world/Weather.js`, the scene background):
  night navy → twilight orange → blue, greyer with clouds, white during lightning.
- **Outside only:** `RoomLighting` lights the outdoors from the sky (`Weather.outdoorLight`: dim blue at
  night, dimmer with clouds/rain, a flash for lightning). The lamp posts light up at night. Rain and
  drizzle (streaks, slanted by wind), snow (soft flakes) and storms (lightning + synthesized thunder) fall
  only outside the bars: drops fill a 48×48 box around the camera that wraps as it moves, and any drop
  inside a bar is hidden (`Weather.insideBar`); fog only while you're outside. Lamp posts stand beside
  each road a little out from the plaza and along the ring road's outer edge (18). Every lamp casts a
  soft additive glow on the ground (not drawn inside a bar: `clipToOutdoors`). Their light is not
  three.js lights (each would cost every lit material): `RegionLights` lights outside pixels from every
  lamp (up to 32) in the material shader, so all lamps light at once and none reach into a bar. Rain has a looping hiss, quieter inside.
- **Clock:** above the door inside each bar (`WallClock.js`): *your* local time (browser) and *your*
  weather (`LocalWeather.js`): the browser asks once for your location, rounded to ~10 km, kept a day,
  and fetched from Open-Meteo straight from your browser ("Tu zona"). Denied: the Canary timezone gets
  Las Palmas, anything else Madrid; until any answer, Spain's. A forum embed will need
  `allow="geolocation"` on its iframe.
- Inside the bars nothing changes: their lights follow their switches.
- **Wall finishes** (`src/world/WallTextures.js`, per room in `RoomLayout.ROOMS`: `exterior`,
  `interior`): drawn in code, mapped in meters (`World.mapWallFaces`), so the pattern keeps its size
  on any wall. Both bars outside: whitewash with an ochre base (`whitewash`; `timber`, half-timbering,
  is there too, unused); inside both: wood wainscot to 1.2 m and cream plaster
  (`wainscot`). Wall ends and tops stay plain cream; the roof's gable ends continue the outside
  finish. `level.json`'s own copies of the walls are removed (they sat on top of World's).
- **Closed buildings** (`src/world/ClosedBuilding.js`): slots 2-5 (`RoomLayout.FREE_SLOTS`) hold a bar's
  shell in the old plain cream with a roof, solid walls (people, cars and the camera stay out), a
  shut door and a big yellow "PRÓXIMA APERTURA" sign (lit a little so it reads at night). Nothing
  inside; when a new bar opens there, it becomes a Room.
- **Roofs** (`src/world/Roof.js`): a terracotta gable roof on each bar (tiled slopes with eaves, gable
  ends like the outside walls, ridge cap, chimney). From inside: a sloped wooden ceiling, plaster gable
  ends; the camera stays under it (the slopes are camera occluders). The bar's light space reaches up
  to `ROOF_TOP`, so the ceiling takes the bar's light; the tiles, cap and chimney are lit as outside
  (`litAsOutside` in `RegionLights.js`: a define that skips the space test). No shadows. The gable
  ends' inner faces are the walls' plaster (`plaster` finish, without the wainscot).
- **Windows** (`src/world/Windows.js`): fake windows on every building's outside walls (bars and
  closed buildings), two rows: a painted window, green shutters and a stone sill each, merged into
  three meshes per building. On the front, either side of the door (closed buildings: clear of the
  sign).
- **Ceiling fixtures** (`src/world/CeilingFixtures.js`), per bar, hanging from the ceiling
  (`Roof.ceilingHeightAt`):
  - two pendant lamps over the tables (room-local x ±6, z 2), on with the normal light: the bulbs glow
    and they light the bar below; RoomLighting hands their positions to RegionLights (`roomLamps`, up
    to 8), which lights only that bar's pixels with them (not its bathroom, not outside);
  - a disco ball in the middle: with disco on it spins, its mirror tiles flash in the cycling disco
    color, and 110 colored specks land where its reflections would hit the walls, floor and ceiling.
  - The projector box hangs 4 in front of its screen, its pole up to the ceiling.

## Upper floor and terrace

- **Gallery** (`src/world/UpperFloor.js`, `RoomLayout.GALLERY`): along each bar's front wall, floor at 5
  (z 6.5 → 9.9, full width), three tables with chairs. Under it everything fits (bathroom, clock,
  who's-here board at 70%, darts); the front-wall paintings hang up there at its eye level.
- **Stairs**: x 2.4 → 8.4 at z 5.2 → 6.45, then a landing (x 8.4 → 10) onto the gallery. Railings on the
  gallery's edge, round the landing, along the stairs' open side.
- **Terrace**: a doorway in the front wall above the entrance (x ±1, y 5 → 7.4) onto a balcony outside
  (x ±4, out to z 12.6) with railings, a table and two plants, looking over the plaza and fountain.
  Outside light and rain; F reaches its chairs from the terrace (their `userData.outside`).
- **Collision** (`CollisionManager`): `floor` slabs (gallery, landing, terrace) you stand on and walk
  under (they block a body whose center is over them, between the slab's bottom and top); a `ramp`
  for the stairs (ground rises along it; it blocks walking into its sides below the treads). Blockers
  no longer block someone standing fully above them (the entrance door, under the doorway). Walking
  down keeps you on the stairs (`LocalPlayer.STEP_DOWN`). F skips things 3.5+ above or below you.
- Gallery and terrace slabs are camera occluders.

## Soundscape

- `src/audio/Soundscape.js`, all synthesized (8 s loops): birds (chirp bursts) by day and two crickets
  at night, non-positional, full outside and at 12% inside a bar, birds at a quarter in the rain;
  each bar has a murmur of voices just outside its door (positional) that grows with the people
  inside (full at 6) and is silent for the bar you're in. Fades at 1.5/s; starts with the audio.

## Bartender

- `src/world/Bartender.js`: one behind each counter (Manolo in Gamedev, Paco in Desarrollo, a moustache),
  a RemotePlayer the game drives (not in `players`, no network). Every 9 s he walks (1.4/s) to another
  stop in the lane between the counter and the back shelf, faces the customers and, a third of the
  time, says a line. Stops and lines come from the server clock and the bar, so everyone sees the same
  thing. A drink served to someone in his bar: "¡Marchando!".

## Tragaperras (video-game meme slot machine)

- **Where:** against each bar's left wall (`src/world/SlotMachine.js`, room-local (-14.35, 0, 2.6)). F or
  click pulls the lever; one spin at a time per machine (2.6 s), and everyone sees the same spin: the
  reels stop one by one on the server's result.
- **Symbols** are drawn in code, no images: emoji on a loud gradient tile with a meme caption (Impact,
  white with a black outline): 🐔 LEEROY JENKINS, 🛩️ DO A BARREL ROLL, 💀 YOU DIED, 🗡️ TAKE THIS (it's
  dangerous to go alone), 🍄 1UP, 🎂 IS A LIE, a keyboard F (PRESS F) and 🏆 GG EZ (jackpot). The
  screen shouts the result: the full meme line on three of a kind, "COMBO x2" on a pair, a red
  "WASTED" on nothing. The sign says TRAGAPERRAS.
- **Pays** (`server/features/slots.js`, bet 10): any pair 18; three of a kind 60 / 80 / -20 (💀 takes
  more) / 120 / 160 / 0 (🎂 the cake is a lie) / 200 / 1000 (📈 jackpot, announced to the whole bar).
  Returns ~88% of what's bet.
- **Coins** live on the connection (a reload starts again at 100). Broke → the owner lends you 50, once a
  minute. Win jingles and a "wah wah" are square-wave tunes (`playTones` in `src/audio/synth.js`).

## Futbolín

- **Table** on the left side of each bar (`src/world/Foosball.js`, room-local (-9.5, 0, -1.5), turned 90°:
  it runs front to back, players stand left and right of it). Table space has its own frame (below).
  Layout (pitch, goals, 8 rods, men, ball) in `server/shared/foosball.json`, read by both sides.
- **Joining:** F on one long side joins that side's team (🔴 red at +z, 🔵 blue at -z), 2 per team. Alone
  you move all 4 of your rods; with a partner, the back player has goalie + defense, the front one
  midfield + attack (`rodsFor`, same on both sides).
- **The server runs the game** (`server/features/foosball.js`): fixed 60 Hz steps against real time (Windows
  timers fire every ~15-30 ms), 20 snapshots/s while anyone plays. Players send rod targets (20/s) and
  kicks; the server slides rods there at rod speed. Phases: `practice` (one team only: no score),
  `countdown` (3 s), `play`, `goal` (1.5 s, the team that conceded serves), `over` (first to 5, 4 s, then
  a new match). A kick sweeps the foot 0.16 along the table; a still ball gets nudged after 2.5 s.
- **Client** (`FoosballSync`): your rods move at once from W/S (↑/↓), others' follow the snapshots, the
  ball is carried on between snapshots and eased back. While playing the camera looks down from your side
  and your own avatar is hidden (others see it). The score is printed on both long side walls (nothing
  floats over the table); kick/goal sounds.

## Stickers

- **Placing:** right click → 🎨 Pegatina sticks the sticker picked in 👤 → Pegatina where the right click
  aimed (`StickerSync.aim`: a raycast from the camera; the first visible solid mesh that isn't an avatar).
  Within 3.5 of your avatar's head. Not on doors, the bathroom door or cars (`UNSTICKABLE`: they move).
- **The sticker:** a flat 1.4 square a hair off the surface (polygon offset, no depth write, no raycast),
  upright on walls; on floors and tables its top points away from the camera, so it reads for whoever
  stuck it. A lit material, so it takes the light of its space. A spray hiss for everyone near.
- **Rules** (`server/features/stickers.js`): one per person, a new one replaces your previous one, at
  most one every 10 s (client and server), each lasts 24 h, 300 at most in total (oldest first).
  "Person" is a random key the browser keeps (`PlayerProfile.stickerOwnerKey`, never relayed), so a
  reconnect still replaces your old sticker. Memory only: a restart (every deploy) wipes them.
- **Designs** (`src/stickers/StickerArt.js`, ids in `server/shared/stickers.json`): 12 drawn in code
  (canvas, no image files), in each meme's spirit rather than copies: Pito feliz, GG EZ, Leeroy, Cake is
  a lie, Press F, Wasted, Git gud, Skill issue, This is fine, Doge, Nerf this, /gamedev/. The choice is
  kept in the browser (`PlayerProfile.loadSticker`), not part of the appearance.

## Right-click menu and gestures

- **Right click** (no drag) on the 3D view opens a radial menu at the cursor (`src/ui/RadialMenu.js`):
  😀 Emojis (the old emoji panel), 🕺 Animaciones (a second ring with the gestures, ‹ goes back) and
  🎨 Pegatina (see Stickers).
- **Gestures** (`src/entities/Gestures.js`) are procedural, on the rig's own bones (CORE, Body, Head and the
  floating HandL/HandR; there are no arm bones). Poses are written in avatar space (the player mesh's
  frame at size 1: +z forward, feet at y -1, hands rest at x ±0.4 / y -0.52, the big head up to +1.1)
  and converted to each bone's space every frame, after the walk/idle animation, so they fit every
  character and size. 0.25 s fade in/out; bones the clip doesn't key are put back each frame.
  - 💃 Baile sexy and 💪 Flexiones loop (10 s max; push-ups tip the whole model face down onto its hands
    and need you standing); ✊ Paja (comic: a sideways fist pumping in front of the belly, faster and faster, then a
    juicy finish: droplets from the hand and a squelch), 😘 Beso (hand to the mouth,
    hearts), 💦 Escupir (head back, then droplets that splat on the floor), 🙌 Animar (hands up, jingle),
    🍻 Brindar (raise, clink sound, sip; lends you a beer if your hand is empty).
  - Hands are aimed, not just moved (`aim: { fingers, thumb }`, avatar-space directions; at rest the
    fingers hang down): up with palms forward when cheering or dancing high, flat and forward on the
    floor for push-ups, at the lips for the kiss, a thumb-up grip for the paja and the toast. What the
    hand holds stays upright (`item.tilt` tips the glass into the mouth). Spitting has a short "ptuh".
  - `snort` is a hidden gesture (not in the menu) played by the bathroom's "Esnifar".
  - Walking cuts a gesture short, for everyone.
- **Sync** (`GestureSync`, `server/features/gestures.js`): `playerGesture` / `playerGestureStop` relayed
  to everyone else; not replayed for late joiners.

## Light switches

- **Switches:** three switches on the inside of each bar's front wall (`LightSwitches.js`): 💡 normal
  and 🕯️ low on one side of the door, 🪩 disco on the other. Click or F.
- **Shared per room**, like doors: `lightsToggle` → `lightsState`, snapshot `lightsStates`
  (`server/features/lights.js`, `LightsSync.js`). Default: normal on.
- **Rendering** (`src/rendering/RoomLighting.js`): the scene's single ambient + directional light
  (from level.json) follow the space the local player is in; outside follows the sky.
  - normal (with or without low) = full light;
  - low alone = warm and dim;
  - all off = almost dark;
  - disco = three colored point lights circling that bar's ceiling. They always exist (intensity 0
    when off), so the light count never changes and no material recompiles.
- **Through open doors** (`src/rendering/RegionLights.js`): every lit material is patched at compile
  time (`Material.prototype.onBeforeCompile`, only for the main renderer). Each pixel finds its space from
  its world position: the bathrooms (up to their ceiling), then the bars (rotated boxes, room-local
  x ±15, z ±10), else
  outside, and uses that space's ambient and directional light instead of the scene's. A point 0.05 in
  front of the surface decides, so a wall's inner face takes the bar's light and its outer face the
  sky's. `RoomLighting.updateRegions` fills the uniforms each frame (each space fades on its own, the
  outside snaps for lightning). Up to 12 spaces (`REGION_MAX`). A space may have one lamp of its own,
  lighting only that space (the bathrooms'). The disco lights are three.js lights, not split by space.

## Empty rooms

`Environment.updateDormancy` (1 s checks): a room nobody (local or remote) has been inside for 30 s stops
its radio download (`Radio.setDormant`) and projector video (`Projector.setDormant`) on this client. Both
come back at the live point when anyone is inside again. Choices stay on the server.

## Entry: direct links and customization

- **Two ways in.** `/` shows the start dialog: nick, character, bar. `/<roomId>` (`/gamedev`, `/desarrollo`,
  case and trailing slash ignored) skips it. The server sends `index.html` for any single-segment path.
  Unknown names fall back to the dialog.
- **First visit through a direct link:**
  - `Parroquiano NNNN` and a random character, both saved;
  - after the avatar loads, a one-time popup *¿Quieres personalizar tu personaje?* (any way of closing it
    counts as answered).
- **Shared memory.** Both ways in share the remembered nick and character (`PlayerProfile`, localStorage
  keys `playerName`, `selectedModel`, `customizePromptSeen`). In a cross-site iframe that storage is
  partitioned. That's acceptable until the forum provides identity.
- **👤 menu** (`CustomizeUI`, next to ⚙️):
  - a nick field (*Guardar*/Enter save it and close the menu) and the start dialog's character tiles,
    moved into the panel;
  - previews are created on first open and paused while it's closed;
  - changes go out as `setUsername` → `userUsername` to everyone.
  - The nick field goes away when forum usernames arrive.
- **Sound on direct links.** With no dialog click, the browser keeps audio suspended. The first
  `pointerdown`/`keydown` resumes the context and kicks the radios (`Radio.kick`).

## World layout and rooms

All room content is authored in one **room-local frame** (the original bar): x ∈ [-15, 15], z ∈ [-10, 10],
walls 8 high, bar counter at z = `BAR_COUNTER_Z` (-5.65), back bar against the back wall at `BACK_BAR_Z`
(-9.65; both moved back 2.65 on 2026-10-23 with the stools, radio, glasses and tap), arcades against the
back wall (z -9.05), paintings at y 5 (5.6 over the bathroom), the sign at y 7, front wall at z = +10 with the entrance centered
(x = 0) and the "who's here" board beside it (x = 7).
`src/world/RoomLayout.js` is the single source of truth for placing rooms:

**The hub** (2026-10-23): a round plaza with `SLOT_COUNT` (6) bar slots around it. Each bar faces the
middle with its door on the plaza's edge; a small road (`RADIAL_ROAD_WIDTH` 6) runs out between each pair
of slots to a ring road (`RING_ROAD_WIDTH` 8, dashed middle line), and a low wall closes the map
(`WORLD_RADIUS`). All of it is computed from the room size, so bigger rooms push it out by themselves:
- `PLAZA_RADIUS = (2·ROOM_HALF_WIDTH + RADIAL_ROAD_WIDTH) / (2·tan(π/6))`: the bars' front walls form a
  hexagon that leaves exactly a road's width between neighbors (31.2 today; ~40 with rooms a third
  bigger);
- the ring road starts 3 past the bars' back corners (56.3–64.3 today); the wall is 5 past it (69.3);
- slot k is at angle k·60° (`slotAngle`), its bar centered `PLAZA_RADIUS + ROOM_HALF_DEPTH` out along
  `bearing(angle)` and turned by that angle so its front faces the middle;
- `PLAZA_CENTER` is (0, `ROOM_HALF_DEPTH + PLAZA_RADIUS`) so Gamedev (slot 0) stays at the origin.

| Room | Slot | Origin (x, z) | Rotation Y | Front door (world) |
|---|---|---|---|---|
| Gamedev | 0 | (0, 0) | 0 | (0, 10) |
| Desarrollo | 1 | (-35.7, 20.6) | 60° | (-27.0, 25.6) |

`Outdoors` (`src/world/Outdoors.js`) builds the grass, the paved plaza (curb and a ring in the middle), the
roads, the edge wall and the fountain in the middle (basin radius 2.4, a column with two bowls up to
~4.4, water falling from each bowl, a quiet positional loop: a faint fizz with soft splats and
plips, made in code (`createWaterBuffer`); the basin is a round platform you
can hop onto, the column blocks); `getLampSpots()` puts a lamp beside each road and 18 along the ring road's outer edge. The soccer stadium lives at
(0, 0, -50) behind Gamedev and is only shown during `/furbo`.

How a room is built (`World.create` → `Environment.create`):
1. `Room` creates a `THREE.Group` at the origin/rotation and resolves its world matrix **before** children are
   added (colliders measure themselves in their own frame from it).
2. A clone of `level.json`'s "Taberna" group (lights and `FrontWall` stripped by `Scene`; lights are global).
3. `World`: floor, walls (front wall split around the door), bar counter colliders.
4. `Environment`: Bar (sign text per room), PresenceBoard, Furniture, Radio, Paintings (only if the room's
   `paintings` flag isn't `false`; Desarrollo has bare walls), Snake + Pong arcades, Door.
   Builders receive the `Room` as their "scene", so they keep their original local coordinates.

Anything that compares positions must go through world space: `Room.toWorld/toLocal/containsPoint`,
`World.getRoomAt(pos)`, `World.getRoomForObject(obj)`, `getWorldPosition()` for arcades.

To add a room: add an entry to `ROOMS` with a free `slot` (0-5) and its id to `ROOM_IDS` in
`server/config.js`. The selector lists it automatically.

## Doors

`Door` (`src/world/Door.js`): frame, hinged panel (swings inward 90°), outside name sign, and an invisible
doorway box on layer 1 used as the collider (enabled only while closed, so the swinging panel never traps
anyone). If a door closes on a player, `LocalPlayer` lets them move while they overlap a collider, so they can
step out. Closed panels also block the third-person camera (`World.getCameraOccluders`). State is
server-authoritative: `doorToggle` → server flips → `doorState` to everyone; `doorStates` snapshot on join.
Offline (no WS) the client toggles locally.

## Audio

One `AudioListener` on the ear (`Environment.ear`, `initializeAudio`): an object at the player's head
(distance is measured from your avatar, not the camera) turned like the camera (left/right follow the
view). Snake's and Pong's listeners hang from it too: all listeners drive the one shared audio context. Each room's radio (and each remote voice)
is a `PositionalAudio` with an `OcclusionChain` (*low-pass filter → gain*, `src/audio/Occlusion.js`) whose
level `Environment.getOcclusionLevel(sourceRoom, listenerRoom)` picks every frame:

| Listener | Filter cutoff | Extra gain |
|---|---|---|
| Inside that room | 20 kHz | 1.0 |
| Outside, door path open (its door open, and listener's own door open or listener in the street) | 2.5 kHz | 0.8 |
| Outside, any closed door in between | 450 Hz | 0.55 |

Changes are smoothed with `setTargetAtTime` (0.15 s). Values live in `OCCLUSION_LEVELS` in `Occlusion.js`.
Arcade sounds are plain `THREE.Audio` (not positional, not occluded).

## Radio (shared stations)

Each room's radio (`src/world/Radio.js`) plays the room's **shared station**: live Spanish internet
radio only (`src/audio/radioStations.js`), so everyone hears the same broadcast (± the browser's buffer).
A sprite above each radio shows "📻 station" (or *Radio apagada*), redrawn on every change.
Defaults: Gamedev Rock FM, Desarrollo MegaStar FM. Kiss FM and Hit FM were dropped (2026-10-21): their
CDN redirects through a hop without CORS headers, so they played silence. The old El Fary mp3 loop was removed (2026-10-21). Clicking a radio opens the station picker (`src/ui/RadioUI.js`). A change goes
`radioSet` → server → `radioState` to everyone, with a 📻 chat line; newcomers get `radioStates`. Rooms
nobody has changed play their `RoomLayout` `radioStation`. *Silenciar para mí* is local.

Playback: a `<audio crossOrigin="anonymous">` element → `PositionalAudio.setMediaElementSource` → the
same `OcclusionChain` as before, so distance and wall muffling still work. **Every station URL must send
CORS headers**, or Web Audio gets silence. The list was checked with curl on 2026-10-20; re-check a station
that goes quiet. Dropped live streams reconnect after 5 s.

**Inaudible radios stop downloading.** Every 250 ms each radio estimates what this player would hear:
the panner's inverse distance falloff (from the ear's `AudioListener`) × the wall/door occlusion gain
× radio volume × the player's radio slider (0 when *Silenciar para mí*). Below 0.01 (-40 dB) for 3 s,
the stream is unloaded. The first check decides at once, so the other bar's radio never starts if you
can't hear it. When it's audible again, it reconnects at the live point. Typical values: own bar ~0.05,
street ~0.011-0.024, the other bar with closed doors ~0.008 (stopped). Each stream is ~128 kbps.

## "Who's here" board

Each room's front wall (where the Mediavida forum TV used to be) has a board (`src/world/PresenceBoard.js`).
It lists the players currently inside that room (🎙️ while they talk, *(tú)* for yourself), with a footer
counting people in the other rooms and on the street. It's computed on each client from the player
positions it already knows (`World.getRoomAt`), checked every 500 ms, and redrawn only when something
changes. No server state. The forum scraper behind the old TV (Puppeteer + headless Chromium,
`/mv-proxy`) was removed on 2026-10-21; it's in git history if a forum feed is wanted again.

## Vircon32 cabinet

A Vircon32 fantasy-console cabinet in every room (back-right corner), playing on its own 3D screen with a
ROM picker. People standing round it watch the game live (WebRTC from the player). Details:
[Vircon32.md](Vircon32.md).

## Volume settings

⚙️ (next to the mic button) also has per-player volume sliders: 📻 radio, 📽️ projector, 🗣️ voices,
🕹️ arcade (`src/audio/AudioSettings.js`, saved in `localStorage` `audioVolumes`, 0-100 %).
- Radios multiply their `PositionalAudio` volume, projectors their YouTube volume, and voices their
  `PositionalAudio` gain.
- Arcade drives:
  - the Vircon32 emulator's output gain (the audio tap, see Vircon32.md);
  - a spectated game's `PositionalAudio`;
  - Snake and Pong's own `AudioListener` master volume. A
slider releases focus when let go, so movement keys work right away.

## Projector (shared YouTube)

A 16:9 screen on each room's right wall (`src/world/Projector.js`), with a projector box hanging in
front of it. The right-wall paintings moved to the front wall, left of the door. The video is a real
YouTube iframe (IFrame API, `src/media/youtube.js`) placed in 3D by a `CSS3DRenderer` layer **under** the
transparent WebGL canvas (`Renderer`). A mesh with `NoBlending` + opacity 0 punches a hole in the canvas
where the screen is, so walls and players in front still cover it. The iframe gets no pointer events: all
control goes through the panel (`src/ui/ProjectorUI.js`), opened by clicking the screen. The player can
paste a YouTube link (watch, youtu.be, shorts, embed, live), pause/resume, or turn it off.

Sync: the server keeps `{ videoId, startedAt, pausedAt }` per room (server clock). Clients estimate the
server clock (`src/network/ServerClock.js`, from `init` and every projector message), play from
`now - startedAt`, and re-seek when more than 1.5 s off (checked every 2 s). Pause stores the position;
resume shifts `startedAt`. YouTube audio can't go through Web Audio, so walls are imitated with volume
only (`OCCLUSION_VOLUME`: 1 / 0.5 / 0.12) on top of distance. If the browser blocks autoplay with sound,
the next click anywhere starts it. Non-embeddable/missing videos are reported in chat.

## Voice chat (push to talk)

`src/voice/VoiceChat.js` + `VoicePeer.js`, UI in `src/ui/VoiceUI.js`. WebRTC full mesh: every pair of
players has one audio-only `RTCPeerConnection`; the WebSocket server only relays signaling (`voiceSignal`)
and the talking flag (`voiceTalking`). The lower user id of a pair sends the offer. Each connection starts
with one `sendrecv` transceiver; the mic is attached later with `replaceTrack`, so there is no
renegotiation. Hold `V` (or the 🎙️ button) to talk: the first press asks for the mic (HTTPS or localhost
only), later presses just toggle `track.enabled`. Remote voices play as `THREE.PositionalAudio` on the
speaker's avatar through the same `OcclusionChain` as the radios
(`Environment.getOcclusionLevel(speakerRoom, listenerRoom)`). Avatars show a 🎙️ sprite while talking.

**Open mic** (⚙️ → *Micrófono abierto*, saved in `localStorage` `voiceMode`): the mic track stays enabled
and `V` / 🎙️ toggle mute (🔇) instead of push-to-talk. The 🎙️ indicator others see follows actual speech:
a level detector on a clone of the mic track (RMS > 0.02, 500 ms hold). A saved open mode reopens the mic
on entry. Releasing or losing the mic in open mode leaves it muted; the next `V` reopens it.

Mic settings (⚙️ next to the mic button, `src/ui/VoiceSettingsUI.js`): input device dropdown (names appear
once mic permission is granted; choice saved in `localStorage` `voiceInputDevice` and requested as `ideal`,
so a missing device falls back to the default), a live level meter (fed from a clone of the mic track,
because the real one is muted between presses; the clone is never sent), and *Desactivar micrófono*, which
stops the track so the browser's recording indicator goes away; the next press reopens it. Switching device
mid-call swaps the track on every peer with `replaceTrack`, without reconnecting.

Limits: a mesh costs N-1 connections per player (fine for a bar of ~20); bigger rooms need an SFU.

Networks: STUN alone only connects players whose NATs allow it. Carrier-grade NAT (common in Spain:
Digi, O2, mobile data) and strict routers need the **TURN relay** (coturn, self-hosted). Setup in
[TURN.md](TURN.md). The server adds per-player, short-lived TURN credentials to `init` when `TURN_URLS` +
`TURN_SECRET` are set (`server/config.js`). `ICE_SERVERS` (a JSON array) still replaces the default STUN. A
connection that isn't up within 15 s counts as failed. The player gets one chat message per peer
("No se ha podido conectar la voz con…"), the initiator retries 3 times, and ⚙️ → *Conexiones de voz*
shows each player as conectando / conectado / sin conexión. Embedding in a forum thread needs
`<iframe allow="microphone">` on the embedding page.

## Server state

All in memory, lost on restart, each owned by its feature module in `server/features/`: users (Hub: id,
name, model, position; seat and duel fields added by those features), seats, chat history (last 50), Snake
high scores (top 10), doors (doorId → open), radio stations and projector state per room. Message list:
see [Protocol.md](Protocol.md).

## Known issues and quirks (found 2026-10-20, not fixed unless noted)

- ~~Server crash on bad input~~ (fixed 2026-10-20): `Hub` parses frames in a try/catch, runs each handler
  inside a try/catch, and features validate/clamp fields (see Protocol.md).
- ~~XSS in chat~~ (fixed 2026-10-20): `ChatUI.addMessage` builds DOM nodes with `textContent`.
- ~~Pong multiplayer sync was broken~~ (fixed 2026-10-22): `WebSocketManager.send` let a `type` inside the
  data override the message type, so Pong's messages never arrived as sent. `send` now puts `type` last,
  and Pong was rebuilt on its own messages (see "Pong (two players)"). Snake is still local.
- Seat ids are Three.js object ids (client-local, though built in the same order everywhere), so server
  seat occupancy is only as good as that. Seated poses are synced since 2026-10-23.
- Duel messages (`duelRequest`...) exist on the server but there is no client UI for them.
- Fixed 2026-10-21: a page loaded hidden or zero-sized (background tab, hidden pane, collapsed iframe)
  left the camera aspect at 0/0 = NaN until the next resize. The scene rendered black, and anything
  using the aspect (the Vircon32 camera framing) got NaN positions. Camera now clamps the aspect and
  `Game.start` re-syncs the size.
- `window.game` is still used as a global by older modules (Bar, arcades, SoccerGame, ChatUI); new code
  gets `game` passed in.
- Geometry is duplicated: `level.json` and `World` both create floor/walls (z-fighting). The bar counter and
  back shelf are only `World`'s since 2026-10-23 (level.json's `BarArea` is removed on load, `Bar` keeps
  the decoration).
- `Bathroom.js` and `Lighting.js` are never used (level.json has an empty Bathroom group).
- The 6 character previews keep their own WebGL contexts and render loops after the game starts.
  (Fixed 2026-10-20: `ModelSelector.init()` ran twice, creating 12.)
- Fixed 2026-10-20: server sent the initial position as `{x,y,z}` while clients expect `[x, y, z]`;
  local `system` chat messages rendered as "undefined ...".
