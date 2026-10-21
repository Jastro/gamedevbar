#!/usr/bin/env bash
# Builds the Vircon32 web emulator into public/vircon32/ (see Docs/Vircon32.md).
#
#   tools/vircon32/build.sh <path-to-Vircon32_WebEmulator-clone> [path-to-emsdk]
#
# Same compile line as the emulator's own DesktopEmulator/build_web.sh, but
# with our minimal page shell (tools/vircon32/shell.html) and the output
# written straight into the game's public folder.
set -euo pipefail

SOURCE="${1:?usage: build.sh <Vircon32_WebEmulator clone> [emsdk dir]}"
EMSDK_DIR="${2:-$HOME/emsdk}"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$REPO_ROOT/public/vircon32"

# shellcheck disable=SC1091
source "$EMSDK_DIR/emsdk_env.sh" > /dev/null

cd "$SOURCE/DesktopEmulator"
CONSOLELOGIC_SRC=$(ls ConsoleLogic/*.cpp)
INFRA_SRC="DesktopInfrastructure/FilePaths.cpp DesktopInfrastructure/Logger.cpp DesktopInfrastructure/StringFunctions.cpp"
EMULATOR_SRC="Emulator/AudioOutput.cpp Emulator/EmulatorControl.cpp Emulator/GamepadsInput.cpp Emulator/Globals.cpp Emulator/StopWatch.cpp Emulator/VideoOutput.cpp Emulator/MainWeb.cpp"

mkdir -p "$OUT"
# shellcheck disable=SC2086
em++ \
    -std=c++11 -O2 \
    -I. -IEmulator -IConsoleLogic -IDesktopInfrastructure \
    -s USE_SDL=2 \
    -s WASM=1 \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s MIN_WEBGL_VERSION=1 \
    -s MAX_WEBGL_VERSION=1 \
    -s EXIT_RUNTIME=0 \
    -s DISABLE_EXCEPTION_CATCHING=0 \
    -s FORCE_FILESYSTEM=1 \
    -s GL_ASSERTIONS=0 \
    -lidbfs.js \
    --pre-js Emulator/preload_cartridge.js \
    --pre-js Emulator/persist_storage.js \
    --shell-file "$REPO_ROOT/tools/vircon32/shell.html" \
    --preload-file Data/Bios/StandardBios.v32@/data/Bios/StandardBios.v32 \
    $CONSOLELOGIC_SRC $INFRA_SRC $EMULATOR_SRC \
    -o "$OUT/index.html"

echo "Built $(git -C "$SOURCE" rev-parse --short HEAD) into $OUT"
ls -la "$OUT"
