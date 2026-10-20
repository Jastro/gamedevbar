# Handover

## Start here
2026-10-20. Two bars (Gamedev, Desarrollo) facing each other across a street, room selector on the start
screen, interactive server-synced front doors, muffled music from outside. Work is on branch
`feature/rooms-and-doors` (PR to `Jastro/gamedevbar` from the `borjafac` fork). Docs:
[Docs/Architecture.md](Docs/Architecture.md), [Docs/Protocol.md](Docs/Protocol.md).
Next step: Borja runs through [Docs/PendingUserChecks.md](Docs/PendingUserChecks.md), then merge.

## Done
- 2026-10-20 Repo docs: Architecture, Protocol, CLAUDE.md, this handover.
- 2026-10-20 Rooms + street + doors + audio occlusion (plan: `Docs/Plans done/2026-10-20-rooms-and-doors.md`).
  Verified in the in-app browser with the real server: spawn in each room, walking blocked by closed doors /
  fences, walking out through open doors, door click/`E`/range, door sync between 2 clients + late-join
  snapshot, stool facing in the rotated room, occlusion levels per position. Audio not listened to.

## Decisions to review
- Door at room-local x = -9 (left of the forum TV), so the rooms are offset along the street (Desarrollo
  origin x = -18) to line the doors up. Cost if wrong: change `FRONT_DOOR.x` / origins in `RoomLayout.js`.
- Desarrollo is a full copy: own forum TV (same thread), own radio (same song), own local arcades.
- Chat, `/furbo` and Snake high scores stay global across rooms.
- No roofs (camera would clip on them); exterior is minimal.
- Git: per the request, work went to a branch + PR instead of straight to `main`.

## Open questions
- Should chat become per-room (or show which bar someone is in)?
- Desarrollo's identity: different decoration, music, TV feed (another subforum thread)?

## Next
- Fix server crash on malformed WS JSON (missing try/catch) and chat XSS (`innerHTML`). See Architecture.md
  "Known issues".
- Pong sync (message `type` overwritten in `WebSocketManager.send`).
- Remove duplicated geometry (level.json vs World vs Bar).
