# Handover archive

Full entries moved out of HANDOVER.md (one-line summaries stay there).

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
