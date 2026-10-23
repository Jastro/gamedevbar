# Architecture

Last updated 2026-10-20. Short map of the code and where new things go. System details (rooms, doors,
audio, voice, known issues): [Systems.md](Systems.md). Messages: [Protocol.md](Protocol.md).

## What this is

**Taberna Virtual**: a multiplayer 3D hangout for the Mediavida forum (started in `/gamedev/`). The goal is
one bar per subforum, embeddable in forum threads. Players pick a name, character and bar, walk around, chat,
talk by voice (push to talk), sit, play arcades, open doors and cross the plaza to the other bar.

| Part | Tech | Entry |
|---|---|---|
| Client | Three.js r160, Vite 5 | `index.html` → `src/main.js` → `src/core/Game.js` |
| Server | Node 20, Express + `ws` | `server.js` → `server/index.js` |
| Deploy | Docker, GitHub Action on push to `main` | `Dockerfile`, `.github/workflows/deploy.yml` |

Dev: Vite on 5148, server on 3000. Media for voice goes peer to peer (WebRTC); the server only relays.

## Client (`src/`)

```
core/          Game (composition root + main loop), InteractionSystem (hover/click/F), EventEmitter, Config,
               PlayerProfile (remembered nick/character/popup flag; all identity storage goes through it)
rendering/     Scene (level.json template), Renderer, Camera, RoomLighting (light switches → scene lights),
               RegionLights (per-space light patched into every lit material)
appearance/    catalog (slots, items, tints, name colors; one entry per accessory), items (builders),
               Accessories (bone anchors, tint, size)
network/       WebSocketManager: transport only (JSON in → emit(type), send(type, data))
entities/      Player, LocalPlayer (input + collisions), RemotePlayer, PlayerManager, Gestures (procedural
               right-click animations on the bones) + GestureSync
world/         RoomLayout (the hub: plaza, slots, roads), Room, World (shells, colliders, Roof, WallTextures, Windows; ClosedBuilding in the free slots),
               CeilingFixtures (lamps, disco ball), Outdoors (plaza, roads,
               edge wall, fountain), DrivableCar + DrivingSync, Environment (props per room),
               Door + DoorSync, Bar, PresenceBoard, Radio, Furniture, Paintings, arcades, VirconCabinet +
               Bathroom + BathroomSync (cubicle, toilet, sink, mirror, stink, dirty hands), GraffitiWall +
               GraffitiSync (the drawable bathroom walls), StickerSync (stickers; designs in
               src/stickers/StickerArt.js), Car + CarSync,
               VirconSync, SoccerGame, CollisionManager, BarTap, Dartboard, KaraokeStage, Weather (Madrid sky,
               street light, rain/snow/fog/storms), WallClock, SlotMachine, Foosball + FoosballSync
               (futbolín; layout shared with the server in server/shared/foosball.json)
bar/           drinks (menu, alcohol, decay math shared with the server), DrinkSync (order panel, B to sip,
               held drink, drunk tag and effects), DartsSync (taking the board, aiming, throwing),
               SlotSync (lever, shared spins, coins)
               RaceSync (ring road circuit: laps, races, start gantry)
interactions/  one file per clickable type: seat, radio, arcade, door, barTap, bathroom fixtures, player
               (click an avatar → ui/ProfileUI)…
audio/         OcclusionChain (wall/door muffling shared by radios and voices)
voice/         VoiceChat (mesh, PTT, positional voices), VoicePeer (one RTCPeerConnection)
ui/            StartScreen, LoadingScreen, ModelSelector, RoomSelector, CustomizeUI (👤 menu),
               ControlsHelpUI (❔ panel: the list of every control, keep it in sync), ChatUI,
               EmotesUI, RadialMenu (right click), VoiceUI, VoiceSettingsUI, RadioUI, ProjectorUI, VirconUI, FloatingPanel
```

Flow: `Game` builds every system in its constructor. The path picks the entry: `/<roomId>`
(`getRoomIdFromPath`) → `Game.joinDirectly` (loading card, remembered or placeholder identity, no dialog);
anything else → `StartScreen` collects name/model/room. Then
`Game.start` → `init` (load level, connect, build world + props, `bindNetwork`) → `setupInput` → loop. Each
frame: players → colliders → soccer → environment (doors, music occlusion) → voice (positions, occlusion)
→ interaction hint → camera.

Rules of thumb:
- Systems get `game` passed in and reach each other through it. Older modules still use `window.game`.
- Network wiring: a system that owns a message subscribes itself (`DoorSync.bind`, `VoiceChat`,
  `PlayerManager`). Glue that spans systems goes in `Game.bindNetwork`. Nothing game-specific in
  `WebSocketManager`.
- Room content uses room-local coordinates; compare positions in world space (`Room.toWorld`,
  `World.getRoomAt`).

## Server (`server/`)

```
index.js        Express app, static dist/, Hub + feature registration (order matters)
config.js       PORT, input LIMITS, ICE_SERVERS
validation.js   cleanString / cleanUsername / cleanModelId
hub/Hub.js      WebSocket lifecycle, routing by message type, chat commands, send/broadcast helpers
hub/User.js     per-connection state (features add their own fields)
features/       presence, doors, seats, chat, arcade, duel, soccer, voice: one register(hub) each
```

`Hub` parses each frame and calls the single handler registered for its `type` (errors are caught and
logged). Lifecycle hooks: `onConnect`, `onJoin` (after `initCompleted`, in registration order),
`onLeave` (reverse order, so presence's `userLeft` goes last).

## How to add…

- **A room**: an entry in `ROOMS` (`src/world/RoomLayout.js`) with a free `slot` around the plaza, and its id
  in `ROOM_IDS` (`server/config.js`; darts, graffiti and Pong only accept those). Its placement, door and
  props follow. Per-room flags (`barSign`, `paintings`) live on that entry.
- **Something clickable**: give its root group `userData.type = '<type>'` (and `originalMaterial` /
  `highlightMaterial` on meshes for the hover glow). Add `src/interactions/<type>Interaction.js` returning
  `{ type, use(object) }`, plus `findNearby(position)` and `hint(object)` if `F` should work near it. Register
  it in `Game`'s constructor.
- **A network message**: client `network.send('myThing', {...})` (don't put a `type` field in the data). On
  the server, `hub.on('myThing', (ctx, data) => ...)` in a feature: validate `data`, then reply with
  `hub.send` / `hub.broadcast`. Document it in Protocol.md.
- **A server feature**: `server/features/<name>.js` exporting `register<Name>(hub)`; call it in
  `server/index.js`. Keep its state inside the module. Use `onJoin` to send newcomers a snapshot.
- **A Vircon32 game**: drop the `.v32` in `public/vircon32/roms/`, add it to `roms.json`, and add its
  license/source to `LICENSES.md`. Redistributable licenses only (Docs/Vircon32.md).
- **A radio station**: an entry in `src/audio/radioStations.js`. The stream must send CORS headers
  (`curl -I -H "Origin: https://example.com" <url>` shows `access-control-allow-origin`).
- **Shared media in a room** (like the radio/projector): server feature with per-room state + join
  snapshot, a `*Sync` class in `src/world/` that applies it, and a panel built on `src/ui/FloatingPanel.js`.
- **A chat command**: `hub.command('/name', (ctx, args) => ...)` in the relevant feature.
- **Sound that should be muffled by walls**: a `PositionalAudio` with an `OcclusionChain`
  (`sound.setFilters(chain.nodes)`); each frame call
  `chain.setLevel(environment.getOcclusionLevel(sourceRoom, listenerRoom))`.
