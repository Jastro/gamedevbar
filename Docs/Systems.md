# Systems

Detail notes per system. Last updated 2026-10-20. Structure and extension points:
[Architecture.md](Architecture.md). Messages: [Protocol.md](Protocol.md).

## Entry: direct links and customization

- **Two ways in.** `/` shows the start dialog: nick, character, bar. `/<roomId>` (`/gamedev`, `/desarrollo`,
  case and trailing slash ignored) skips it. The server sends `index.html` for any single-segment path.
  Unknown names fall back to the dialog.
- **First visit through a direct link:**
  - `Parroquiano NNNN` and a random character, both saved;
  - after the avatar loads, a one-time popup *¿Quieres personalizar tu personaje?* (any way of closing it
    counts as answered).
- **Shared memory.** Both ways in share the remembered nick and character (`PlayerProfile`, localStorage
  keys `playerName`, `selectedModel`, `customizePromptSeen`). In a cross-site iframe that storage is
  partitioned. That's acceptable until the forum provides identity.
- **👤 menu** (`CustomizeUI`, next to ⚙️):
  - a nick field (*Guardar*/Enter) and the start dialog's character tiles, moved into the panel;
  - previews are created on first open and paused while it's closed;
  - changes go out as `setUsername` → `userUsername` to everyone.
  - The nick field goes away when forum usernames arrive.
- **Sound on direct links.** With no dialog click, the browser keeps audio suspended. The first
  `pointerdown`/`keydown` resumes the context and kicks the radios (`Radio.kick`).

## World layout and rooms

All room content is authored in one **room-local frame** (the original bar): x ∈ [-15, 15], z ∈ [-10, 10],
walls 8 high, bar counter at z = -3, back bar at z = -7, front wall at z = +10 with the entrance centered
(x = 0) and the "who's here" board beside it (x = 7).
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
4. `Environment`: Bar (sign text per room), PresenceBoard, Furniture, Radio, Paintings (only if the room's
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

## Radio (shared stations)

Each room's radio (`src/world/Radio.js`) plays the room's **shared station**: live Spanish internet
radio only (`src/audio/radioStations.js`), so everyone hears the same broadcast (± the browser's buffer).
Defaults: Gamedev Rock FM, Desarrollo MegaStar FM. Kiss FM and Hit FM were dropped (2026-10-21): their
CDN redirects through a hop without CORS headers, so they played silence. The old El Fary mp3 loop was removed (2026-10-21). Clicking a radio opens the station picker (`src/ui/RadioUI.js`). A change goes
`radioSet` → server → `radioState` to everyone, with a 📻 chat line; newcomers get `radioStates`. Rooms
nobody has changed play their `RoomLayout` `radioStation`. *Silenciar para mí* is local.

Playback: a `<audio crossOrigin="anonymous">` element → `PositionalAudio.setMediaElementSource` → the
same `OcclusionChain` as before, so distance and wall muffling still work. **Every station URL must send
CORS headers**, or Web Audio gets silence. The list was checked with curl on 2026-10-20; re-check a station
that goes quiet. Dropped live streams reconnect after 5 s.

**Inaudible radios stop downloading.** Every 250 ms each radio estimates what this player would hear:
the panner's inverse distance falloff (from the camera's `AudioListener`) × the wall/door occlusion gain
× radio volume × the player's radio slider (0 when *Silenciar para mí*). Below 0.01 (-40 dB) for 3 s,
the stream is unloaded. The first check decides at once, so the other bar's radio never starts if you
can't hear it. When it's audible again, it reconnects at the live point. Typical values: own bar ~0.05,
street ~0.011-0.024, the other bar with closed doors ~0.008 (stopped). Each stream is ~128 kbps.

## "Who's here" board

Each room's front wall (where the Mediavida forum TV used to be) has a board (`src/world/PresenceBoard.js`).
It lists the players currently inside that room (🎙️ while they talk, *(tú)* for yourself), with a footer
counting people in the other rooms and on the street. It's computed on each client from the player
positions it already knows (`World.getRoomAt`), checked every 500 ms, and redrawn only when something
changes. No server state. The forum scraper behind the old TV (Puppeteer + headless Chromium,
`/mv-proxy`) was removed on 2026-10-21; it's in git history if a forum feed is wanted again.

## Vircon32 cabinet

A Vircon32 fantasy-console cabinet in every room (back-right corner), playing on its own 3D screen with a
ROM picker. People standing round it watch the game live (WebRTC from the player). Details:
[Vircon32.md](Vircon32.md).

## Volume settings

⚙️ (next to the mic button) also has per-player volume sliders: 📻 radio, 📽️ projector, 🗣️ voices,
🕹️ arcade (`src/audio/AudioSettings.js`, saved in `localStorage` `audioVolumes`, 0-100 %).
- Radios multiply their `PositionalAudio` volume, projectors their YouTube volume, and voices their
  `PositionalAudio` gain.
- Arcade drives:
  - the Vircon32 emulator's output gain (the audio tap, see Vircon32.md);
  - a spectated game's `PositionalAudio`;
  - Snake and Pong's own `AudioListener` master volume. A
slider releases focus when let go, so movement keys work right away.

## Projector (shared YouTube)

A 16:9 screen on each room's right wall (`src/world/Projector.js`), with a projector box hanging in
front of it. The right-wall paintings moved to the front wall, left of the door. The video is a real
YouTube iframe (IFrame API, `src/media/youtube.js`) placed in 3D by a `CSS3DRenderer` layer **under** the
transparent WebGL canvas (`Renderer`). A mesh with `NoBlending` + opacity 0 punches a hole in the canvas
where the screen is, so walls and players in front still cover it. The iframe gets no pointer events: all
control goes through the panel (`src/ui/ProjectorUI.js`), opened by clicking the screen. The player can
paste a YouTube link (watch, youtu.be, shorts, embed, live), pause/resume, or turn it off.

Sync: the server keeps `{ videoId, startedAt, pausedAt }` per room (server clock). Clients estimate the
server clock (`src/network/ServerClock.js`, from `init` and every projector message), play from
`now - startedAt`, and re-seek when more than 1.5 s off (checked every 2 s). Pause stores the position;
resume shifts `startedAt`. YouTube audio can't go through Web Audio, so walls are imitated with volume
only (`OCCLUSION_VOLUME`: 1 / 0.5 / 0.12) on top of distance. If the browser blocks autoplay with sound,
the next click anywhere starts it. Non-embeddable/missing videos are reported in chat.

## Voice chat (push to talk)

`src/voice/VoiceChat.js` + `VoicePeer.js`, UI in `src/ui/VoiceUI.js`. WebRTC full mesh: every pair of
players has one audio-only `RTCPeerConnection`; the WebSocket server only relays signaling (`voiceSignal`)
and the talking flag (`voiceTalking`). The lower user id of a pair sends the offer. Each connection starts
with one `sendrecv` transceiver; the mic is attached later with `replaceTrack`, so there is no
renegotiation. Hold `V` (or the 🎙️ button) to talk: the first press asks for the mic (HTTPS or localhost
only), later presses just toggle `track.enabled`. Remote voices play as `THREE.PositionalAudio` on the
speaker's avatar through the same `OcclusionChain` as the radios
(`Environment.getOcclusionLevel(speakerRoom, listenerRoom)`). Avatars show a 🎙️ sprite while talking.

**Open mic** (⚙️ → *Micrófono abierto*, saved in `localStorage` `voiceMode`): the mic track stays enabled
and `V` / 🎙️ toggle mute (🔇) instead of push-to-talk. The 🎙️ indicator others see follows actual speech:
a level detector on a clone of the mic track (RMS > 0.02, 500 ms hold). A saved open mode reopens the mic
on entry. Releasing or losing the mic in open mode leaves it muted; the next `V` reopens it.

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
high scores (top 10), doors (doorId → open), radio stations and projector state per room. Message list:
see [Protocol.md](Protocol.md).

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
- Fixed 2026-10-21: a page loaded hidden or zero-sized (background tab, hidden pane, collapsed iframe)
  left the camera aspect at 0/0 = NaN until the next resize. The scene rendered black, and anything
  using the aspect (the Vircon32 camera framing) got NaN positions. Camera now clamps the aspect and
  `Game.start` re-syncs the size.
- `window.game` is still used as a global by older modules (Bar, arcades, SoccerGame, ChatUI); new code
  gets `game` passed in.
- Geometry is duplicated: `level.json`, `World` and `Bar` all create floor/walls/bar counter (z-fighting).
- `Bathroom.js` and `Lighting.js` are never used (level.json has an empty Bathroom group).
- The 6 character previews keep their own WebGL contexts and render loops after the game starts.
  (Fixed 2026-10-20: `ModelSelector.init()` ran twice, creating 12.)
- Fixed 2026-10-20: server sent the initial position as `{x,y,z}` while clients expect `[x, y, z]`;
  local `system` chat messages rendered as "undefined ...".
