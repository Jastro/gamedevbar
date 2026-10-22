import * as THREE from 'three';
import { LAYOUT, maxOffset, rodsFor, TEAM_NAMES } from './Foosball';
import { playSynth, playTones } from '../audio/synth';

// Futbolín (server: server/features/foosball.js runs the game). F on one long
// side joins that team; while you play, the camera looks down at the pitch
// from your side, W/S (↑/↓) slide your rods, Space or a click kicks, Esc
// leaves. Your own rods move at once here; everything else comes from the
// server's snapshots (the ball carried on between them).
const INPUT_SPEED = 1.8;     // units/s your rods slide
const SEND_INTERVAL = 50;    // ms between rod updates
const BALL_CORRECTION = 12;  // 1/s: how fast the drawn ball eases to the server's
const ROD_FOLLOW = 15;       // 1/s for other players' rods
const SOUND_DISTANCE = 8;
const HINT = 'W/S o ↑/↓: mover · Espacio o clic: chutar · Esc: salir';

export class FoosballSync {
    constructor(game) {
        this.game = game;
        this.tables = new Map(); // roomId -> { slots, phase, score, snapshot, ball, rods }
        this.session = null;     // { roomId, slot, team, rods: [indices], offsets: Map }
        this.lastSent = 0;
        this.keys = {};

        window.addEventListener('keydown', (event) => {
            if (!this.session || this.game.chatActive) return;
            this.keys[event.code] = true;
            if (event.code === 'Space' && !event.repeat) {
                event.preventDefault();
                this.kick();
            } else if (event.key === 'Escape') {
                this.leave();
            }
        });
        window.addEventListener('keyup', (event) => { this.keys[event.code] = false; });
        window.addEventListener('blur', () => { this.keys = {}; });
        window.addEventListener('click', (event) => {
            if (this.session && event.target?.id === 'webgl-layer') this.kick();
        });
    }

    get localId() {
        return this.game.players.localPlayer?.id;
    }

    table(roomId) {
        return this.game.environment.rooms.get(roomId)?.foosball ?? null;
    }

    stateFor(roomId) {
        if (!this.tables.has(roomId)) {
            this.tables.set(roomId, {
                slots: [null, null, null, null], phase: 'idle', score: [0, 0], snapshot: null,
                ball: { x: 0, z: 0, vx: 0, vz: 0 }, rods: LAYOUT.rods.map(() => 0)
            });
        }
        return this.tables.get(roomId);
    }

    bind() {
        const { network } = this.game;
        network.on('foosballTables', (data) => {
            Object.entries(data.tables || {}).forEach(([roomId, table]) => this.applyTable(roomId, table));
        });
        network.on('foosballTable', (data) => this.applyTable(data.roomId, data));
        network.on('foosballState', (data) => this.applySnapshot(data));
        network.on('foosballFull', (data) => {
            this.say(`⚽ El equipo ${TEAM_NAMES[data.team] ?? ''} ya está completo. Prueba el otro lado.`);
        });
    }

    say(message) {
        this.game.ui.chat?.addMessage({ type: 'system', message });
    }

    applyTable(roomId, data) {
        if (!this.table(roomId) || !Array.isArray(data.slots)) return;
        const state = this.stateFor(roomId);
        state.slots = data.slots.slice(0, 4);
        state.phase = data.phase;
        state.score = Array.isArray(data.score) ? data.score : [0, 0];
        const slot = state.slots.findIndex(entry => entry?.userId === this.localId);
        if (slot !== -1 && (!this.session || this.session.roomId !== roomId)) {
            this.enter(roomId, slot);
        } else if (slot === -1 && this.session?.roomId === roomId) {
            this.exit();
        } else if (slot !== -1 && this.session) {
            // A partner came or went: our rods change.
            this.session.slot = slot;
            this.session.rods = rodsFor(state.slots, slot);
        }
    }

    applySnapshot(data) {
        const table = this.table(data.roomId);
        if (!table || !Array.isArray(data.ball) || !Array.isArray(data.rods)) return;
        const state = this.stateFor(data.roomId);
        state.snapshot = data;
        state.phase = data.phase;
        state.score = data.score;
        const [x, z, vx, vz] = data.ball;
        state.target = { x, z };
        state.ball.vx = vx;
        state.ball.vz = vz;
        // Jumps (a goal reset) snap; small differences ease.
        if (Math.hypot(state.ball.x - x, state.ball.z - z) > 0.4 || data.phase !== 'play') {
            state.ball.x = x;
            state.ball.z = z;
        }
        (data.kicks || []).forEach((kicking, index) => {
            if (kicking && !this.session?.rods.includes(index)) table.kick(index);
        });
        const near = this.isNear(table);
        (data.events || []).forEach(event => this.playEvent(table, event, data, near));
    }

    playEvent(table, event, data, near) {
        const listener = this.game.environment.audioListener;
        const at = new THREE.Vector3(data.ball[0], 1.1, data.ball[1]);
        if ((event === 'kick' || event === 'hit') && near && listener) {
            playSynth(listener, table.group, at, 'dart', event === 'kick' ? 3 : 1.5);
        } else if (event === 'goal') {
            if (near && listener) playTones(listener, table.group, at, [[523, 0, 0.12], [659, 0.12, 0.12], [784, 0.24, 0.3]], 0.2, 5);
            if (this.session?.roomId === data.roomId) {
                this.say(`⚽ ¡GOOOL! ${TEAM_NAMES[0]} ${data.score[0]} - ${data.score[1]} ${TEAM_NAMES[1]}`);
            }
        } else if (event === 'win' && this.session?.roomId === data.roomId) {
            const winner = data.score[0] > data.score[1] ? 0 : 1;
            this.say(`🏆 Gana el equipo ${TEAM_NAMES[winner]} (${data.score[0]} - ${data.score[1]}). Otra en 4 s…`);
        }
    }

    isNear(table) {
        if (this.session) return true;
        const player = this.game.players.localPlayer;
        return Boolean(player) && table.distanceTo(player.position) < SOUND_DISTANCE;
    }

    // --- Playing ------------------------------------------------------------------

    // From the interaction: join the team on the side you're standing.
    join(table) {
        const player = this.game.players.localPlayer;
        if (!player) return;
        this.game.network.send('foosballJoin', { roomId: table.id, team: table.sideOf(player.position) });
    }

    enter(roomId, slot) {
        const table = this.table(roomId);
        const player = this.game.players.localPlayer;
        if (!table || !player) return;
        if (this.game.playMode) {
            // Busy with something else (darts, an arcade): give the place back.
            this.game.network.send('foosballLeave', { roomId });
            return;
        }
        if (player.isSitting) player.standUp();
        const team = slot < 2 ? 0 : 1;
        const state = this.stateFor(roomId);
        const rods = rodsFor(state.slots, slot);
        this.session = { roomId, slot, team, rods };
        // Partners stand apart: the back player toward their own goal.
        const ownGoal = team === 0 ? -1 : 1;
        const partner = state.slots[team * 2 + (slot % 2 === 0 ? 1 : 0)];
        const along = partner ? (slot % 2 === 0 ? ownGoal : -ownGoal) * 0.6 : 0;
        const spot = table.getStandSpot(team, along);
        player.position.copy(spot.position);
        player.rotation = spot.rotation;
        player.stopMoving?.();
        player.keysPressed = {};
        this.playMode = { hint: HINT };
        this.game.playMode = this.playMode;
        // The camera is where your head would be: hide your own avatar
        // (everyone else still sees it).
        player.mesh.visible = false;
        const view = table.getView(team);
        this.game.camera.setView(view.position, view.lookAt);
        this.say(`⚽ Juegas con el ${TEAM_NAMES[team]}.${state.slots.some((s, i) => s && (i < 2 ? 0 : 1) !== team) ? '' : ' Esperando rival: puedes entrenar.'}`);
    }

    exit() {
        if (!this.session) return;
        this.session = null;
        this.keys = {};
        const player = this.game.players.localPlayer;
        if (player) player.mesh.visible = true;
        if (this.game.playMode === this.playMode) {
            this.game.playMode = null;
            this.game.camera.clearView();
        }
        this.playMode = null;
    }

    leave() {
        if (!this.session) return;
        this.game.network.send('foosballLeave', { roomId: this.session.roomId });
        this.exit();
    }

    kick() {
        const session = this.session;
        if (!session) return;
        const table = this.table(session.roomId);
        session.rods.forEach(index => table.kick(index));
        this.game.network.send('foosballKick', { roomId: session.roomId });
    }

    // --- Per frame ---------------------------------------------------------------

    update(deltaTime) {
        const dt = Math.min(deltaTime, 0.1);
        this.game.environment.rooms.forEach(({ foosball: table }, roomId) => {
            const state = this.stateFor(roomId);
            const mine = this.session?.roomId === roomId ? this.session : null;

            // Your rods: from the keys. Theirs: toward the snapshot.
            if (mine && !this.game.chatActive) {
                const up = this.keys.KeyW || this.keys.ArrowUp;
                const down = this.keys.KeyS || this.keys.ArrowDown;
                // W pushes the rods away from you: -z for red (at +z), +z for blue.
                const away = mine.team === 0 ? -1 : 1;
                const direction = up === down ? 0 : (up ? away : -away);
                mine.rods.forEach(index => {
                    const limit = maxOffset(LAYOUT.rods[index]);
                    const offset = THREE.MathUtils.clamp(table.getRod(index) + direction * INPUT_SPEED * dt, -limit, limit);
                    table.setRod(index, offset);
                });
            }
            const snapshotRods = state.snapshot?.rods;
            if (snapshotRods) {
                const follow = 1 - Math.exp(-ROD_FOLLOW * dt);
                LAYOUT.rods.forEach((_, index) => {
                    if (mine?.rods.includes(index)) return;
                    const current = table.getRod(index);
                    table.setRod(index, current + ((snapshotRods[index] ?? 0) - current) * follow);
                });
            }

            // Ball: carry it on, ease toward the server's.
            const ball = state.ball;
            if (state.phase === 'play' || state.phase === 'practice') {
                ball.x += ball.vx * dt;
                ball.z += ball.vz * dt;
                if (state.target) {
                    const ease = 1 - Math.exp(-BALL_CORRECTION * dt);
                    state.target.x += ball.vx * dt;
                    state.target.z += ball.vz * dt;
                    ball.x += (state.target.x - ball.x) * ease;
                    ball.z += (state.target.z - ball.z) * ease;
                }
            }
            table.setBall(ball.x, ball.z);
            table.update(dt);
            table.setScoreText(this.scoreText(state));
        });

        // Send our rods.
        const now = performance.now();
        if (this.session && now - this.lastSent >= SEND_INTERVAL) {
            this.lastSent = now;
            const table = this.table(this.session.roomId);
            const offsets = {};
            this.session.rods.forEach(index => { offsets[index] = Math.round(table.getRod(index) * 1000) / 1000; });
            const key = JSON.stringify(offsets);
            if (key !== this.lastOffsets) {
                this.lastOffsets = key;
                this.game.network.send('foosballRods', { roomId: this.session.roomId, offsets });
            }
        }
    }

    scoreText(state) {
        const [red, blue] = state.score ?? [0, 0];
        switch (state.phase) {
            case 'practice': return 'Entrenando · falta rival';
            case 'countdown': return `${Math.max(1, Math.ceil(state.snapshot?.timer ?? 3))}`;
            case 'play': return `🔴 ${red} - ${blue} 🔵`;
            case 'goal': return `¡GOL! 🔴 ${red} - ${blue} 🔵`;
            case 'over': return `🏆 Gana ${red > blue ? TEAM_NAMES[0] : TEAM_NAMES[1]}`;
            default: return 'FUTBOLÍN · F para jugar';
        }
    }
}
