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

const DEVICE_STORAGE_KEY = 'voiceInputDevice';
const MIC_PROCESSING = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };

// Push-to-talk proximity voice chat over a WebRTC mesh; the game's WebSocket
// only relays signaling. Events: 'talking' (bool), 'mic' (bool: mic open or
// released), 'error' (reason), 'devices' (input device list may have changed),
// 'peers' (connection status changed), 'peerFailed' (remoteId, first failure only).
// Statuses: 'connecting' | 'connected' | 'failed'.
export class VoiceChat extends EventEmitter {
    constructor(game) {
        super();
        this.game = game;
        this.network = game.network;
        this.peers = new Map(); // remoteId -> { peer, stream, element, sound, occlusion, retries }
        this.peerStatus = new Map(); // remoteId -> status; outlives failed connections for the UI
        this.notifiedFailures = new Set();
        this.localId = null;
        this.iceServers = DEFAULT_ICE_SERVERS;
        this.micTrack = null;
        this.micRequest = null;
        this.pttHeld = false;
        this.isTalking = false;
        this.setupNetworkHandlers();
        navigator.mediaDevices?.addEventListener?.('devicechange', () => this.emit('devices'));
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
        this.network.on('userLeft', (data) => {
            this.disconnectFrom(data.userId);
            this.peerStatus.delete(data.userId);
            this.emit('peers');
        });
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
            onFailed: () => this.handleFailure(remoteId),
            onConnected: () => this.setStatus(remoteId, 'connected')
        });
        if (this.micTrack) entry.peer.setLocalTrack(this.micTrack);
        this.peers.set(remoteId, entry);
        this.setStatus(remoteId, 'connecting');
        return entry;
    }

    setStatus(remoteId, status) {
        if (this.peerStatus.get(remoteId) === status) return;
        this.peerStatus.set(remoteId, status);
        this.emit('peers');
        if (status === 'failed' && !this.notifiedFailures.has(remoteId)) {
            this.notifiedFailures.add(remoteId);
            this.emit('peerFailed', remoteId);
        }
    }

    // [{ id, name, status }] for every remote player we tried to reach.
    getPeerStatuses() {
        return [...this.peerStatus].map(([id, status]) => ({
            id,
            name: this.game.players.players.get(id)?.username ?? '…',
            status
        }));
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
        this.setStatus(remoteId, 'failed');

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
        this.peerStatus.clear();
        this.notifiedFailures.clear();
        this.emit('peers');
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

    // --- Microphone -------------------------------------------------------

    get preferredDeviceId() {
        try {
            return localStorage.getItem(DEVICE_STORAGE_KEY) || null;
        } catch {
            return null;
        }
    }

    // Device of the open mic, or the saved choice if the mic isn't open yet.
    get currentDeviceId() {
        return this.micTrack?.getSettings().deviceId ?? this.preferredDeviceId;
    }

    // Labels are empty until mic permission has been granted once.
    async listInputDevices() {
        if (!navigator.mediaDevices?.enumerateDevices) return [];
        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices.filter(device => device.kind === 'audioinput');
    }

    // `exact` fails if that device is gone; `ideal` falls back to the default.
    requestTrack(deviceId, exact) {
        const audio = { ...MIC_PROCESSING };
        if (deviceId) audio.deviceId = exact ? { exact: deviceId } : { ideal: deviceId };
        return navigator.mediaDevices.getUserMedia({ audio, video: false })
            .then(stream => stream.getAudioTracks()[0]);
    }

    // Asked on the first push-to-talk press (needs a user gesture) and kept
    // open afterwards, so later presses start instantly.
    enableMic() {
        if (!this.isSupported) {
            this.emit('error', window.isSecureContext ? 'unsupported' : 'insecure');
            return Promise.resolve(false);
        }
        if (this.micTrack) return Promise.resolve(true);
        if (this.micRequest) return this.micRequest;

        this.micRequest = this.requestTrack(this.preferredDeviceId, false).then(track => {
            this.useTrack(track);
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

    // Remembers the choice; if the mic is open, swaps devices live (peers get
    // the new track through replaceTrack, no reconnect).
    async setInputDevice(deviceId) {
        try {
            localStorage.setItem(DEVICE_STORAGE_KEY, deviceId);
        } catch {
            // Not critical: the choice just won't be remembered.
        }
        if (!this.micTrack) return true;
        try {
            this.useTrack(await this.requestTrack(deviceId, true));
            return true;
        } catch (error) {
            console.warn('Voice: switching microphone failed', error);
            this.emit('error', 'unavailable');
            return false;
        }
    }

    useTrack(track) {
        const previous = this.micTrack;
        track.enabled = this.isTalking;
        track.addEventListener('ended', () => {
            if (this.micTrack === track) this.handleMicLost();
        });
        this.micTrack = track;
        this.peers.forEach(entry => entry.peer.setLocalTrack(track));
        previous?.stop();
        this.emit('mic', true);
    }

    // Closes the mic (the browser's recording indicator goes away); the next
    // push to talk opens it again.
    releaseMic() {
        if (!this.micTrack) return;
        this.stopTalking();
        this.micTrack.stop();
        this.micTrack = null;
        this.peers.forEach(entry => entry.peer.setLocalTrack(null));
        this.emit('mic', false);
    }

    // Device unplugged or permission revoked: next press asks again.
    handleMicLost() {
        this.stopTalking();
        this.micTrack = null;
        this.peers.forEach(entry => entry.peer.setLocalTrack(null));
        this.emit('mic', false);
    }
}
