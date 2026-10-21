const { LIMITS } = require('../config');
const { cleanString } = require('../validation');

// Who is playing each room's Vircon32 cabinet (one player at a time). The
// game itself runs only on that player's client; people standing next to it
// get a WebRTC stream from that client (signaling relayed here, bundled
// games only); everyone else sees the name and title. Freed on stop or
// disconnect.
const ROOM_ID_PATTERN = /^[a-z0-9_-]{1,32}$/;
const MAX_ROOMS = 32;
const MAX_TITLE_LENGTH = 60;

function registerVircon(hub) {
    const cabinets = new Map(); // roomId -> { playerId, playerName, romTitle, watchable }

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
            romTitle: cleanString(data.romTitle, MAX_TITLE_LENGTH) || 'Vircon32',
            // Only bundled games may be streamed (uploads aren't license-checked).
            watchable: data.watchable === true
        });
        publish(roomId);
    });

    // Spectating signaling: only between a watchable cabinet's player and
    // someone else. Media goes peer to peer (or through TURN).
    hub.on('virconSignal', ({ ws, user }, data) => {
        const { roomId, targetId, signal } = data;
        if (typeof roomId !== 'string' || typeof targetId !== 'string') return;
        if (!signal || typeof signal !== 'object') return;
        if (JSON.stringify(signal).length > LIMITS.voiceSignalBytes) return;
        const cabinet = cabinets.get(roomId);
        const allowed = Boolean(cabinet?.watchable) && targetId !== user.id
            && (cabinet.playerId === user.id || cabinet.playerId === targetId);
        const target = allowed ? hub.findUser(targetId) : null;
        if (!target) {
            // A watcher asking a game that's no longer there: answer for the
            // player, so it stops waiting instead of timing out.
            if (signal.description?.type === 'offer') {
                hub.send(ws, { type: 'virconSignal', roomId, fromId: targetId, signal: { refused: true, peerId: signal.peerId } });
            }
            return;
        }
        hub.send(target.ws, { type: 'virconSignal', roomId, fromId: user.id, signal });
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
