// Shared YouTube projector per room. The server keeps when the video started
// (server clock) and where it was paused; clients derive the position from
// that, so everyone watches the same moment.
const ROOM_ID_PATTERN = /^[a-z0-9_-]{1,32}$/;
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const MAX_ROOMS = 32;

function registerProjector(hub) {
    const screens = new Map(); // roomId -> { videoId, startedAt, pausedAt: seconds | null }

    const validRoom = (roomId) => typeof roomId === 'string' && ROOM_ID_PATTERN.test(roomId);

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
        if (!validRoom(data.roomId) || typeof data.videoId !== 'string' || !VIDEO_ID_PATTERN.test(data.videoId)) return;
        if (!screens.has(data.roomId) && screens.size >= MAX_ROOMS) return;
        screens.set(data.roomId, { videoId: data.videoId, startedAt: Date.now(), pausedAt: null });
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
