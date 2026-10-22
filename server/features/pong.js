// Pong machines (one per room, id = room id). The server owns who plays:
// the first to join is player 1 (against the CPU), a second joins as player
// 2 and the match restarts. Player 1's client runs the game and sends
// snapshots (`pongState`), player 2 sends its paddle (`pongPaddle`); both are
// relayed to everyone else. Anyone leaving ends the match.
const { isRoomId } = require('../config');

const MIN_RELAY_MS = 30; // per user, for snapshots and paddles
const SIZE = 512;        // the game's canvas, in px
const PHASES = ['countdown', 'play', 'over'];
const EVENTS = ['hit', 'point', 'over'];

const finite = (value, min, max) => (typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value)) : null);

function cleanSnapshot(data) {
    const ball = data.ball || {};
    const snapshot = {
        ball: {
            x: finite(ball.x, -50, SIZE + 50),
            y: finite(ball.y, -50, SIZE + 50),
            dx: finite(ball.dx, -2000, 2000),
            dy: finite(ball.dy, -2000, 2000)
        },
        p1y: finite(data.p1y, 0, SIZE),
        p2y: finite(data.p2y, 0, SIZE),
        s1: finite(data.s1, 0, 99),
        s2: finite(data.s2, 0, 99),
        countdown: finite(data.countdown, 0, 10) ?? 0,
        phase: PHASES.includes(data.phase) ? data.phase : null,
        winner: data.winner === 1 || data.winner === 2 ? data.winner : null,
        events: (Array.isArray(data.events) ? data.events : []).filter(e => EVENTS.includes(e)).slice(0, 6)
    };
    const required = [snapshot.ball.x, snapshot.ball.y, snapshot.ball.dx, snapshot.ball.dy,
        snapshot.p1y, snapshot.p2y, snapshot.s1, snapshot.s2, snapshot.phase];
    return required.some(value => value === null) ? null : snapshot;
}

function registerPong(hub) {
    const machines = new Map(); // id -> { player1, player2, mode }

    const idle = () => ({ player1: null, player2: null, mode: 'idle' });
    const publish = (machineId) => hub.broadcastAll({ type: 'pongMachine', machineId, state: machines.get(machineId) });
    const playerOf = (machine, user) => (machine.player1?.userId === user.id ? 1 : machine.player2?.userId === user.id ? 2 : 0);

    const end = (machineId) => {
        machines.set(machineId, idle());
        publish(machineId);
    };

    const machineFor = (machineId, create) => {
        if (!isRoomId(machineId)) return null;
        if (!machines.has(machineId)) {
            if (!create) return null;
            machines.set(machineId, idle());
        }
        return machines.get(machineId);
    };

    hub.on('pongJoin', ({ ws, user }, { machineId }) => {
        const machine = user.username ? machineFor(machineId, true) : null;
        if (!machine || playerOf(machine, user)) return;
        if (machine.player1 && machine.player2) {
            hub.send(ws, { type: 'pongBusy', machineId });
            return;
        }
        // One machine at a time.
        machines.forEach((other, otherId) => {
            if (other !== machine && playerOf(other, user)) end(otherId);
        });
        const player = { userId: user.id, name: user.username };
        if (!machine.player1) {
            machines.set(machineId, { player1: player, player2: null, mode: 'onePlayer' });
        } else {
            machines.set(machineId, { player1: machine.player1, player2: player, mode: 'twoPlayer' });
        }
        publish(machineId);
    });

    hub.on('pongLeave', ({ user }, { machineId }) => {
        const machine = machineFor(machineId, false);
        if (machine && playerOf(machine, user)) end(machineId);
    });

    // Player 1 (the host) says the match is over.
    hub.on('pongOver', ({ user }, { machineId }) => {
        const machine = machineFor(machineId, false);
        if (machine && playerOf(machine, user) === 1) end(machineId);
    });

    const relayAllowed = (user) => {
        const now = Date.now();
        if (now - (user.lastPongRelay ?? 0) < MIN_RELAY_MS) return false;
        user.lastPongRelay = now;
        return true;
    };

    hub.on('pongState', ({ ws, user }, data) => {
        const machine = machineFor(data.machineId, false);
        if (!machine || playerOf(machine, user) !== 1 || !relayAllowed(user)) return;
        const snapshot = cleanSnapshot(data);
        if (snapshot) hub.broadcast({ type: 'pongState', machineId: data.machineId, ...snapshot }, ws);
    });

    hub.on('pongPaddle', ({ ws, user }, { machineId, y }) => {
        const machine = machineFor(machineId, false);
        if (!machine || playerOf(machine, user) !== 2 || !relayAllowed(user)) return;
        const paddle = finite(y, 0, SIZE);
        if (paddle !== null) hub.broadcast({ type: 'pongPaddle', machineId, y: paddle }, ws);
    });

    hub.onJoin(({ ws }) => {
        hub.send(ws, { type: 'pongMachines', machines: Object.fromEntries(machines) });
    });

    hub.onLeave(({ user }) => {
        machines.forEach((machine, machineId) => {
            if (playerOf(machine, user)) end(machineId);
        });
    });
}

module.exports = { registerPong, cleanSnapshot };
