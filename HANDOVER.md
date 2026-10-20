# Handover

## Start here
2026-10-20. Two bars (Gamedev, Desarrollo) facing each other across a street, room selector on the start
screen, interactive server-synced front doors, muffled music from outside. Work is on branch
`feature/rooms-and-doors` (PR to `Jastro/gamedevbar` from the `borjafac` fork). Docs:
[Docs/Architecture.md](Docs/Architecture.md), [Docs/Protocol.md](Docs/Protocol.md).
Next step: Borja runs through [Docs/PendingUserChecks.md](Docs/PendingUserChecks.md), then merge.

## Done
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
- Doors centered on the front wall, rooms straight across the street (per Borja, 2026-10-20). The forum TV
  moved from x = 1.09 to x = 7 on the same wall to make room for the door.
- Desarrollo is a copy without the paintings: own forum TV (same thread), own radio (same song), own local
  arcades.
- Chat, `/furbo` and Snake high scores stay global across rooms.
- No roofs (camera would clip on them); exterior is minimal.
- Git: per the request, work went to a branch + PR instead of straight to `main`.

## Open questions
- Should chat become per-room (or show which bar someone is in)?
- Desarrollo's identity: different decoration, music, TV feed (another subforum thread)?

## Next
- Pong sync (message `type` overwritten in `WebSocketManager.send`).
- Remove duplicated geometry (level.json vs World vs Bar).
