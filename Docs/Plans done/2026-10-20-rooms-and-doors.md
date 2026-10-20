# Rooms, street and doors

Status: done 2026-10-20 (branch `feature/rooms-and-doors`).

## Goal
Room selector with two options (Gamedev, Desarrollo), each spawning in its own physical bar. Desarrollo is
a duplicate of Gamedev placed across a street, entrances facing each other. Interactive doors to go in and
out. Music from a room sounds muffled from outside, on top of distance attenuation.

## Design
- **[LOCKED]** One room-local frame for all content; rooms placed by origin + Y rotation (`RoomLayout.js`).
  Desarrollo = Gamedev rotated π, doors aligned at x = -9, street 14 units wide.
- **[LOCKED]** `level.json` loaded once as a template and cloned per room; lights moved to the scene once.
- **[LOCKED]** Each room gets its own props (bar, TV, radio, arcades, paintings, furniture). Arcades stay
  local-only (Pong sync was already broken, see Architecture.md).
- **[LOCKED]** Door state server-authoritative (`doorToggle` / `doorState` / `doorStates`).
- **[LOCKED]** Audio occlusion per room radio: low-pass + gain by listener location and door states.
- **[PROPOSAL]** Door at x = -9 on the front wall (keeps the forum TV untouched). Click or `E`, range 3.
- **[PROPOSAL]** Chat, soccer and Snake high scores stay global across rooms.

## Tasks
1. Room placement data + `Room` class. Touches: `src/world/RoomLayout.js`, `src/world/Room.js`.
2. Level template per room. Touches: `src/rendering/Scene.js`.
3. Room shells with doorway, street + fences. Touches: `src/world/World.js`, `src/world/Street.js`,
   `src/world/CollisionManager.js` (collider `enabled`).
4. Props per room, doors, occlusion. Touches: `src/world/Environment.js`, `Door.js`, `Radio.js`, `Bar.js`,
   `ArcadePong.js`, `ArcadeSnake.js`.
5. Wiring: selector, spawn, camera occluders, interactions, hint. Touches: `src/core/Game.js`,
   `src/ui/RoomSelector.js`, `index.html`, `src/entities/*`, `src/rendering/Camera.js`,
   `src/network/WebSocketManager.js`.
6. Server door state. Touches: `server.js`.
7. Docs. Touches: `Docs/*`, `HANDOVER.md`, `CLAUDE.md`, `readme.md`.

## Deviations
- Fixed two existing bugs met on the way: server initial position shape (`{x,y,z}` → `[x,y,z]`) and local
  `system` chat messages showing "undefined".
- Spawn camera faces the bar in both rooms (camera yaw = room rotation).
- Added an on-screen hint ("E · Abrir puerta") near doors.
