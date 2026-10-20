# Push-to-talk proximity voice chat

Status: done 2026-10-20 (branch `feature/voice-chat`, stacked on `feature/rooms-and-doors`).

## Goal
Players talk to each other with their mic while holding a key (push to talk). Voices come from the speaking
avatar (3D positional) and are muffled through walls and doors exactly like the room music.

## Design
- **[LOCKED]** WebRTC peer-to-peer audio, full mesh between connected players. The existing WebSocket server
  relays signaling (`voiceSignal`) and never touches media. One offerer per pair: the lower user id.
- **[LOCKED]** No renegotiation: every peer connection is created with one `sendrecv` audio transceiver; the
  mic track is attached later with `replaceTrack`. Push to talk toggles `track.enabled` (silence when off).
- **[LOCKED]** Mic is requested on the first push-to-talk press (needs a user gesture, HTTPS or localhost)
  and kept open afterwards for instant PTT.
- **[LOCKED]** Remote voice → `THREE.PositionalAudio` on the speaker's avatar → occlusion chain shared with
  the radios (`src/audio/Occlusion.js`), level from `Environment.getOcclusionLevel(sourceRoom, listenerRoom)`.
  A muted `<audio>` element also holds each remote stream (Chrome only feeds WebRTC audio to Web Audio when
  the stream is attached to a media element).
- **[LOCKED]** Talking indicator: client sends `voiceTalking`, server relays; avatars show a 🎙️ sprite.
- **[PROPOSAL]** PTT key `V`; on-screen 🎙️ hold button for mouse/touch. Released on window blur.
- **[PROPOSAL]** ICE servers come from the server's `init` message (`ICE_SERVERS` env, JSON array);
  default public Google STUN. Players behind strict NATs need a TURN server (not provided).
- Out of scope (backlog): SFU for big rooms, per-user mute/volume, voice activity detection, settings menu.

## Tasks
1. Occlusion helper, Radio uses it, `Environment.getOcclusionLevel`. Touches: `src/audio/Occlusion.js`,
   `src/world/Radio.js`, `src/world/Environment.js`.
2. `VoicePeer` + `VoiceChat` (signaling, mic, remote audio, occlusion). Touches: `src/voice/*`.
3. PTT input + HUD + talking sprite. Touches: `src/ui/VoiceUI.js`, `src/entities/Player.js`,
   `src/core/Game.js`, `index.html`.
4. Server relay + ICE config. Touches: `server.js`.
5. Docs. Touches: `Docs/Architecture.md`, `Docs/Protocol.md`, `HANDOVER.md`, `Docs/PendingUserChecks.md`.

## Deviations
- Chat-container added to the "clicks on UI don't hit the 3D world" list (the emote and mic buttons live there).
