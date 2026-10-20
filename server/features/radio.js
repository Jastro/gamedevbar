// Which station each room's radio plays, shared by everyone. Unset rooms use
// the client's default (RoomLayout radioStation). Station ids are checked for
// shape only; the client ignores ids it doesn't know.
const ROOM_ID_PATTERN = /^[a-z0-9_-]{1,32}$/;
const STATION_ID_PATTERN = /^[a-z0-9-]{1,32}$/;
const MAX_ROOMS = 32;

function registerRadio(hub) {
    const stations = new Map(); // roomId -> stationId | null (off)

    hub.on('radioSet', ({ user }, data) => {
        const { roomId } = data;
        const stationId = data.stationId ?? null;
        if (typeof roomId !== 'string' || !ROOM_ID_PATTERN.test(roomId)) return;
        if (stationId !== null && (typeof stationId !== 'string' || !STATION_ID_PATTERN.test(stationId))) return;
        if (!stations.has(roomId) && stations.size >= MAX_ROOMS) return;

        stations.set(roomId, stationId);
        hub.broadcastAll({ type: 'radioState', roomId, stationId, by: user.username });
    });

    hub.onJoin(({ ws }) => {
        hub.send(ws, { type: 'radioStates', stations: Object.fromEntries(stations) });
    });
}

module.exports = { registerRadio };
