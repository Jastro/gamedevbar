# Taberna Virtual (gamedevbar)

Multiplayer Three.js hangout for the Mediavida /gamedev/ community. Client in `src/` (Vite), Node server in
`server/` (Express + `ws`; `server.js` is just the entry). UI text is Spanish.

## Read first
- `HANDOVER.md` – current state and next steps.
- `Docs/Architecture.md` – code map and "how to add a room / clickable / message / server feature".
- `Docs/Systems.md` – rooms layout, doors, audio occlusion, voice chat, known issues.
- `Docs/Protocol.md` – WebSocket messages.
- `Docs/TURN.md` – coturn relay setup on the server (voice between different networks).
- `Docs/Vircon32.md` – Vircon32 cabinet: emulator build (`tools/vircon32/`), ROM licensing rules.

## Run
- `npm install`, then `npm run dev`:
  Vite on 5148, server on 3000. `npm run build` is the only automated check (no tests).
- When a tool injects `PORT` (e.g. preview servers), start the server with `PORT=3000` explicitly, since the
  client always connects to `:3000` in dev.

## Conventions
- Room content is authored in room-local coordinates; placement lives only in `src/world/RoomLayout.js`.
  Compare positions in world space (`Room.toWorld`, `World.getRoomAt`, `getWorldPosition`).
- Anything clickable: `userData.type` on the root group + an interaction in `src/interactions/` (see Architecture.md).
- New shared state goes through the server (see doors: `doorToggle` → `doorState`, snapshot on join), one
  module per feature in `server/features/`.
- New code and comments in US English; keep UI strings in Spanish.
- Deploy is automatic on push to `main` (GitHub Action → Docker over SSH).
