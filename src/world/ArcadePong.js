import * as THREE from 'three';

// The Pong cabinet in each bar (machine id = room id). Who plays is decided
// by the server (server/features/pong.js): player 1 plays the CPU until a
// second player joins, then the match restarts as 1 vs 1.
// Roles on this client:
//   host    (player 1): runs the game, sends snapshots 20 times a second;
//   guest   (player 2): moves its own paddle, sends it, draws the snapshots;
//   watcher (everyone else): draws the snapshots, moving the ball between them.
// Speeds are per second, so the game runs the same at any frame rate.
const SIZE = 512;            // canvas px (the game's units)
const PADDLE_HEIGHT = 80;
const PADDLE_WIDTH = 20;
const BALL_RADIUS = 10;
const BALL_SPEED = 300;      // px/s at the serve
const BALL_SPEEDUP = 1.1;    // per paddle hit
const MAX_BALL_SPEED = 900;
const PADDLE_SPEED = 600;    // px/s
const AI_SPEED = 300;        // px/s, beatable
const VICTORY_SCORE = 5;
const COUNTDOWN = 3;         // s before the serve
const OVER_TIME = 4;         // s of "game over" before the machine frees up
const SNAPSHOT_INTERVAL = 50; // ms
const SOUND_DISTANCE = 8;    // watchers closer than this hear it
const MAX_DELTA = 0.05;      // s; a stalled tab doesn't teleport the ball
const PLAY_HINT = 'W/S o ↑/↓: mover la pala · Esc: dejar de jugar';

export class ArcadePong {
    constructor(room) {
        this.room = room;
        this.machine = { player1: null, player2: null, mode: 'idle' };
        this.keysPressed = {};
        this.sounds = {};
        this.lastFrame = performance.now();
        this.lastSent = 0;
        this.pendingEvents = [];
        this.resetMatch();
        this.setupCanvas();
        this.setupControls();
        this.setupSounds();
    }

    get id() {
        return this.room.id;
    }

    get network() {
        return window.game?.network;
    }

    get localId() {
        return window.game?.players.localPlayer?.id;
    }

    // 'host', 'guest' or 'watcher' for this client.
    get role() {
        const id = this.localId;
        if (id && this.machine.player1?.userId === id) return 'host';
        if (id && this.machine.player2?.userId === id) return 'guest';
        return 'watcher';
    }

    create(position = { x: 7, y: 2, z: -8 }) {
        this.arcadeGroup = new THREE.Group();
        const cabinetMaterial = new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.2, metalness: 0.8 });
        const cabinet = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 1.5), cabinetMaterial);

        const screenTexture = new THREE.CanvasTexture(this.canvas);
        screenTexture.minFilter = THREE.LinearFilter;
        this.screen = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.8), new THREE.MeshBasicMaterial({ map: screenTexture }));
        this.screen.position.set(0, 0.5, 0.76);

        const controlPanel = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 0.8), cabinetMaterial);
        controlPanel.position.set(0, -1, 0.3);
        controlPanel.rotation.x = -Math.PI / 6;

        this.arcadeGroup.add(cabinet, this.screen, controlPanel);
        this.arcadeGroup.position.set(position.x, position.y, position.z);
        this.arcadeGroup.userData = {
            type: 'arcade',
            arcade: this,
            originalMaterial: cabinetMaterial,
            highlightMaterial: new THREE.MeshStandardMaterial({ color: 0x7fff7f, emissive: 0x2f2f2f })
        };
        window.game?.world?.collisionManager?.addCollider(this.arcadeGroup);
        this.room.add(this.arcadeGroup);
        this.animate();
    }

    setupCanvas() {
        this.canvas = document.createElement('canvas');
        this.canvas.width = SIZE;
        this.canvas.height = SIZE;
        this.context = this.canvas.getContext('2d');
    }

    setupSounds() {
        // Its own listener, so the Arcade volume slider is its master gain.
        const listener = new THREE.AudioListener();
        (window.game?.environment?.ear ?? window.game?.camera?.getCamera())?.add(listener);
        const settings = window.game?.audioSettings;
        listener.setMasterVolume(settings?.get('arcade') ?? 1);
        settings?.on('change', ({ category, value }) => {
            if (category === 'arcade') listener.setMasterVolume(value);
        });
        const loader = new THREE.AudioLoader();
        const load = (name, url, volume) => {
            this.sounds[name] = new THREE.Audio(listener);
            loader.load(url, (buffer) => {
                this.sounds[name].setBuffer(buffer);
                this.sounds[name].setVolume(volume);
            });
        };
        load('hit', '/assets/sound/arcade/hit.wav', 0.3);
        load('point', '/assets/sound/arcade/point.wav', 0.4);
        load('over', '/assets/sound/arcade/gameover.mp3', 0.5);
    }

    setupControls() {
        document.addEventListener('keydown', (event) => {
            this.keysPressed[event.code] = true;
            if (event.key === 'Escape' && this.role !== 'watcher' && this.machine.mode !== 'idle') this.leave();
        });
        document.addEventListener('keyup', (event) => {
            this.keysPressed[event.code] = false;
        });
        window.addEventListener('blur', () => { this.keysPressed = {}; });
    }

    // Used by LocalPlayer (no walking while playing) via Environment.
    isPlayingGame(playerId) {
        if (this.machine.mode === 'idle') return false;
        return this.machine.player1?.userId === playerId || this.machine.player2?.userId === playerId;
    }

    checkPlayerProximity(playerPosition) {
        const arcade = this.arcadeGroup.getWorldPosition(new THREE.Vector3());
        return Math.hypot(playerPosition.x - arcade.x, playerPosition.z - arcade.z) <= 3;
    }

    // --- Server state --------------------------------------------------------

    join() {
        this.network?.send('pongJoin', { machineId: this.id });
    }

    leave() {
        this.network?.send('pongLeave', { machineId: this.id });
    }

    applyMachine(state) {
        const previous = this.machine;
        this.machine = {
            player1: state?.player1 ?? null,
            player2: state?.player2 ?? null,
            mode: ['onePlayer', 'twoPlayer'].includes(state?.mode) ? state.mode : 'idle'
        };
        // A new match (someone started, or player 2 joined): fresh scores.
        const restarted = this.machine.mode !== previous.mode
            || this.machine.player1?.userId !== previous.player1?.userId;
        if (restarted) this.resetMatch();
        this.updatePlayMode();
    }

    // Snapshots from the host (guest and watchers).
    applySnapshot(snapshot) {
        if (this.role === 'host' || this.machine.mode === 'idle') return;
        const { ball, p1y, p2y, s1, s2, phase, countdown, winner, events } = snapshot;
        this.match.ball = { ...ball };
        this.match.p1y = p1y;
        if (this.role !== 'guest') this.match.p2y = p2y;
        Object.assign(this.match, { s1, s2, phase, countdown, winner });
        if (this.isNear()) (events || []).forEach(event => this.play(event));
    }

    // Player 2's paddle (host and watchers).
    applyPaddle(y) {
        if (this.role !== 'guest') this.match.p2y = y;
    }

    // While we're one of the players: the hint, and no world keys.
    updatePlayMode() {
        const game = window.game;
        if (!game) return;
        const playing = this.role !== 'watcher' && this.machine.mode !== 'idle';
        if (playing && !game.playMode) {
            this.playMode = { hint: PLAY_HINT };
            game.playMode = this.playMode;
        } else if (!playing && this.playMode && game.playMode === this.playMode) {
            game.playMode = null;
            this.playMode = null;
        }
    }

    // --- The game --------------------------------------------------------------

    resetMatch() {
        this.match = {
            p1y: SIZE / 2,
            p2y: SIZE / 2,
            s1: 0,
            s2: 0,
            ball: { x: SIZE / 2, y: SIZE / 2, dx: 0, dy: 0 },
            phase: 'countdown',
            countdown: COUNTDOWN,
            winner: null,
            overTime: 0,
            nextServe: Math.random() < 0.5 ? 1 : -1
        };
    }

    serve() {
        const angle = (Math.random() - 0.5) * Math.PI / 3;
        const direction = this.match.nextServe;
        this.match.ball = {
            x: SIZE / 2,
            y: SIZE / 2,
            dx: Math.cos(angle) * BALL_SPEED * direction,
            dy: Math.sin(angle) * BALL_SPEED
        };
    }

    movePaddle(key, dt) {
        const up = this.keysPressed.KeyW || this.keysPressed.ArrowUp;
        const down = this.keysPressed.KeyS || this.keysPressed.ArrowDown;
        if (window.game?.chatActive || up === down) return;
        const half = PADDLE_HEIGHT / 2;
        this.match[key] = Math.min(SIZE - half, Math.max(half, this.match[key] + (down ? 1 : -1) * PADDLE_SPEED * dt));
    }

    // Host only: the whole simulation.
    simulate(dt) {
        const m = this.match;
        this.movePaddle('p1y', dt);
        if (this.machine.mode === 'onePlayer') {
            const target = m.ball.dx > 0 ? m.ball.y : SIZE / 2;
            const diff = target - m.p2y;
            m.p2y += Math.sign(diff) * Math.min(Math.abs(diff), AI_SPEED * dt);
        }

        if (m.phase === 'countdown') {
            m.countdown -= dt;
            if (m.countdown <= 0) {
                m.phase = 'play';
                this.serve();
            }
            return;
        }
        if (m.phase === 'over') {
            m.overTime += dt;
            if (m.overTime >= OVER_TIME && !m.overSent) {
                m.overSent = true;
                this.network?.send('pongOver', { machineId: this.id });
            }
            return;
        }

        const ball = m.ball;
        ball.x += ball.dx * dt;
        ball.y += ball.dy * dt;
        if (ball.y < BALL_RADIUS && ball.dy < 0) { ball.y = BALL_RADIUS; ball.dy *= -1; }
        if (ball.y > SIZE - BALL_RADIUS && ball.dy > 0) { ball.y = SIZE - BALL_RADIUS; ball.dy *= -1; }

        // Paddles: the bounce angle depends on where the ball hits.
        const hitPaddle = (paddleY, side) => {
            const offset = (ball.y - paddleY) / (PADDLE_HEIGHT / 2);
            if (Math.abs(offset) > 1.15) return false;
            const speed = Math.min(MAX_BALL_SPEED, Math.hypot(ball.dx, ball.dy) * BALL_SPEEDUP);
            const angle = offset * Math.PI / 4;
            ball.dx = Math.cos(angle) * speed * side;
            ball.dy = Math.sin(angle) * speed;
            this.event('hit');
            return true;
        };
        if (ball.dx < 0 && ball.x - BALL_RADIUS <= PADDLE_WIDTH && ball.x > 0) {
            if (hitPaddle(m.p1y, 1)) ball.x = PADDLE_WIDTH + BALL_RADIUS;
        } else if (ball.dx > 0 && ball.x + BALL_RADIUS >= SIZE - PADDLE_WIDTH && ball.x < SIZE) {
            if (hitPaddle(m.p2y, -1)) ball.x = SIZE - PADDLE_WIDTH - BALL_RADIUS;
        }

        // Points.
        if (ball.x < -BALL_RADIUS || ball.x > SIZE + BALL_RADIUS) {
            const scorer = ball.x < 0 ? 2 : 1;
            if (scorer === 1) m.s1 += 1; else m.s2 += 1;
            this.event('point');
            m.nextServe = scorer === 1 ? 1 : -1;
            m.ball = { x: SIZE / 2, y: SIZE / 2, dx: 0, dy: 0 };
            if (m.s1 >= VICTORY_SCORE || m.s2 >= VICTORY_SCORE) {
                m.phase = 'over';
                m.winner = scorer;
                m.overTime = 0;
                this.event('over');
            } else {
                m.phase = 'countdown';
                m.countdown = 1;
            }
        }
    }

    // Guest and watchers: carry the ball on between snapshots.
    extrapolate(dt) {
        const m = this.match;
        if (m.phase === 'countdown') m.countdown = Math.max(0, m.countdown - dt);
        if (m.phase !== 'play') return;
        const ball = m.ball;
        ball.x += ball.dx * dt;
        ball.y += ball.dy * dt;
        if (ball.y < BALL_RADIUS && ball.dy < 0) ball.dy *= -1;
        if (ball.y > SIZE - BALL_RADIUS && ball.dy > 0) ball.dy *= -1;
    }

    event(name) {
        this.pendingEvents.push(name);
        this.play(name);
    }

    play(name) {
        const sound = this.sounds[name];
        if (!sound?.buffer) return;
        if (sound.isPlaying) sound.stop();
        sound.play();
    }

    isNear() {
        if (this.role !== 'watcher') return true;
        const player = window.game?.players.localPlayer;
        if (!player || !this.arcadeGroup) return false;
        const arcade = this.arcadeGroup.getWorldPosition(new THREE.Vector3());
        return Math.hypot(player.position.x - arcade.x, player.position.z - arcade.z) <= SOUND_DISTANCE;
    }

    sendSnapshot(now) {
        if (now - this.lastSent < SNAPSHOT_INTERVAL) return;
        this.lastSent = now;
        const m = this.match;
        this.network?.send('pongState', {
            machineId: this.id,
            ball: m.ball, p1y: m.p1y, p2y: m.p2y, s1: m.s1, s2: m.s2,
            phase: m.phase, countdown: m.countdown, winner: m.winner,
            events: this.pendingEvents.splice(0)
        });
    }

    sendPaddle(now) {
        if (now - this.lastSent < SNAPSHOT_INTERVAL) return;
        this.lastSent = now;
        this.network?.send('pongPaddle', { machineId: this.id, y: this.match.p2y });
    }

    update(deltaTime) {
        const now = performance.now();
        const dt = Math.min(deltaTime, MAX_DELTA);
        if (this.machine.mode === 'idle') {
            this.drawTitle(now);
            return;
        }
        const role = this.role;
        if (role === 'host') {
            this.simulate(dt);
            this.sendSnapshot(now);
        } else {
            if (role === 'guest') {
                this.movePaddle('p2y', dt);
                this.sendPaddle(now);
            }
            this.extrapolate(dt);
        }
        this.draw(now);
    }

    animate() {
        const now = performance.now();
        const deltaTime = (now - this.lastFrame) / 1000;
        this.lastFrame = now;
        this.update(deltaTime);
        requestAnimationFrame(() => this.animate());
    }

    // --- Drawing --------------------------------------------------------------

    drawTitle(now) {
        const ctx = this.context;
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, SIZE, SIZE);
        const hue = (now % 3000) / 3000 * 360;
        ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
        const scale = 1 + Math.sin(now / 500) * 0.1;
        ctx.font = `bold ${48 * scale}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText('PONG', SIZE / 2, 200);
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.sin(now / 400) * 0.5 + 0.5})`;
        ctx.font = '24px Arial';
        ctx.fillText('Acércate y pulsa F para jugar', SIZE / 2, 300);
        ctx.fillText('Controles: W/S o ↑/↓', SIZE / 2, 350);
        this.refresh();
    }

    draw(now) {
        const ctx = this.context;
        const m = this.match;
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, SIZE, SIZE);

        ctx.strokeStyle = 'white';
        ctx.setLineDash([20, 15]);
        ctx.beginPath();
        ctx.moveTo(SIZE / 2, 0);
        ctx.lineTo(SIZE / 2, SIZE);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.font = '48px Arial';
        ctx.fillText(String(m.s1), SIZE / 4, 60);
        ctx.fillText(String(m.s2), SIZE * 3 / 4, 60);
        ctx.font = '18px Arial';
        const name = (player) => (player?.name ?? '').slice(0, 14);
        ctx.fillText(name(this.machine.player1), SIZE / 4, 90);
        ctx.fillText(this.machine.mode === 'twoPlayer' ? name(this.machine.player2) : 'CPU', SIZE * 3 / 4, 90);

        ctx.fillRect(0, m.p1y - PADDLE_HEIGHT / 2, PADDLE_WIDTH, PADDLE_HEIGHT);
        ctx.fillRect(SIZE - PADDLE_WIDTH, m.p2y - PADDLE_HEIGHT / 2, PADDLE_WIDTH, PADDLE_HEIGHT);

        if (m.phase === 'play') {
            ctx.beginPath();
            ctx.arc(m.ball.x, m.ball.y, BALL_RADIUS, 0, Math.PI * 2);
            ctx.fill();
        } else if (m.phase === 'countdown') {
            ctx.font = 'bold 72px Arial';
            ctx.fillText(String(Math.max(1, Math.ceil(m.countdown))), SIZE / 2, SIZE / 2 + 24);
        } else if (m.phase === 'over') {
            const winner = m.winner === 1 ? this.machine.player1 : this.machine.player2;
            const winnerName = m.winner === 2 && this.machine.mode === 'onePlayer' ? 'la CPU' : name(winner);
            ctx.fillStyle = `hsl(${(now % 1000) / 1000 * 360}, 100%, 50%)`;
            ctx.font = 'bold 44px Arial';
            ctx.fillText('¡FIN DEL JUEGO!', SIZE / 2, SIZE / 2 - 20);
            ctx.font = '28px Arial';
            ctx.fillText(`Gana ${winnerName}`, SIZE / 2, SIZE / 2 + 30);
        }

        // Watchers: a one-player game can be joined.
        if (this.machine.mode === 'onePlayer' && this.role === 'watcher' && m.phase !== 'over') {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.font = '20px Arial';
            ctx.fillText(`F: retar a ${name(this.machine.player1)}`, SIZE / 2, SIZE - 24);
        }
        this.refresh();
    }

    refresh() {
        if (this.screen?.material.map) this.screen.material.map.needsUpdate = true;
    }
}
