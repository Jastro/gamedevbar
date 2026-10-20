import * as THREE from 'three';
import { EventEmitter } from '../core/EventEmitter';
import { OcclusionChain } from '../audio/Occlusion';
import { VoicePeer } from './VoicePeer';

// Used until the server's `init` message provides its own list.
const DEFAULT_ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];
const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAY = 2000; // ms

// Distance falloff for voices (inverse model): full volume within
// VOICE_REF_DISTANCE units, about half at twice that.
const VOICE_REF_DISTANCE = 4;
const VOICE_ROLLOFF = 1.2;
const VOICE_HEIGHT = 0.6; // mouth height relative to the avatar origin

// Push-to-talk proximity voice chat over a WebRTC mesh; the game's WebSocket
// only relays signaling. Events: 'talking' (bool), 'mic' (bool), 'error' (reason).
export class VoiceChat extends EventEmitter {
    constructor(game) {
        super();
        this.game = game;
        this.network = game.network;
        this.peers = new Map(); // remoteId -> { peer, stream, element, sound, occlusion, retries }
        this.localId = null;
        this.iceServers = DEFAULT_ICE_SERVERS;
        this.micTrack = null;
        this.micRequest = null;
        this.pttHeld = false;
        this.isTalking = false;
        this.setupNetworkHandlers();
    }

    get isSupported() {
        return Boolean(window.RTCPeerConnection && navigator.mediaDevices?.getUserMedia);
    }

    setupNetworkHandlers() {
        this.network.on('init', (data) => {
            this.closeAll();
            this.localId = data.userId;
            if (Array.isArray(data.iceServers) && data.iceServers.length > 0) {
                this.iceServers = data.iceServers;
            }
        });
        this.network.on('userJoined', (data) => this.connectTo(data.userId));
        this.network.on('userUsername', (data) => this.connectTo(data.userId));
        this.network.on('userLeft', (data) => this.disconnectFrom(data.userId));
        this.network.on('voiceSignal', (data) => this.handleSignal(data.fromId, data.signal));
        this.network.on('voiceTalking', (data) => {
            this.game.players.players.get(data.userId)?.setTalking(data.talking === true);
        });
        this.network.on('disconnect', () => this.closeAll());
    }

    // --- Connections -------------------------------------------------------

    connectTo(remoteId) {
        if (!this.isSupported || !this.localId || !remoteId) return;
        if (remoteId === this.localId || this.peers.has(remoteId)) return;
        // Only the lower id offers; the other side waits for that offer.
        if (this.localId < remoteId) this.createPeer(remoteId, true);
    }

    createPeer(remoteId, isInitiator, retries = 0) {
        const entry = { remoteId, stream: null, element: null, sound: null, occlusion: null, retries };
        entry.peer = new VoicePeer({
            remoteId,
            isInitiator,
            iceServers: this.iceServers,
            sendSignal: (signal) => this.network.send('voiceSignal', { targetId: remoteId, signal }),
            onTrack: (stream) => this.attachRemoteStream(entry, stream),
            onFailed: () => this.handleFailure(remoteId)
        });
        if (this.micTrack) entry.peer.setLocalTrack(this.micTrack);
        this.peers.set(remoteId, entry);
        return entry;
    }

    handleSignal(fromId, signal) {
        if (!this.isSupported || !fromId || !signal || typeof signal !== 'object') return;

        let entry = this.peers.get(fromId);
        if (signal.description?.type === 'offer') {
            // A new offer always means a fresh connection from the initiator.
            const retries = entry?.retries ?? 0;
            if (entry) this.disconnectFrom(fromId);
            entry = this.createPeer(fromId, false, retries);
        }
        entry?.peer.handleSignal(signal);
    }

    handleFailure(remoteId) {
        const entry = this.peers.get(remoteId);
        if (!entry) return;
        this.disconnectFrom(remoteId);

        if (this.localId < remoteId && entry.retries < MAX_RECONNECT_ATTEMPTS) {
            setTimeout(() => {
                if (this.game.players.players.has(remoteId) && !this.peers.has(remoteId)) {
                    this.createPeer(remoteId, true, entry.retries + 1);
                }
            }, RECONNECT_DELAY);
        }
    }

    disconnectFrom(remoteId) {
        const entry = this.peers.get(remoteId);
        if (!entry) return;
        entry.peer.close();
        if (entry.sound) {
            entry.sound.disconnect();
            entry.sound.removeFromParent();
        }
        if (entry.element) entry.element.srcObject = null;
        this.peers.delete(remoteId);
        this.game.players.players.get(remoteId)?.setTalking(false);
    }

    closeAll() {
        [...this.peers.keys()].forEach(remoteId => this.disconnectFrom(remoteId));
    }

    // --- Remote audio ------------------------------------------------------

    attachRemoteStream(entry, stream) {
        entry.stream = stream;
        // Chrome only feeds remote WebRTC audio into Web Audio while the stream
        // is also attached to a media element; muted so it isn't heard twice.
        entry.element = new Audio();
        entry.element.muted = true;
        entry.element.srcObject = stream;
        entry.element.play().catch(() => {});
        this.ensureSound(entry);
    }

    // Built lazily: the listener only exists once the player has entered.
    ensureSound(entry) {
        const listener = this.game.environment.audioListener;
        if (entry.sound || !entry.stream || !listener) return;

        entry.occlusion = new OcclusionChain(listener.context);
        entry.sound = new THREE.PositionalAudio(listener);
        entry.sound.setRefDistance(VOICE_REF_DISTANCE);
        entry.sound.setRolloffFactor(VOICE_ROLLOFF);
        entry.sound.position.y = VOICE_HEIGHT;
        entry.sound.setFilters(entry.occlusion.nodes);
        entry.sound.setMediaStreamSource(entry.stream);
    }

    update(listenerPosition) {
        if (!listenerPosition) return;
        const { world, environment } = this.game;
        const listenerRoom = world.getRoomAt(listenerPosition);

        this.peers.forEach(entry => {
            this.ensureSound(entry);
            const player = this.game.players.players.get(entry.remoteId);
            if (!entry.sound || !player) return;

            // Player.loadModel clears the avatar's children, so re-attach.
            if (entry.sound.parent !== player.mesh) player.mesh.add(entry.sound);
            entry.occlusion.setLevel(environment.getOcclusionLevel(world.getRoomAt(player.position), listenerRoom));
        });
    }

    // --- Push to talk ------------------------------------------------------

    async startTalking() {
        if (this.pttHeld) return;
        this.pttHeld = true;
        if (!this.micTrack && !(await this.enableMic())) {
            this.pttHeld = false;
            return;
        }
        // Released while the permission prompt was open.
        if (this.pttHeld) this.setTalking(true);
    }

    stopTalking() {
        this.pttHeld = false;
        if (this.isTalking) this.setTalking(false);
    }

    setTalking(isTalking) {
        this.isTalking = isTalking;
        if (this.micTrack) this.micTrack.enabled = isTalking;
        this.network.send('voiceTalking', { talking: isTalking });
        this.emit('talking', isTalking);
    }

    // Asked on the first push-to-talk press (needs a user gesture) and kept
    // open afterwards, so later presses start instantly.
    enableMic() {
        if (!this.isSupported) {
            this.emit('error', window.isSecureContext ? 'unsupported' : 'insecure');
            return Promise.resolve(false);
        }
        if (this.micRequest) return this.micRequest;

        this.micRequest = navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            video: false
        }).then(stream => {
            this.micTrack = stream.getAudioTracks()[0];
            this.micTrack.enabled = false;
            this.micTrack.addEventListener('ended', () => this.handleMicLost());
            this.peers.forEach(entry => entry.peer.setLocalTrack(this.micTrack));
            this.emit('mic', true);
            return true;
        }).catch(error => {
            console.warn('Voice: microphone unavailable', error);
            this.emit('error', error.name === 'NotAllowedError' ? 'denied' : 'unavailable');
            return false;
        }).finally(() => {
            this.micRequest = null;
        });
        return this.micRequest;
    }

    // Device unplugged or permission revoked: next press asks again.
    handleMicLost() {
        this.stopTalking();
        this.micTrack = null;
        this.peers.forEach(entry => entry.peer.setLocalTrack(null));
        this.emit('mic', false);
    }
}
