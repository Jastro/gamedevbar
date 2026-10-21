# Handover

## Start here
2026-10-21. Working toward forum embeds. Direct links, 👤 menu and arcade spectating are merged
(#18, #19). `feature/controls-and-movement` (PR open) adds the controls change and the movement rework.
Next: Borja's checks in `Docs/PendingUserChecks.md`, on the server.

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
- 2026-10-21 Vircon32 spectating + 🕹️ Arcade slider (plan `Docs/Plans done/2026-10-21-vircon-spectating-plan.md`):
  - **Who watches:** people within 4.5 of a cabinet see and hear the player's game on its screen (WebRTC
    from the player: canvas at 30 fps capped at 1 Mbps, plus the emulator's audio tap). At most 6
    watchers, nearest first. Bundled games only.
  - **Slider:** the Arcade slider drives the emulator's gain, watched games and Snake/Pong.
  - **Verified (three in-app clients):**
    - B at 4 units gets 640×360 frames advancing at about 30 fps, plus audio packets, and its screen
      shows the game;
    - out of range → idle, and back in → watching again; the player keeps 1 connection, so none leak;
    - Esc → idle; the player's socket dropping ends their game, and the watcher → idle;
    - with the cap set to 1, a nearer C took the slot and B was refused with back-off;
    - an uploaded cart is not watchable;
    - an offer to a ghost cabinet is refused by the server at once;
    - the slider moves the emulator gain and the Snake/Pong master gains.
  - **Not verified:** two real networks or TURN, quality or delay by eye, and the player's frame rate
    while streaming.
  - **Bug fix (old):** the `virconStates` join snapshot never cleared cabinets freed during a reconnect.
- 2026-10-21 Direct links + customization (plan `Docs/Plans done/2026-10-21-direct-join-plan.md`):
  - **Links:** `/<roomId>` skips the start dialog. You see a loading card, then the bar.
  - **First visit:** `Parroquiano NNNN` and a random character, both remembered, plus a one-time
    *¿Quieres personalizar tu personaje?* popup.
  - **👤 menu:** changes nick and character live for everyone.
  - **Shared memory:** `/` pre-fills the remembered nick.
  - **Sound:** on a direct link it starts on the first click or key.
  - **Bug fix:** below ~900 px the 😊/🎙️/⚙️ buttons were off-screen. They now sit in a row above the chat
    input.
  - **Verified (two in-app clients):**
    - production routes (`/Gamedev/`, `/foo` → app; files still served; `/a/b` 404);
    - a fresh `/desarrollo` gives a placeholder and a random model in Desarrollo with no preview canvases;
    - a reload keeps both;
    - `/` shows the dialog pre-filled;
    - `/foo` shows the dialog;
    - the profile functions work with `localStorage` throwing;
    - popup *Sí* opens the menu, and B saw A's new name and model live;
    - an empty nick is ignored, and reopening keeps 6 canvases;
    - the buttons are on screen at 375 and 820 px.
  - **Not verified:** the autoplay unlock, because the in-app browser doesn't block autoplay, so the
    suspended → running path was never exercised.
  - **Fixed after review:**
    - `/gamedev/` redirects to `/gamedev`, and `level.json` plus the bathroom sounds now load from absolute
      paths. Before, a trailing slash gave an empty scene.
    - The audio unlock retries until the context runs.
    - ⚙️ fits on phones.
    - A model change mid-load keeps the latest pick, and the menu previews resize.
    - The popup can't open twice on reconnect.
  - **Bug fix:** every model change kept the previous model attached to the avatar (`Player.loadModel`
    matched it as an undefined "chat sprite"). Verified: after three quick changes, one model is left.
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
  - **Branch stacked on `feature/direct-join`.** Merge #18 first, otherwise the spectating PR also shows
    #18's commits.
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
- Git: per the request, work went to a branch + PR instead of straight to `main`.

## Open questions
- Carra's own Vircon32 games (BSD-3) are only on itch.io as zips: download them by hand to add them?
- Should chat become per-room (or show which bar someone is in)?
- Desarrollo's identity: different decoration, default music?

## Next
- Pong sync (message `type` overwritten in `WebSocketManager.send`).
- Remove duplicated geometry (level.json vs World vs Bar).
