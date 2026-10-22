# Handover

## Start here
2026-10-22. Away-mode batch from `Docs/Plans to be done/2026-10-22-bar-games-plan.md`: bar service and
drunkenness, darts and bathroom graffiti (done, pushed), then karaoke stage and two-player Pong sync, each
pushed to `main` on its own. Next: the next unchecked task in that plan; Borja's checks in
`Docs/PendingUserChecks.md`.

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
- 2026-10-22 Toilet seated pose and the camera gap:
  - **Seated pose:** pooping sits you properly, with hips on the seat and feet forward and up (a procedural
    pose on the foot bones), and everyone sees it.
  - **Bug fix:** the camera escaped the bathroom over the door, because the lintel wasn't a camera occluder.
    Verified with a sweep of 4,410 camera positions from 6 spots inside: 0 escapes. With the lintel removed,
    the same sweep gives 39, so the test can fail.
  - **Also verified:** the pose locally and on a second client (feet at z 0.36, toes 0.48 forward), and a
    front screenshot.
- 2026-10-22 Bathroom and bar tweaks:
  - **Bathroom:**
    - the flush is quieter and the latch clicks;
    - the toilet is centered on its wall and 25% bigger;
    - the cubicle has a ceiling, and the camera collides with its walls, ceiling and closed door;
    - the menu says "¿Qué vas a hacer, guarro?" with Mear / Cagar;
    - the shame tag text is smaller (64 px, was 72);
    - three paintings over the cubicle were raised to clear the ceiling.
  - **Bar:**
    - the counter is a platform you can jump onto;
    - the "Gamedev MV" sign moved from the counter to the back wall, above the paintings, and got bigger.
  - **Verified in-app:**
    - a jump lands on the counter (y 2.3), and walking into it still blocks;
    - the camera stays inside the cubicle below the ceiling, and stops at the wall from outside;
    - you sit on the toilet at its new spot (z 7.5, y 1.1);
    - the latch clicks on each toggle;
    - the new labels show;
    - screenshots of the toilet and the sign.
- 2026-10-22 Bathroom in each bar (plan `Docs/Plans done/2026-10-22-bathroom-plan.md`):
  - **Features:** door with latch and Libre/Ocupado sign, toilet (pee/poo with sounds and bowl visuals),
    flush, sink, mirror, air freshener, its own light and switch, the 10-min stink, and dirty-hands shame
    (lines + tag) until washing.
  - **Bug fix:** an invisible toilet seat from an old `level.json` group was sitting next to the Vircon32.
  - **Verified in-app with two clients:**
    - door and latch sync, and a latched door is refused to the other player;
    - pee stands you at the bowl with yellow water, poo sits you with a 💩 swirl, haze and flies;
    - flush empties the bowl; the freshener ends the stink and shows the spray;
    - shame appears outside and not inside, and washing clears it;
    - the light syncs and darkens the inside; the mirror reflects, only for whoever is inside.
  - **Not judged:** sound levels and the look at play distance.
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
- Pong sync (message `type` overwritten in `WebSocketManager.send`).
- Remove duplicated geometry (level.json vs World vs Bar).
