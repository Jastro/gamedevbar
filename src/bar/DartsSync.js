import * as THREE from 'three';

// Darts (server: server/features/darts.js). F at the yellow line asks for
// the board; once the server names us the thrower, the camera locks behind
// us, the mouse aims a swaying crosshair (more when drunk) and a click or
// Space throws. Three darts, then the turn ends by itself; Esc leaves early.
const DARTS_PER_TURN = 3;
const THROW_COOLDOWN = 650; // ms (the server allows one per 600)
const SWAY = 0.08;          // board units, sober
const DRUNK_SWAY = 0.35;    // extra at full drunkenness
const RELEASE_JITTER = 0.03;
const HAND_OFFSET = new THREE.Vector3(0, 0.7, 0);
const HINT = 'Apunta con el ratón · Clic o Espacio: lanzar · Esc: salir';

export class DartsSync {
    constructor(game) {
        this.game = game;
        this.states = new Map(); // roomId -> state
        this.session = null; // { roomId, board, thrown }
        this.mouse = new THREE.Vector2();
        this.raycaster = new THREE.Raycaster();
        this.aim = { x: 0, y: 0 };
        this.lastThrow = 0;

        window.addEventListener('mousemove', (event) => {
            this.mouse.set((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);
        });
        window.addEventListener('click', (event) => {
            if (this.session && event.target?.id === 'webgl-layer') this.throw();
        });
        window.addEventListener('keydown', (event) => {
            if (!this.session || this.game.chatActive) return;
            if (event.key === ' ' && !event.repeat) {
                event.preventDefault();
                this.throw();
            } else if (event.key === 'Escape') {
                this.leave();
            }
        });
    }

    get localId() {
        return this.game.players.localPlayer?.id;
    }

    board(roomId) {
        return this.game.environment.rooms.get(roomId)?.dartboard ?? null;
    }

    bind() {
        const { network } = this.game;
        network.on('dartsStates', (data) => {
            Object.entries(data.rooms || {}).forEach(([roomId, state]) => this.applyState(roomId, state));
        });
        network.on('dartsState', (data) => this.applyState(data.roomId, data.state));
        network.on('dartsThrow', (data) => this.handleThrow(data));
        network.on('dartsBusy', (data) => {
            this.game.ui.chat?.addMessage({ type: 'system', message: `🎯 Está tirando ${data.thrower?.name ?? 'alguien'}, espera tu turno.` });
        });
    }

    // From the interaction: ask for the board.
    request(board) {
        const state = this.states.get(board.id);
        const thrower = state?.thrower;
        if (thrower && thrower.userId !== this.localId && this.game.players.players.has(thrower.userId)) {
            this.game.ui.chat?.addMessage({ type: 'system', message: `🎯 Está tirando ${thrower.name}, espera tu turno.` });
            return;
        }
        this.game.network.send('dartsStart', { roomId: board.id });
    }

    applyState(roomId, state) {
        const board = this.board(roomId);
        if (!board || !state) return;
        this.states.set(roomId, state);
        board.syncDarts(state.darts);
        board.drawChalkboard(state);
        const mine = state.thrower?.userId === this.localId;
        if (mine && !this.session) this.enter(roomId, board, state.darts?.length ?? 0);
        else if (!mine && this.session?.roomId === roomId) this.exit();
    }

    handleThrow({ roomId, userId, index, x, y, label, score }) {
        const board = this.board(roomId);
        const player = this.game.players.players.get(userId);
        if (!board || !Number.isInteger(index)) return;
        const from = player
            ? player.mesh.position.clone().add(HAND_OFFSET)
            : board.getView().position;
        board.throwDart(index, x, y, from, this.game.environment.audioListener);
        // The server only republishes the state at the end of a turn; keep
        // the chalkboard's running darts current meanwhile.
        const state = this.states.get(roomId);
        if (state) {
            state.darts = [...(state.darts ?? [])];
            state.darts[index] = { x, y, score, label };
            board.drawChalkboard(state);
        }
        if (userId === this.localId) {
            const points = score > 0 ? `${label} (${score})` : label;
            this.game.ui.chat?.addMessage({ type: 'system', message: `🎯 ${points}` });
        }
    }

    // --- Throwing ---------------------------------------------------------------

    enter(roomId, board, thrown) {
        const player = this.game.players.localPlayer;
        if (!player || this.game.playMode) {
            this.game.network.send('dartsLeave', { roomId });
            return;
        }
        if (player.isSitting) player.standUp();
        const spot = board.getStandSpot();
        player.position.copy(spot.position);
        player.rotation = spot.rotation;
        player.stopMoving?.();
        player.keysPressed = {};
        this.session = { roomId, board, thrown };
        this.aim = { x: 0, y: 0 };
        this.game.playMode = { hint: HINT };
        const view = board.getView();
        this.game.camera.setView(view.position, view.lookAt);
    }

    exit() {
        if (!this.session) return;
        this.session.board.setCrosshair(null);
        this.session = null;
        this.game.camera.clearView();
        this.game.playMode = null;
    }

    leave() {
        if (!this.session) return;
        this.game.network.send('dartsLeave', { roomId: this.session.roomId });
        this.exit();
    }

    // Crosshair = mouse aim + a slow figure-of-eight sway.
    crosshairAt(time) {
        const drunk = this.game.drinkSync?.effect ?? 0;
        const amount = SWAY + DRUNK_SWAY * drunk;
        return {
            x: this.aim.x + amount * (Math.sin(time * 1.7) + 0.5 * Math.sin(time * 4.3)) / 1.5,
            y: this.aim.y + amount * (Math.sin(time * 2.3 + 1) + 0.5 * Math.cos(time * 3.7)) / 1.5
        };
    }

    throw() {
        const session = this.session;
        const now = performance.now();
        if (!session || session.thrown >= DARTS_PER_TURN || now - this.lastThrow < THROW_COOLDOWN) return;
        this.lastThrow = now;
        session.thrown += 1;
        const point = this.crosshairAt(now / 1000);
        const jitter = () => (Math.random() + Math.random() - 1) * RELEASE_JITTER;
        this.game.network.send('dartsThrow', { roomId: session.roomId, x: point.x + jitter(), y: point.y + jitter() });
    }

    update(deltaTime) {
        this.game.environment.rooms.forEach(({ dartboard }) => dartboard.update(deltaTime));
        const session = this.session;
        if (!session) return;
        // Aim where the mouse points on the board.
        this.raycaster.setFromCamera(this.mouse, this.game.camera.getCamera());
        const hit = this.raycaster.ray.intersectPlane(session.board.getPlane(), new THREE.Vector3());
        if (hit) {
            const point = session.board.toBoardUnits(hit);
            this.aim = { x: THREE.MathUtils.clamp(point.x, -1.5, 1.5), y: THREE.MathUtils.clamp(point.y, -1.5, 1.5) };
        }
        session.board.setCrosshair(session.thrown < DARTS_PER_TURN ? this.crosshairAt(performance.now() / 1000) : null);
    }
}
