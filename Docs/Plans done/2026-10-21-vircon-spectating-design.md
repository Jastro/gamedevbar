# Vircon32 spectating + arcade volume slider (design)

2026-10-21. Status: approved 2026-10-21, built (plan `2026-10-21-vircon-spectating-plan.md`). Own branch/PR (`feature/vircon-spectating`), after
the direct-join PR.

## Why
Today, while someone plays the Vircon32 cabinet, everyone else sees only "🎮 name · game" on it. A bar
arcade is a social spot: friends crowd round, watch, cheer over voice and take turns. Spectating turns
the cabinet from a solo screen into that.

## What Borja decided
- **What watchers get:**
  - the game exactly as the player sees and hears it;
  - on the cabinet's own screen in the 3D bar, with the sound coming from the machine.
- **Who can watch:** only people gathered round, at most about 1.5 m beyond the play range. Play range is
  `VIRCON_INTERACT_DISTANCE` = 3, so the watch range is 4.5 units from the cabinet.
- **Arcade slider:** a new *Arcade* volume slider in ⚙️ next to radio, projector and voices.
- **TURN relay allowed, capped** (2026-10-21). When a watcher and the player can't connect directly, the
  stream may go through the coturn relay on Jastro's server.
  - Video is capped at about 1 Mbps per watcher.
  - The PR description must tell Jastro the worst case: 6 watchers × 2 cabinets ≈ 12 Mbps of relay.
- **Bundled games only** (2026-10-21). Carts uploaded from your own `.v32` can't be watched; they stay
  private as today, since nobody has checked their licenses.

## Claude's calls (agreed in conversation, no objection)
- **Transport.** The player's browser streams the emulator's picture and sound over WebRTC, peer to peer.
  - It uses the ICE/TURN servers the client already gets in `init`.
  - Watchers are a fraction of a second behind. The server only relays signaling.
  - Rejected: every watcher running the emulator from the player's inputs. It's cheaper, but copies can
    drift, which breaks "exactly as the player sees it".
- **Cap:** at most 6 watchers per cabinet, nearest first (up to about 1 Mbps upload each).
- **Watchers' movement:** free, with nothing locked. The player's experience is unchanged.
- **Slider scope:**
  - Vircon32 sound, for the player and for watchers;
  - the old in-bar arcade sounds (`ArcadeSnake.js`, `ArcadePong.js`).

## Goals
- Walk into range → the live game appears on the cabinet within about 1 s. Walk out → back to the idle
  screen, and the connection closes.
- Watchers hear the game from the cabinet: positional, and muffled through walls like voices.
- The server's own process only relays signaling. Media goes peer to peer, or through coturn when no
  direct path exists (capped, see above).

## Non-goals
- Watching from across the room, a fullscreen spectator view, recording, chat overlays.
- Multiplayer Vircon32 (several pads), queues or turn-taking. Cheering is done over voice.

## Anti-goals
- Any change in the player's own framerate or input latency that they'd notice.
- Streams running to people out of range: upload use must follow the range rule.
- Errors, chat spam or a broken idle screen when a stream can't connect. It falls back silently to the
  current "🎮 name · game" screen.

## Constraints and what already exists
- **Emulator page.** The emulator runs in a same-origin iframe (`/vircon32/index.html?rom=...`, started by
  `VirconCabinet.startLocal`). The parent can reach its `<canvas id=canvas>` (a WebGL canvas).
  `canvas.captureStream(30)` works on it.
- **Emulator audio.** It comes from Emscripten SDL2's own `AudioContext` inside the iframe. To capture it and
  to apply the slider, the page shell must route that context's output through a `GainNode`, and also
  into a `MediaStreamAudioDestinationNode` that the parent can read.
  - The shell is `tools/vircon32/shell.html`.
  - The deployed `public/vircon32/index.html` is that shell, minified by emcc, with
    `<script async src=index.js>`.
  - Regenerate it with `tools/vircon32/build.sh` (needs emsdk, see `Docs/Vircon32.md`), or apply the
    identical change to both files and say so.
- **Voice connections can't carry the stream.** `VoicePeer` is audio-only by design: one transceiver,
  `replaceTrack`, and no renegotiation. Use separate per-watcher connections that exist only while
  watching.
- **Signaling.** Mirror `voiceSignal`: client → server `{targetId, signal}`, size-capped, relayed only
  when one side is the cabinet's current player (`server/features/vircon.js` knows who that is).
- **Who is playing.** `VirconSync` / `virconState` already tell every client who plays each cabinet.
- **Picture on the watcher's side.** The cabinet has an idle screen mesh with a canvas texture. It hides
  while the local player plays through the CSS3D iframe.
- **Positional sound.** `VoiceChat.ensureSound` shows the pattern: `THREE.PositionalAudio` +
  `OcclusionChain`, with a muted `<audio>` element kept attached (Chrome needs it for remote WebRTC audio).
- **Volume settings.** `AudioSettings` holds `VOLUME_CATEGORIES` (`radio`, `video`, `voice`) and persists
  them. `VoiceSettingsUI` renders the sliders.
- **Language.** UI strings in Spanish.

## Builder's calls
- **Who opens the connection.** The watcher's client opens it, with an offer using recvonly video+audio
  transceivers. The player's client answers, attaching the captured tracks.
  - The player's client enforces the cap. It knows everyone's positions and refuses beyond 6, nearest
    kept.
  - A refused watcher retries after a few seconds while still in range.
- **Range checks.**
  - Horizontal distance to the cabinet, measured in world space, every few hundred ms, not every frame.
  - Leaving range uses a small margin (say 0.3), so standing on the edge doesn't flap.
  - Both sides check: the watcher closes when it walks out, and the player drops watchers who are out of
    range.
- **Watcher's picture.** A `THREE.VideoTexture` on the existing screen mesh, swapped with the idle
  texture. No CSS3D: it keeps depth, so people in front still cover it.
- **Watcher's sound.** `PositionalAudio` at the screen center, with `OcclusionChain`, volume from
  `arcade` (×1). Ref distance and rolloff are tuned so it's clear inside the 4.5 range.
- **Player's own sound.** It goes through the iframe gain, set from `arcade` and updated live.
- **Video settings.** Capture at 30 fps. Let WebRTC adapt the bitrate, but cap it at about 1 Mbps
  (`RTCRtpSender.setParameters` `maxBitrate`), for direct and relayed connections alike.
- **Telling clients a game is watchable.** `virconStart` carries `watchable: false` for uploaded carts.
  - The server stores it and sends it in `virconState`.
  - Watchers don't try to connect to those cabinets, and the player refuses offers for them.
- **Git.** Branch `feature/vircon-spectating` from `main` once the direct-join PR has merged (both touch
  the HUD/settings area) → PR to `Jastro/gamedevbar`. Each commit must be shippable, since merging
  deploys.
- **Ending.** The connection closes when the player stops (Esc, disconnect, `virconState` null).
  Watchers then fall back to the idle screen.

## Done looks like
- Verified with two in-app clients and a real emulator (Worm):
  - the watcher in range gets frames (`videoWidth > 0`, frames advancing) and audio samples;
  - out of range, the connection closes and the idle screen is back;
  - Esc on the player ends it for the watcher.
- Cap tested with the constant temporarily lowered to 1 and two watchers.
- The slider changes the player's own Vircon32 sound, a watcher's stream sound and Snake/Pong sounds, and
  persists across reload.
- `npm run build` passes. Updated in the same PR: `Docs/Protocol.md` (new message),
  `Docs/Vircon32.md`, `Docs/Systems.md` (audio/slider), `Docs/PendingUserChecks.md` (watch feel,
  delay, upload on a real home connection).
