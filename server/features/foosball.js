// Futbolín, one table per room. The server runs the game: 60 physics steps
// a second, 20 snapshots a second to everyone while someone is playing.
// Players send where their rods should be (`foosballRods`) and their kicks;
// the server moves the rods there at rod speed, so nobody's connection or
// frame rate decides the game. Layout: server/shared/foosball.json.
const { isRoomId } = require('../config');
const LAYOUT = require('../shared/foosball.json');

const STEP = 1 / 60;
const SNAPSHOT_EVERY = 3;       // steps (20 per second)
const ROD_SPEED = 3.5;          // units/s the server moves a rod toward its target
const KICK_TIME = 0.2;          // s a kick lasts
const KICK_COOLDOWN_MS = 250;
const KICK_SPEED = 3.6;         // ball speed off a kick
const KICK_REACH = 0.16;        // how far along the table a swinging foot reaches
const MAX_SPEED = 6;
const FRICTION = 0.5;           // 1/s
const WALL_BOUNCE = 0.8;
const MAN_BOUNCE = 0.55;
const STUCK_TIME = 2.5;         // s nearly still before the table "tilts" the ball
const COUNTDOWN = 3;
const GOAL_PAUSE = 1.5;
const OVER_TIME = 4;
const WIN_SCORE = 5;
const SLOTS = 4;                // [red back, red front, blue back, blue front]
const MIN_RODS_INTERVAL_MS = 30;

const { length, width } = LAYOUT.field;
const BALL_R = LAYOUT.ballRadius;
const MAN_R = LAYOUT.manRadius;

// How far a rod can slide from the center before its outer man hits the wall
// (the goalie stays around its goal).
function maxOffset(rod) {
    if (rod.role === 'goalie') return LAYOUT.goalWidth / 2 + 0.08;
    return width / 2 - MAN_R - ((rod.men - 1) / 2) * rod.spacing;
}

function menZ(rod, offset) {
    const result = [];
    for (let i = 0; i < rod.men; i++) result.push(offset + (i - (rod.men - 1) / 2) * rod.spacing);
    return result;
}

const teamOfSlot = (slot) => (slot < 2 ? 0 : 1);

// Which rods a slot moves: alone on a team, all four; with a partner, the
// back player has goalie + defense and the front one midfield + attack.
function rodsFor(slots, slot) {
    const team = teamOfSlot(slot);
    const partner = team * 2 + (slot % 2 === 0 ? 1 : 0);
    const roles = slots[partner]
        ? (slot % 2 === 0 ? ['goalie', 'defense'] : ['midfield', 'attack'])
        : ['goalie', 'defense', 'midfield', 'attack'];
    return LAYOUT.rods
        .map((rod, index) => ({ rod, index }))
        .filter(({ rod }) => rod.team === team && roles.includes(rod.role))
        .map(({ index }) => index);
}

function newTable() {
    return {
        slots: new Array(SLOTS).fill(null), // { userId, name }
        rods: LAYOUT.rods.map(() => ({ offset: 0, target: 0, velocity: 0, kick: 0 })),
        ball: { x: 0, z: 0, vx: 0, vz: 0 },
        score: [0, 0],
        phase: 'idle', // idle | practice | countdown | play | goal | over
        timer: 0,
        stuck: 0,
        events: []
    };
}

function registerFoosball(hub) {
    const tables = new Map(); // roomId -> table
    let loop = null;
    let steps = 0;

    const tableFor = (roomId) => {
        if (!isRoomId(roomId)) return null;
        if (!tables.has(roomId)) tables.set(roomId, newTable());
        return tables.get(roomId);
    };

    const slotOf = (table, userId) => table.slots.findIndex(slot => slot?.userId === userId);
    const teamCount = (table, team) => table.slots.filter((slot, i) => slot && teamOfSlot(i) === team).length;

    const publishTable = (roomId, table) => hub.broadcastAll({
        type: 'foosballTable', roomId, slots: table.slots, phase: table.phase, score: table.score
    });

    // Served from the middle, rolling toward `toward` (-1 / 1; random if 0).
    const resetBall = (table, toward = 0) => {
        const direction = toward || (Math.random() < 0.5 ? -1 : 1);
        table.ball = { x: 0, z: (Math.random() - 0.5) * 0.3, vx: direction * 0.6, vz: (Math.random() - 0.5) * 0.6 };
        table.stuck = 0;
    };

    // Who's at the table decides the phase.
    const refreshPhase = (roomId, table) => {
        const red = teamCount(table, 0);
        const blue = teamCount(table, 1);
        const before = table.phase;
        if (red === 0 && blue === 0) {
            table.phase = 'idle';
        } else if (red === 0 || blue === 0) {
            table.phase = 'practice';
            table.score = [0, 0];
        } else if (before === 'idle' || before === 'practice') {
            table.phase = 'countdown';
            table.timer = COUNTDOWN;
            table.score = [0, 0];
            resetBall(table);
        }
        if (table.phase === 'practice' && before !== 'practice') resetBall(table);
        publishTable(roomId, table);
        ensureLoop();
    };

    // --- Physics -------------------------------------------------------------

    const stepTable = (table) => {
        table.rods.forEach(rod => {
            const before = rod.offset;
            const delta = rod.target - rod.offset;
            rod.offset += Math.sign(delta) * Math.min(Math.abs(delta), ROD_SPEED * STEP);
            rod.velocity = (rod.offset - before) / STEP;
            rod.kick = Math.max(0, rod.kick - STEP);
        });

        if (table.phase === 'countdown' || table.phase === 'goal') {
            table.timer -= STEP;
            if (table.timer <= 0) {
                table.phase = 'play';
                if (table.ballPending) resetBall(table, table.ballPending);
                table.ballPending = 0;
            }
            return;
        }
        if (table.phase === 'over') {
            table.timer -= STEP;
            if (table.timer <= 0) {
                table.phase = 'countdown';
                table.timer = COUNTDOWN;
                table.score = [0, 0];
                resetBall(table);
                table.changed = true;
            }
            return;
        }
        if (table.phase !== 'play' && table.phase !== 'practice') return;

        const ball = table.ball;
        const damping = Math.exp(-FRICTION * STEP);
        ball.vx *= damping;
        ball.vz *= damping;
        ball.x += ball.vx * STEP;
        ball.z += ball.vz * STEP;

        // Side walls.
        const sideLimit = width / 2 - BALL_R;
        if (Math.abs(ball.z) > sideLimit) {
            ball.z = Math.sign(ball.z) * sideLimit;
            ball.vz = -ball.vz * WALL_BOUNCE;
        }
        // Ends: a goal through the mouth, a bounce elsewhere.
        const endLimit = length / 2 - BALL_R;
        if (Math.abs(ball.x) > endLimit) {
            if (Math.abs(ball.z) < LAYOUT.goalWidth / 2) {
                const scorer = ball.x > 0 ? 0 : 1; // red scores in the blue goal (+x)
                table.events.push('goal');
                if (table.phase === 'practice') {
                    resetBall(table);
                    return;
                }
                table.score[scorer] += 1;
                table.changed = true;
                if (table.score[scorer] >= WIN_SCORE) {
                    table.phase = 'over';
                    table.timer = OVER_TIME;
                    table.winner = scorer;
                    table.events.push('win');
                    ball.vx = ball.vz = 0;
                    ball.x = 0;
                    ball.z = 0;
                } else {
                    table.phase = 'goal';
                    table.timer = GOAL_PAUSE;
                    // The team that conceded serves.
                    table.ballPending = scorer === 0 ? -1 : 1;
                    ball.vx = ball.vz = 0;
                    ball.x = Math.sign(ball.x) * endLimit;
                }
                return;
            }
            ball.x = Math.sign(ball.x) * endLimit;
            ball.vx = -ball.vx * WALL_BOUNCE;
        }

        // Men.
        LAYOUT.rods.forEach((layout, index) => {
            const rod = table.rods[index];
            const dx = ball.x - layout.x;
            const kicking = rod.kick > 0;
            if (Math.abs(dx) > (kicking ? KICK_REACH : BALL_R + MAN_R)) return;
            const reach = BALL_R + MAN_R;
            menZ(layout, rod.offset).forEach(z => {
                const dz = ball.z - z;
                // A swinging foot sweeps a band along the table.
                if (kicking && Math.abs(dz) < reach) {
                    const forward = layout.team === 0 ? 1 : -1;
                    ball.x = layout.x + forward * (reach + 0.01);
                    ball.vx = forward * KICK_SPEED;
                    ball.vz = ball.vz * 0.3 + dz * 8 + rod.velocity * 0.4;
                    rod.kick = 0;
                    table.events.push('kick');
                    return;
                }
                const distance = Math.hypot(dx, dz);
                if (distance >= reach || distance === 0) return;
                const nx = dx / distance;
                const nz = dz / distance;
                // Out of the man, then bounce (moving rods drag the ball along).
                ball.x = layout.x + nx * reach;
                ball.z = z + nz * reach;
                const along = ball.vx * nx + ball.vz * nz;
                if (along < 0) {
                    ball.vx -= (1 + MAN_BOUNCE) * along * nx;
                    ball.vz -= (1 + MAN_BOUNCE) * along * nz;
                }
                ball.vz += rod.velocity * 0.6;
                table.events.push('hit');
            });
        });

        const speed = Math.hypot(ball.vx, ball.vz);
        if (speed > MAX_SPEED) {
            ball.vx *= MAX_SPEED / speed;
            ball.vz *= MAX_SPEED / speed;
        }
        // A dead ball gets a nudge, like a slightly tilted table.
        table.stuck = speed < 0.06 ? table.stuck + STEP : 0;
        if (table.stuck > STUCK_TIME) {
            ball.vx += (Math.random() - 0.5) * 0.8;
            ball.vz += (Math.random() - 0.5) * 0.8;
            table.stuck = 0;
        }
    };

    const snapshot = (roomId, table) => {
        const round = (value) => Math.round(value * 1000) / 1000;
        hub.broadcastAll({
            type: 'foosballState',
            roomId,
            ball: [round(table.ball.x), round(table.ball.z), round(table.ball.vx), round(table.ball.vz)],
            rods: table.rods.map(rod => round(rod.offset)),
            kicks: table.rods.map(rod => (rod.kick > 0 ? 1 : 0)),
            score: table.score,
            phase: table.phase,
            timer: round(Math.max(0, table.timer)),
            winner: table.phase === 'over' ? table.winner : null,
            events: table.events.splice(0)
        });
    };

    // Timers aren't precise (~15 ms on Windows), so each tick runs as many
    // fixed steps as real time has passed.
    let lastTick = 0;
    let pending = 0;
    function ensureLoop() {
        const active = [...tables.values()].some(table => table.phase !== 'idle');
        if (active && !loop) {
            lastTick = performance.now();
            pending = 0;
            loop = setInterval(tick, 10);
        } else if (!active && loop) {
            clearInterval(loop);
            loop = null;
        }
    }

    function tick() {
        const now = performance.now();
        pending = Math.min(pending + (now - lastTick) / 1000, 0.25);
        lastTick = now;
        while (pending >= STEP) {
            pending -= STEP;
            steps += 1;
            tables.forEach((table, roomId) => {
                if (table.phase === 'idle') return;
                stepTable(table);
                if (table.changed) {
                    table.changed = false;
                    publishTable(roomId, table);
                }
                if (steps % SNAPSHOT_EVERY === 0) snapshot(roomId, table);
            });
        }
    }

    // --- Messages --------------------------------------------------------------

    hub.on('foosballJoin', ({ ws, user }, { roomId, team }) => {
        if (!user.username || (team !== 0 && team !== 1)) return;
        const table = tableFor(roomId);
        if (!table || slotOf(table, user.id) !== -1) return;
        const free = [team * 2, team * 2 + 1].find(slot => !table.slots[slot]);
        if (free === undefined) {
            hub.send(ws, { type: 'foosballFull', roomId, team });
            return;
        }
        // One table at a time.
        tables.forEach((other, otherId) => {
            const index = slotOf(other, user.id);
            if (other !== table && index !== -1) {
                other.slots[index] = null;
                refreshPhase(otherId, other);
            }
        });
        table.slots[free] = { userId: user.id, name: user.username };
        refreshPhase(roomId, table);
    });

    const leave = (roomId, table, userId) => {
        const index = slotOf(table, userId);
        if (index === -1) return;
        table.slots[index] = null;
        refreshPhase(roomId, table);
    };

    hub.on('foosballLeave', ({ user }, { roomId }) => {
        const table = isRoomId(roomId) ? tables.get(roomId) : null;
        if (table) leave(roomId, table, user.id);
    });

    hub.on('foosballRods', ({ user }, { roomId, offsets }) => {
        const table = isRoomId(roomId) ? tables.get(roomId) : null;
        if (!table || !offsets || typeof offsets !== 'object') return;
        const slot = slotOf(table, user.id);
        if (slot === -1) return;
        const now = Date.now();
        if (now - (user.lastFoosballRods ?? 0) < MIN_RODS_INTERVAL_MS) return;
        user.lastFoosballRods = now;
        rodsFor(table.slots, slot).forEach(index => {
            const value = offsets[index];
            if (typeof value !== 'number' || !Number.isFinite(value)) return;
            const limit = maxOffset(LAYOUT.rods[index]);
            table.rods[index].target = Math.max(-limit, Math.min(limit, value));
        });
    });

    hub.on('foosballKick', ({ user }, { roomId }) => {
        const table = isRoomId(roomId) ? tables.get(roomId) : null;
        if (!table) return;
        const slot = slotOf(table, user.id);
        if (slot === -1) return;
        const now = Date.now();
        if (now - (user.lastFoosballKick ?? 0) < KICK_COOLDOWN_MS) return;
        user.lastFoosballKick = now;
        rodsFor(table.slots, slot).forEach(index => { table.rods[index].kick = KICK_TIME; });
    });

    hub.onJoin(({ ws }) => {
        const states = {};
        tables.forEach((table, roomId) => { states[roomId] = { slots: table.slots, phase: table.phase, score: table.score }; });
        hub.send(ws, { type: 'foosballTables', tables: states });
    });

    hub.onLeave(({ user }) => {
        tables.forEach((table, roomId) => leave(roomId, table, user.id));
    });
}

module.exports = { registerFoosball, rodsFor, maxOffset };
