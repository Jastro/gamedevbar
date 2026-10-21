// One spectating connection between a Vircon32 player and one watcher.
// The watcher offers with receive-only video + audio transceivers; the
// player answers, sending the emulator canvas and its audio tap. Tracks can
// be swapped later with replaceTrack (the game's audio context starts after
// its first sound), so there's never a renegotiation. Signals ride on
// `virconSignal`; `{ refused: true }` closes the other side at once.

// Watching is optional: give up quietly if nothing connects.
const CONNECT_TIMEOUT = 15000; // ms
const MAX_VIDEO_BITRATE = 1_000_000; // bps, also through the TURN relay

export class VirconStreamPeer {
    constructor({ remoteId, role, iceServers, sendSignal, onTrack, onClosed }) {
        this.remoteId = remoteId;
        this.role = role; // 'watcher' | 'player'
        this.sendSignal = sendSignal;
        this.onTrack = onTrack;
        this.onClosed = onClosed;
        this.pendingCandidates = [];
        this.closed = false;

        this.pc = new RTCPeerConnection({ iceServers });
        this.pc.onicecandidate = (event) => {
            if (event.candidate) this.sendSignal({ candidate: event.candidate.toJSON() });
        };
        this.pc.ontrack = (event) => this.onTrack?.(event.track);
        this.pc.onconnectionstatechange = () => {
            const state = this.pc.connectionState;
            if (state === 'connected') clearTimeout(this.connectTimer);
            if (state === 'failed' || state === 'closed') this.close('failed');
        };
        this.connectTimer = setTimeout(() => this.close('timeout'), CONNECT_TIMEOUT);

        if (role === 'watcher') {
            this.pc.addTransceiver('video', { direction: 'recvonly' });
            this.pc.addTransceiver('audio', { direction: 'recvonly' });
            this.sendOffer();
        }
    }

    async sendOffer() {
        try {
            await this.pc.setLocalDescription(await this.pc.createOffer());
            this.sendSignal({ description: this.pc.localDescription.toJSON() });
        } catch (error) {
            console.warn(`Vircon32 stream: offer to ${this.remoteId} failed`, error);
            this.close('failed');
        }
    }

    // Player side: answer a watcher's offer with whatever tracks exist now.
    async answer(offer, tracks) {
        try {
            await this.pc.setRemoteDescription(offer);
            this.pc.getTransceivers().forEach(transceiver => {
                transceiver.direction = 'sendonly';
            });
            await this.setTracks(tracks);
            await this.pc.setLocalDescription(await this.pc.createAnswer());
            this.sendSignal({ description: this.pc.localDescription.toJSON() });
            await this.flushCandidates();
            await this.capBitrate();
        } catch (error) {
            console.warn(`Vircon32 stream: answer to ${this.remoteId} failed`, error);
            this.close('failed');
        }
    }

    // tracks: { video, audio } (either may be null). No-op for unchanged ones.
    async setTracks({ video, audio }) {
        for (const transceiver of this.pc.getTransceivers()) {
            const kind = transceiver.receiver.track.kind;
            const track = kind === 'video' ? video : audio;
            if (transceiver.sender.track === (track ?? null)) continue;
            await transceiver.sender.replaceTrack(track ?? null);
        }
    }

    async capBitrate() {
        const sender = this.pc.getTransceivers().find(t => t.receiver.track.kind === 'video')?.sender;
        if (!sender) return;
        const parameters = sender.getParameters();
        if (!parameters.encodings?.length) parameters.encodings = [{}];
        parameters.encodings[0].maxBitrate = MAX_VIDEO_BITRATE;
        await sender.setParameters(parameters).catch(() => {});
    }

    async handleSignal(signal) {
        if (this.closed) return;
        if (signal.refused) {
            this.close('refused', false);
            return;
        }
        try {
            if (signal.description?.type === 'answer') {
                await this.pc.setRemoteDescription(signal.description);
                await this.flushCandidates();
            } else if (signal.candidate) {
                if (this.pc.remoteDescription) {
                    await this.pc.addIceCandidate(signal.candidate);
                } else {
                    this.pendingCandidates.push(signal.candidate);
                }
            }
        } catch (error) {
            console.warn(`Vircon32 stream: signal from ${this.remoteId} failed`, error);
        }
    }

    // Candidates can arrive before the description they belong to.
    async flushCandidates() {
        for (const candidate of this.pendingCandidates.splice(0)) {
            await this.pc.addIceCandidate(candidate);
        }
    }

    // notify: tell the other side (so it doesn't wait for ICE to time out).
    close(reason = 'closed', notify = true) {
        if (this.closed) return;
        this.closed = true;
        clearTimeout(this.connectTimer);
        if (notify) this.sendSignal({ refused: true });
        this.pc.close();
        this.onClosed?.(reason);
    }
}
