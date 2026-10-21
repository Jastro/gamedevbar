# Systems

Detail notes per system. Last updated 2026-10-20. Structure and extension points:
[Architecture.md](Architecture.md). Messages: [Protocol.md](Protocol.md).

## World layout and rooms

All room content is authored in one **room-local frame** (the original bar): x ∈ [-15, 15], z ∈ [-10, 10],
walls 8 high, bar counter at z = -3, back bar at z = -7, front wall at z = +10 with the entrance centered
(x = 0) and the forum TV beside it (x = 7).
`src/world/RoomLayout.js` is the single source of truth for placing rooms:

| Room | Origin (x, z) | Rotation Y | Front door (world) |
|---|---|---|---|
| Gamedev | (0, 0) | 0 | (0, 10) |
| Desarrollo | (0, 34) | π | (0, 24) |

The rooms sit straight across from each other, entrances facing. Street (world): x ∈ [-25, 25], z ∈ [10, 24]. `Street` adds ground, sidewalks, a center line and low fences
on every street edge not covered by a facade, so players can't leave the play area. The soccer stadium lives
at (0, 0, -50) behind Gamedev and is only shown during `/furbo`.

How a room is built (`World.create` → `Environment.create`):
1. `Room` creates a `THREE.Group` at the origin/rotation and resolves its world matrix **before** children are
   added (colliders are `Box3.setFromObject` of world-space geometry).
2. A clone of `level.json`'s "Taberna" group (lights and `FrontWall` stripped by `Scene`; lights are global).
3. `World`: floor, walls (front wall split around the door), bar counter colliders.
4. `Environment`: Bar (sign text per room, forum TV), Furniture, Radio, Paintings (only if the room's
   `paintings` flag isn't `false`; Desarrollo has bare walls), Snake + Pong arcades, Door.
   Builders receive the `Room` as their "scene", so they keep their original local coordinates.

Anything that compares positions must go through world space: `Room.toWorld/toLocal/containsPoint`,
`World.getRoomAt(pos)`, `World.getRoomForObject(obj)`, `getWorldPosition()` for arcades.

To add a room: add an entry to `ROOMS` (non-overlapping footprint; rotations of 0 or π keep facades on the
street edges that `Street` expects) and extend `STREET` if needed. The selector lists it automatically.

## Doors

`Door` (`src/world/Door.js`): frame, hinged panel (swings inward 90°), outside name sign, and an invisible
doorway box on layer 1 used as the collider (enabled only while closed, so the swinging panel never traps
anyone). If a door closes on a player, `LocalPlayer` lets them move while they overlap a collider, so they can
step out. Closed panels also block the third-person camera (`World.getCameraOccluders`). State is
server-authoritative: `doorToggle` → server flips → `doorState` to everyone; `doorStates` snapshot on join.
Offline (no WS) the client toggles locally.

## Audio

One `AudioListener` on the camera (`Environment.initializeAudio`). Each room's radio (and each remote voice)
is a `PositionalAudio` with an `OcclusionChain` (*low-pass filter → gain*, `src/audio/Occlusion.js`) whose
level `Environment.getOcclusionLevel(sourceRoom, listenerRoom)` picks every frame:

| Listener | Filter cutoff | Extra gain |
|---|---|---|
| Inside that room | 20 kHz | 1.0 |
| Outside, door path open (its door open, and listener's own door open or listener in the street) | 2.5 kHz | 0.8 |
| Outside, any closed door in between | 450 Hz | 0.55 |

Changes are smoothed with `setTargetAtTime` (0.15 s). Values live in `OCCLUSION_LEVELS` in `Occlusion.js`.
Arcade sounds are plain `THREE.Audio` (not positional, not occluded).

## Voice chat (push to talk)

`src/voice/VoiceChat.js` + `VoicePeer.js`, UI in `src/ui/VoiceUI.js`. WebRTC full mesh: every pair of
players has one audio-only `RTCPeerConnection`; the WebSocket server only relays signaling (`voiceSignal`)
and the talking flag (`voiceTalking`). The lower user id of a pair sends the offer. Each connection starts
with one `sendrecv` transceiver; the mic is attached later with `replaceTrack`, so there is no
renegotiation. Hold `V` (or the 🎙️ button) to talk: the first press asks for the mic (HTTPS or localhost
only), later presses just toggle `track.enabled`. Remote voices play as `THREE.PositionalAudio` on the
speaker's avatar through the same `OcclusionChain` as the radios
(`Environment.getOcclusionLevel(speakerRoom, listenerRoom)`). Avatars show a 🎙️ sprite while talking.

Mic settings (⚙️ next to the mic button, `src/ui/VoiceSettingsUI.js`): input device dropdown (names appear
once mic permission is granted; choice saved in `localStorage` `voiceInputDevice` and requested as `ideal`,
so a missing device falls back to the default), a live level meter (fed from a clone of the mic track,
because the real one is muted between presses; the clone is never sent), and *Desactivar micrófono*, which
stops the track so the browser's recording indicator goes away; the next press reopens it. Switching device
mid-call swaps the track on every peer with `replaceTrack`, without reconnecting.

Limits: a mesh costs N-1 connections per player (fine for a bar of ~20); bigger rooms need an SFU.

Networks: STUN alone only connects players whose NATs allow it. Carrier-grade NAT (common in Spain:
Digi, O2, mobile data) and strict routers need the **TURN relay** (coturn, self-hosted). Setup in
[TURN.md](TURN.md). The server adds per-player, short-lived TURN credentials to `init` when `TURN_URLS` +
`TURN_SECRET` are set (`server/config.js`). `ICE_SERVERS` (a JSON array) still replaces the default STUN. A
connection that isn't up within 15 s counts as failed. The player gets one chat message per peer
("No se ha podido conectar la voz con…"), the initiator retries 3 times, and ⚙️ → *Conexiones de voz*
shows each player as conectando / conectado / sin conexión. Embedding in a forum thread needs
`<iframe allow="microphone">` on the embedding page.

## Server state

All in memory, lost on restart, each owned by its feature module in `server/features/`: users (Hub: id,
name, model, position; seat and duel fields added by those features), seats, chat history (last 50), Snake
high scores (top 10), doors (doorId → open). Forum posts cached 30 s, proxied images 5 min
(`server/forumProxy.js`). Message list: see [Protocol.md](Protocol.md).

## Known issues and quirks (found 2026-10-20, not fixed unless noted)

- ~~Server crash on bad input~~ (fixed 2026-10-20): `Hub` parses frames in a try/catch, runs each handler
  inside a try/catch, and features validate/clamp fields (see Protocol.md).
- ~~XSS in chat~~ (fixed 2026-10-20): `ChatUI.addMessage` builds DOM nodes with `textContent`.
- **Pong multiplayer sync is broken**: `WebSocketManager.send(type, data)` builds `{ type, ...data }`, so a
  `data.type` overrides the message type. `arcadeInteraction.js` sends `arcadeState` with `type: 'startGame'` (server sees
  `startGame`, unhandled) and `syncGameState` gets re-broadcast as `arcadeState`, which no client listens to.
  Pong is effectively local-only; each room has its own local Pong and Snake.
- Seat ids are Three.js object ids (client-local), so server seat occupancy is meaningless across clients, and
  no client handles `userSat`/`userStood` (others don't see you sit).
- Duel messages (`duelRequest`...) exist on the server but there is no client UI for them.
- `node-fetch` is a devDependency but `server/forumProxy.js` imports it at request time; the Docker
  image installs production deps only, so image proxying likely fails there (forum text still works).
  Fix: move it to `dependencies` or use Node's built-in `fetch`.
- `window.game` is still used as a global by older modules (Bar, arcades, SoccerGame, ChatUI); new code
  gets `game` passed in.
- Geometry is duplicated: `level.json`, `World` and `Bar` all create floor/walls/bar counter (z-fighting).
- `Bathroom.js` and `Lighting.js` are never used (level.json has an empty Bathroom group). `/proxy-image`
  is unused by the client (avatars go through `/mv-proxy?imageUrl=`).
- The 6 character previews keep their own WebGL contexts and render loops after the game starts.
  (Fixed 2026-10-20: `ModelSelector.init()` ran twice, creating 12.)
- Each room's forum TV polls `/mv-proxy` every 5 s (2 rooms → 2 requests per client per 5 s; server caches).
- Fixed 2026-10-20: server sent the initial position as `{x,y,z}` while clients expect `[x, y, z]`;
  local `system` chat messages rendered as "undefined ...".
