// Server settings and client input limits.

const PORT = process.env.PORT || 3000;

// Everything below comes straight from the socket, so it is type-checked and
// clamped before it is stored or relayed to other clients.
const LIMITS = {
    usernameLength: 24,
    chatLength: 200,
    emojiLength: 16,
    chatHistory: 50,
    snakeHighScores: 10,
    doors: 64,
    voiceSignalBytes: 16 * 1024 // an SDP is a few KB
};

// ICE servers handed to clients for voice chat. Set ICE_SERVERS to a JSON array
// (e.g. with a TURN server) for players behind strict NATs.
function loadIceServers() {
    const fallback = [{ urls: 'stun:stun.l.google.com:19302' }];
    if (!process.env.ICE_SERVERS) return fallback;
    try {
        const parsed = JSON.parse(process.env.ICE_SERVERS);
        return Array.isArray(parsed) && parsed.length > 0 ? parsed : fallback;
    } catch (error) {
        console.error('Invalid ICE_SERVERS, using default STUN:', error.message);
        return fallback;
    }
}

module.exports = {
    PORT,
    LIMITS,
    ICE_SERVERS: loadIceServers()
};
