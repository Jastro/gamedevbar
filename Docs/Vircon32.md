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
  plus a loading line, with no buttons. It posts `vircon:ready` / `vircon:error` / `vircon:escape` to the
  parent page.
- ROM: `index.html?rom=<path>`, fetched at load (`preload_cartridge.js` upstream). The path can be
  relative (`roms/Worm.v32`) or a same-origin `blob:` URL (an uploaded file).
- Controls (fixed): arrows = D-pad, X / Z / S / A = buttons A / B / X / Y, Q / W = L / R, Enter = Start.

## Bundled games
`public/vircon32/roms/roms.json` lists them for the selector. `LICENSES.md` next to it lists the author,
license and source of each. Only games whose license allows redistribution are added. The current four
are joyrider3774's MIT games (crisp-game-lib with 266 mini games, Formula 1, Worm, Mazethingie), all
under 2 MB.

Left out for now:
- **Large MIT games** by the same author: Puztrix 26 MB, Vircoban 87 MB, Puzzleland 140 MB, Retrotime
  222 MB, and others. They're too big for git and would need hosting outside the repo.
- **Carra's official games** and **Jastro's OceanStorm**: no license stated.
