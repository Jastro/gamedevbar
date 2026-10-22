# Handover

## Start here
2026-10-22 (later). Done and pushed: real time and weather in Madrid, the meme slot machine and the
futbolín (plan in `Docs/Plans done/2026-10-22-futbolin-slots-weather-plan.md`), after the bar games batch
(drinks, darts, graffiti, karaoke, two-player Pong). Next: Borja's checks in `Docs/PendingUserChecks.md`;
the forum embed waits for permission from the Mediavida add-on admin.

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
- 2026-10-22 Spain weather outside, local clock: the street shows Spain in general (8 cities, rain if 3+
  have it); the clocks show each player's local time and weather (browser location, rounded, cached a
  day; fallback Madrid / Las Palmas). **Verified:** combine asserts (dry with 2 wet cities, rain with 3,
  storm wins, fog, overcast, Madrid sun times, average temperature; plus a wrong one that fails); live
  8-city fetch (partly cloudy, 16.3 °C); in-app: location denied → Madrid local weather on the clock;
  stubbed location (Barcelona) → rounded 41.4 / 2.2, cached, "☁️ 18°C · Tu zona".
- 2026-10-22 Light through open doors (plan `Docs/Plans to be done/2026-10-22-doors-light-local-weather-gestures-plan.md`):
  a bar you're not in is lit by two door lights while its door is open; from inside, the street's
  materials are dimmed to the sky's light. **Verified** at night: from the street the open doorway shows
  a lit inside (Gamedev's door lights at 9, Desarrollo's at 0 with its door closed); from inside, the
  street through the door is dark (dim 0.35); screenshots.
- 2026-10-22 Futbolín:
  - **Table** on the left side of each bar; F on a long side joins that team, 2 per team (alone you have
    all 4 rods, partners split back/front). Practice alone, matches to 5 with countdown and goal pauses.
  - **The server runs the physics** (60 Hz against real time) and sends 20 snapshots/s; players send rod
    targets and kicks. Your view looks down from your side, your avatar hidden.
  - **Verified:** headless runs on the server (phases, rod split, a 25 s bot match: 65 kicks, 15 hits,
    a goal; fixed real-time stepping and a dead zone between the midfield rods); in-app with two
    clients: hints by side, red alone → practice, blue joins → countdown → play, blue's W slides its
    rods away (server and the other client agree), the ball matches on both clients, Esc releases the
    view and the avatar, a player who leaves can walk off (not stuck in the table); screenshots; no
    errors.
  - **Not judged:** the feel (speeds, kick strength), lag over a real network, 2 vs 2 with four people.
- 2026-10-22 Meme slot machine:
  - **Machine** against each bar's left wall; F pulls the lever, the server rolls, everyone watches the
    same spin. Symbols drawn in code (🗿, 🤡, 💀, 🐕 much wow, 🍄 1UP, 🎂 cake is a lie, F, 📈 stonks).
  - **Coins** per connection: 100 to start, bet 10, pair 18, triples up to 1000; broke → 50 once a minute.
  - **Verified:** payout asserts (+ a wrong one that fails) and the expected return (8.79 per 10); a mock
    hub: bailout once, then "broke" for 60 s, unjoined players and bad rooms ignored; in-app with two
    clients: hint with coins, spins sync (same reels on both), only the spinner's coins change, a second
    pull while spinning gets "Espera…"; screenshot of the screen.
  - **Not judged:** the look, jingles, how generous it feels.
- 2026-10-22 Real time and weather (Madrid):
  - **Server** asks Open-Meteo every 10 min (code, temperature, clouds, wind, sunrise/sunset).
  - **Client:** the sky follows the real sun and clouds; outside, the street light follows the sky and two
    lamp posts come on at night; rain, drizzle, snow, fog and storms (lightning + thunder) over the
    street only; a clock above each bar's door ("23:18 · 🌧️ 14°C · Madrid").
  - **Verified:** a real fetch (13.9 °C, sunrise 08:33, sunset 19:24); in-app at 23:17 Madrid: night sky,
    street ambient 0.22, lamps on (screenshot); forced storm: rain streaks and a lightning flash
    (screenshot); forced snow by day: round flakes (screenshot, after fixing square flakes); inside the
    bar the lights stay on their switch, no fog, rain quieter; the clock (screenshot).
  - **Not judged:** the look by day, sound levels.
- 2026-10-22 Small fixes (`8c2017e`): the karaoke mic faces the singer, no mic prompt while on stage,
  bar stools face the counter straight on (they faced its middle).
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
- Remove duplicated geometry (level.json vs World vs Bar).
