# Pending user checks

Things only a human can judge. Run `npm run dev`, open http://localhost:5148 (two browser windows for
multiplayer checks). Delete items once resolved; turn notes into tasks in HANDOVER.md.

- [ ] **Muffled music from outside.** Enter Gamedev, wait for El Fary, walk out (door open) into the street,
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
- [ ] **Street look.** Exterior is plain (dark ground, fences, neon name signs, no roof). Good enough for now?
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
- [ ] **Smoke car** (street, between the doors). Two players click it: countdown 🚗💨 5…1, smoke fills
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
