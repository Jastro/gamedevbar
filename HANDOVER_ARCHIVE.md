# Handover archive

Full entries moved out of HANDOVER.md (one-line summaries stay there).

## Done (2026-10-23: the hub, drivable cars)
- 2026-10-23 Drivable cars and the fountain: four open-top cars on the ring road (F to drive, W/S/A/D,
  F or Esc to get out), a quiet engine hum, crashes against walls/lamps/fountain/edge, never into a
  bar, no collision with people; the driver's client runs it, the server keeps where it was left.
  A tall, slim fountain in the plaza center with falling water and a water loop. **Verified with two
  clients:** F next to the red car → driving (seated, hint, engine on), 23 units in under 3 s; the other
  client sees the car and the driver seated at the same spot; driving at Desarrollo's open door stops
  at the doorway line (never inside); stops against the fountain (4.4 from its center); drives
  through the other player; F gets out 2 away on a free spot, engine off, pose cleared on both; a
  late joiner sees the car where it was left; screenshots of the fountain and of driving.
- 2026-10-23 The hub: the street is replaced by a round plaza with 6 bar slots around it, a small road
  between each pair out to a ring road, grass and a wall at the map's edge, all computed from the room
  size (plaza radius 31.2 today, ~40 when rooms grow a third). Gamedev keeps slot 0 at the origin,
  Desarrollo moved to slot 1. Colliders are now tested in their own frame (rooms at 60° would have got
  huge world-aligned boxes). Rain/snow follow the camera and skip the bars; lamps by each road; the car
  on the plaza. **Verified:** collisions in Desarrollo (60°) match Gamedev's at all 3,504 grid points
  (782 blocked), platform heights match (counter 1.3, stage 0.25, tables 1.03); walking out of
  Desarrollo stops at its closed door and reaches the plaza with it open; roads free, the edge wall
  blocks; no rain inside bars (966 drops visible, 0 inside); top and plaza-level screenshots.

## Done (2026-10-23: rounds of fixes)
- 2026-10-23 Second round of fixes:
  - **Gesture hands** are aimed by finger/thumb direction from the rig's finger bones (they hung
    fingers-down when raised): cheer and dance palms forward, push-ups flat on the floor (lifted, they
    were sinking), kiss at the lips, paja thumb-up grip, toast grip with the glass kept upright and tipped
    to drink. **Verified:** measured finger directions match each target, the raised glass points up
    (0.99) and tips toward the face to drink; screenshots of cheer, toast (raised and sip), push-ups.
  - **Futbolín:** no floating scoreboard; the score is printed on both long sides (screenshot).
  - **Tragaperras:** 🐔 LEEROY JENKINS replaces "All your base".
  - **👤 panel** on the right (from 800 px wide; measured 24 px from the right edge).
  - **Bathroom:** a small table in the corner with a powder line, "Esnifar" (sniff + power-up for
    everyone, a lean-in gesture, the line gone 45 s for everyone); the toilet roll was floating, now on a
    wall holder. **Verified with two clients:** hint "Esnifar", line gone on both, the other gets "No queda
    nada" and the "(no queda nada)" hint; screenshots of the corner.
- 2026-10-23 Borja's round of fixes:
  - **Seated pose on every seat** (stools, chairs, car), shown to everyone (`userSat` carries the pose).
  - **Gestures:** hands rotate (kiss: fingers to the lips then palm out; toast: glass tipped into the
    mouth; paja: sideways fist), the paja ends with droplets and a squelch, spitting is a short "ptuh".
  - **Karaoke:** the singer stands 1.0 behind the mic (they overlapped). **Darts** harder (wider, faster
    sway, shakier release).
  - **Layout:** the back shelf and the four arcades are against the back wall; counter, stools, tap,
    radio and glasses moved back 2.65 with the shelf (same gap); paintings up 1, sign up to y 7. The
    counter existed three times (level.json, World, Bar): now only World's, Bar keeps the decoration.
  - **Tragaperras:** renamed, video-game memes on loud tiles with Impact captions, WASTED / COMBO /
    YOU DIED / GG EZ jackpot results (server ids changed, payouts the same, ~88%).
  - **Verified in-app:** overview of the new back wall (screenshot); stools at z -4.15, sitting on a stool
    and a chair shows the pose, the other client gets `seatPose: 'sit'`; kiss/toast/paja frozen at key
    moments (screenshots: rotated hand at the lips, tipped glass, sideways fist); the finish spawns 9
    droplets and ends; singer at 13.4 vs grille 12.6 (screenshot); the tragaperras screen (screenshot);
    payout return recomputed (8.79 per 10).

## Done (2026-10-22 night: gestures, local clock)
- 2026-10-22 Right-click radial menu and gestures: Emojis / Animaciones; 💃 dance, 💪 push-ups, ✊ paja,
  😘 kiss, 💦 spit, 🙌 cheer, 🍻 toast, procedural on the bones in avatar space, synced to everyone.
  **Verified in-app with two clients:** both rings (7 gestures + back); dance and cheer move the
  hands/body (screenshots); push-ups lay the body face down just above the floor (lowest point 0.09,
  screenshot); the toast lends a beer (screenshot); spit spawns 6 droplets and kiss hearts, all cleaned
  up; ✊ hand at its target; the other client plays them (time advancing, model tipped for push-ups);
  walking stops it on both and the model returns to rest; Emojis still opens and closes the panel.
  **Not judged:** how each one looks and reads on every character.
- 2026-10-22 Spain weather outside, local clock: the street shows Spain in general (8 cities, rain if 3+
  have it); the clocks show each player's local time and weather (browser location, rounded, cached a
  day; fallback Madrid / Las Palmas). **Verified:** combine asserts (dry with 2 wet cities, rain with 3,
  storm wins, fog, overcast, Madrid sun times, average temperature; plus a wrong one that fails); live
  8-city fetch (partly cloudy, 16.3 °C); in-app: location denied → Madrid local weather on the clock;
  stubbed location (Barcelona) → rounded 41.4 / 2.2, cached, "☁️ 18°C · Tu zona".

## Done (2026-10-22 evening: doors light, futbolín, slots, weather)
- 2026-10-22 Light through open doors (plan `Docs/Plans to be done/2026-10-22-doors-light-local-weather-gestures-plan.md`):
  a bar you're not in is lit by two door lights while its door is open; from inside, the street's
  materials are dimmed to the sky's light. **Verified** at night: from the street the open doorway shows
  a lit inside (Gamedev's door lights at 9, Desarrollo's at 0 with its door closed); from inside, the
  street through the door is dark (dim 0.35); screenshots.
- 2026-10-22 Futbolín:
  - **Table** on the left side of each bar; F on a long side joins that team, 2 per team (alone you have
    all 4 rods, partners split back/front). Practice alone, matches to 5 with countdown and goal pauses.
  - **The server runs the physics** (60 Hz against real time) and sends 20 snapshots/s; players send rod
    targets and kicks. Your view looks down from your side, your avatar hidden.
  - **Verified:** headless runs on the server (phases, rod split, a 25 s bot match: 65 kicks, 15 hits,
    a goal; fixed real-time stepping and a dead zone between the midfield rods); in-app with two
    clients: hints by side, red alone → practice, blue joins → countdown → play, blue's W slides its
    rods away (server and the other client agree), the ball matches on both clients, Esc releases the
    view and the avatar, a player who leaves can walk off (not stuck in the table); screenshots; no
    errors.
  - **Not judged:** the feel (speeds, kick strength), lag over a real network, 2 vs 2 with four people.
- 2026-10-22 Meme slot machine:
  - **Machine** against each bar's left wall; F pulls the lever, the server rolls, everyone watches the
    same spin. Symbols drawn in code (🗿, 🤡, 💀, 🐕 much wow, 🍄 1UP, 🎂 cake is a lie, F, 📈 stonks).
  - **Coins** per connection: 100 to start, bet 10, pair 18, triples up to 1000; broke → 50 once a minute.
  - **Verified:** payout asserts (+ a wrong one that fails) and the expected return (8.79 per 10); a mock
    hub: bailout once, then "broke" for 60 s, unjoined players and bad rooms ignored; in-app with two
    clients: hint with coins, spins sync (same reels on both), only the spinner's coins change, a second
    pull while spinning gets "Espera…"; screenshot of the screen.
  - **Not judged:** the look, jingles, how generous it feels.
- 2026-10-22 Real time and weather (Madrid):
  - **Server** asks Open-Meteo every 10 min (code, temperature, clouds, wind, sunrise/sunset).
  - **Client:** the sky follows the real sun and clouds; outside, the street light follows the sky and two
    lamp posts come on at night; rain, drizzle, snow, fog and storms (lightning + thunder) over the
    street only; a clock above each bar's door ("23:18 · 🌧️ 14°C · Madrid").
  - **Verified:** a real fetch (13.9 °C, sunrise 08:33, sunset 19:24); in-app at 23:17 Madrid: night sky,
    street ambient 0.22, lamps on (screenshot); forced storm: rain streaks and a lightning flash
    (screenshot); forced snow by day: round flakes (screenshot, after fixing square flakes); inside the
    bar the lights stay on their switch, no fog, rain quieter; the clock (screenshot).
  - **Not judged:** the look by day, sound levels.
- 2026-10-22 Small fixes (`8c2017e`): the karaoke mic faces the singer, no mic prompt while on stage,
  bar stools face the counter straight on (they faced its middle).

## Done (2026-10-22: bar games batch)
- 2026-10-22 Review fixes for the batch (independent review of `6026818..3f689ad`):
  - **Bug fixes:**
    - a client that never joined could take the darts board and leave a nameless turn that broke every
      chalkboard until a restart;
    - made-up room ids could fill the 32-id cap of darts, graffiti and Pong (now only the real rooms,
      `ROOM_IDS` in `server/config.js`);
    - every dart leaked its geometry and materials (now shared);
    - a throw the server dropped for arriving early still counted on the client, which locked the thrower
      in (throws now count on the server's confirmation);
    - `drinkOrder {drink: 'constructor'}` was accepted;
    - the drunk slur garbled `/` commands;
    - a full graffiti wall redrew on every stroke (now every 200 segments).
  - **Verified:** from a raw socket, unjoined `dartsStart`/`pongJoin`, fake room ids, a `constructor` drink
    and an unknown darts room are all rejected (no state in the join snapshots); in-app, 6 rapid throws
    give exactly 3 darts, the turn ends and the view comes back; Pong join/leave still work; no errors.
- 2026-10-22 Two-player Pong:
  - **Bug fix:** `WebSocketManager.send` let a `type` inside the data override the message type, so Pong's
    messages never arrived as sent; `type` now always wins. The old relay (`arcadeState`/`arcadeUpdate`)
    is gone.
  - **Rebuilt:** the server owns who plays each room's machine (`server/features/pong.js`); player 1's
    client runs the game per second and sends 20 snapshots/s, player 2 sends its paddle, watchers draw the
    snapshots. Countdown, first to 5, angle by hit spot, Esc to leave, names on the screen.
  - **Verified in-app with two clients:** F → player 1 vs CPU with the play hint; the second client watches
    the live match (0-1, ball moving), sees "Retar a …", joins → both in a 1 vs 1 countdown; its paddle
    (up 0.7 s → y 40) reaches the host; scores agree (3-0); the match ends 5-0, both go idle and the play
    mode is released; Esc mid-match frees it; screenshot of the live screen; no errors.
  - **Not judged:** smoothness over a real network, difficulty.
- 2026-10-22 Karaoke stage:
  - **Stage** in front of each projector: low platform, mic stand, stage light that fades in while anyone
    is up (worked out from positions, no server state). F at the mic puts you on stage facing the room.
  - **Voice:** a singer is heard at about full volume anywhere in that bar (ref distance 25 instead of 4),
    and normally from outside. The projector panel links to a YouTube karaoke search.
  - **Verified in-app with two clients:** F at the mic → on stage at y 1.25, light at full; the second
    client sees the singer on stage and the light on (the other bar's stays off); a stand-in voice entry
    switches to ref 25 inside the bar and back to 4 from the street; screenshot of the stage; no errors.
  - **Not judged:** real singing over voice chat (needs two mics), loudness against the projector.
- 2026-10-22 Bathroom graffiti:
  - **Wall:** the inside of the cubicle's partition facing the bar is drawable. F → a panel showing the
    wall's own canvas (6 colors, 🧽 eraser, 3 sizes, mouse/pen/touch). Shared live, last 3000 segments per
    wall kept in server memory and sent to late joiners.
  - **Verified in-app with two clients:** F inside facing the wall shows "Pintar en la pared" and opens
    the panel; a drawn face + letter (57 segments) shows in the panel and on the wall (screenshot), the
    second client gets all 57, and again after a reload; malformed batches (out-of-range coordinates,
    bad color, non-array, bad room id, a bad segment mixed with a good one) only let the good segment
    through; walking out closes the panel; no errors.
  - **Not judged:** drawing feel, touch on a phone.
- 2026-10-22 Darts:
  - **Board** on each bar's right wall past the projector, a yellow throw line and a chalkboard (thrower's
    darts, last 6 turns, day's best). F at the line takes the board; a close aiming view, the mouse aims
    a swaying crosshair (wider when drunk), click/Space throws 3 darts, Esc leaves.
  - **Scoring on the server only** (sectors, doubles, triples, 25, bull 50).
  - **Verified:** scoring asserts for bull, 25, T20, D6, 11, 3 and the 5/1 sector edges, plus a wrong
    expectation that fails; in-app with two clients: F at the line enters (hint "Jugar a los dardos"), 3
    throws score 5, 5, 12 = 22 into history and best, the turn ends after 2.5 s and the camera comes back;
    the second client sees the darts stuck, gets "Está tirando…" and can't take the board; Esc mid-turn
    frees it; screenshots of the aiming view and the corner; no errors.
  - **Not judged:** the difficulty, the darts' look in flight, the sounds.
- 2026-10-22 Bar service and drunkenness:
  - **Tap and drinks:** a beer tap at the right end of each counter; F → Caña, Vino, Chupito, Cubata,
    Café, Refresco. The drink shows in your hand (new hand items: shot glass, cubata, coffee cup, soda
    can) and B sips it (3 sips, positional sip sound).
  - **Drunk level** 0..6 on the server, decaying 1 per 2 min; from level 1.5 the camera sways and rolls,
    walking weaves, from 2 the chat slurs, from 3 a "🍺 Borracho/a" tag shows to everyone. Coffee sobers.
  - **Verified in-app with two clients:** F at the tap picks it (not the stool) and opens the menu; a
    cubata + 3 sips → level 1.98 and the hand empties; at level 3.4 the second client sees the wine in
    the first player's hand bone and the tag, and the camera roll shows in a screenshot; slur samples
    read OK (fixed a swap that moved spaces); no console or server errors.
  - **Not judged:** how the effects feel, the drinks' look in the hand.

## Done (2026-10-22: bathroom)
- 2026-10-22 Toilet seated pose and the camera gap:
  - **Seated pose:** pooping sits you properly, with hips on the seat and feet forward and up (a procedural
    pose on the foot bones), and everyone sees it.
  - **Bug fix:** the camera escaped the bathroom over the door, because the lintel wasn't a camera occluder.
    Verified with a sweep of 4,410 camera positions from 6 spots inside: 0 escapes. With the lintel removed,
    the same sweep gives 39, so the test can fail.
  - **Also verified:** the pose locally and on a second client (feet at z 0.36, toes 0.48 forward), and a
    front screenshot.
- 2026-10-22 Bathroom and bar tweaks:
  - **Bathroom:**
    - the flush is quieter and the latch clicks;
    - the toilet is centered on its wall and 25% bigger;
    - the cubicle has a ceiling, and the camera collides with its walls, ceiling and closed door;
    - the menu says "¿Qué vas a hacer, guarro?" with Mear / Cagar;
    - the shame tag text is smaller (64 px, was 72);
    - three paintings over the cubicle were raised to clear the ceiling.
  - **Bar:**
    - the counter is a platform you can jump onto;
    - the "Gamedev MV" sign moved from the counter to the back wall, above the paintings, and got bigger.
  - **Verified in-app:**
    - a jump lands on the counter (y 2.3), and walking into it still blocks;
    - the camera stays inside the cubicle below the ceiling, and stops at the wall from outside;
    - you sit on the toilet at its new spot (z 7.5, y 1.1);
    - the latch clicks on each toggle;
    - the new labels show;
    - screenshots of the toilet and the sign.
- 2026-10-22 Bathroom in each bar (plan `Docs/Plans done/2026-10-22-bathroom-plan.md`):
  - **Features:** door with latch and Libre/Ocupado sign, toilet (pee/poo with sounds and bowl visuals),
    flush, sink, mirror, air freshener, its own light and switch, the 10-min stink, and dirty-hands shame
    (lines + tag) until washing.
  - **Bug fix:** an invisible toilet seat from an old `level.json` group was sitting next to the Vircon32.
  - **Verified in-app with two clients:**
    - door and latch sync, and a latched door is refused to the other player;
    - pee stands you at the bowl with yellow water, poo sits you with a 💩 swirl, haze and flies;
    - flush empties the bowl; the freshener ends the stink and shows the spray;
    - shame appears outside and not inside, and washing clears it;
    - the light syncs and darkens the inside; the mirror reflects, only for whoever is inside.
  - **Not judged:** sound levels and the look at play distance.

## Done (2026-10-21: car, appearance, interactions, controls)
- 2026-10-21 Car, Pokebonk, small fixes (plan `Docs/Plans done/2026-10-21-car-pokebonk-plan.md`):
  - **Chairs:** they faced sideways and now face their table (verified for all 24).
  - **Jump:** 1.43 high and 0.6 s in the air.
  - **Chat:** Enter focuses it.
  - **Cabinets:** the Vircon32 moved to x 12.5, and a Pokebonk cabinet plays the site on its screen
    (verified: it loads in the frame, and Salir restores everything). The Vircon32 still plays.
  - **Smoke car** (verified with two clients):
    - countdown 5→3, then smoke and hiss;
    - fade at 3 s, and the two passengers land at different spots in Desarrollo;
    - the seats are freed.
  - **Not judged:** the look of the smoke and car, the hiss volume, and Pokebonk's playability on the
    cabinet.
- 2026-10-21 Appearance, part 1 (plan `Docs/Plans done/2026-10-21-appearance-plan.md`):
  - **Items:** 27 accessories built in code: 13 hats (cap, top hat, viking helmet, crown, beret, gamer
    headset, mushroom, ? block, halo, horns, beer helmet, pirate hat, chef hat), 6 face items, and 8 hand
    items (beer, wine, bottle, tortilla pincho, gamepad, pixel sword, mic, 1UP mushroom).
  - **Also:** a color tint, a size slider and name colors; the 👤 menu has tabs. Everything is saved and
    synced.
  - **Verified in-app:**
    - items on the bones of pj, pj2, pj3, pj4, pj5 and pj6, checked by eye on screenshots (a mustache and
      the chicken/Santa hat heights were fixed);
    - a second client sees crown + monocle + gamepad + tint live;
    - the appearance comes back after a reload;
    - the server shape check drops bad ids and colors.
  - **Not judged:** item fit and feel at play distance.
  - **Next step:** part 2, more characters (find the asset pack and its license) and per-part colors.
- 2026-10-21 Interactions, tables, lights (plan `Docs/Plans done/2026-10-21-interactions-tables-lights-plan.md`):
  - **F everywhere:** F works for everything, and the target is the nearest thing in front of you.
  - **Chairs:** they're seats now, at chair height, facing the table.
  - **Running:** Shift (5.5 units/s).
  - **Tables:** you can stand on them, and all other colliders block at any height.
  - **Empty rooms:** their radio and projector pause after 30 s and resume live.
  - **Light switches:** normal / low / disco, shared per room.
  - **Bug fixes:** stools and chairs never highlighted on hover; jumping onto a table landed you inside
    it; a jump could carry you over the bar or a fence.
  - **Verified in-app:**
    - F hints for chair, stool, radio (when facing it), Pong, Snake, projector, door, Vircon32, the three
      switches, and nothing in open space;
    - Shift: 5.1 units in the first second;
    - you can't walk through a table; jumping onto one stands you at y 2.03, and walking off drops you
      to the floor;
    - jumping at the bar doesn't land you on it;
    - a chair sits you at y 1 facing the table;
    - the radio goes dormant 30 s after the room empties and comes back live on entry (projector logic
      checked with a stub player; the in-app browser's YouTube player never became ready);
    - switches sync between two clients, a late joiner gets the snapshot, and the lighting follows
      (low: ambient 0.18 warm; disco: three moving colored lights; all off: dark).
  - **Not judged:** the look and feel.
- 2026-10-21 Controls and movement (`feature/controls-and-movement`):
  - **Controls:** Q/E rotate the camera, F interacts (E did before), a right click opens the emojis at the
    cursor (a right drag still rotates), and a ❔ button lists every control. *Guardar* closes the 👤 menu,
    and V talks while playing the Vircon32. Each radio shows "📻 station" above it.
  - **Movement:**
    - per second instead of per frame, so the speed was frame-rate dependent before;
    - acceleration and deceleration, smooth turning;
    - sliding along walls, plus a door-frame assist;
    - a collision box of 0.8 instead of 1.0;
    - position sent at most 20/s instead of every frame;
    - other players smoothed per second, with smooth turning.
  - **Bug fix:** every collider's box was recomputed on every collision check and every frame. Now
    1000 checks take 0.8 ms.
  - **Bug fix:** Space typed in the chat made you jump.
  - **Verified in-app:**
    - 1 s of walking = 2.98 / 2.96 / 2.94 units at 30 / 60 / 144 fps;
    - a diagonal into a wall slides; straight into the door frame 0.2 off-center eases through; head-on
      into a wall stops;
    - Q/E rotate and are ignored while typing in the chat;
    - a right click opens the emojis at the cursor, and a right drag rotates without opening them;
    - E no longer interacts and F does (hint "F · Cerrar puerta");
    - the ❔ panel opens and fits at 375 px;
    - *Guardar* closes the menu;
    - V inside the emulator starts and stops talking;
    - the radio label is readable;
    - a second client sees the moved player converge, rotation included.
  - **Not judged:** the feel. That's for Borja.

## Done (2026-10-21: spectating, direct links)
- 2026-10-21 Vircon32 spectating + 🕹️ Arcade slider (plan `Docs/Plans done/2026-10-21-vircon-spectating-plan.md`):
  - **Who watches:** people within 4.5 of a cabinet see and hear the player's game on its screen (WebRTC
    from the player: canvas at 30 fps capped at 1 Mbps, plus the emulator's audio tap). At most 6
    watchers, nearest first. Bundled games only.
  - **Slider:** the Arcade slider drives the emulator's gain, watched games and Snake/Pong.
  - **Verified (three in-app clients):**
    - B at 4 units gets 640×360 frames advancing at about 30 fps, plus audio packets, and its screen
      shows the game;
    - out of range → idle, and back in → watching again; the player keeps 1 connection, so none leak;
    - Esc → idle; the player's socket dropping ends their game, and the watcher → idle;
    - with the cap set to 1, a nearer C took the slot and B was refused with back-off;
    - an uploaded cart is not watchable;
    - an offer to a ghost cabinet is refused by the server at once;
    - the slider moves the emulator gain and the Snake/Pong master gains.
  - **Not verified:** two real networks or TURN, quality or delay by eye, and the player's frame rate
    while streaming.
  - **Bug fix (old):** the `virconStates` join snapshot never cleared cabinets freed during a reconnect.
- 2026-10-21 Direct links + customization (plan `Docs/Plans done/2026-10-21-direct-join-plan.md`):
  - **Links:** `/<roomId>` skips the start dialog. You see a loading card, then the bar.
  - **First visit:** `Parroquiano NNNN` and a random character, both remembered, plus a one-time
    *¿Quieres personalizar tu personaje?* popup.
  - **👤 menu:** changes nick and character live for everyone.
  - **Shared memory:** `/` pre-fills the remembered nick.
  - **Sound:** on a direct link it starts on the first click or key.
  - **Bug fix:** below ~900 px the 😊/🎙️/⚙️ buttons were off-screen. They now sit in a row above the chat
    input.
  - **Verified (two in-app clients):**
    - production routes (`/Gamedev/`, `/foo` → app; files still served; `/a/b` 404);
    - a fresh `/desarrollo` gives a placeholder and a random model in Desarrollo with no preview canvases;
    - a reload keeps both;
    - `/` shows the dialog pre-filled;
    - `/foo` shows the dialog;
    - the profile functions work with `localStorage` throwing;
    - popup *Sí* opens the menu, and B saw A's new name and model live;
    - an empty nick is ignored, and reopening keeps 6 canvases;
    - the buttons are on screen at 375 and 820 px.
  - **Not verified:** the autoplay unlock, because the in-app browser doesn't block autoplay, so the
    suspended → running path was never exercised.
  - **Fixed after review:**
    - `/gamedev/` redirects to `/gamedev`, and `level.json` plus the bathroom sounds now load from absolute
      paths. Before, a trailing slash gave an empty scene.
    - The audio unlock retries until the context runs.
    - ⚙️ fits on phones.
    - A model change mid-load keeps the latest pick, and the menu previews resize.
    - The popup can't open twice on reconnect.
  - **Bug fix:** every model change kept the previous model attached to the avatar (`Player.loadModel`
    matched it as an undefined "chat sprite"). Verified: after three quick changes, one model is left.

## Done (2026-10-21, before direct links)
- 2026-10-21 Camera controls: middle-drag pans (clamped to 3 units), R resets zoom/angle/pan (also from
  inside the emulator), the wheel zooms only over the 3D view (no zoom while scrolling panels like the
  ROM list). Vircon32 play mode now plays on the arcade: camera locked, screen at ~50% of the view,
  no zoom/rotation. Default radios: Gamedev Rock FM, Desarrollo MegaStar FM. Kiss FM and Hit FM removed
  (their CDN's redirect has no CORS header → silence; the other 11 load with CORS). Verified in-app: wheel over
  the canvas zooms and over the ROM list doesn't, no zoom in play mode, middle-drag pans in and out of
  play mode, R (page and emulator iframe) resets, screenshot shows the cabinet with the screen at about
  half the view, defaults from the server. Feel not judged.
- 2026-10-21 Vircon32: 17 more games, for 21 bundled (~480 MB): Ocean Storm (Jastro's permission), all
  of joyrider3774's licensed games under 100 MB, and six community games. Picker shows each game's size.
  `public/vircon32/roms/LICENSES.md` lists license and source per game.
- 2026-10-21 Vircon32 cabinet in every room (plan `Docs/Plans done/2026-10-21-openmic-board-vircon32.md`):
  web emulator built with emsdk into `public/vircon32/` (`tools/vircon32/build.sh`, own shell), four MIT
  games + upload of your own `.v32`, one player per cabinet (server), game on the cabinet's 3D screen with
  the camera framing it and keyboard in the emulator iframe; Esc leaves. Verified with two in-app clients:
  E/hint/panel, Worm boots on the cabinet screen (BIOS logo seen), real key presses reach the game while
  the avatar stays put, busy refusal, Esc frees, disconnect frees, upload loads the exact file. The pane
  ran at 1.5 fps (throttled), so speed wasn't judged.
- 2026-10-21 The forum TV in each room is now a "who's here" board (players inside that room, 🎙️ when
  talking, counts for the other room/street), computed client-side. Removed the Mediavida scraper:
  `server/forumProxy.js`, `/mv-proxy` + `/proxy-image`, `puppeteer` and `node-fetch`, Chromium in the
  Docker image, Vite proxies. Verified: build, server syntax; in-app (see slice commit).
- 2026-10-21 Open-mic mode for voice (⚙️ checkbox, saved): mic always sent, V/🎙️ toggle mute, 🎙️
  indicator driven by speech detection. Verified with two in-app clients and a gated fake mic: heard with
  no key held, indicator on with speech / off 0.5 s after, mute → silence, back to PTT → silence, saved
  mode reopens the mic on entry. Not tried with a real mic.
- 2026-10-21 Deploy through GHCR + Portainer webhook instead of scp/ssh; app and coturn run as git-ops
  stacks. Removed `deploy/` (remote-deploy.sh, coturn files): the repo no longer needs an SSH key to the
  server, only `PORTAINER_WEBHOOK_URL`. Not run yet against the real server.
- 2026-10-21 Sound: per-player volume sliders (radio/projector/voices) in ⚙️, and radios stop
  downloading when inaudible (estimated gain < -40 dB for 3 s; resume live when audible). Verified
  in-app: gains logged at 5 spots, other bar's radio never loads from inside a bar, resumes from the
  street, slider 0 stops the stream, settings persist across reload.
- 2026-10-21 Bug: arcade intro jingle played on every join (all 4 machines, full volume, plus a 30-45 s
  repeat). Removed the automatic intro; in-game sounds unchanged. Verified: no arcade sound playing after
  join, Snake/Pong still start. `public/assets/sound/arcade/intro.mp3` is now unused.
- 2026-10-21 Removed the El Fary mp3 loop ("Taberna FM"): radios play live stations only; Gamedev
  defaults to LOS40 Classic.
- 2026-10-21 Shared radio (13 live Spanish stations + Taberna FM synced to the server clock, per-room
  station picked by clicking the radio) and a shared YouTube projector on each room's right wall (CSS3D
  iframe behind a hole in the canvas, server-clock sync, pause/resume/stop, volume by distance/walls).
  Branch `feature/radio-projector`, stacked on the TURN branches. Verified with two in-app browser clients:
  live stream samples reach Web Audio (CORS ok), Taberna FM within 40 ms between clients, station change
  synced + chat line, projector join snapshot / pause / resume / stop synced (clients 0.3-1.4 s apart),
  iframe aligned to the screen to the pixel, volume 100 → 3 across distance/doors. Not seen with eyes:
  the screenshot tool can't capture the video itself, and nothing was listened to.

## Done (2026-10-20)
- 2026-10-20 TURN deploy automation: workflow ships `deploy/` and runs `deploy/remote-deploy.sh`; with
  the `TURN_SECRET` secret it starts coturn (own compose project) and injects TURN env into the app via a
  managed compose override, never editing the server's compose file; any TURN problem aborts before
  `compose down`. Verified: workflow YAML parses; script run against a fake `docker` in 9 scenarios (no
  secret / one service / two services ± variable / foreign override / bad secret / compose.yaml / re-run /
  empty host var). Not run on the real server.
- 2026-10-20 Bug (production): voice silent between players on different networks; two tabs on one PC
  worked. Root cause: STUN-only ICE can't cross carrier-grade/strict NATs, so no TURN relay = no path. Fix:
  server issues coturn `use-auth-secret` credentials per user (`TURN_URLS`/`TURN_SECRET`); client gives up
  after 15 s, says so in chat once, shows per-player status in ⚙️. Verified: credentials match `openssl`
  HMAC; local repro (one client restricted to relay-only, no relay) → both sides "sin conexión" + one
  message after retries; normal pair still "conectado"; client receives TURN entry in `init`. coturn itself
  not tested (no Docker here).
- 2026-10-20 Mic settings panel (⚙️): input device dropdown (remembered, live switch via replaceTrack),
  level meter, release-mic button, PTT ignored while typing in form fields. Verified in two in-app browser
  clients with two fake mics (440/880 Hz tones): device names hidden until permission, listener's peak moves
  445 → 879 Hz on a mid-talk switch with no reconnect, old track stopped, choice saved and reused after
  release, meter fills while not talking. Real devices not tested.
- 2026-10-20 Modular refactor (behavior unchanged): server split into `server/` (Hub + one module per
  feature), client gets `InteractionSystem` + `src/interactions/`, `StartScreen`, `DoorSync`, transport-only
  `WebSocketManager`. Fixed on the way: `ModelSelector.init()` ran twice (12 preview WebGL contexts instead
  of 6). Docs: Architecture.md rewritten short, details moved to Systems.md. Verified: build; server smoke
  test over ws; two in-app browser clients: join, chat both ways, door via E + hint + sync, sit, radio,
  arcade range message, voice connect + PTT tone received/stopped, no console errors.
- 2026-10-20 Push-to-talk proximity voice chat (WebRTC mesh, signaling over the game WS), plan
  `Docs/Plans done/2026-10-20-voice-chat.md`. Verified with two in-app browser clients and a fake mic (a
  440 Hz tone): peers connect, the tone reaches the listener's audio graph only while PTT is held, 🎙️ sprite
  follows, occlusion levels for 6 positions/door combos, peers cleaned up on leave. Real mic not tested.
- 2026-10-20 Security: WS handler no longer crashes on malformed/partial frames (try/catch, field checks,
  safe user lookups), usernames/chat/emoji clamped server-side, chat history capped on join/leave too, chat
  XSS fixed (`textContent`). Verified: `npm run build`; ws script sending 17 bad frames (old server dies on
  `{"type":"userChat"}`, new one stays up); in-app browser with `<i>Pepe</i>` name + `<img onerror>` message
  renders as text, no alert.
- 2026-10-20 Repo docs: Architecture, Protocol, CLAUDE.md, this handover.
- 2026-10-20 Rooms + street + doors + audio occlusion (plan: `Docs/Plans done/2026-10-20-rooms-and-doors.md`).
  Verified in the in-app browser with the real server: spawn in each room, walking blocked by closed doors /
  fences, walking out through open doors, door click/`E`/range, door sync between 2 clients + late-join
  snapshot, stool facing in the rotated room, occlusion levels per position. Audio not listened to.
