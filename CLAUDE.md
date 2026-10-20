# Taberna Virtual (gamedevbar)

Multiplayer Three.js hangout for the Mediavida /gamedev/ community. Client in `src/` (Vite), Node server in
`server.js` (Express + `ws` + Puppeteer forum scraper). UI text is Spanish.

## Read first
- `HANDOVER.md` – current state and next steps.
- `Docs/Architecture.md` – modules, world layout / rooms, doors, audio, known issues.
- `Docs/Protocol.md` – WebSocket messages.

## Run
- `npm install` (set `PUPPETEER_SKIP_DOWNLOAD=true` to skip the Chromium download), then `npm run dev`:
  Vite on 5148, server on 3000. `npm run build` is the only automated check (no tests).
- When a tool injects `PORT` (e.g. preview servers), start the server with `PORT=3000` explicitly, since the
  client always connects to `:3000` in dev.

## Conventions
- Room content is authored in room-local coordinates; placement lives only in `src/world/RoomLayout.js`.
  Compare positions in world space (`Room.toWorld`, `World.getRoomAt`, `getWorldPosition`).
- Anything clickable: put `userData.type` on the root group and add the type to `HIGHLIGHT_TYPES` in `Game.js`.
- New shared state goes through the server (see doors: `doorToggle` → `doorState`, snapshot on join).
- New code and comments in US English; keep UI strings in Spanish.
- Deploy is automatic on push to `main` (GitHub Action → Docker over SSH).
