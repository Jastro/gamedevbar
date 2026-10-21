# Vircon32 spectating + Arcade slider: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (unattended inline execution,
> Borja 2026-10-21). Steps use checkbox (`- [x]`) syntax.

**Goal:** Players within 4.5 units of a cabinet see and hear the live game on its screen. A new *Arcade*
slider controls all arcade sound.

**Architecture:**
- The emulator page shell taps SDL2's audio: a unity "tap" node feeds two outputs. One is a player gain
  (the slider) that goes to the speakers; the other is a `MediaStreamAudioDestinationNode`.
- The player's client exposes the canvas `captureStream(30)` and that audio stream.
- Watchers open one `RTCPeerConnection` each to the player (recvonly offer, the player answers with the
  tracks), signaled through a new `virconSignal` relay.
- Watchers draw the video as a `VideoTexture` on the cabinet's screen mesh, and play the audio as
  `PositionalAudio` + `OcclusionChain` at the screen.

**Tech stack:** WebRTC, Three.js r160, Emscripten SDL2 page shell.

**Spec:** `Docs/Plans to be done/2026-10-21-vircon-spectating-design.md`

## Global constraints
- Watch range: `VIRCON_WATCH_DISTANCE = VIRCON_INTERACT_DISTANCE + 1.5` (4.5), with a leave margin of 0.3.
  Horizontal distance via `VirconCabinet.distanceTo`.
- At most `MAX_WATCHERS = 6` per cabinet, nearest first.
- Video at 30 fps, `maxBitrate` 1_000_000. ICE servers are the ones from `init` (`game.voice.iceServers`).
- Uploaded carts are never streamed (`watchable: false`).
- Fails silently to the idle screen: no chat lines, and `console.warn` at most.
- New volume category `arcade`, label `🕹️ Arcade`, persisted with the other volumes.
- UI strings in Spanish. Docs updated in the same PR: Protocol, Vircon32, Systems, PendingUserChecks,
  HANDOVER.

## Review focus
1. **The player leaves mid-stream** (Esc, disconnect, tab closed): watchers return to the idle screen
   within about 1 s. Nothing may stay frozen on the last frame.
2. **A watcher walks in and out repeatedly at the edge:** no leaked `RTCPeerConnection`s
   (the count stays ≤ 1 per cabinet on the watcher, and ≤ 6 on the player).
3. **The player is a watcher's voice peer too:** the voice and stream connections are independent, and
   closing one leaves the other alone.
4. **A watcher in another room within 4.5 units through a wall:** this can't happen given the cabinet
   placement, but the range check must still require the same room (`World.getRoomAt`).
5. **The slider at 0:** silences the player's own emulator, the watcher stream and Snake/Pong, and
   survives a reload.

---

### Task 1: Arcade volume slider + emulator audio tap
**Files:**
- modify `src/audio/AudioSettings.js`, `src/ui/VoiceSettingsUI.js`, `src/world/ArcadePong.js`,
  `src/world/ArcadeSnake.js`, `src/ui/VirconUI.js`;
- modify `tools/vircon32/shell.html` **and** `public/vircon32/index.html` (the same inline script, minified
  by hand; note in `Docs/Vircon32.md` that a rebuild reproduces it).

**Produces:** inside the emulator iframe, `window.virconAudio = { context, tap, output, stream }`:
- `output` is a GainNode, used for the player's volume;
- `stream` is a MediaStream holding the game audio at unity gain.

- [x] `VOLUME_CATEGORIES` gets `arcade`, and the slider shows with the label `🕹️ Arcade`.
- [x] **Shell:** before `index.js` loads, wrap `AudioContext`/`webkitAudioContext`. The wrapper returns
  the real context with an instance `destination` property set to `tap`, and wires
  `tap → output → realDestination` and `tap → MediaStreamDestination`. It sets `window.virconAudio` and
  posts `vircon:audio` to the parent.
- [x] **VirconUI:** on iframe load / `vircon:audio`, and on `audioSettings` `change` for `arcade`, set
  `virconAudio.output.gain.value = arcade`.
- [x] **Snake/Pong:** keep their `AudioListener` and call `listener.setMasterVolume(arcade)`, both at setup
  and on change.
- [x] **Verify:** play Worm. At slider 0, `output.gain.value === 0` while `stream` still has a live audio
  track. Snake's listener master gain follows the slider.
- [x] `npm run build`, then commit.

### Task 2: Server relay + watchable flag
**Files:** `server/features/vircon.js`, `server/config.js` (if a limit is needed), `src/world/VirconSync.js`,
`src/ui/VirconUI.js`, `Docs/Protocol.md`.

**Produces:**
- **Client → server** `virconSignal { roomId, targetId, signal }`, relayed as
  `virconSignal { roomId, fromId, signal }`. The server relays only when the cabinet in `roomId` is
  occupied, `watchable`, and exactly one of sender/target is its player. Same size cap as `voiceSignal`.
- `virconStart` gets `watchable` (a boolean; anything but `true` counts as false). It's stored in the
  cabinet state and goes out in `virconState`/`virconStates`.
- [x] Implement it. VirconUI sends `watchable: !rom.isBlob`.
- [x] **Verify:** start a game with a bundled ROM → `virconState.state.watchable === true`; an upload →
  `false`.
- [x] Commit.

### Task 3: Stream peers (player side and watcher side)
**Files:** create `src/vircon/VirconStreamPeer.js` (one connection, either role) and
`src/vircon/VirconSpectating.js` (range logic, both roles); modify `src/core/Game.js` (construct, `bind`,
`update`) and `src/world/VirconCabinet.js` (show and hide the remote video).

**Interfaces (produced):**
- `VirconCabinet.showRemoteVideo(videoElement)`: makes a `VideoTexture` the screen map and turns
  `idleScreen` on.
- `VirconCabinet.hideRemoteVideo()`: restores `idleTexture` and disposes the video texture.
- `VirconCabinet.getCaptureStreams()`: on the player's client, returns `{ video, audio }` tracks
  (`canvas.captureStream(30)`, and `virconAudio.stream`), or `null` if not ready yet.
- `VirconSpectating`:
  - `bind()`: `virconSignal`, plus `virconState` to drop connections when the occupant changes;
  - `update(listenerPosition)`: throttled to 250 ms.

- [x] **Watcher role**, for each cabinet whose occupant is someone else and is watchable:
  - **In range** (same room, distance ≤ 4.5) with no connection: create a peer with recvonly
    `video` + `audio` transceivers, then offer.
  - **Out of range** (> 4.8), or the occupant changes: close the peer and call `hideRemoteVideo`.
  - **On track:** a muted, playing `<video>` element. Call `showRemoteVideo` once video arrives, and build
    the sound like `VoiceChat.ensureSound`: `PositionalAudio` at `getScreenCenter()` with
    `OcclusionChain`, ref distance 2, volume `arcade`, and the occlusion level from the cabinet's room vs
    the listener's room.
  - **On failure or refusal:** retry after 3 s while still in range.
- [x] **Player role**, on an offer while playing locally a watchable cabinet:
  - refuse (close and send `{ refused: true }`) when the watcher is out of range, or when 6 watchers are
    already connected and this one is farther than all of them;
  - if it's nearer than the farthest connected watcher, evict that one;
  - otherwise answer with the capture tracks, and set the video sender's `maxBitrate` to 1 Mbps;
  - every update, drop watchers now beyond 4.8;
  - on `endPlay`, close all.
- [x] **Verify with two in-app clients, A playing Worm and B as watcher:**
  - B at 4 units: within about 2 s, `video.videoWidth === 640` and the frame count advances; the screen
    mesh map is a VideoTexture;
  - B moves to 6 units: the peer closes and the idle texture is back;
  - B returns to 4 units, then A presses Esc: B goes back to idle;
  - with `MAX_WATCHERS` temporarily set to 1 and a third client nearer, the farther one is evicted.
    Revert the constant afterwards.
- [x] `npm run build`, then commit.

### Task 4: Docs, PR
- [x] Update the docs:
  - `Docs/Vircon32.md`: a spectating section and the audio tap;
  - `Docs/Systems.md`: the Arcade slider;
  - `Docs/Protocol.md`: already updated in Task 2;
  - `Docs/PendingUserChecks.md`: watch feel, delay, upload on a real home connection, the slider;
  - `HANDOVER.md`.
- [x] Move the design and this plan to `Docs/Plans done/`, with Deviations if any.
- [x] Push the branch and open the PR. The PR body states the relay worst case (≈12 Mbps through coturn)
  for Jastro.

## Deviations (2026-10-21)
- **After review:**
  - every signal carries a `peerId`;
  - refused watchers back off from 3 s up to 30 s;
  - eviction needs the newcomer to be 0.5 nearer;
  - the server refuses offers for a cabinet that's gone;
  - the join snapshot clears cabinets it doesn't list;
  - losing the connection ends the local game.
- **Streaming code lives in `src/vircon/`** (`VirconStreamPeer`, `VirconSpectating`). The plan named the
  same files.
