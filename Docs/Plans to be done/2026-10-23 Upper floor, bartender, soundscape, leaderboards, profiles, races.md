# Upper floor, bartender, soundscape, leaderboards, profiles, races (2026-10-23)

Borja asked for all six in one go. Built in this order, one commit (built + browser-checked) each.
All room-local coordinates: x -15..15 (right = +x seen from the door), z -10..10, front wall at +z.

## 1. Upper floor and terrace [LOCKED]
- **Gallery** (mezzanine) along the front wall, both bars: floor top at y 5.0 (0.3 thick), z 6.5 → 9.9,
  full width. Everything under it fits (bathroom 3.35, clock ≤ 4.63, presence board, door 3, darts).
  Ceiling above it: 9.6 at its edge, 8.05 at the wall.
- **Stairs**: a straight run along x at z 5.2 → 6.45, from x 3 (floor) up to x 9 (gallery), clear of the
  door (x ±1) and the tables (z 2). Walkable as a **ramp collider** (new type: ground height along the
  run, never blocks from above, blocks you walking into its side below the treads).
- **New collider type `floor`** (raised slab): you stand on top, you can walk underneath; it only
  blocks a body that overlaps the slab. Railings: blockers from y 5 up (only block people up there).
- Railing along the gallery edge (gap at the stairs' top) and along the stairs' open side.
- Gallery furniture: two small tables with chairs (sittable), a sofa-ish bench.
- **Terrace**: a doorway in the front wall at gallery level (x -1..1, y 5..7.4: the lintel splits)
  onto a balcony outside, x -4..4, z 10.1 → 12.6, floor at 5, railings on 3 sides, a table with
  chairs and two plants. It faces the plaza and the fountain. Outside light, rain falls on it.
- Camera: gallery and terrace slabs are camera occluders (the camera stays out of them).
- Read: `World.js` (createWalls), `CollisionManager.js`, `LocalPlayer.js` (handleJump), `Furniture.js`.
- Touches: `World.js`, `CollisionManager.js`, `LocalPlayer.js`, new `src/world/UpperFloor.js`.

## 2. Bartender NPC [LOCKED]
- One per bar, "Manolo" (name tag), a RemotePlayer driven locally (not in `players`): walks the lane
  behind the counter (z -7.3), x -10..8, stops, faces the counter, says a line now and then
  ("¿Qué te pongo?", "Aquí no se fía"…). The schedule is a function of the server clock and the room
  id, so every client sees him in the same place, without server traffic.
- Read: `RemotePlayer.js`, `Player.js` (showChatBubble), `Game.js`. Touches: new `src/world/Bartender.js`, `Game.js`.

## 3. Soundscape [LOCKED]
- Synthesized (no files): birds by day, crickets at night (outside only, faint from inside a bar),
  and a murmur of voices outside each bar's door that grows with how many people are inside
  (none for the bar you're in: you hear the real people).
- Touches: new `src/audio/Soundscape.js`, `Game.js`.

## 4. Weekly leaderboards [LOCKED]
- Server `features/leaderboards.js`: per ISO week (Madrid time), by player name: 🎯 best darts turn
  (3 darts), ⚽ futbolín wins (both players of the winning team, only real matches), 🎰 biggest slots
  win, 🏁 best lap and race wins. Other features call `hub.leaderboards.record(...)`.
- Saved to `DATA_DIR` (default `./data`, created in the Docker image) as JSON, so a restart keeps it.
  **A redeploy replaces the container: Jastro needs a volume on `/app/data` in the stack** (Open question).
- A board in each bar (left wall, high, clear of paintings) shows the top 5 of each; `leaderboardState`
  on join and on change.

## 5. Profiles on click [LOCKED]
- Click an avatar: a panel with name, character, accessories, the bar they're in, their week's stats
  (from the leaderboards) and buttons: 👋 Saludar (cheer gesture + chat line), 🎯/⚽ invite (a chat line
  to them). `profileRequest {userId}` → `profile`. Your own avatar shows yours.

## 6. Races [LOCKED]
- Ring road circuit, counterclockwise (the parked cars' way), start/finish line with a gantry (lights)
  at the far side of the plaza (slot 3's angle, by a closed building).
- **Time trial**: any driver crossing the line on the ring starts a lap; progress counts only while on
  the ring road (no cutting through the plaza); a full lap → `raceLap {ms}` → best lap on the board,
  announced when it's a personal or the week's best.
- **Races**: G while driving near the line joins the next race (a 20 s lobby, 2+ cars), 3-2-1 lights,
  3 laps; cars hold until green; clients report finishes, the server announces the order and records
  the win. Abandoned after 4 min.
- HUD: lap time / lap n of 3 / countdown, top center.
- Touches: new `src/world/RaceSync.js` + `server/features/races.js`, `DrivingSync.js` (hold, G key).

## Deviations
- 1: the stairs end on a small landing (x 8.4-10) before the gallery; the terrace table sits off to one
  side so the doorway stays clear. `floor` colliders block by the body's center (stairs reach the
  slab's height right at its edge). Blockers no longer block someone standing above their top (the
  closed entrance door blocked the doorway above it).
