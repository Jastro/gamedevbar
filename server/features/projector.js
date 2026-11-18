// Shared projector per room (YouTube video, Twitch channel or Twitch VOD). The
// server keeps when the video started (server clock) and where it was paused;
// clients derive the position from that, so everyone watches the same moment
// (a live channel just follows play/pause).
const ROOM_ID_PATTERN = /^[a-z0-9_-]{1,32}$/;
// provider -> what its videoId looks like (YouTube id, Twitch login, VOD number).
const VIDEO_ID_PATTERNS = {
    youtube: /^[A-Za-z0-9_-]{11}$/,
    twitch: /^[a-z0-9_]{1,25}$/,
    'twitch-vod': /^\d{1,12}$/
};
const MAX_ROOMS = 32;

function registerProjector(hub) {
    const screens = new Map(); // roomId -> { videoId, startedAt, pausedAt: seconds | null }

    const validRoom = (roomId) => typeof roomId === 'string' && ROOM_ID_PATTERN.test(roomId);

    // Older clients send no provider: YouTube.
    const validMedia = (data) => {
        const provider = data.provider ?? 'youtube';
        const pattern = Object.hasOwn(VIDEO_ID_PATTERNS, provider) ? VIDEO_ID_PATTERNS[provider] : null;
        return pattern && typeof data.videoId === 'string' && pattern.test(data.videoId) ? provider : null;
    };

    const publish = (roomId, by) => {
        hub.broadcastAll({
            type: 'projectorState',
            roomId,
            state: screens.get(roomId) ?? null,
            by,
            serverTime: Date.now()
        });
    };

    hub.on('projectorPlay', ({ user }, data) => {
        const provider = validMedia(data);
        if (!validRoom(data.roomId) || !provider) return;
        if (!screens.has(data.roomId) && screens.size >= MAX_ROOMS) return;
        screens.set(data.roomId, { provider, videoId: data.videoId, startedAt: Date.now(), pausedAt: null });
        publish(data.roomId, user.username);
    });

    hub.on('projectorPause', ({ user }, data) => {
        const screen = validRoom(data.roomId) && screens.get(data.roomId);
        if (!screen || screen.pausedAt !== null) return;
        screen.pausedAt = (Date.now() - screen.startedAt) / 1000;
        publish(data.roomId, user.username);
    });

    hub.on('projectorResume', ({ user }, data) => {
        const screen = validRoom(data.roomId) && screens.get(data.roomId);
        if (!screen || screen.pausedAt === null) return;
        screen.startedAt = Date.now() - screen.pausedAt * 1000;
        screen.pausedAt = null;
        publish(data.roomId, user.username);
    });

    hub.on('projectorStop', ({ user }, data) => {
        if (!validRoom(data.roomId) || !screens.has(data.roomId)) return;
        screens.delete(data.roomId);
        publish(data.roomId, user.username);
    });

    hub.onJoin(({ ws }) => {
        hub.send(ws, { type: 'projectorStates', screens: Object.fromEntries(screens), serverTime: Date.now() });
    });
}

module.exports = { registerProjector };
