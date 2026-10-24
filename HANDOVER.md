# Handover

## Start here
2026-10-23 (evening). Done and pushed: the whole upper-floor plan (`Docs/Plans done/`): gallery,
stairs and terrace in each bar, the bartender, the soundscape, weekly leaderboards, profiles on
click and races on the ring road; then Borja's notes on stairs/terrace/bartender. Next: Borja's
checks in `Docs/PendingUserChecks.md` (races and profiles need two windows); Jastro's volume for
`/app/data` (Open questions); the forum embed waits for the Mediavida add-on admin.

2026-10-20. Two bars (Gamedev, Desarrollo) across a street with synced doors, muffled music, push-to-talk
proximity voice chat with mic settings, and a modular client/server layout (PRs Jastro/gamedevbar#10-#12 merged).
In production, voice failed between different networks: there was no TURN relay. `fix/voice-turn` adds
per-user TURN credentials + connection status/errors, and the coturn setup guide in [Docs/TURN.md](Docs/TURN.md).
Deploy moved to git-ops: this repo builds `ghcr.io/jastro/gamedevbar` and calls a Portainer webhook; the app
and coturn are stacks in the server owner's git-ops repo (Docs/TURN.md).
Next step: Jastro sets up both stacks, the firewall ports and the webhook secret (checklist in
Docs/TURN.md); then retest voice across networks.
Docs: [Architecture](Docs/Architecture.md), [Systems](Docs/Systems.md), [Protocol](Docs/Protocol.md).

## Done
- 2026-10-24 Agente Porras: a policeman in the plaza, run by the server, who chases random people
  (drunk ones first), searches them and hands out absurd verdicts; police cap and baton accessories.
  **Verified in the browser** (real server): he picked me after ~4 s of patrol, chased, caught me,
  searched and gave a verdict (announced in chat); stepping into Gamedev mid-chase made him give up
  ("territorio del camarero"); hidden from inside the bar; picture of him with cap, moustache, baton.
- 2026-10-24 Bartenders (and their names and lines) only show when you can see them: in their bar or
  through its open door. **Verified in the browser:** visible only in Gamedev from inside, none from the
  plaza or the terrace, FEDA's with its door open; a hidden one's card doesn't open; plaza picture.
- 2026-10-24 Performance: hidden interiors of bars you can't see into, static meshes merged (walls,
  roofs, railings, closed buildings, bottles; chairs, tables, lamps and cars as fewer meshes), lights at
  0 hidden (7 lights were computed per pixel for nothing), pixel ratio ≤ 1.5. Fixed: running up the
  stairs in a slow frame sank you into them / dropped you through; the stairs' handrail fell short at
  both ends (tilted rail sized to the horizontal run). **Verified in the browser:** draw calls inside
  facing the bar 574 → 274, looking out the door 2198 → 688, plaza 990 → 274; stairs run at 60/20/15/10
  fps with the camera swinging: no sinking (the old code sank at ≤ 20 fps in the same test); chairs
  seat and highlight, tables and lamp posts block, disco/karaoke lights switch, an open door shows its
  bar from across the plaza; pictures inside, outside and of the handrail ends.
- 2026-10-24 Mediavida sign over the fountain (turning, with the forum's logo), two new bars (FEDA in
  slot 2, Offtopic in slot 5, copies of Desarrollo), ~40 sarcastic bartender lines plus each bar's own.
  **Verified in the browser:** `/feda` spawns inside FEDA; four bars and bartenders; pictures of the
  plaza with the sign, the sign up close, inside FEDA and Offtopic's front; the sign turns; no errors.
- 2026-10-23 Borja's notes: stairs by the bathroom, bigger terrace, terrace z-fight fixed, bigger
  bartender on a deck. Details in [HANDOVER_ARCHIVE.md](HANDOVER_ARCHIVE.md).
- 2026-10-23 Plan steps 4-6: weekly leaderboards (board on each gallery, `data/leaderboards.json`),
  profiles on click, races on the ring road (timed laps, G races). Details in
  [HANDOVER_ARCHIVE.md](HANDOVER_ARCHIVE.md).
- 2026-10-23 Plan steps 1-3: an upper gallery with stairs and a terrace in each bar, a bartender
  (Manolo / Paco), the soundscape. Details in [HANDOVER_ARCHIVE.md](HANDOVER_ARCHIVE.md).
- 2026-10-23 Hanging lamps, disco ball, windows, nitro, roofs, wall finishes, closed buildings,
  passenger seat, stickers, whole-wall graffiti, cars pushing each other, the toilet light.
  Details in [HANDOVER_ARCHIVE.md](HANDOVER_ARCHIVE.md).
- 2026-10-20 to 2026-10-23: the hub, cars and the Uber, gestures, weather, futbolín, slots, bar
  games, bathrooms, appearance, Vircon32, TURN/voice. Summaries and details in
  [HANDOVER_ARCHIVE.md](HANDOVER_ARCHIVE.md).

## Decisions to review
- **Pixel ratio capped at 1.5** (was 2): a bit softer on 2x screens, 44% fewer pixels. Back to 2 in
  `Renderer.js` if it looks blurry.
- **Interiors hidden** when you're not in a bar, its door is shut and you're more than 16 from its
  front: if something pops in visibly when walking up, raise `INTERIOR_NEAR` (Environment.js).
- **New bars:** FEDA in slot 2 (beside Desarrollo) and Offtopic in slot 5 (beside Gamedev), so the four
  sit together; radios Cadena SER / LOS40; bartenders Fermín (pj3) and Lola (pj5). Taglines: "Se
  discute de todo y no se arregla nada" / "De todo un poco, y nada en serio".
- **Mediavida logo:** the forum's `safari-pinned-tab.svg` (one color), painted orange (#ff7f00) on a
  dark board; the exact brand orange may differ.
- **Bartender's deck** (0.5 high behind the counter) is a platform: players can still go behind the
  bar by jumping onto it. If they shouldn't go there at all: a blocker at the counter's ends.
- **Stickers are flat squares, not projected decals:** on edges and curved things they overhang. They
  live in server memory (a deploy wipes them). The 12 designs are ours, in the memes' spirit.
- **Uber Suicida:** seat 0 drives; it lost its collider (walk through it, like the other cars). If it
  should still block people: a collider moved with it.
- **Light per space is per pixel** (world position + a nudge along the normal), only for ambient and
  directional light; point lights (disco, lamps, bathroom lamp) still reach through walls as before.
- **Lamps are shader light, outside only:** a person standing in a doorway is lit by them on their
  outside half only. Lamps don't cast shadows (they never did).
- **Car pushing is client-side:** the pusher's client slides parked cars and reports where they end up;
  two people shoving the same parked car at once may make it jitter. Cars don't spin when hit
  off-center, they only slide.
- **Fountain volume 0.15** (about 20 dB under the old hiss), a different sound (fizz + splats + plips).
- Hub (2026-10-23):
  - **Desarrollo is Gamedev's neighbor (slot 1)**, not across the plaza (slot 3): a 10 s walk door to door
    instead of 20. If wrong: change its `slot` in `RoomLayout.js`.
  - **The plaza radius is computed from the room size**, with exactly a road (6) between neighbors' front
    corners. Bigger rooms move everything out by themselves; nothing else to change.
- Futbolín / slots / weather (2026-10-22):
  - **Gestures aren't replayed for late joiners**, and loops stop after 10 s.
  - **The location prompt shows on entry** (for the clock). If wrong: ask only when someone looks at
    the clock, or drop local weather and keep local time.
  - **Meme symbols are emoji + captions** drawn in code, not downloaded meme images (copyright, and
    downloading needs your OK each time). Easy to swap for real images if you provide them.
  - **Slot coins aren't saved** (a reload gives you 100 again) and can't buy anything.
  - **Futbolín: your own avatar is hidden while you play** (the camera sits where your head is).
  - **Futbolín rods all move together with W/S** (no per-rod control). If wrong: per-rod keys or mouse.
  - **Weather only falls over the street**, not inside the roofless bars; fog only while you're outside.
- Bar games batch (away mode, 2026-10-22):
  - **Drunk state is per connection**, not saved: a reload sobers you up. If wrong: people reload to
    escape the effects (harmless).
  - **Effects scale from level 1.5**, so one drink does nothing visible and the 2nd-3rd starts the sway.
    If wrong: tune `EFFECT_START` in `src/bar/DrinkSync.js`.
  - **Darts board at y 2.1 and 1.3× real size** (plan said y 1.75): avatars are 2.15 tall. The aiming
    view is a close camera 2.4 from the board, not over the shoulder: from the line the board was a dot.
  - **Graffiti can differ between clients** when two people paint the same spot at the same moment
    (your strokes show at once, theirs in server order) until a reload. Cheap to live with.
  - **Pong is run by player 1's client** (not the server): simpler and smooth for player 1; player 2 sees
    the ball through the relay (~50 ms + latency behind). If that feels laggy, the next step is running the
    game on the server.
  - **Anyone leaving a Pong match ends it** (player 2 leaving doesn't fall back to the CPU).
  - **Karaoke volume is a ref distance of 25** with the normal rolloff: not literally constant volume, so
    the far corners are ~0.85. If wrong: tune `STAGE_REF_DISTANCE` in `VoiceChat.js`.
  - **Graffiti has no "clear wall" button**, and the eraser is open to everyone. Memory only (a deploy
    wipes it). If wrong: add a clear (who may use it is Borja's call) or persist to disk.
  - **A turn ends by itself** after 3 darts (no "play again" button: F again). If wrong: add a rematch key.
  - **The tap is at x 5**, not the counter's middle, so F in front of it doesn't pick a stool.
- Spectating (away mode, 2026-10-21):
  - **Losing the connection ends your Vircon32 game**, rather than reclaiming the cabinet, because a
    reconnect respawns the avatar anyway. If wrong: a short network blip kicks you out of the game.
  - **`public/vircon32/index.html` audio tap edited by hand** (the same script as `shell.html`), with no
    emsdk rebuild. If wrong: the next rebuild differs, though it should be identical.
- Direct links (away mode, 2026-10-21):
  - **Any way of closing the first-visit popup counts as answered** (✕, Esc, clicking outside). If wrong:
    people who click past it never see it again.
  - **No automated tests.** The repo has no test runner, and adding Vitest is a separate decision; checks
    were done in the in-app browser instead.
- Vircon32 cabinet at room-local (11, 2, -8), back-right corner. Emulator audio is not positional.
- Every licensed game under 100 MB is bundled in git (~480 MB in history and in the Docker image), per
  Borja's "no LFS" rule. If the image size hurts deploys, move the ROMs to a server volume or CDN.
- Doors centered on the front wall, rooms straight across the street (per Borja, 2026-10-20). The board
  moved from x = 1.09 to x = 7 on the same wall to make room for the door.
- Desarrollo is a copy without the paintings: own board, own radio, own local
  arcades.
- Chat, `/furbo` and Snake high scores stay global across rooms.
- No roofs (camera would clip on them); exterior is minimal.
- Git (since 2026-10-22): commits go straight to `main` on Jastro/gamedevbar (Borja has write access); no
  branches or PRs. Every push deploys, so only finished, built, checked slices get pushed.

## Open questions
- **Leaderboards across deploys (Jastro):** they're saved in `/app/data` inside the container, which a
  deploy replaces. A volume on `/app/data` in the app's stack keeps them (and future saved state).
- Carra's own Vircon32 games (BSD-3) are only on itch.io as zips: download them by hand to add them?
- Should chat become per-room (or show which bar someone is in)?
- Desarrollo's identity: different decoration, default music?

## Next
- More characters: the six models are by an artist who collaborates with the project; new ones (or
  variations) wait for them. They must keep the rig (CORE/Body/Head + floating hands/feet with finger
  bones, clips Grounded/Idle/Jump/Sprint/Walk) for accessories, the seated pose and the gestures.
- Bathroom and lights still accept any room id up to 32 (like darts did): switch them to `isRoomId`.
- Remove the remaining duplicated geometry: level.json's floor still lies under World's (its walls are gone).
