# Pending user checks

Things only a human can judge. Run `npm run dev`, open http://localhost:5148 (two browser windows for
multiplayer checks). Delete items once resolved; turn notes into tasks in HANDOVER.md.

- [ ] **Muffled music from outside.** Enter Gamedev, wait for El Fary, walk out (door open) into the street,
      then close the door (`E`) and walk across to Desarrollo's door. Expected: clear inside; slightly dull
      with the door open; clearly muffled (bassy, quieter) with it closed; smooth transitions, no clicks.
      Tune `OCCLUSION_LEVELS` in `src/world/Radio.js` if it feels off.
- [ ] **Two radios.** Both bars play the same song, unsynced. Inside one bar, is the other one audible
      enough to be annoying? (If yes: lower the `closed` gain or give Desarrollo its own track.)
- [ ] **Door feel.** Swing speed (`SWING_SPEED` in `Door.js`), interaction range 3, hint text position.
      Click the door and press `E`; both should work, far clicks say "¡Acércate más a la puerta!".
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
- [ ] **Vircon32 cabinet** (back-right corner of each bar). Walk up, `E` or click → pick a game → the camera
      frames the cabinet and the game runs on its screen. Check: speed/smoothness in a normal browser
      window, sound, all controls (arrows, X Z S A, Q W, Enter), Esc returns you to the bar. A second
      player gets "ya está jugando"; the cabinet shows "🎮 name · game" to others. Try *Cargar mi .v32*
      with a file of your own. Clicking the chat while playing still lets you type?
