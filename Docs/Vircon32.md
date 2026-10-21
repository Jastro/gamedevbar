# Vircon32 cabinet

Last updated 2026-10-21.

[Vircon32](https://www.vircon32.com/) is a 32-bit fantasy console by Carra. Every room has a Vircon32
arcade cabinet that plays the console's games on its 3D screen.

## Emulator build
- Source: [joyrider3774/Vircon32_WebEmulator](https://github.com/joyrider3774/Vircon32_WebEmulator) at
  commit `a1e89b6bf2d56240c4c8c8bce61c5384c146dec7`. It's an Emscripten port of the official desktop
  emulator, a fork of [vircon32/WebEmulator](https://github.com/vircon32/WebEmulator). The software is
  BSD-3-Clause; the assets and BIOS are CC BY 4.0.
- Output, committed: `public/vircon32/index.{html,js,wasm,data}`, ~1.9 MB. The `.data` file is the
  standard BIOS. WebGL1, SDL2 audio, keyboard only.
- Rebuild: install emsdk (`git clone https://github.com/emscripten-core/emsdk && ./emsdk install latest
  && ./emsdk activate latest`), then run
  `tools/vircon32/build.sh <path to the emulator clone> <path to emsdk>` from Git Bash. The script uses the
  upstream compile line with our page shell, `tools/vircon32/shell.html`. That shell is only a canvas
  plus a loading line, with no buttons. It posts `vircon:ready` / `vircon:error` / `vircon:escape` /
  `vircon:audio` to the parent page.
- **Audio tap** (in the shell): it wraps `AudioContext` so SDL2's output (`audioContext.destination`)
  goes to a unity `tap` gain:
  - `tap → output` (the player's 🕹️ Arcade volume) `→` speakers;
  - `tap →` a `MediaStream` streamed to spectators.
  - Exposed as `window.virconAudio` inside the iframe.
  - `public/vircon32/index.html` carries the same script, minified by hand (2026-10-21). A rebuild from
    the shell reproduces it.
- ROM: `index.html?rom=<path>`, fetched at load (`preload_cartridge.js` upstream). The path can be
  relative (`roms/Worm.v32`) or a same-origin `blob:` URL (an uploaded file).
- Controls (fixed): arrows = D-pad, X / Z / S / A = buttons A / B / X / Y, Q / W = L / R, Enter = Start.

## Bundled games
`public/vircon32/roms/roms.json` lists them for the selector (title, author, description, size).
`LICENSES.md` next to it lists the author, license and source of each. Only games whose license allows
redistribution are added, plus Ocean Storm, included with Jastro's permission (2026-10-21). Files must
stay under GitHub's 100 MB per-file limit, because the repo doesn't use Git LFS.

As of 2026-10-21: 21 games, ~480 MB.
- Ocean Storm (Jastro).
- 13 by joyrider3774 (MIT, BSD-3, and two GPL-3 collections).
- 6 from Carra's CommunityContent repo (MIT/BSD-3).

Those ~480 MB live in git history and in every Docker image. Clients only download the game they pick.

Licensed but not bundled:
- **Over 100 MB:** Puzzleland, Retrotime.
- **Only as itch.io zips:** Carra's own games (BSD-3 / CC BY 4.0). Download them by hand, then add them
  the usual way, with their music credits.
- **No license stated:** four community games.

## In the bar
- **Cabinet:** one per room at room-local (11, 2, -8), the back-right corner (`src/world/VirconCabinet.js`).
  The idle screen shows the logo, or "🎮 name · game" while someone plays.
- **Picking a game:** click it or press `E` within 3 units → panel (`src/ui/VirconUI.js`). It lists the
  bundled games (`roms.json`) and a *📂 Cargar mi .v32* button (the file plays only on your client).
- **One player per cabinet:** `virconStart` → server → `virconState` (or `virconBusy`), handled in
  `server/features/vircon.js` and `src/world/VirconSync.js`. Freed on Esc or disconnect. People farther
  away see the player's name and game title.
- **Spectating** (`src/vircon/`): anyone within 4.5 units of the cabinet (play range + 1.5, same room)
  sees and hears the live game on the cabinet's screen.
  - **Watcher:** offers a receive-only WebRTC connection (`virconSignal`, relayed by the server only to or
    from the cabinet's player).
  - **Player:** answers with the emulator canvas (`captureStream(30)`, capped at 1 Mbps) and the audio
    tap.
  - **On screen:** a `VideoTexture` on the screen mesh, so people in front still cover it. The sound is a
    `PositionalAudio` at the screen, muffled by walls, on the Arcade slider.
  - **Limits:** at most 6 watchers, nearest first. A newcomer must be 0.5 nearer to take the farthest
    watcher's slot. A refused watcher retries after 3 s, doubling up to 30 s; a new game resets that.
  - **Connection ids:** every signal carries the connection's `peerId`, so late messages from an earlier
    connection are ignored.
  - **Lost connection:** the player's game ends. The join snapshot also clears cabinets it doesn't list.
  - **Ending:** leaving range (+0.3 margin), Esc or a disconnect brings back the idle screen.
  - **Uploaded carts** are never streamed (`watchable: false`): nobody has checked their licenses.
  - **Network:** ICE uses the same STUN/TURN as voice, so when no direct path exists the stream goes
    through coturn. Worst case about 12 Mbps (2 cabinets × 6 watchers × 1 Mbps).
- **Play mode:** `game.playMode` is set, which turns off movement and world clicks/`E`, and the hint shows
  the controls. The camera is locked in front of the cabinet (`Camera.setView`), 0.3 above the screen and
  close enough that the screen takes about half the view for the camera's FOV and aspect
  (`PLAY_VIEW_FILL`/`PLAY_VIEW_RISE` in `VirconCabinet.js`): the game runs on the arcade, not fullscreen.
  Wheel zoom and right-drag rotation are off; middle-drag still pans and R (even from inside the
  emulator) re-centers. The avatar stands in front. Keyboard focus is moved into the iframe (same origin), so the game
  gets the keys and the bar doesn't. Clicking the page gives focus back to the game, except when the click
  is in a text field (chat). Esc, sent by the iframe or pressed in the page, ends the session and unloads
  the emulator.
- **Rendering:** the emulator iframe sits on the screen through the CSS3D layer, with a transparent "hole"
  mesh like the projector's, so it's drawn only while you play. The player hears the emulator directly
  (not positional), at the Arcade volume.
