const { LIMITS } = require('../config');

// WebRTC signaling relay for push-to-talk voice. Media never touches the server.
function registerVoice(hub) {
    hub.on('voiceSignal', ({ user }, data) => {
        if (typeof data.targetId !== 'string' || !data.signal || typeof data.signal !== 'object') return;
        if (JSON.stringify(data.signal).length > LIMITS.voiceSignalBytes) return;
        const target = hub.findUser(data.targetId);
        if (!target) return;
        hub.send(target.ws, { type: 'voiceSignal', fromId: user.id, signal: data.signal });
    });

    hub.on('voiceTalking', ({ ws, user }, data) => {
        hub.broadcast({ type: 'voiceTalking', userId: user.id, talking: data.talking === true }, ws);
    });
}

module.exports = { registerVoice };
