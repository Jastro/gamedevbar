# Handover

## Start here
2026-10-21. Working toward forum embeds. Two open PRs, stacked: `feature/direct-join` (Jastro/gamedevbar#18)
and `feature/vircon-spectating` (on top of it; merge #18 first). Next: Borja's checks in
`Docs/PendingUserChecks.md` (direct links on a phone, watching the arcade between two homes).

2026-10-20. Two bars (Gamedev, Desarrollo) across a street with synced doors, muffled music, push-to-talk
proximity voice chat with mic settings, and a modular client/server layout (PRs Jastro/gamedevbar#10-#12 merged).
In production, voice failed between different networks: there was no TURN relay. `fix/voice-turn` adds
per-user TURN credentials + connection status/errors, and the coturn setup guide in [Docs/TURN.md](Docs/TURN.md).
Deploy moved to git-ops: this repo builds `ghcr.io/jastro/gamedevbar` and calls a Portainer webhook; the app
and coturn are stacks in the server owner's git-ops repo (Docs/TURN.md).
Next step: Jastro sets up both stacks, the firewall ports and the webhook secret (checklist in
Docs/TURN.md); then retest voice across networks.
Docs: [Architecture](Docs/Architecture.md), [Systems](Docs/Systems.md), [Protocol](Docs/Protocol.md).

## Done
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
- 2026-10-20 (details in [HANDOVER_ARCHIVE.md](HANDOVER_ARCHIVE.md)):
  - TURN deploy automation;
  - voice-over-TURN fix (per-user coturn credentials);
  - mic settings panel;
  - modular refactor;
  - push-to-talk voice chat;
  - WS hardening and the chat XSS fix;
  - repo docs;
  - rooms, street, doors and audio occlusion.

## Decisions to review
- Spectating (away mode, 2026-10-21):
  - **Losing the connection ends your Vircon32 game**, rather than reclaiming the cabinet, because a
    reconnect respawns the avatar anyway. If wrong: a short network blip kicks you out of the game.
  - **`public/vircon32/index.html` audio tap edited by hand** (the same script as `shell.html`), with no
    emsdk rebuild. If wrong: the next rebuild differs, though it should be identical.
  - **Branch stacked on `feature/direct-join`.** Merge #18 first, otherwise the spectating PR also shows
    #18's commits.
- Direct links (away mode, 2026-10-21):
  - **Any way of closing the first-visit popup counts as answered** (✕, Esc, clicking outside). If wrong:
    people who click past it never see it again.
  - **No automated tests.** The repo has no test runner, and adding Vitest is a separate decision; checks
    were done in the in-app browser instead.
- Vircon32 cabinet at room-local (11, 2, -8), back-right corner. Emulator audio is not positional.
- Every licensed game under 100 MB is bundled in git (~480 MB in history and in the Docker image), per
  Borja's "no LFS" rule. If the image size hurts deploys, move the ROMs to a server volume or CDN.
- Doors centered on the front wall, rooms straight across the street (per Borja, 2026-10-20). The board
  moved from x = 1.09 to x = 7 on the same wall to make room for the door.
- Desarrollo is a copy without the paintings: own board, own radio, own local
  arcades.
- Chat, `/furbo` and Snake high scores stay global across rooms.
- No roofs (camera would clip on them); exterior is minimal.
- Git: per the request, work went to a branch + PR instead of straight to `main`.

## Open questions
- Carra's own Vircon32 games (BSD-3) are only on itch.io as zips: download them by hand to add them?
- Should chat become per-room (or show which bar someone is in)?
- Desarrollo's identity: different decoration, default music?

## Next
- Pong sync (message `type` overwritten in `WebSocketManager.send`).
- Remove duplicated geometry (level.json vs World vs Bar).
