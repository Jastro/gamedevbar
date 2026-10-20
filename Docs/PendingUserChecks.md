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
- [ ] **Street look.** Exterior is plain (dark ground, fences, neon name signs, no roof). Good enough for now?
