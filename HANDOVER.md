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
- 2026-10-22 Right-click radial menu and gestures: Emojis / Animaciones; 💃 dance, 💪 push-ups, ✊ paja,
  😘 kiss, 💦 spit, 🙌 cheer, 🍻 toast, procedural on the bones in avatar space, synced to everyone.
  **Verified in-app with two clients:** both rings (7 gestures + back); dance and cheer move the
  hands/body (screenshots); push-ups lay the body face down just above the floor (lowest point 0.09,
  screenshot); the toast lends a beer (screenshot); spit spawns 6 droplets and kiss hearts, all cleaned
  up; ✊ hand at its target; the other client plays them (time advancing, model tipped for push-ups);
  walking stops it on both and the model returns to rest; Emojis still opens and closes the panel.
  **Not judged:** how each one looks and reads on every character.
- 2026-10-22 Spain weather outside, local clock: the street shows Spain in general (8 cities, rain if 3+
  have it); the clocks show each player's local time and weather (browser location, rounded, cached a
  day; fallback Madrid / Las Palmas). **Verified:** combine asserts (dry with 2 wet cities, rain with 3,
  storm wins, fog, overcast, Madrid sun times, average temperature; plus a wrong one that fails); live
  8-city fetch (partly cloudy, 16.3 °C); in-app: location denied → Madrid local weather on the clock;
  stubbed location (Barcelona) → rounded 41.4 / 2.2, cached, "☁️ 18°C · Tu zona".
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
- Bathroom and lights still accept any room id up to 32 (like darts did): switch them to `isRoomId`.
- Remove the remaining duplicated geometry (level.json vs World: floor and walls).
