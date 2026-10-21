# Open mic, "who's here" board, Vircon32 cabinet

Status: in progress 2026-10-21 (branch `feature/openmic-board-vircon32`).

## Goal
1. Voice: a setting for an always-open mic instead of push-to-talk.
2. The forum TV in each room (its scraper rarely worked) becomes a board listing who is online and in
   that room. The Mediavida scraper (Puppeteer + Chromium) is removed.
3. A Vircon32 arcade cabinet in every room. The game plays on the cabinet's 3D screen, with a ROM selector
   (curated free games plus loading your own `.v32`).

## Design
- **[LOCKED]** Open mic: a ⚙️ checkbox, saved per player. When it's on, the mic track stays enabled, and
  the 🎙️ button / `V` toggle mute instead of push-to-talk. The talking indicator follows actual speech (a
  level detector with a short hold), so 🎙️ only shows while you speak.
- **[LOCKED]** Board: computed on each client from known player positions (`World.getRoomAt`), so no
  server change. It shows the room's people (name + 🎙️ when talking) plus counts for the other room and the
  street. It redraws only when something changes.
- **[LOCKED]** Scraper removal: `server/forumProxy.js`, the `/mv-proxy` + `/proxy-image` routes, the
  `puppeteer` dependency, the Chromium packages/env in `Dockerfile`, the Vite proxy entries, and the
  client fetch/scroll code in `Bar.js`.
- **[LOCKED]** Vircon32 emulator: [joyrider3774/Vircon32_WebEmulator](https://github.com/joyrider3774/Vircon32_WebEmulator)
  (Emscripten port of the official emulator, BSD-3), built locally once with emsdk. The output goes
  into `public/vircon32/`, and the source commit is recorded. A ROM is chosen with `?rom=`.
- **[LOCKED]** Cabinet screen: the same CSS3D-under-canvas technique as the projector. The emulator
  iframe is the screen.
- **[LOCKED]** Playing: click the cabinet when close → ROM panel → pick/upload → *play mode*:
  - the camera frames the screen;
  - the avatar stands in front;
  - keyboard focus goes into the (same-origin) iframe, so the game gets keys and the bar doesn't;
  - Esc exits and unloads the emulator.
- **[LOCKED]** One player per cabinet. The server keeps `{ playerName, romTitle }` per room and frees it on
  exit/disconnect. Others see "🎮 Ana · Vitris" on the cabinet screen; video isn't streamed to them.
- **[PROPOSAL]** Cabinet position: room-local (11, 2, -8), back-right corner, facing +z. Emulator audio
  isn't positional (only the player hears it).
- **[OPEN → decided by Borja 2026-10-21]** ROMs: only games whose license allows redistribution, each one
  checked and listed with its source/license in `public/vircon32/roms/LICENSES.md`.

## Tasks
1. Open mic. Read: `src/voice/VoiceChat.js`, `src/ui/VoiceUI.js`, `src/ui/VoiceSettingsUI.js`.
   Touches: those + `index.html`, Docs (Systems voice section, PendingUserChecks).
2. Board + scraper removal. Read: `src/world/Bar.js` (createForumTV…), `server/index.js`,
   `server/forumProxy.js`, `Dockerfile`, `vite.config.js`, `package.json`.
   Touches: those, `src/world/PresenceBoard.js` (new), `Environment.js`, Docs.
3. Vircon32 build. Read: the web emulator's BUILD.md, `preload_cartridge.js`, `shell.html`.
   Touches: `public/vircon32/*`, `Docs/Vircon32.md` (new).
4. ROM curation. Touches: `public/vircon32/roms/*`, `roms.json`, `LICENSES.md`.
5. Cabinet + play mode + panel + server occupancy. Read: `src/world/Projector.js` (CSS3D/hole),
   `src/ui/FloatingPanel.js`, `server/features/projector.js`. Touches: `src/world/VirconCabinet.js`,
   `src/world/VirconSync.js`, `src/ui/VirconUI.js`, `src/interactions/virconInteraction.js`,
   `server/features/vircon.js`, `Game.js`, `Environment.js`, `index.html`, Docs.

## Deviations
(none yet)
