# Architecture

Last updated 2026-10-20.

## What this is

**Taberna Virtual** is a small multiplayer 3D hangout for the Mediavida `/gamedev/` subforum community
(originally proposed in the forum thread *"Gamedev Taberna: ahora nuestro propio Habbo"*). People pick a name
and a character, walk around a toon-shaded bar, chat with speech bubbles and emotes, sit down, play arcade
machines, start a `/furbo` soccer match, and watch the live forum thread on a TV on the wall. The UI is in
Spanish; code comments are a mix of Spanish (older) and English (newer).

There are two bars, **Gamedev** and **Desarrollo**, facing each other across a street. Players choose where to
spawn and can walk between them through interactive front doors.

## Stack and runtime

| Part | Tech | Entry |
|---|---|---|
| Client | Three.js r160 (ES modules), Vite 5 dev server / build | `index.html` → `src/main.js` → `src/core/Game.js` |
| Server | Node 20, Express (static + proxies), `ws` WebSocket server | `server.js` |
| Forum scraping | Puppeteer (headless Chromium) | `fetchForumPosts()` in `server.js` |
| Deploy | Docker multi-stage (`Dockerfile`), GitHub Action builds the image and ships it over SSH on push to `main` | `.github/workflows/deploy.yml` |

Ports: Vite on **5148** (`vite.config.js`, proxies `/mv-proxy` and `/proxy-image` to 3000), server on **3000**
(`PORT` env). In dev the client opens `ws://<host>:3000`; over https it uses `wss://<host>` (reverse proxy).
In production Express serves `dist/` and the WebSocket on the same port.

Forum TV needs Chromium at `PUPPETEER_EXECUTABLE_PATH` (default `/usr/bin/chromium-browser`). On a Windows
dev box without it the TV shows "Error updating content..."; everything else works.

## Client module map

```
src/
  core/       Game (owner of everything, main loop, input → interactions), Config, EventEmitter
  rendering/  Scene (THREE.Scene + level.json template), Renderer (WebGL + OutlineEffect), Camera (3rd person)
  network/    WebSocketManager (connect, JSON messages → events), NetworkEvents (constants, mostly unused)
  entities/   Player (model, animations, name/chat sprites), LocalPlayer (input, collisions, sit), RemotePlayer (lerp), PlayerManager
  world/      RoomLayout (room placement data), Room, World (shells + collisions + street), Street, Environment (props per room),
              Door, Bar (+ forum TV), Furniture, Radio, Paintings, ArcadePong, ArcadeSnake, SoccerGame, CollisionManager
  ui/         ChatUI, EmotesUI, emotes, ModelSelector, RoomSelector
public/       level.json (Three.js scene JSON for one room), models (*.glb), sounds, paintings
```

Startup: `Game` constructor builds Scene/Camera/Renderer/World/Environment/SoccerGame, UI and network. On
"Entrar al Bar" it reads name, model and room, runs `init()` (renderer, wait for `level.json`, connect WS,
`world.create()`, `environment.create()`, soccer init), starts the loop and audio. The server's `init` message
makes `PlayerManager` create the `LocalPlayer` at the chosen room's spawn.

Per frame (`Game.update`): players → world colliders → soccer → `environment.update` (doors, audio occlusion)
→ interaction hint → camera follow. Interactions are raycasts from the mouse: objects whose ancestor has
`userData.type` in `seat | radio | arcade | door` highlight on hover and react to click. `E` toggles the
nearest door.

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

One `AudioListener` on the camera (`Environment.initializeAudio`). Each room's radio is a `PositionalAudio`
(default inverse distance model) with a chain *low-pass filter → gain* that `Environment.updateAudioOcclusion`
drives every frame from the local player's position:

| Listener | Filter cutoff | Extra gain |
|---|---|---|
| Inside that room | 20 kHz | 1.0 |
| Outside, door path open (its door open, and listener's own door open or listener in the street) | 2.5 kHz | 0.8 |
| Outside, any closed door in between | 450 Hz | 0.55 |

Changes are smoothed with `setTargetAtTime` (0.15 s). Values live in `OCCLUSION_LEVELS` in `Radio.js`.
Arcade sounds are plain `THREE.Audio` (not positional, not occluded).

## Server state (`server.js`)

All in memory, lost on restart: `users` (per socket: id, name, model, position, seat, duel state),
`seats`, `ChatLog` (last 50), `snakeHighScores` (top 10), `doors` (doorId → open). Forum posts cached 30 s,
proxied images 5 min. Message list: see [Protocol.md](Protocol.md).

## Known issues and quirks (found 2026-10-20, not fixed unless noted)

- **Server crash on bad input**: `JSON.parse(message)` in the WS handler has no try/catch; one malformed
  message from any client throws and kills the process.
- **XSS**: chat messages and usernames are inserted with `innerHTML` (`ChatUI.addMessage`) unescaped.
- **Pong multiplayer sync is broken**: `WebSocketManager.send(type, data)` builds `{ type, ...data }`, so a
  `data.type` overrides the message type. `Game` sends `arcadeState` with `type: 'startGame'` (server sees
  `startGame`, unhandled) and `syncGameState` gets re-broadcast as `arcadeState`, which no client listens to.
  Pong is effectively local-only; each room has its own local Pong and Snake.
- Seat ids are Three.js object ids (client-local), so server seat occupancy is meaningless across clients, and
  no client handles `userSat`/`userStood` (others don't see you sit).
- Duel messages (`duelRequest`...) exist on the server but there is no client UI for them.
- Geometry is duplicated: `level.json`, `World` and `Bar` all create floor/walls/bar counter (z-fighting).
- `Bathroom.js` and `Lighting.js` are never used (level.json has an empty Bathroom group). `/proxy-image`
  is unused by the client (avatars go through `/mv-proxy?imageUrl=`).
- The 6 character previews keep their own WebGL contexts and render loops after the game starts.
- Each room's forum TV polls `/mv-proxy` every 5 s (2 rooms → 2 requests per client per 5 s; server caches).
- Fixed 2026-10-20: server sent the initial position as `{x,y,z}` while clients expect `[x, y, z]`;
  local `system` chat messages rendered as "undefined ...".
