# Handover

## Start here
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

## Decisions to review
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
