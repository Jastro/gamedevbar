# WebSocket protocol

Last updated 2026-10-20. JSON text frames, one object per message, discriminated by `type`.
Client sends with `network.send(type, data)` → `{ ...data, type }` (the `type` argument always wins; until
2026-10-22 a `type` inside `data` won, which broke Pong). Client listeners: `network.on(type, fn)`.

Server input handling (`server/hub/Hub.js` + each `server/features/*.js`): frames that are not JSON objects with a string `type` are
dropped (logged); a throwing handler is logged, never fatal. Strings are trimmed and clamped: `username` to 24
chars (empty/non-string → `Anónimo`), chat `message` to 200 (empty → dropped), `emoji` to 16; `selectedModel`
must match `[a-z0-9_-]{1,32}` (else `pj`); `score` must be a finite number; `duelChoice` must be
`piedra`/`papel`/`tijera`. The client renders all chat text with `textContent`, never HTML.

## Client → server

| type | Fields | Server reaction |
|---|---|---|
| `setUsername` | `username`, `selectedModel`, `appearance` (`{head, face, hand, tint, scale, nameColor}`, shape-checked by `cleanAppearance`) | clamp/validate, store, `userUsername` to all |
| `initCompleted` | `username`, `selectedModel`, `appearance` | `userJoined` to others, existing users + `doorStates` + chat history to sender, welcome chat to all |
| `userMoved` | `position: [x,y,z]`, `rotation` | store, `userMoved` to others |
| `userChat` | `message`, `isEmote`, `emoji` | `/furbo` → `startSoccerGame` to all; else log + `userChat` to all |
| `userSat` / `userStood` | `seatId`, `pose` (`sit` \| `stand`) / – | seat bookkeeping, relayed to others → their seated pose |
| `doorToggle` | `doorId` (`<roomId>:<door>`) | validate id, flip state, `doorState` to all |
| `voiceSignal` | `targetId`, `signal` (`{description}` or `{candidate}`, ≤ 16 KB) | relayed only to `targetId` as `voiceSignal` with `fromId` |
| `voiceTalking` | `talking` (bool) | `voiceTalking` to others |
| `radioSet` | `roomId`, `stationId` (or `null` = off) | store, `radioState` to all |
| `projectorPlay` | `roomId`, `videoId` (11-char YouTube id) | start at server time now, `projectorState` to all |
| `projectorPause` / `projectorResume` / `projectorStop` | `roomId` | update/clear, `projectorState` to all |
| `virconStart` | `roomId` (cabinet id: the room id for the Vircon32, `<room>-pokebonk` for Pokebonk), `romTitle`, `watchable` (bool; false for uploaded carts) | take the room's cabinet → `virconState` to all, or `virconBusy` to sender |
| `virconStop` | `roomId` | free it (only its player) → `virconState` to all |
| `carSit` | `slot` (optional 0-4; normally omitted: the server picks the first free one) | take a car seat → `carState` to all, or `carDenied {reason}` to sender (`full`, `riding`, `taken`) |
| `carLeave` | – | free your car seat → `carState` |
| `bathroomDoor` / `bathroomLatch` / `bathroomLight` | `roomId` | toggle; a door latched by someone else → `bathroomRefused {reason: 'latched'}`; opening unlatches; latching closes the door → `bathroomState` to all |
| `toiletUse` | `roomId`, `kind` (`pee` \| `poo`) | occupy the toilet (else `bathroomRefused {reason: 'occupied'}`), set the bowl (poo outranks pee), poo → stink 10 min, sender's hands dirty → `bathroomEvent` + `hygiene` + `bathroomState` |
| `toiletLeave` / `toiletFlush` / `washHands` / `airFreshener` | `roomId` | free the toilet / empty the bowl (`bathroomEvent flush`) / clean hands (`wash`) / end the stink (`spray`) |
| `drinkOrder` | `drink` (`beer` \| `wine` \| `shot` \| `cubata` \| `coffee` \| `soda`) | 2 s cooldown; hand the sender that drink with 3 sips → `drinkState` to all |
| `drinkSip` | – | 0.8 s cooldown; needs a drink; adds alcohol/3 to the level (0..6, decayed first) → `drinkSipped` + `drinkState` to all |
| `dartsStart` | `roomId` | take that room's board (ends your turn at any other board) → `dartsState` to all; taken by someone connected → `dartsBusy` to sender |
| `dartsThrow` | `roomId`, `x`, `y` (board units, clamped to ±2) | thrower only, 3 per turn, 0.6 s cooldown; scored on the server → `dartsThrow` to all; after the 3rd: history + day's best, `dartsState`, and 2.5 s later the turn ends (`dartsState` with no thrower). 30 s idle also ends it |
| `dartsLeave` | `roomId` | the thrower gives up the board → `dartsState` |
| `graffitiDraw` | `roomId`, `segments` (1-60 × `[x0, y0, x1, y1, color 0-6, size 0-2]`, coordinates 0..1) | 40 ms per-user rate limit; bad segments dropped, coordinates rounded to 0.001; kept (last 3000 per wall) → `graffitiDraw` to others |
| `slotSpin` | `roomId` | joined players, real rooms; busy machine → `slotBusy`; broke and no bailout yet → `slotBroke {retryIn}`; else roll → `slotResult` to all |
| `foosballJoin` | `roomId`, `team` (0 red / 1 blue) | joined players; a free slot on that team (else `foosballFull`); leaves any other table → `foosballTable` |
| `foosballLeave` | `roomId` | frees your slot → `foosballTable` |
| `foosballRods` | `roomId`, `offsets` (`{ rodIndex: z }`, only your rods count; clamped) | ≥ 30 ms apart; the server slides those rods there |
| `foosballKick` | `roomId` | ≥ 250 ms apart; your rods kick for 0.2 s |
| `playerGesture` | `gesture` (`dance`, `pushups`, `jerk`, `kiss`, `spit`, `cheer`, `toast`, `snort`) | joined players, ≥ 400 ms apart → `playerGesture {userId, gesture}` to others |
| `playerGestureStop` | – | → `playerGestureStop {userId}` to others |
| `powderSnort` | `roomId` | 3 s cooldown; line gone → `bathroomRefused {reason: 'empty'}`; else empty it for 45 s → `bathroomEvent snort` + `bathroomState` |
| `lightsToggle` | `roomId`, `light` (`normal` \| `low` \| `disco`) | flip it for that room → `lightsState` to all |
| `virconSignal` | `roomId`, `targetId`, `signal` (`{description}`, `{candidate}` or `{refused}`, always with `peerId`; ≤ voice size cap) | spectating WebRTC signaling; relayed as `virconSignal {roomId, fromId, signal}` only if the room's cabinet is watchable and sender or target is its player; an offer that can't be relayed gets `{refused, peerId}` back (as if from the target) |
| `snakeHighScore` | `username`, `score` | keep top 10, `snakeHighScores` to all |
| `pongJoin` | `machineId` (room id) | first → player 1 vs CPU (`onePlayer`), second → player 2 (`twoPlayer`, match restarts); full → `pongBusy` to sender. Leaves any other machine first → `pongMachine` to all |
| `pongLeave` | `machineId` | a player leaving ends the match → `pongMachine` (idle) |
| `pongOver` | `machineId` | player 1 only: the match ended → `pongMachine` (idle) |
| `pongState` | `machineId`, `ball {x, y, dx, dy}`, `p1y`, `p2y`, `s1`, `s2`, `phase` (`countdown`/`play`/`over`), `countdown`, `winner`, `events` (`hit`/`point`/`over`) | player 1 only, ≥ 30 ms apart; clamped → relayed to others |
| `pongPaddle` | `machineId`, `y` | player 2 only, ≥ 30 ms apart → relayed to others |
| `soccerBallUpdate` | `position`, `velocity` | relayed to others |
| `duelRequest` / `duelAccepted` / `duelRejected` / `duelChoice` | ids, choice | rock-paper-scissors duel; no client UI |

## Server → client

| type | Fields | Client handling |
|---|---|---|
| `init` | `userId`, `iceServers` (STUN + per-user TURN credentials when configured), `serverTime` | create `LocalPlayer` at chosen room spawn, send `setUsername` + `initCompleted`; voice keeps id + ICE servers |
| `userJoined` | `userId`, `username`, `position`, `rotation`, `selectedModel`, `appearance`, `seatId`, `seatPose` | create/update `RemotePlayer` |
| `userLeft` | `userId` | remove player |
| `userMoved` | `userId`, `position`, `rotation` | remote player target |
| `userUsername` | `userId`, `username`, `selectedModel`, `appearance` | update/create remote player |
| `userChat` | `userId`, `username`, `message`, `isEmote`, `isTaberna`, `emoji`, `timestamp` | chat box + bubble |
| `doorState` | `doorId`, `isOpen` | animate door |
| `voiceSignal` | `fromId`, `signal` | WebRTC offer/answer/ICE candidate for that peer |
| `voiceTalking` | `userId`, `talking` | 🎙️ sprite on that avatar |
| `radioState` | `roomId`, `stationId`, `by` | switch that room's radio, 📻 chat line |
| `radioStates` | `stations: { roomId: stationId }` | join snapshot |
| `projectorState` | `roomId`, `state` (`{ videoId, startedAt, pausedAt }` or `null`), `by`, `serverTime` | apply + 📽️ chat line |
| `projectorStates` | `screens: { roomId: state }`, `serverTime` | join snapshot |
| `doorStates` | `doors: { doorId: isOpen }` | apply instantly (join snapshot) |
| `virconState` | `roomId`, `state` (`{ playerId, playerName, romTitle, watchable }` or `null`) | cabinet screen; the asker starts playing; spectators connect or drop |
| `carState` | `slots` (5 × playerId or null), `countdownEndsAt` (server ms or null), `riding` | `CarSync`: sit down when listed, countdown overlay; also the join snapshot |
| `carSmoke` | `occupants` (playerIds) | smoke + hiss for all; the occupants fade out and land at random spots. Seats are already cleared; `riding` stays true 6 s |
| `carDenied` | `reason` | chat line |
| `bathroomState` | `roomId`, `state` (`{ doorOpen, latchedBy, lightOn, mess, stinkUntil, occupant, occupantKind, powderEmptyUntil }`; `occupantKind` 'poo' = seated pose) | `Bathroom.applyState` |
| `bathroomStates` | `rooms: { roomId: state }`, `dirty` (userIds) | join snapshot |
| `bathroomEvent` | `roomId`, `kind` (`pee`, `poo`, `flush`, `wash`, `spray`, `snort`), `userId` | sounds/particles; the sender sits (poo) or stands at the bowl (pee) |
| `hygiene` | `userId`, `dirty` | shame on/off (cleared by washing or after 10 min) |
| `bathroomRefused` | `roomId`, `reason` | chat line |
| `drinkState` | `userId`, `drink` (id or `null`), `sips`, `drunk` (level at `at`), `at` (server ms) | `DrinkSync`: held item, tag, local effects; the level now is `drunk - (now - at) / 120000` |
| `drinkStates` | `states` (array of `drinkState` bodies: users holding a drink or still drunk) | join snapshot |
| `drinkSipped` | `userId` | sip sound at that player |
| `dartsState` | `roomId`, `state` (`{ thrower: {userId, name} \| null, darts: [{x, y, score, label}], history: [{name, total, labels}], best: {name, total, day} \| null }`) | `DartsSync`: stuck darts, chalkboard; enter/leave throwing for the local player |
| `dartsStates` | `rooms: { roomId: state }` | join snapshot |
| `dartsThrow` | `roomId`, `userId`, `index` (0-2), `x`, `y`, `score`, `label` (`20`, `T20`, `D20`, `25`, `Diana`, `Fuera`) | the dart flies from that player's hand and sticks; the thrower gets a chat line |
| `dartsBusy` | `roomId`, `thrower` | chat line |
| `graffitiDraw` | `roomId`, `segments` | draw them on that bathroom's wall |
| `graffitiStates` | `rooms: { roomId: segments }` | join snapshot |
| `weatherState` | Spain in general: `code` (WMO, combined from 8 cities), `temperature` (average °C or null), `cloudCover` (average %), `wind` (km/h), `sunrise`/`sunset` (Madrid minutes after midnight), `wetCities`, `updatedAt` | `Weather`: sky, street light, precipitation, clocks. Also sent on join |
| `slotResult` | `roomId`, `userId`, `name`, `reels` (3 symbol ids), `win`, `coins` (the spinner's new total), `bailout` | everyone spins that machine to the result; chat line for the spinner (and the bar on a jackpot) |
| `slotBusy` / `slotBroke` | `roomId` (+ `retryIn` s) | chat line |
| `foosballTable` | `roomId`, `slots` (4 × `{userId, name}` or null: red back, red front, blue back, blue front), `phase`, `score` | who plays; the local player enters/leaves play mode |
| `foosballTables` | `tables: { roomId: { slots, phase, score } }` | join snapshot |
| `foosballState` | `roomId`, `ball` [x, z, vx, vz], `rods` (8 offsets), `kicks` (8 × 0/1), `score`, `phase`, `timer`, `winner`, `events` (`kick`/`hit`/`goal`/`win`) | 20/s while active: draw the table |
| `foosballFull` | `roomId`, `team` | chat line |
| `playerGesture` / `playerGestureStop` | `userId` (+ `gesture`) | play / end that player's gesture |
| `lightsState` | `roomId`, `state` (`{ normal, low, disco }`) | `LightsSync` → switches + `RoomLighting` |
| `lightsStates` | `rooms: { roomId: state }` (only rooms someone touched) | join snapshot; unlisted rooms → default (normal on) |
| `virconSignal` | `roomId`, `fromId`, `signal` | `VirconSpectating`: answer (player) or apply (watcher) |
| `virconStates` | `cabinets: { roomId: state }` | join snapshot |
| `virconBusy` | `roomId`, `state` | "someone is already playing" chat line |
| `snakeHighScores` | `scores` | all Snake machines |
| `pongMachine` | `machineId`, `state` (`{ player1, player2, mode }`, players `{userId, name}`, mode `idle`/`onePlayer`/`twoPlayer`) | `ArcadePong.applyMachine`: roles, new match, play mode |
| `pongMachines` | `machines: { machineId: state }` | join snapshot |
| `pongState` / `pongPaddle` | as sent | guest/watchers draw the snapshot; host/watchers take player 2's paddle |
| `pongBusy` | `machineId` | chat line |
| `startSoccerGame` | `initiatorId` | start soccer for everyone |
| `soccerBallUpdate` | `position`, `velocity` | ball sync |
