// Server settings and client input limits.
const crypto = require('crypto');

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
// to replace the default STUN (e.g. a hosted TURN with static credentials).
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

// Self-hosted TURN relay (coturn with `use-auth-secret`), needed by players
// behind strict/carrier-grade NATs. TURN_URLS is comma-separated, e.g.
// "turn:example.com:3478?transport=udp,turn:example.com:3478?transport=tcp".
// See Docs/TURN.md.
const TURN = {
    urls: (process.env.TURN_URLS || '').split(',').map(url => url.trim()).filter(Boolean),
    secret: process.env.TURN_SECRET || '',
    ttlSeconds: Number(process.env.TURN_TTL_SECONDS) || 6 * 60 * 60
};

const BASE_ICE_SERVERS = loadIceServers();

// coturn's TURN REST scheme: username "<expiry>:<id>", password
// base64(HMAC-SHA1(secret, username)). Short-lived, so a leaked one expires
// and the shared secret never reaches clients.
function turnCredentials(userId, now = Date.now()) {
    const username = `${Math.floor(now / 1000) + TURN.ttlSeconds}:${userId}`;
    const credential = crypto.createHmac('sha1', TURN.secret).update(username).digest('base64');
    return { username, credential };
}

function getIceServers(userId) {
    if (TURN.urls.length === 0 || !TURN.secret) return BASE_ICE_SERVERS;
    return [...BASE_ICE_SERVERS, { urls: TURN.urls, ...turnCredentials(userId) }];
}

if (TURN.urls.length > 0 && !TURN.secret) {
    console.error('TURN_URLS is set but TURN_SECRET is missing: TURN disabled.');
}

// The bars that exist (ROOMS in src/world/RoomLayout.js; keep both in sync).
// Per-room features only accept these, so made-up ids can't fill their state.
const ROOM_IDS = new Set(['gamedev', 'desarrollo', 'feda', 'offtopic']);
const isRoomId = (roomId) => typeof roomId === 'string' && ROOM_IDS.has(roomId);

module.exports = {
    PORT,
    LIMITS,
    isRoomId,
    getIceServers,
    turnCredentials
};
