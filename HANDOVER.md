# Handover

## Start here
2026-10-21. Working toward forum embeds. Direct links, 👤 menu, arcade spectating and the controls/movement
rework, interactions/tables/lights and appearance part 1 are merged (#18-#21, #23). `feature/car-pokebonk`
(#22, open; main merged in): chairs face tables, shorter jump, Enter to chat, Pokebonk cabinet, the smoke
car. Next: Borja's checks in `Docs/PendingUserChecks.md`.

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
- 2026-10-21 Car, Pokebonk, small fixes (plan `Docs/Plans done/2026-10-21-car-pokebonk-plan.md`):
  - **Chairs:** they faced sideways and now face their table (verified for all 24).
  - **Jump:** 1.43 high and 0.6 s in the air.
  - **Chat:** Enter focuses it.
  - **Cabinets:** the Vircon32 moved to x 12.5, and a Pokebonk cabinet plays the site on its screen
    (verified: it loads in the frame, and Salir restores everything). The Vircon32 still plays.
  - **Smoke car** (verified with two clients):
    - countdown 5→3, then smoke and hiss;
    - fade at 3 s, and the two passengers land at different spots in Desarrollo;
    - the seats are freed.
  - **Not judged:** the look of the smoke and car, the hiss volume, and Pokebonk's playability on the
    cabinet.
- 2026-10-21 Appearance, part 1 (plan `Docs/Plans done/2026-10-21-appearance-plan.md`):
  - **Items:** 27 accessories built in code: 13 hats (cap, top hat, viking helmet, crown, beret, gamer
    headset, mushroom, ? block, halo, horns, beer helmet, pirate hat, chef hat), 6 face items, and 8 hand
    items (beer, wine, bottle, tortilla pincho, gamepad, pixel sword, mic, 1UP mushroom).
  - **Also:** a color tint, a size slider and name colors; the 👤 menu has tabs. Everything is saved and
    synced.
  - **Verified in-app:**
    - items on the bones of pj, pj2, pj3, pj4, pj5 and pj6, checked by eye on screenshots (a mustache and
      the chicken/Santa hat heights were fixed);
    - a second client sees crown + monocle + gamepad + tint live;
    - the appearance comes back after a reload;
    - the server shape check drops bad ids and colors.
  - **Not judged:** item fit and feel at play distance.
  - **Next step:** part 2, more characters (find the asset pack and its license) and per-part colors.
- 2026-10-21 Interactions, tables, lights (plan `Docs/Plans done/2026-10-21-interactions-tables-lights-plan.md`):
  - **F everywhere:** F works for everything, and the target is the nearest thing in front of you.
  - **Chairs:** they're seats now, at chair height, facing the table.
  - **Running:** Shift (5.5 units/s).
  - **Tables:** you can stand on them, and all other colliders block at any height.
  - **Empty rooms:** their radio and projector pause after 30 s and resume live.
  - **Light switches:** normal / low / disco, shared per room.
  - **Bug fixes:** stools and chairs never highlighted on hover; jumping onto a table landed you inside
    it; a jump could carry you over the bar or a fence.
  - **Verified in-app:**
    - F hints for chair, stool, radio (when facing it), Pong, Snake, projector, door, Vircon32, the three
      switches, and nothing in open space;
    - Shift: 5.1 units in the first second;
    - you can't walk through a table; jumping onto one stands you at y 2.03, and walking off drops you
      to the floor;
    - jumping at the bar doesn't land you on it;
    - a chair sits you at y 1 facing the table;
    - the radio goes dormant 30 s after the room empties and comes back live on entry (projector logic
      checked with a stub player; the in-app browser's YouTube player never became ready);
    - switches sync between two clients, a late joiner gets the snapshot, and the lighting follows
      (low: ambient 0.18 warm; disco: three moving colored lights; all off: dark).
  - **Not judged:** the look and feel.
- 2026-10-21 Controls and movement (`feature/controls-and-movement`):
  - **Controls:** Q/E rotate the camera, F interacts (E did before), a right click opens the emojis at the
    cursor (a right drag still rotates), and a ❔ button lists every control. *Guardar* closes the 👤 menu,
    and V talks while playing the Vircon32. Each radio shows "📻 station" above it.
  - **Movement:**
    - per second instead of per frame, so the speed was frame-rate dependent before;
    - acceleration and deceleration, smooth turning;
    - sliding along walls, plus a door-frame assist;
    - a collision box of 0.8 instead of 1.0;
    - position sent at most 20/s instead of every frame;
    - other players smoothed per second, with smooth turning.
  - **Bug fix:** every collider's box was recomputed on every collision check and every frame. Now
    1000 checks take 0.8 ms.
  - **Bug fix:** Space typed in the chat made you jump.
  - **Verified in-app:**
    - 1 s of walking = 2.98 / 2.96 / 2.94 units at 30 / 60 / 144 fps;
    - a diagonal into a wall slides; straight into the door frame 0.2 off-center eases through; head-on
      into a wall stops;
    - Q/E rotate and are ignored while typing in the chat;
    - a right click opens the emojis at the cursor, and a right drag rotates without opening them;
    - E no longer interacts and F does (hint "F · Cerrar puerta");
    - the ❔ panel opens and fits at 375 px;
    - *Guardar* closes the menu;
    - V inside the emulator starts and stops talking;
    - the radio label is readable;
    - a second client sees the moved player converge, rotation included.
  - **Not judged:** the feel. That's for Borja.
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
