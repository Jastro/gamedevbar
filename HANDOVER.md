# Handover

## Start here
2026-10-22 (night). Done and pushed: light through open doors, Spain weather outside with each player's
local clock, and the right-click radial menu with seven gestures (plan in `Docs/Plans done/`). Before
that: futbolín, the tragaperras, Madrid time/weather and the bar games batch. 2026-10-23: a round of
fixes (seated pose everywhere, gesture hands, bar layout against the back wall, meme tragaperras). Next: Borja's checks in
`Docs/PendingUserChecks.md`; the forum embed waits for the Mediavida add-on admin.

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
- 2026-10-23 Drivable cars and the fountain: four open-top cars on the ring road (F to drive, W/S/A/D,
  F or Esc to get out), a quiet engine hum, crashes against walls/lamps/fountain/edge, never into a
  bar, no collision with people; the driver's client runs it, the server keeps where it was left.
  A tall, slim fountain in the plaza center with falling water and a water loop. **Verified with two
  clients:** F next to the red car → driving (seated, hint, engine on), 23 units in under 3 s; the other
  client sees the car and the driver seated at the same spot; driving at Desarrollo's open door stops
  at the doorway line (never inside); stops against the fountain (4.4 from its center); drives
  through the other player; F gets out 2 away on a free spot, engine off, pose cleared on both; a
  late joiner sees the car where it was left; screenshots of the fountain and of driving.
- 2026-10-23 The hub: the street is replaced by a round plaza with 6 bar slots around it, a small road
  between each pair out to a ring road, grass and a wall at the map's edge, all computed from the room
  size (plaza radius 31.2 today, ~40 when rooms grow a third). Gamedev keeps slot 0 at the origin,
  Desarrollo moved to slot 1. Colliders are now tested in their own frame (rooms at 60° would have got
  huge world-aligned boxes). Rain/snow follow the camera and skip the bars; lamps by each road; the car
  on the plaza. **Verified:** collisions in Desarrollo (60°) match Gamedev's at all 3,504 grid points
  (782 blocked), platform heights match (counter 1.3, stage 0.25, tables 1.03); walking out of
  Desarrollo stops at its closed door and reaches the plaza with it open; roads free, the edge wall
  blocks; no rain inside bars (966 drops visible, 0 inside); top and plaza-level screenshots.
- 2026-10-23 Second round of fixes:
  - **Gesture hands** are aimed by finger/thumb direction from the rig's finger bones (they hung
    fingers-down when raised): cheer and dance palms forward, push-ups flat on the floor (lifted, they
    were sinking), kiss at the lips, paja thumb-up grip, toast grip with the glass kept upright and tipped
    to drink. **Verified:** measured finger directions match each target, the raised glass points up
    (0.99) and tips toward the face to drink; screenshots of cheer, toast (raised and sip), push-ups.
  - **Futbolín:** no floating scoreboard; the score is printed on both long sides (screenshot).
  - **Tragaperras:** 🐔 LEEROY JENKINS replaces "All your base".
  - **👤 panel** on the right (from 800 px wide; measured 24 px from the right edge).
  - **Bathroom:** a small table in the corner with a powder line, "Esnifar" (sniff + power-up for
    everyone, a lean-in gesture, the line gone 45 s for everyone); the toilet roll was floating, now on a
    wall holder. **Verified with two clients:** hint "Esnifar", line gone on both, the other gets "No queda
    nada" and the "(no queda nada)" hint; screenshots of the corner.
- 2026-10-23 Borja's round of fixes:
  - **Seated pose on every seat** (stools, chairs, car), shown to everyone (`userSat` carries the pose).
  - **Gestures:** hands rotate (kiss: fingers to the lips then palm out; toast: glass tipped into the
    mouth; paja: sideways fist), the paja ends with droplets and a squelch, spitting is a short "ptuh".
  - **Karaoke:** the singer stands 1.0 behind the mic (they overlapped). **Darts** harder (wider, faster
    sway, shakier release).
  - **Layout:** the back shelf and the four arcades are against the back wall; counter, stools, tap,
    radio and glasses moved back 2.65 with the shelf (same gap); paintings up 1, sign up to y 7. The
    counter existed three times (level.json, World, Bar): now only World's, Bar keeps the decoration.
  - **Tragaperras:** renamed, video-game memes on loud tiles with Impact captions, WASTED / COMBO /
    YOU DIED / GG EZ jackpot results (server ids changed, payouts the same, ~88%).
  - **Verified in-app:** overview of the new back wall (screenshot); stools at z -4.15, sitting on a stool
    and a chair shows the pose, the other client gets `seatPose: 'sit'`; kiss/toast/paja frozen at key
    moments (screenshots: rotated hand at the lips, tipped glass, sideways fist); the finish spawns 9
    droplets and ends; singer at 13.4 vs grille 12.6 (screenshot); the tragaperras screen (screenshot);
    payout return recomputed (8.79 per 10).
- 2026-10-22 (night) Right-click radial menu with gestures, Spain weather outside with each player's
  local clock. Details in [HANDOVER_ARCHIVE.md](HANDOVER_ARCHIVE.md).
- 2026-10-22 (evening) Light through open doors, the futbolín, the meme slot machine, Madrid time and
  weather, small fixes (mic, stools). Details in [HANDOVER_ARCHIVE.md](HANDOVER_ARCHIVE.md).
- 2026-10-22 Bar games batch: drinks and drunkenness, darts, bathroom graffiti, karaoke stage, two-player Pong,
  then review fixes. Details in [HANDOVER_ARCHIVE.md](HANDOVER_ARCHIVE.md).
- 2026-10-22 Bathroom in each bar, then tweaks (quieter flush, latch click, ceiling, camera collision, jumpable
  counter, sign on the back wall) and the seated toilet pose. Details in [HANDOVER_ARCHIVE.md](HANDOVER_ARCHIVE.md).
- 2026-10-21 Car + Pokebonk, appearance part 1 (27 accessories, tint, size, name colors), interactions/tables/lights
  (F everywhere, chairs, Shift, standable tables, dormant rooms, switches), controls and movement (Q/E, ❔,
  per-second movement, wall sliding). Details in [HANDOVER_ARCHIVE.md](HANDOVER_ARCHIVE.md).
- 2026-10-21 Vircon32 spectating + Arcade slider (#19), and direct links + 👤 menu (#18). Details in
  [HANDOVER_ARCHIVE.md](HANDOVER_ARCHIVE.md).
- Earlier 2026-10-21 (details in [HANDOVER_ARCHIVE.md](HANDOVER_ARCHIVE.md)):
  - camera pan/reset, with Vircon32 played on the arcade screen;
  - 21 bundled Vircon32 games;
  - the Vircon32 cabinet;
  - the "who's here" board;
  - open mic;
  - GHCR + Portainer deploy;
  - volume sliders and far radios stopping;
  - the arcade jingle fix;
  - El Fary removed;
  - shared radio and projector.
- 2026-10-20 (details in [HANDOVER_ARCHIVE.md](HANDOVER_ARCHIVE.md)):
  - TURN deploy automation;
  - voice-over-TURN fix (per-user coturn credentials);
  - mic settings panel;
  - modular refactor;
  - push-to-talk voice chat;
  - WS hardening and the chat XSS fix;
  - repo docs;
  - rooms, street, doors and audio occlusion.

## Decisions to review
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
- Carra's own Vircon32 games (BSD-3) are only on itch.io as zips: download them by hand to add them?
- Should chat become per-room (or show which bar someone is in)?
- Desarrollo's identity: different decoration, default music?

## Next
- More characters: the six models are by an artist who collaborates with the project; new ones (or
  variations) wait for them. They must keep the rig (CORE/Body/Head + floating hands/feet with finger
  bones, clips Grounded/Idle/Jump/Sprint/Walk) for accessories, the seated pose and the gestures.
- Bathroom and lights still accept any room id up to 32 (like darts did): switch them to `isRoomId`.
- Remove the remaining duplicated geometry (level.json vs World: floor and walls).
