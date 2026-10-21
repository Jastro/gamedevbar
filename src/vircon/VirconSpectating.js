import * as THREE from 'three';
import { OcclusionChain } from '../audio/Occlusion';
import { VIRCON_INTERACT_DISTANCE } from '../world/VirconCabinet';
import { VirconStreamPeer } from './VirconStreamPeer';

// Lets people gathered round a Vircon32 cabinet watch whoever is playing:
// the player's client streams the emulator's picture and sound (WebRTC),
// and watchers show it on the cabinet screen with the sound coming from it.
// Only bundled games (occupant.watchable), only within WATCH_DISTANCE, and
// at most MAX_WATCHERS per cabinet (nearest first), to keep the player's
// upload in check. Anything that fails just leaves the idle screen.

// 1.5 beyond the play range. LEAVE_MARGIN keeps the edge from flapping.
export const WATCH_DISTANCE = VIRCON_INTERACT_DISTANCE + 1.5;
const LEAVE_MARGIN = 0.3;
const MAX_WATCHERS = 6;
const UPDATE_INTERVAL = 250; // ms between range checks
const RETRY_DELAY = 3000; // ms before asking again after a refusal/failure
const SOUND_REF_DISTANCE = 2;

export class VirconSpectating {
    constructor(game) {
        this.game = game;
        // Watcher side: roomId -> { playerId, peer, video, audioElement, sound, occlusion }
        this.watching = new Map();
        this.retryAt = new Map(); // roomId -> time before which we don't ask again
        // Player side: watcherId -> VirconStreamPeer (we play one cabinet at a time).
        this.watchers = new Map();
        this.lastUpdate = 0;
    }

    get localId() {
        return this.game.players.localPlayer?.id;
    }

    bind() {
        const { network } = this.game;
        network.on('virconSignal', (data) => this.handleSignal(data));
        network.on('virconState', (data) => this.handleState(data.roomId, data.state));
        network.on('disconnect', () => this.closeAll());
        this.game.audioSettings.on('change', ({ category, value }) => {
            if (category !== 'arcade') return;
            this.watching.forEach(entry => entry.sound?.setVolume(value));
        });
    }

    cabinet(roomId) {
        return this.game.environment.rooms.get(roomId)?.vircon;
    }

    // Horizontal distance from a cabinet, or Infinity from another room/the street.
    distanceFrom(roomId, position) {
        const contents = this.game.environment.rooms.get(roomId);
        if (!contents || !position) return Infinity;
        if (this.game.world.getRoomAt(position) !== contents.room) return Infinity;
        return contents.vircon.distanceTo(position);
    }

    update(listenerPosition) {
        if (!listenerPosition || !this.localId) return;
        const now = performance.now();
        if (now - this.lastUpdate < UPDATE_INTERVAL) return;
        this.lastUpdate = now;
        this.updateWatching(listenerPosition, now);
        this.updateBroadcast();
    }

    // --- Watcher side --------------------------------------------------------

    updateWatching(listenerPosition, now) {
        const { environment, world } = this.game;
        environment.rooms.forEach(({ room, vircon }, roomId) => {
            const occupant = vircon.occupant;
            const entry = this.watching.get(roomId);
            const range = entry ? WATCH_DISTANCE + LEAVE_MARGIN : WATCH_DISTANCE;
            const eligible = Boolean(occupant?.watchable)
                && occupant.playerId !== this.localId
                && !vircon.isPlayingLocally
                && this.distanceFrom(roomId, listenerPosition) <= range;

            if (entry && (!eligible || entry.playerId !== occupant.playerId)) {
                this.stopWatching(roomId);
            } else if (!entry && eligible && now >= (this.retryAt.get(roomId) ?? 0)) {
                this.startWatching(roomId, occupant.playerId);
            }
            const watching = this.watching.get(roomId);
            if (watching?.occlusion) {
                watching.occlusion.setLevel(environment.getOcclusionLevel(room, world.getRoomAt(listenerPosition)));
            }
        });
    }

    startWatching(roomId, playerId) {
        const entry = { playerId, peer: null, video: null, audioElement: null, sound: null, occlusion: null };
        this.watching.set(roomId, entry);
        entry.peer = new VirconStreamPeer({
            remoteId: playerId,
            role: 'watcher',
            iceServers: this.game.voice.iceServers,
            sendSignal: (signal) => this.game.network.send('virconSignal', { roomId, targetId: playerId, signal }),
            onTrack: (track) => this.attachTrack(roomId, entry, track),
            onClosed: () => {
                if (this.watching.get(roomId) !== entry) return;
                this.stopWatching(roomId);
                this.retryAt.set(roomId, performance.now() + RETRY_DELAY);
            }
        });
    }

    attachTrack(roomId, entry, track) {
        const stream = new MediaStream([track]);
        if (track.kind === 'video') {
            entry.video = document.createElement('video');
            entry.video.muted = true;
            entry.video.playsInline = true;
            entry.video.srcObject = stream;
            // Only replace the idle screen once there's a picture to show.
            entry.video.addEventListener('loadeddata', () => {
                if (this.watching.get(roomId) === entry) this.cabinet(roomId)?.showRemoteVideo(entry.video);
            }, { once: true });
            entry.video.play().catch(() => {});
            return;
        }
        const listener = this.game.environment.audioListener;
        if (!listener) return;
        // Chrome only feeds remote WebRTC audio into Web Audio while the
        // stream is also attached to a media element (muted: heard once).
        entry.audioElement = new Audio();
        entry.audioElement.muted = true;
        entry.audioElement.srcObject = stream;
        entry.audioElement.play().catch(() => {});
        entry.occlusion = new OcclusionChain(listener.context);
        entry.sound = new THREE.PositionalAudio(listener);
        entry.sound.setRefDistance(SOUND_REF_DISTANCE);
        entry.sound.setVolume(this.game.audioSettings.get('arcade'));
        entry.sound.setFilters(entry.occlusion.nodes);
        entry.sound.setMediaStreamSource(stream);
        this.cabinet(roomId)?.addScreenSound(entry.sound);
    }

    stopWatching(roomId) {
        const entry = this.watching.get(roomId);
        if (!entry) return;
        this.watching.delete(roomId);
        entry.peer.close();
        this.cabinet(roomId)?.hideRemoteVideo();
        if (entry.video) entry.video.srcObject = null;
        if (entry.audioElement) entry.audioElement.srcObject = null;
        if (entry.sound) {
            entry.sound.disconnect();
            entry.sound.removeFromParent();
        }
    }

    handleState(roomId, state) {
        const entry = this.watching.get(roomId);
        if (entry && entry.playerId !== state?.playerId) this.stopWatching(roomId);
        this.retryAt.delete(roomId);
    }

    // --- Player side ---------------------------------------------------------

    // The cabinet the local player is streaming from, if any.
    get broadcastRoomId() {
        const session = this.game.ui.vircon.session;
        if (!session || !session.cabinet.occupant?.watchable) return null;
        return session.roomId;
    }

    handleSignal({ roomId, fromId, signal }) {
        if (!signal || typeof signal !== 'object') return;
        const entry = this.watching.get(roomId);
        if (entry && entry.playerId === fromId) {
            entry.peer.handleSignal(signal);
            return;
        }
        if (roomId !== this.broadcastRoomId) {
            // Not (or no longer) ours to stream: let them stop waiting.
            if (signal.description?.type === 'offer') this.refuse(roomId, fromId);
            return;
        }
        if (signal.description?.type === 'offer') {
            this.admit(roomId, fromId, signal.description);
        } else {
            this.watchers.get(fromId)?.handleSignal(signal);
        }
    }

    refuse(roomId, watcherId) {
        this.game.network.send('virconSignal', { roomId, targetId: watcherId, signal: { refused: true } });
    }

    watcherDistance(roomId, watcherId) {
        return this.distanceFrom(roomId, this.game.players.players.get(watcherId)?.position);
    }

    admit(roomId, watcherId, offer) {
        this.watchers.get(watcherId)?.close('replaced', false);
        const distance = this.watcherDistance(roomId, watcherId);
        const tracks = this.cabinet(roomId).getCaptureTracks();
        if (distance > WATCH_DISTANCE + LEAVE_MARGIN || !tracks?.video) {
            this.refuse(roomId, watcherId);
            return;
        }
        if (this.watchers.size >= MAX_WATCHERS) {
            // Keep the nearest: the farthest current watcher makes room, or
            // the newcomer is turned away.
            let farthestId = null;
            let farthest = -1;
            this.watchers.forEach((peer, id) => {
                const d = this.watcherDistance(roomId, id);
                if (d > farthest) {
                    farthest = d;
                    farthestId = id;
                }
            });
            if (distance >= farthest) {
                this.refuse(roomId, watcherId);
                return;
            }
            this.watchers.get(farthestId).close('evicted');
        }
        const peer = new VirconStreamPeer({
            remoteId: watcherId,
            role: 'player',
            iceServers: this.game.voice.iceServers,
            sendSignal: (signal) => this.game.network.send('virconSignal', { roomId, targetId: watcherId, signal }),
            onClosed: () => {
                if (this.watchers.get(watcherId) === peer) this.watchers.delete(watcherId);
            }
        });
        this.watchers.set(watcherId, peer);
        peer.answer(offer, tracks);
    }

    // Drop watchers who walked away; add the game's sound once it exists.
    updateBroadcast() {
        const roomId = this.broadcastRoomId;
        if (!roomId) {
            this.stopBroadcast();
            return;
        }
        if (this.watchers.size === 0) return;
        const tracks = this.cabinet(roomId).getCaptureTracks();
        this.watchers.forEach((peer, watcherId) => {
            if (this.watcherDistance(roomId, watcherId) > WATCH_DISTANCE + LEAVE_MARGIN) {
                peer.close('out of range');
            } else if (tracks) {
                peer.setTracks(tracks).catch(() => {});
            }
        });
    }

    stopBroadcast() {
        this.watchers.forEach(peer => peer.close('stopped'));
        this.watchers.clear();
    }

    closeAll() {
        [...this.watching.keys()].forEach(roomId => this.stopWatching(roomId));
        this.stopBroadcast();
        this.retryAt.clear();
    }
}
