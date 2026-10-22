# Pending user checks

Things only a human can judge. Run `npm run dev`, open http://localhost:5148 (two browser windows for
multiplayer checks). Delete items once resolved; turn notes into tasks in HANDOVER.md.

- [ ] **Muffled music from outside.** Enter Gamedev, wait for El Fary, walk out (door open) onto the plaza,
      then close the door (`F`) and walk across to Desarrollo's door. Expected: clear inside; slightly dull
      with the door open; clearly muffled (bassy, quieter) with it closed; smooth transitions, no clicks.
      Tune `OCCLUSION_LEVELS` in `src/world/Radio.js` if it feels off.
- [ ] **Two radios.** Both bars play the same song, unsynced. Inside one bar, is the other one audible
      enough to be annoying? (If yes: lower the `closed` gain or give Desarrollo its own track.)
- [ ] **Door feel.** Swing speed (`SWING_SPEED` in `Door.js`), interaction range 3, hint text position.
      Click the door and press `F`; both should work, far clicks say "¡Acércate más a la puerta!".
- [ ] **Door sync.** Window A opens a door, window B sees it swing. Join a third window late: doors that
      are open appear open.
- [ ] **Camera near doors/walls outside.** Walk along both facades and through the doorways rotating the
      camera (right mouse). Expected: camera doesn't end up behind a wall or a closed door.
- [ ] **Room selector.** Layout on desktop and phone width; choice remembered after reload.
- [ ] **"Who's here" board** (front wall, right of the door). Shows everyone inside that bar, 🎙️ while
      they talk, and counts for the other bar / street; updates within ~0.5 s as people walk in and out.
      Readable from the bar?
- [ ] **The plaza** (2026-10-23). Walk around: the plaza, the six small roads, the ring road, the wall at
      the edge, the lamps. Desarrollo is now Gamedev's neighbor (slot 1). Is the plaza too big for two bars
      for now? Walls and furniture in Desarrollo (turned 60°) should block exactly like in Gamedev.
- [ ] **Voice with a real mic.** Two machines (or two browsers with headphones). Hold `V`: first press asks
      for the mic; the other player hears you from your avatar's position and sees 🎙️ over your head.
      Check: latency, volume vs. the radio (`VOICE_REF_DISTANCE`/`VOICE_ROLLOFF` in `VoiceChat.js`),
      echo without headphones, muffling when one of you is outside / behind a closed door.
- [ ] **Voice over the internet (after coturn is deployed, Docs/TURN.md).** Two different homes, plus one
      phone on mobile data. ⚙️ → *Conexiones de voz* shows `conectado` for each other and you hear each
      other. Before TURN (2026-10-20): different networks never connected, two tabs on one PC did.
- [ ] **🎙️ button.** Hold it with mouse and touch; releasing anywhere stops talking.
- [ ] **Mic settings (⚙️).** With 2+ real mics (e.g. webcam + headset): the dropdown lists them by name
      after permission, the meter moves when you speak, switching while someone listens changes what they
      hear without dropping, *Desactivar micrófono* turns off the browser's mic indicator, choice survives reload.
- [ ] **Shared radio.** Two players in the same bar: click the radio, pick a station; both hear it
      switch (📻 line in chat). Check each station plays (list in `src/audio/radioStations.js`), volume vs.
      voices, muffling from the street, "Silenciar para mí".
- [ ] **Projector.** Click the right-wall screen, paste a YouTube link: everyone in the bar sees it at the
      same moment (±1-2 s), pause/resume/off from either side, a late joiner jumps to the right spot.
      Check: the video looks right on the wall from different angles, players walking in front cover it,
      volume drops with distance and closed doors, a non-embeddable video shows an error in chat.
- [ ] **Front-wall paintings.** The 4 paintings from the right wall are now left of the door. OK there?
- [ ] **Volume sliders (⚙️).** Radio / projector / voices sliders change what you hear right away and are
      kept after reload. Radio at 0 (or *Silenciar para mí*) stops its download after ~3 s.
- [ ] **Far radios stop.** From inside one bar with doors closed, the other bar's radio shouldn't be
      audible at all (it isn't even downloaded). Walking out to the street brings it back within ~0.25 s,
      live. Does the cut-off point (-40 dB) feel right, or is it noticeable when it stops/starts?
- [ ] **Open mic (⚙️ → Micrófono abierto).** Others hear you without holding V; 🎙️ over your head only
      while you speak (not with background noise). V / 🎙️ mutes (🔇) and unmutes. Kept after reload.
      Is the speech threshold right for your mic, or does the indicator flicker / miss quiet speech?
- [ ] **Vircon32 cabinet** (back-right corner of each bar). Walk up, `F` or click → pick a game → the camera
      frames the cabinet and the game runs on its screen. Check: speed/smoothness in a normal browser
      window, sound, all controls (arrows, X Z S A, Q W, Enter), Esc returns you to the bar. A second
      player gets "ya está jugando"; the cabinet shows "🎮 name · game" to others. Try *Cargar mi .v32*
      with a file of your own. Clicking the chat while playing still lets you type?
- [ ] **Direct links.** Open http://localhost:5148/desarrollo in a private window (and on a phone).
      Expected: the loading card, then Desarrollo; the popup *¿Quieres personalizar tu personaje?* once;
      the radio starts on your first click or key. Reload: no popup, same nick and character. Is the
      loading card too plain?
- [ ] **👤 menu.** Change the character and nick with a friend watching: they see it at once. On a phone,
      do the tiles fit, and are the buttons above the chat input easy to hit?
- [ ] **Watching the arcade.** Two machines (ideally different homes). A plays a bundled game; B walks up
      to the cabinet. Expected: within ~1-2 s the game appears on B's cabinet screen with its sound coming
      from the machine; B walking away (past ~4.5) brings back the "🎮 A · game" screen; A's Esc does too.
      Judge: delay, picture quality, whether A's game slows down while streaming, A's upload on a home
      connection, and whether 4.5 is the right "gathered round" distance (`WATCH_DISTANCE` in
      `src/vircon/VirconSpectating.js`).
- [ ] **🕹️ Arcade slider (⚙️).** Changes the Vircon32 sound while you play, a watched game's sound, and
      Snake/Pong sounds; kept after reload.
- [ ] **Smoke car** (on the plaza, by the road between the two bars). Two players click it: countdown 🚗💨 5…1, smoke fills
      the cabin and leaks out, hiss, fade to black, each of you wakes up somewhere different. Does the
      smoke look good from outside too? Is the hiss too loud or too quiet? Timing OK?
- [ ] **Pokebonk cabinet** (next to the Vircon32). Click it: the game shows on its screen and takes mouse
      and keyboard; *✕ Salir* returns you to the bar. If the site refuses to load in the frame, try
      *↗ Abrir en otra pestaña*. Is the screen big enough to play this way?
- [ ] **Chairs and jump.** Chairs face their table. The jump is shorter and snappier (still reaches tables?).
      Enter starts typing in the chat.
- [ ] **Accessories** (👤 → Accesorios / Color). Try hats, face items and hand items on all six
      characters. Do they sit right (especially hats on the chicken, officer and Santa, which have their
      own headgear)? Too big or too small? Hand items while walking? Does the tint look good, and is the
      size slider range OK? A friend should see everything live. Tune per character in
      `src/appearance/Accessories.js` (`HEADS`) and per item in `items.js`.
- [ ] **Bathroom** (front-left corner of each bar). With a friend:
      - Open the door, go in, latch it: your friend can't open it, and the sign says Ocupado.
      - Pee (stand) and poo (sit): sounds, bowl visuals, the stink haze and flies.
      - Flush, the air freshener, the light switch (dark inside when off), the mirror.
      - Leave without washing: green lines at your hands and the shame tag. Washing clears it.
      - Judge: sound volumes (pee/flush, which was lowered, fart, latch click), haze density, room size for
        3 people, how the cubicle looks from the bar, the camera inside (under the ceiling).
- [ ] **Drinks.** At the tap (right end of the counter), F → order each drink: is it visible in the
      hand on every character, and does it look right? Drink with B: the sip sound, then the glass goes
      after 3 sips. Order cubatas and shots until the level passes 3: does the camera sway and walking
      weave feel funny rather than sickening (tune in `Camera.placeCamera` and
      `LocalPlayer.getInputDirection`)? Is the chat slur readable? A friend sees your drink and the
      "🍺 Borracho/a" tag. A coffee sobers you up a bit; the effects fade within ~2 min per level.
- [ ] **Darts** (right wall, next to the projector). F at the yellow line: the close aiming view, the
      crosshair sway (sober and drunk), click or Space to throw. Do the darts read well on the board and in
      flight? Is it too easy or too hard (`SWAY`, `DRUNK_SWAY`, `RELEASE_JITTER` in
      `src/bar/DartsSync.js`)? The thunk and whoosh sounds. A friend can't take the board while you throw,
      sees your darts fly and land, and the chalkboard shows both of your turns.
- [ ] **Bathroom graffiti.** Inside the cubicle, F facing the wall on the bar side → the drawing panel.
      Draw with the mouse (and on a phone with a finger): smooth lines, colors, sizes, the 🧽 eraser. A
      friend sees it on the wall as you draw, and after reloading. Is the wall big enough, is the panel
      comfortable, and do you want a "clear the wall" button (and who could use it)?
- [ ] **Karaoke.** Projector → "🎤 Buscar karaoke en YouTube", paste a lyrics video. F at the mic (or
      jump onto the stage): the stage light comes on. With a friend at the far end of the bar, hold V and
      sing: are you loud and clear everywhere inside, and normal again once you step off? Is it too loud
      over the projector's sound? From the street, it should sound like any voice in the bar. Does the
      singer block the lyrics too much?
- [ ] **Pong for two** (rebuilt 2026-10-22). One of you F at the Pong cabinet (vs the CPU), the other F
      to challenge: the match restarts 1 vs 1 after 3 s. Is it smooth for both, including player 2 on a
      slower connection? Speed, bounce angles and the CPU's level OK (top of `src/world/ArcadePong.js`)? A
      third player only watches; Esc leaves; the end screen frees the machine after 4 s.
- [ ] **Time and weather.** Visit by day and by night (Madrid time): the sky, how dark the street is at
      night and whether the lamp posts help, the clock above the door. To see weather without waiting
      for it, in the browser console: `Object.assign(game.weather.state, { code: 95 })` (storm; 61 rain,
      73 snow, 45 fog, 0 clear). Rain sound volume outside/inside, thunder volume, snow look.
- [ ] **Tragaperras** (left wall). F pulls the lever: do the reels, sounds and jingles feel like a
      tragaperras? Are the video-game memes (Leeroy Jenkins, barrel roll, YOU DIED, take this, 1UP, cake,
      press F, GG EZ, WASTED) readable from a step back, and funny enough? Too stingy or too
      generous (~88%)? A friend nearby sees the same spin.
- [ ] **Futbolín** (left side of the bar). With a friend, one on each long side, F: the camera view
      from your side, W/S to slide the rods, Space/click to kick. Is the ball speed, kick strength and rod
      speed fun (`server/features/foosball.js` top, `INPUT_SPEED` in `FoosballSync.js`)? Does it feel laggy
      over the internet? Try 2 vs 2 (back/front split), practice alone, a goal and a full match to 5.
- [ ] **Powder table** (bathroom, corner right of the mirror). F → Esnifar: the sniff + power-up sound,
      the lean-in, the line gone for 45 s for everyone. Is the power-up loud enough / too long?
- [ ] **Right-click menu and animations.** Right click (no drag): Emojis / Animaciones. Try every
      animation on several characters (and sizes) with a friend watching: do they read as what they are
      (sexy dance, push-ups, paja, beso, escupir, animar, brindar)? Too subtle / too much? Walking stops
      them. Tune the poses in `src/entities/Gestures.js` (avatar-space numbers per gesture).
- [ ] **Your clock.** In a normal browser the bar asks for your location once: allow it and the clock
      above the door shows your local time, your weather and "Tu zona"; deny it and it shows Madrid's
      (Las Palmas in the Canaries). Is asking on entry OK, or should it wait for something?
- [ ] **Light through the door.** At night, from the street, open a bar's door: the inside should look
      lit (and dark again when the door closes). From inside, the street through the open door should
      look like night. Too bright or too dim (`DOOR_LIGHT_INTENSITY` in `RoomLighting.js`)?
- [ ] **Bar counter and sign** (moved back 2026-10-23). The shelf and arcades are against the back wall, the
      counter, stools, tap and radio moved back with them, paintings and sign higher. Room in front of the
      counter OK? Jump onto the counter; is the sign readable from the entrance?
- [ ] **Seated pose everywhere.** Sit on a stool, a chair and in the car with a friend watching: feet
      forward like on the toilet. Does it look right at each height?
- [ ] **Light switches** (by each door, inside). Try normal / low / disco and their combinations with a
      friend: both of you see the same thing. Does low look cosy, all off dark enough, disco fun
      (`RoomLighting.js`: `LEVELS`, `DISCO_*`)? Frame rate with disco on?
- [ ] **Tables and chairs.** Jump onto a table and walk around on it, then off; you can't walk through one.
      Sit on a chair (click or F): lower than a stool, facing the table. Shift runs: speed OK?
- [ ] **F everywhere.** F near a chair, stool, the radio (facing it), the projector, Pong, Snake and a
      light switch: the hint names the right thing.
- [ ] **Empty bar pauses.** From Gamedev with the doors open, Desarrollo's radio is faintly audible; 30 s
      after the last person leaves Desarrollo it goes quiet, and walking in brings it back live.
- [ ] **Movement feel** (reworked 2026-10-21). Walk around both bars, through the doors and along the
      walls. Expected: the same speed whatever the frame rate, a short ramp up and down instead of an
      instant start/stop, smooth turning, sliding along walls, and getting eased through a door when
      slightly off-center. Tune at the top of `src/entities/LocalPlayer.js` (`WALK_SPEED`, `ACCELERATION`,
      `DECELERATION`, `TURN_RATE`, `CORNER_PROBES`). Other players should look smooth too.
- [ ] **New controls.** Q/E rotate the camera (speed OK?), F interacts, a right click opens the emojis at
      the cursor (a right drag still rotates), ❔ lists the controls, *Guardar* closes 👤, and V talks while
      playing the Vircon32.
- [ ] **Radio label.** "📻 station" above each radio is readable from across the bar, and changes when
      someone switches station.
- [ ] **Vircon32 play camera.** Start a game: the cabinet stays visible with its screen at about half
      the view (not fullscreen), the wheel doesn't zoom (also while scrolling the ROM list), middle-drag
      pans, R re-centers. Is the framing comfortable to play on desktop and on a narrow window? Tune
      `PLAY_VIEW_FILL`/`PLAY_VIEW_RISE` in `VirconCabinet.js`.
- [ ] **Camera pan and reset (whole bar).** Middle-drag (wheel click) shifts the view, R brings back the
      default zoom, angle (facing the bar) and no pan. R typed in the chat does nothing. Pan speed OK?
