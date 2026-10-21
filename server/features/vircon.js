const { cleanString } = require('../validation');

// Who is playing each room's Vircon32 cabinet (one player at a time). The
// game itself runs only on that player's client; others just see the name
// and title on the cabinet. Freed on stop or disconnect.
const ROOM_ID_PATTERN = /^[a-z0-9_-]{1,32}$/;
const MAX_ROOMS = 32;
const MAX_TITLE_LENGTH = 60;

function registerVircon(hub) {
    const cabinets = new Map(); // roomId -> { playerId, playerName, romTitle }

    const publish = (roomId) => {
        hub.broadcastAll({ type: 'virconState', roomId, state: cabinets.get(roomId) ?? null });
    };

    hub.on('virconStart', ({ ws, user }, data) => {
        const { roomId } = data;
        if (typeof roomId !== 'string' || !ROOM_ID_PATTERN.test(roomId)) return;
        const current = cabinets.get(roomId);
        if (current && current.playerId !== user.id && hub.findUser(current.playerId)) {
            hub.send(ws, { type: 'virconBusy', roomId, state: current });
            return;
        }
        if (!current && cabinets.size >= MAX_ROOMS) return;
        cabinets.set(roomId, {
            playerId: user.id,
            playerName: user.username,
            romTitle: cleanString(data.romTitle, MAX_TITLE_LENGTH) || 'Vircon32'
        });
        publish(roomId);
    });

    hub.on('virconStop', ({ user }, data) => {
        const current = cabinets.get(data.roomId);
        if (!current || current.playerId !== user.id) return;
        cabinets.delete(data.roomId);
        publish(data.roomId);
    });

    hub.onJoin(({ ws }) => {
        hub.send(ws, { type: 'virconStates', cabinets: Object.fromEntries(cabinets) });
    });

    hub.onLeave(({ user }) => {
        cabinets.forEach((state, roomId) => {
            if (state.playerId !== user.id) return;
            cabinets.delete(roomId);
            publish(roomId);
        });
    });
}

module.exports = { registerVircon };
