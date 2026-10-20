# WebSocket protocol

Last updated 2026-10-20. JSON text frames, one object per message, discriminated by `type`.
Client sends with `network.send(type, data)` → `{ type, ...data }` (a `type` inside `data` wins; see
Architecture.md known issues). Client listeners: `network.on(type, fn)`.

## Client → server

| type | Fields | Server reaction |
|---|---|---|
| `setUsername` | `username`, `selectedModel` | store, `userUsername` to all |
| `initCompleted` | `username`, `selectedModel` | `userJoined` to others, existing users + `doorStates` + chat history to sender, welcome chat to all |
| `userMoved` | `position: [x,y,z]`, `rotation` | store, `userMoved` to others |
| `userChat` | `message`, `isEmote`, `emoji` | `/furbo` → `startSoccerGame` to all; else log + `userChat` to all |
| `userSat` / `userStood` | `seatId` / – | seat bookkeeping, relayed to others (no client handler) |
| `doorToggle` | `doorId` (`<roomId>:<door>`) | validate id, flip state, `doorState` to all |
| `snakeHighScore` | `username`, `score` | keep top 10, `snakeHighScores` to all |
| `arcadeState` | `gameState`, `data` | re-broadcast (see known issues: Pong sync broken) |
| `soccerBallUpdate` | `position`, `velocity` | relayed to others |
| `duelRequest` / `duelAccepted` / `duelRejected` / `duelChoice` | ids, choice | rock-paper-scissors duel; no client UI |

## Server → client

| type | Fields | Client handling |
|---|---|---|
| `init` | `userId` | create `LocalPlayer` at chosen room spawn, send `setUsername` + `initCompleted` |
| `userJoined` | `userId`, `username`, `position`, `rotation`, `selectedModel`, `seatId` | create/update `RemotePlayer` |
| `userLeft` | `userId` | remove player |
| `userMoved` | `userId`, `position`, `rotation` | remote player target |
| `userUsername` | `userId`, `username`, `selectedModel` | update/create remote player |
| `userChat` | `userId`, `username`, `message`, `isEmote`, `isTaberna`, `emoji`, `timestamp` | chat box + bubble |
| `doorState` | `doorId`, `isOpen` | animate door |
| `doorStates` | `doors: { doorId: isOpen }` | apply instantly (join snapshot) |
| `snakeHighScores` | `scores` | all Snake machines |
| `startSoccerGame` | `initiatorId` | start soccer for everyone |
| `soccerBallUpdate` | `position`, `velocity` | ball sync |
