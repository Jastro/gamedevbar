// Light switches per room (normal / low / disco), shared by everyone in the
// bar like doors. State: roomId -> { normal, low, disco }; rooms never
// touched use DEFAULT_LIGHTS (the client knows it too).
const ROOM_ID_PATTERN = /^[a-z0-9_-]{1,32}$/;
const LIGHTS = ['normal', 'low', 'disco'];
const DEFAULT_LIGHTS = { normal: true, low: false, disco: false };
const MAX_ROOMS = 32;

function registerLights(hub) {
    const rooms = new Map();

    hub.on('lightsToggle', (ctx, data) => {
        const { roomId, light } = data;
        if (typeof roomId !== 'string' || !ROOM_ID_PATTERN.test(roomId)) return;
        if (!LIGHTS.includes(light)) return;
        if (!rooms.has(roomId) && rooms.size >= MAX_ROOMS) return;

        const state = { ...(rooms.get(roomId) ?? DEFAULT_LIGHTS) };
        state[light] = !state[light];
        rooms.set(roomId, state);
        hub.broadcastAll({ type: 'lightsState', roomId, state });
    });

    hub.onJoin(({ ws }) => {
        hub.send(ws, { type: 'lightsStates', rooms: Object.fromEntries(rooms) });
    });
}

module.exports = { registerLights };
