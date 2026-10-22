# Bar service, darts, bathroom graffiti, karaoke, two-player Pong: plan

2026-10-22. Borja: "do all bar themed and the first of the games, do not ask me". That's away mode:
decisions are logged in HANDOVER *Decisions to review*. Each task is pushed to `main` on its own once it
builds and has been checked in the browser.

## 1. Bar service and drunkenness [LOCKED]
- **Ordering:** a beer tap and bottles on the counter. Click or F at the counter → a menu:
  🍺 Caña, 🍷 Vino, 🥃 Chupito, 🍹 Cubata, ☕ Café, 🥤 Refresco. The drink shows in your hand (temporarily
  replacing your hand accessory), and others see it.
- **Drinking:** B takes a sip (3 sips per drink, glug sound). An empty glass disappears.
- **Alcohol:** caña/vino +1, chupito +1.5, cubata +2, café −1.5, refresco 0. The level is 0..6 and drops
  1 point every 2 min (server time).
- **Effects** (from level 2): the camera sways, walking drifts, letters in your chat messages get
  scrambled, and a "🍺 Borracho/a" tag shows (level ≥ 3, everyone sees it).
- **Server:** `server/features/drinks.js` → `drinkState {userId, drink, sips, drunk, at}`, plus a snapshot.

## 2. Darts [LOCKED]
- **Board:** on the right wall (x 14.85, y 1.75, z 6), with a throw line 4 m in front. One thrower at a time.
- **Throwing:** step to the line (F) → the camera locks behind you, a swaying crosshair, click or Space
  throws, 3 darts per turn. Real dartboard scoring (sectors, double and triple rings, bull 25/50).
- **Shared:** the darts stuck in the board, plus a chalkboard with recent turns and the day's best.
- **Server:** `server/features/darts.js`.

## 3. Bathroom graffiti [LOCKED]
- **Wall:** the inside face of the cubicle's right partition is a drawable wall. F → a drawing panel (pen,
  6 colors, sizes, eraser = white). Strokes are shared and replayed on join.
- **Limits:** 3000 segments per wall; the oldest are dropped. Memory only: a server restart wipes it.
- **Server:** `server/features/graffiti.js`.

## 4. Karaoke stage [LOCKED]
- **Stage:** a low platform in front of the projector (right wall) with a mic stand and a spotlight that
  turns on while someone is on it.
- **Voice:** standing on the stage, your voice reaches the whole bar at near-full volume (not muffled
  inside that bar).
- **Lyrics:** use the existing shared projector with YouTube karaoke videos. The projector panel gets a
  "Buscar karaoke" link.

## 5. Two-player Pong [LOCKED]
- Fix the known issue: arcade messages arrive with a different `type`, so the second player and the game
  state never sync. Then make two-player Pong work between two clients.

## Deviations (2026-10-22, all five done and pushed)
- **Bar:** the tap is at the right end of the counter (x 5), past the last stool, so F picks it; no
  bottles were added (the back bar already has them). Effects start at level 1.5, not 2.
- **Darts:** the board is at y 2.1 and 1.3x real size (avatars are 2.15 tall), not y 1.75. Aiming uses
  a close camera 2.4 from the board, not one behind you: from the line the board was a dot. The darts
  are 1.8x size.
- **Graffiti:** colors + eraser + 3 sizes as planned; segments are batched (one message per 100 ms).
- **Karaoke:** no server state; "on stage" comes from positions. The stage is a platform you jump onto,
  or F at the mic places you. The stage light is on a floor stand (there's no ceiling to hang it from).
- **Pong:** fixing the `type` override alone wasn't enough (every client ran its own ball), so Pong was
  rebuilt: the server owns the players, player 1's client runs the game and sends snapshots, player 2
  sends its paddle. New `server/features/pong.js`; the old `arcadeState` relay is gone.
