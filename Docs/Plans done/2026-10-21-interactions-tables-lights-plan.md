# F everywhere, run, tables, chairs, empty rooms, light switches: plan

2026-10-21. Borja's request, with answers: tables can be stood on; empty rooms pause locally and resume
live; lights are shared per room. One branch/PR: `feature/interactions-tables-lights`.

## Tasks
1. **F for every interaction** [LOCKED].
   - `InteractionSystem` finds the nearest interactable within each type's `range`, by horizontal distance
     to the object's world position. It does that by scanning a cached list of `userData.type` objects,
     plus the existing custom `findNearby` (doors, Vircon32).
   - Hints per type: seat *Sentarse*, radio *Cambiar emisora*, projector *Proyector*, arcade *Jugar*,
     light switch *Encender/Apagar …*.
   - Read: `src/core/InteractionSystem.js`, `src/interactions/*`.
   - Touches: the same files.
2. **Chairs are seats** [LOCKED].
   - `Furniture` chairs get `userData.type = 'seat'`, hover materials, `sitHeight` and a `faceTarget` (the
     table center). `sitDown` uses them.
   - No chair colliders.
   - Read: `src/world/Furniture.js`, `LocalPlayer.sitDown`.
   - Touches: the same files.
3. **Run** [LOCKED]: Shift held → `RUN_SPEED` 5.5 instead of 3.2. Touches: `LocalPlayer.js`, ❔ list.
4. **Tables you can stand on** [LOCKED].
   - `CollisionManager` gets two collider kinds:
     - `platform`: a table, a cylinder in XZ with a top height;
     - everything else, which now blocks at any height (no more jumping over the bar, fences or cabinets
       and landing inside).
   - A platform blocks only while your feet are below its top. `getGroundHeight(position)` gives the
     highest platform top under you.
   - `LocalPlayer` falls when there's no ground under its feet and lands on platform tops.
   - Read: `CollisionManager.js`, `LocalPlayer.js`.
   - Touches: the same, plus `Furniture.js`.
5. **Empty rooms pause their streams** [LOCKED].
   - `Environment` tracks, per room, when anyone (local or remote) was last inside.
   - After 30 s empty, that room's radio stops downloading (`Radio.setDormant`) and the projector unloads
     its video locally (`Projector.setDormant`).
   - Both resume live when someone enters. Choices stay on the server.
6. **Light switches** [LOCKED].
   - **Server:** `server/features/lights.js`. `lightsToggle {roomId, light}` (light ∈ normal | low | disco)
     → `lightsState {roomId, state}` to everyone, plus a `lightsStates` join snapshot. Default
     `{ normal: true, low: false, disco: false }`.
   - **Switches:** three plates on the front wall inside each bar: normal and low to the left of the door,
     disco to the right (`src/world/LightSwitches.js`). Click or F.
   - **Rendering** (`src/rendering/RoomLighting.js`): the scene's ambient/directional light follows the
     state of the bar the local player is in (the street keeps the defaults). Normal is full light, low a
     warm dim light; both on = normal; none = almost dark. Disco = 3 colored point lights circling that
     room's ceiling. They always exist (intensity 0 when off), so toggling never recompiles shaders.
7. **Docs, verification, PR.** Systems, Protocol, Architecture, PendingUserChecks, HANDOVER, the ❔ list.

## Verification
- `npm run build` passes.
- Two in-app clients:
  - F works near each type;
  - you can sit on a chair facing the table;
  - Shift speed is 5.5;
  - jump onto a table → you stand on it; walk off → you fall; you can't land inside the bar;
  - an empty room's radio/projector stop after 30 s and resume on entry;
  - switches sync, and a late joiner gets the state;
  - lights change.

## Deviations (2026-10-21)
- **F target:** it's chosen by distance and facing, not distance alone, so facing the radio behind a stool
  picks the radio. Range-based targets must be in the player's own space.
- **Blockers:** they block from their bottom up and ignore anything entirely above your head (door
  lintels).
- **Tables:** a table is a circle against the player's center.
- **Toilet:** `Bathroom` isn't built anywhere, so the toilet seat isn't reachable. That was already the
  case.
