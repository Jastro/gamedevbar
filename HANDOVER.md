# Handover

## Start here
2026-10-22. Away-mode batch done and pushed (plan `Docs/Plans done/2026-10-22-bar-games-plan.md`): bar
service and drunkenness, darts, bathroom graffiti, the karaoke stage and two-player Pong. Next: Borja's
checks in `Docs/PendingUserChecks.md` (new ones for each of these) and the *Decisions to review* below.

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
- 2026-10-22 Review fixes for the batch (independent review of `6026818..3f689ad`):
  - **Bug fixes:**
    - a client that never joined could take the darts board and leave a nameless turn that broke every
      chalkboard until a restart;
    - made-up room ids could fill the 32-id cap of darts, graffiti and Pong (now only the real rooms,
      `ROOM_IDS` in `server/config.js`);
    - every dart leaked its geometry and materials (now shared);
    - a throw the server dropped for arriving early still counted on the client, which locked the thrower
      in (throws now count on the server's confirmation);
    - `drinkOrder {drink: 'constructor'}` was accepted;
    - the drunk slur garbled `/` commands;
    - a full graffiti wall redrew on every stroke (now every 200 segments).
  - **Verified:** from a raw socket, unjoined `dartsStart`/`pongJoin`, fake room ids, a `constructor` drink
    and an unknown darts room are all rejected (no state in the join snapshots); in-app, 6 rapid throws
    give exactly 3 darts, the turn ends and the view comes back; Pong join/leave still work; no errors.
- 2026-10-22 Two-player Pong:
  - **Bug fix:** `WebSocketManager.send` let a `type` inside the data override the message type, so Pong's
    messages never arrived as sent; `type` now always wins. The old relay (`arcadeState`/`arcadeUpdate`)
    is gone.
  - **Rebuilt:** the server owns who plays each room's machine (`server/features/pong.js`); player 1's
    client runs the game per second and sends 20 snapshots/s, player 2 sends its paddle, watchers draw the
    snapshots. Countdown, first to 5, angle by hit spot, Esc to leave, names on the screen.
  - **Verified in-app with two clients:** F → player 1 vs CPU with the play hint; the second client watches
    the live match (0-1, ball moving), sees "Retar a …", joins → both in a 1 vs 1 countdown; its paddle
    (up 0.7 s → y 40) reaches the host; scores agree (3-0); the match ends 5-0, both go idle and the play
    mode is released; Esc mid-match frees it; screenshot of the live screen; no errors.
  - **Not judged:** smoothness over a real network, difficulty.
- 2026-10-22 Karaoke stage:
  - **Stage** in front of each projector: low platform, mic stand, stage light that fades in while anyone
    is up (worked out from positions, no server state). F at the mic puts you on stage facing the room.
  - **Voice:** a singer is heard at about full volume anywhere in that bar (ref distance 25 instead of 4),
    and normally from outside. The projector panel links to a YouTube karaoke search.
  - **Verified in-app with two clients:** F at the mic → on stage at y 1.25, light at full; the second
    client sees the singer on stage and the light on (the other bar's stays off); a stand-in voice entry
    switches to ref 25 inside the bar and back to 4 from the street; screenshot of the stage; no errors.
  - **Not judged:** real singing over voice chat (needs two mics), loudness against the projector.
- 2026-10-22 Bathroom graffiti:
  - **Wall:** the inside of the cubicle's partition facing the bar is drawable. F → a panel showing the
    wall's own canvas (6 colors, 🧽 eraser, 3 sizes, mouse/pen/touch). Shared live, last 3000 segments per
    wall kept in server memory and sent to late joiners.
  - **Verified in-app with two clients:** F inside facing the wall shows "Pintar en la pared" and opens
    the panel; a drawn face + letter (57 segments) shows in the panel and on the wall (screenshot), the
    second client gets all 57, and again after a reload; malformed batches (out-of-range coordinates,
    bad color, non-array, bad room id, a bad segment mixed with a good one) only let the good segment
    through; walking out closes the panel; no errors.
  - **Not judged:** drawing feel, touch on a phone.
- 2026-10-22 Darts:
  - **Board** on each bar's right wall past the projector, a yellow throw line and a chalkboard (thrower's
    darts, last 6 turns, day's best). F at the line takes the board; a close aiming view, the mouse aims
    a swaying crosshair (wider when drunk), click/Space throws 3 darts, Esc leaves.
  - **Scoring on the server only** (sectors, doubles, triples, 25, bull 50).
  - **Verified:** scoring asserts for bull, 25, T20, D6, 11, 3 and the 5/1 sector edges, plus a wrong
    expectation that fails; in-app with two clients: F at the line enters (hint "Jugar a los dardos"), 3
    throws score 5, 5, 12 = 22 into history and best, the turn ends after 2.5 s and the camera comes back;
    the second client sees the darts stuck, gets "Está tirando…" and can't take the board; Esc mid-turn
    frees it; screenshots of the aiming view and the corner; no errors.
  - **Not judged:** the difficulty, the darts' look in flight, the sounds.
- 2026-10-22 Bar service and drunkenness:
  - **Tap and drinks:** a beer tap at the right end of each counter; F → Caña, Vino, Chupito, Cubata,
    Café, Refresco. The drink shows in your hand (new hand items: shot glass, cubata, coffee cup, soda
    can) and B sips it (3 sips, positional sip sound).
  - **Drunk level** 0..6 on the server, decaying 1 per 2 min; from level 1.5 the camera sways and rolls,
    walking weaves, from 2 the chat slurs, from 3 a "🍺 Borracho/a" tag shows to everyone. Coffee sobers.
  - **Verified in-app with two clients:** F at the tap picks it (not the stool) and opens the menu; a
    cubata + 3 sips → level 1.98 and the hand empties; at level 3.4 the second client sees the wine in
    the first player's hand bone and the tag, and the camera roll shows in a screenshot; slur samples
    read OK (fixed a swap that moved spaces); no console or server errors.
  - **Not judged:** how the effects feel, the drinks' look in the hand.
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
- Remove duplicated geometry (level.json vs World vs Bar).
