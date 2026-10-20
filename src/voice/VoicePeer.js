// One WebRTC connection to one remote player, audio only.
// Created with a single sendrecv transceiver so the mic can be attached or
// swapped later with replaceTrack, without renegotiating. Exactly one side
// of each pair (the initiator) sends the offer, so offers never collide.

// ICE can sit in "checking" for a long time when no path exists (e.g. both
// behind strict NATs without TURN); give up and report a failure instead.
const CONNECT_TIMEOUT = 15000; // ms

export class VoicePeer {
    constructor({ remoteId, isInitiator, iceServers, sendSignal, onTrack, onFailed, onConnected }) {
        this.remoteId = remoteId;
        this.isInitiator = isInitiator;
        this.sendSignal = sendSignal;
        this.onTrack = onTrack;
        this.onFailed = onFailed;
        this.onConnected = onConnected;
        this.pendingCandidates = [];
        this.localTrack = null;
        this.closed = false;

        this.pc = new RTCPeerConnection({ iceServers });
        this.pc.onicecandidate = (event) => {
            if (event.candidate) this.sendSignal({ candidate: event.candidate.toJSON() });
        };
        this.pc.ontrack = (event) => {
            // replaceTrack-attached tracks carry no stream, so build one.
            this.onTrack(event.streams[0] ?? new MediaStream([event.track]));
        };
        this.pc.onconnectionstatechange = () => {
            if (this.closed) return;
            if (this.pc.connectionState === 'connected') {
                clearTimeout(this.connectTimer);
                this.onConnected?.();
            } else if (this.pc.connectionState === 'failed') {
                this.fail();
            }
        };
        this.connectTimer = setTimeout(() => this.fail(), CONNECT_TIMEOUT);

        if (isInitiator) {
            this.transceiver = this.pc.addTransceiver('audio', { direction: 'sendrecv' });
            this.sendOffer();
        }
    }

    async sendOffer() {
        try {
            await this.pc.setLocalDescription(await this.pc.createOffer());
            this.sendSignal({ description: this.pc.localDescription.toJSON() });
        } catch (error) {
            console.error(`Voice: offer to ${this.remoteId} failed`, error);
        }
    }

    async handleSignal(signal) {
        if (this.closed) return;
        try {
            if (signal.description) {
                await this.pc.setRemoteDescription(signal.description);
                if (signal.description.type === 'offer') {
                    // Answer with our own audio track (or silence until push to talk).
                    this.transceiver = this.pc.getTransceivers()[0];
                    this.transceiver.direction = 'sendrecv';
                    if (this.localTrack) await this.transceiver.sender.replaceTrack(this.localTrack);
                    await this.pc.setLocalDescription(await this.pc.createAnswer());
                    this.sendSignal({ description: this.pc.localDescription.toJSON() });
                }
                // Candidates can arrive before the description they belong to.
                const queued = this.pendingCandidates.splice(0);
                for (const candidate of queued) await this.pc.addIceCandidate(candidate);
            } else if (signal.candidate) {
                if (this.pc.remoteDescription) {
                    await this.pc.addIceCandidate(signal.candidate);
                } else {
                    this.pendingCandidates.push(signal.candidate);
                }
            }
        } catch (error) {
            console.error(`Voice: signal from ${this.remoteId} failed`, error);
        }
    }

    setLocalTrack(track) {
        this.localTrack = track;
        this.transceiver?.sender.replaceTrack(track).catch(error => {
            console.error(`Voice: attaching mic for ${this.remoteId} failed`, error);
        });
    }

    fail() {
        if (this.closed || this.pc.connectionState === 'connected') return;
        clearTimeout(this.connectTimer);
        this.onFailed?.();
    }

    close() {
        this.closed = true;
        clearTimeout(this.connectTimer);
        this.pc.close();
    }
}
