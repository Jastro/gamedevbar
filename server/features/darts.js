// Darts, one board per room: one thrower at a time, 3 darts per turn. The
// client sends where each dart hit (board units: 1 = outer edge of the
// double ring, x right, y up) and the server scores it, so scoring lives
// only here. Recent turns and the day's best show on the chalkboard.
const { isRoomId } = require('../config');

const DARTS_PER_TURN = 3;
const THROW_COOLDOWN_MS = 600;
const TURN_IDLE_MS = 30000;   // a thrower who stops throwing loses the line
const TURN_END_MS = 2500;     // darts stay on the board this long after the 3rd
const HISTORY_LENGTH = 6;

// Clockwise from the top, as on a real board.
const SECTORS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
// Ring radii in board units (real board in mm / 170).
const BULL = 6.35 / 170;
const OUTER_BULL = 15.9 / 170;
const TRIPLE_IN = 99 / 170;
const TRIPLE_OUT = 107 / 170;
const DOUBLE_IN = 162 / 170;

function scoreAt(x, y) {
    const r = Math.hypot(x, y);
    if (r > 1) return { score: 0, label: 'Fuera' };
    if (r <= BULL) return { score: 50, label: 'Diana' };
    if (r <= OUTER_BULL) return { score: 25, label: '25' };
    const degrees = Math.atan2(y, x) * 180 / Math.PI;
    const fromTop = ((90 - degrees + 9) % 360 + 360) % 360;
    const number = SECTORS[Math.floor(fromTop / 18) % 20];
    if (r >= TRIPLE_IN && r <= TRIPLE_OUT) return { score: number * 3, label: `T${number}` };
    if (r >= DOUBLE_IN) return { score: number * 2, label: `D${number}` };
    return { score: number, label: String(number) };
}

// "Today" in Spain, where the bar is.
function today() {
    try {
        return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
    } catch {
        return new Date().toISOString().slice(0, 10);
    }
}

function registerDarts(hub) {
    const rooms = new Map(); // roomId -> { thrower, darts, history, best, timers }

    const roomFor = (roomId, create) => {
        if (!isRoomId(roomId)) return null;
        if (!rooms.has(roomId)) {
            if (!create) return null;
            rooms.set(roomId, { thrower: null, darts: [], history: [], best: null, idleTimer: null, endTimer: null });
        }
        return rooms.get(roomId);
    };

    const publicState = (room) => {
        if (room.best && room.best.day !== today()) room.best = null;
        return { thrower: room.thrower, darts: room.darts, history: room.history, best: room.best };
    };

    const publish = (roomId, room) => hub.broadcastAll({ type: 'dartsState', roomId, state: publicState(room) });

    const endTurn = (roomId, room) => {
        clearTimeout(room.idleTimer);
        clearTimeout(room.endTimer);
        room.idleTimer = room.endTimer = null;
        room.thrower = null;
        room.darts = [];
        publish(roomId, room);
    };

    const touchIdle = (roomId, room) => {
        clearTimeout(room.idleTimer);
        room.idleTimer = setTimeout(() => endTurn(roomId, room), TURN_IDLE_MS);
    };

    hub.on('dartsStart', ({ ws, user }, { roomId }) => {
        // Only players who have joined (they have a name for the chalkboard).
        const room = user.username ? roomFor(roomId, true) : null;
        if (!room) return;
        if (room.thrower && room.thrower.userId !== user.id && hub.findUser(room.thrower.userId)) {
            hub.send(ws, { type: 'dartsBusy', roomId, thrower: room.thrower });
            return;
        }
        if (room.thrower?.userId === user.id) return;
        // One board at a time.
        rooms.forEach((other, otherId) => {
            if (other !== room && other.thrower?.userId === user.id) endTurn(otherId, other);
        });
        clearTimeout(room.endTimer);
        room.endTimer = null;
        room.thrower = { userId: user.id, name: user.username };
        room.darts = [];
        touchIdle(roomId, room);
        publish(roomId, room);
    });

    hub.on('dartsThrow', ({ user }, { roomId, x, y }) => {
        const room = roomFor(roomId, false);
        if (!room || room.thrower?.userId !== user.id) return;
        if (room.darts.length >= DARTS_PER_TURN) return;
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        const now = Date.now();
        if (now - (user.lastDartThrow ?? 0) < THROW_COOLDOWN_MS) return;
        user.lastDartThrow = now;

        const hitX = Math.max(-2, Math.min(2, x));
        const hitY = Math.max(-2, Math.min(2, y));
        const dart = { x: hitX, y: hitY, ...scoreAt(hitX, hitY) };
        room.darts.push(dart);
        hub.broadcastAll({ type: 'dartsThrow', roomId, userId: user.id, index: room.darts.length - 1, ...dart });

        if (room.darts.length < DARTS_PER_TURN) {
            touchIdle(roomId, room);
            return;
        }
        const total = room.darts.reduce((sum, d) => sum + d.score, 0);
        room.history.unshift({ name: user.username, total, labels: room.darts.map(d => d.label) });
        room.history.length = Math.min(room.history.length, HISTORY_LENGTH);
        const day = today();
        if (!room.best || room.best.day !== day || total > room.best.total) room.best = { name: user.username, total, day };
        clearTimeout(room.idleTimer);
        room.endTimer = setTimeout(() => endTurn(roomId, room), TURN_END_MS);
        publish(roomId, room);
    });

    hub.on('dartsLeave', ({ user }, { roomId }) => {
        const room = roomFor(roomId, false);
        if (room?.thrower?.userId === user.id) endTurn(roomId, room);
    });

    hub.onJoin(({ ws }) => {
        const states = {};
        rooms.forEach((room, roomId) => { states[roomId] = publicState(room); });
        hub.send(ws, { type: 'dartsStates', rooms: states });
    });

    hub.onLeave(({ user }) => {
        rooms.forEach((room, roomId) => {
            if (room.thrower?.userId === user.id) endTurn(roomId, room);
        });
    });
}

module.exports = { registerDarts, scoreAt };
