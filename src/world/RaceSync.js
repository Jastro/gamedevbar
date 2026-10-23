import * as THREE from 'three';
import { RING_ROAD, PLAZA_CENTER, slotAngle } from './RoomLayout';
import { hubPoint } from './Outdoors';
import { formatLap } from './LeaderboardSync';
import { playTones } from '../audio/synth';

// The ring road is a circuit (server: server/features/races.js), driven
// counterclockwise (the way the parked cars point), with a checkered line
// and a gantry with start lights on the far side of the plaza (slot 3).
// Time trial: every lap our car completes on the ring is timed and sent
// (raceLap); progress only counts on the ring itself, so cutting through
// the plaza doesn't make a lap. Races: G while driving near the line opens
// or joins one (20 s lobby); when it starts every entrant's car jumps to
// the grid behind the line and holds (DrivingSync) until green; 3 laps,
// and we tell the server when we're done (it does the timing).
const LINE_ANGLE = slotAngle(3);
const MIDDLE = (RING_ROAD.inner + RING_ROAD.outer) / 2;
const BAND = { inner: RING_ROAD.inner - 2, outer: RING_ROAD.outer + 2 }; // "on the ring"
const FULL_LAP = 2 * Math.PI;
const LAP_SLACK = 0.3;      // rad a lap may fall short (bumped off the edge, a wobble at the line)
const MAX_LAP_MS = 5 * 60 * 1000;
const JOIN_REACH = 30;      // how near the line G works
const GRID = { first: 0.07, row: 0.1, lanes: [-2, 2] }; // rad behind the line, rad per row, lanes from the middle
const GANTRY = { height: 5.5, margin: 0.8 };
const COUNTDOWN_MS = 3000;  // the three red lights (the server adds 1 s to get on the grid)
const GO_SHOWN_MS = 1500;
const LIGHT_OFF = 0x262626;
const LIGHT_RED = 0xff2a1a;
const LIGHT_GREEN = 0x2bff5a;

// Bearing (as in RoomLayout.bearing) of a world point around the plaza.
function angleAt(x, z) {
    return Math.atan2(-(x - PLAZA_CENTER.x), -(z - PLAZA_CENTER.z));
}

// Into -π..π.
function wrap(angle) {
    return angle - 2 * Math.PI * Math.floor((angle + Math.PI) / (2 * Math.PI));
}

export class RaceSync {
    constructor(game) {
        this.game = game;
        this.race = { phase: 'idle', laps: 3 };
        this.track = null;   // our lap tracking while we drive
        this.entry = null;   // our part in the race: { lapsDone, mark, finished, gridded }
        this.best = null;    // our best lap this week (ms)
        this.lastBeep = null;
        this.hud = document.createElement('div');
        this.hud.id = 'race-hud';
        this.hud.className = 'hidden';
        document.body.appendChild(this.hud);
        window.addEventListener('keydown', (event) => {
            if (event.code !== 'KeyG' || event.repeat || this.game.chatActive || !this.game.drivingSync?.driving) return;
            this.toggleJoin();
        });
    }

    get localId() {
        return this.game.players.localPlayer?.id;
    }

    get now() {
        return this.game.serverClock.now();
    }

    get inRace() {
        return Boolean(this.race.entrants?.some(entrant => entrant.id === this.localId));
    }

    // Our car waits on the grid for the green light.
    get holding() {
        return this.inRace && this.race.phase === 'running' && this.now < this.race.startAt;
    }

    create() {
        const scene = this.game.scene.getScene();
        this.group = new THREE.Group();
        scene.add(this.group);
        this.createLine();
        this.createGantry();
    }

    createLine() {
        const width = RING_ROAD.outer - RING_ROAD.inner;
        const canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 3;
        const context = canvas.getContext('2d');
        for (let x = 0; x < 16; x++) {
            for (let y = 0; y < 3; y++) {
                context.fillStyle = (x + y) % 2 ? '#111' : '#eee';
                context.fillRect(x, y, 1, 1);
            }
        }
        const texture = new THREE.CanvasTexture(canvas);
        texture.magFilter = THREE.NearestFilter;
        texture.colorSpace = THREE.SRGBColorSpace;
        // Texture u across the road (local z after the turn below).
        const geometry = new THREE.PlaneGeometry(width, 1.5).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2);
        const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9 });
        material.userData.outlineParameters = { visible: false };
        const line = new THREE.Mesh(geometry, material);
        const at = hubPoint(LINE_ANGLE, MIDDLE);
        line.position.set(at.x, -0.003, at.z);
        line.rotation.y = LINE_ANGLE; // local z along the bearing, across the road
        line.receiveShadow = true;
        line.raycast = () => {};
        this.group.add(line);
    }

    // Two posts either side of the road, a beam across with a META sign and
    // three start lights.
    createGantry() {
        const metal = new THREE.MeshStandardMaterial({ color: 0x2f3337, metalness: 0.6, roughness: 0.5 });
        const span = RING_ROAD.outer - RING_ROAD.inner + 2 * GANTRY.margin;
        [RING_ROAD.inner - GANTRY.margin, RING_ROAD.outer + GANTRY.margin].forEach(distance => {
            const at = hubPoint(LINE_ANGLE, distance);
            const post = new THREE.Mesh(new THREE.BoxGeometry(0.35, GANTRY.height, 0.35), metal);
            post.position.set(at.x, GANTRY.height / 2, at.z);
            post.rotation.y = LINE_ANGLE;
            post.castShadow = true;
            this.group.add(post);
            post.updateMatrixWorld(true);
            this.game.world.collisionManager.addCollider(post);
        });
        const middle = hubPoint(LINE_ANGLE, MIDDLE);
        const beam = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, span), metal);
        beam.position.set(middle.x, GANTRY.height, middle.z);
        beam.rotation.y = LINE_ANGLE;
        beam.castShadow = true;
        this.group.add(beam);

        // The sign hangs from the beam, readable from both ways.
        const sign = new THREE.Group();
        sign.position.set(middle.x, GANTRY.height + 0.75, middle.z);
        sign.rotation.y = LINE_ANGLE;
        const signMaterial = new THREE.MeshStandardMaterial({ map: this.createSignTexture(), roughness: 0.8 });
        [0, Math.PI].forEach(turn => {
            // A plane faces +z; turned to face along the road (local ±x).
            const face = new THREE.Mesh(new THREE.PlaneGeometry(span - 1, 1.1), signMaterial);
            face.rotation.y = Math.PI / 2 + turn;
            face.position.x = turn ? -0.03 : 0.03;
            sign.add(face);
        });
        this.group.add(sign);

        // Lights under the beam, facing the cars coming up to the line.
        this.lights = [-1.6, 0, 1.6].map(offset => {
            const material = new THREE.MeshBasicMaterial({ color: LIGHT_OFF });
            material.userData.outlineParameters = { visible: false };
            const light = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), material);
            const at = hubPoint(LINE_ANGLE, MIDDLE + offset);
            light.position.set(at.x, GANTRY.height - 0.45, at.z);
            this.group.add(light);
            return light;
        });
    }

    createSignTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 128;
        const context = canvas.getContext('2d');
        const square = 32;
        for (let x = 0; x < canvas.width; x += square) {
            for (let y = 0; y < canvas.height; y += square) {
                context.fillStyle = ((x + y) / square) % 2 ? '#111' : '#eee';
                context.fillRect(x, y, square, square);
            }
        }
        context.fillStyle = '#dc5a0b';
        context.fillRect(256, 12, 512, 104);
        context.fillStyle = '#fff';
        context.font = 'bold 80px sans-serif';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText('META', 512, 68);
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        return texture;
    }

    bind() {
        const { network } = this.game;
        network.on('raceState', (data) => this.applyState(data));
        network.on('raceLapRecorded', (data) => {
            this.best = Number(data.best) || null;
            const ms = Number(data.ms) || 0;
            this.say(ms === this.best
                ? `⏱️ Vuelta en ${formatLap(ms)} · ¡tu mejor de la semana!`
                : `⏱️ Vuelta en ${formatLap(ms)} · tu mejor: ${formatLap(this.best)}`);
        });
    }

    say(message) {
        this.game.ui.chat?.addMessage({ type: 'system', message });
    }

    applyState(data) {
        this.race = { ...data, entrants: Array.isArray(data.entrants) ? data.entrants : [], finishes: Array.isArray(data.finishes) ? data.finishes : [] };
        if (!this.inRace) {
            this.entry = null;
            return;
        }
        this.entry ??= { lapsDone: 0, mark: null, finished: false, gridded: false };
        if (this.race.phase === 'running' && !this.entry.gridded) {
            this.entry.gridded = true;
            this.placeOnGrid(this.race.entrants.findIndex(entrant => entrant.id === this.localId));
        }
    }

    // Two by two behind the line, in the order they joined.
    placeOnGrid(index) {
        const sync = this.game.drivingSync;
        const entry = sync.cars.get(sync.driving);
        if (!entry) return;
        const angle = LINE_ANGLE - GRID.first - Math.floor(index / 2) * GRID.row;
        const at = hubPoint(angle, MIDDLE + GRID.lanes[index % 2]);
        entry.car.group.position.set(at.x, 0, at.z);
        entry.car.group.rotation.y = Math.atan2(-Math.cos(angle), Math.sin(angle));
        entry.speed = 0;
        sync.lastSent = 0; // tell the others right away
        // A jump, not driving: no progress, no crossing.
        if (this.track) this.track.lastAngle = null;
    }

    toggleJoin() {
        const { phase } = this.race;
        if (this.inRace) {
            this.game.network.send('raceLeave', {});
            this.say(phase === 'lobby' ? '🏁 Te bajas de la carrera.' : '🏁 Abandonas la carrera.');
        } else if (phase === 'running') {
            this.say('🏁 Hay una carrera en marcha: a la siguiente.');
        } else if (!this.nearLine()) {
            this.say('🏁 Las carreras salen de la meta, en el circuito al otro lado de la plaza.');
        } else {
            this.game.network.send('raceJoin', {});
        }
    }

    nearLine() {
        const sync = this.game.drivingSync;
        const car = sync.cars.get(sync.driving)?.car;
        if (!car) return false;
        const line = hubPoint(LINE_ANGLE, MIDDLE);
        return Math.hypot(car.position.x - line.x, car.position.z - line.z) < JOIN_REACH;
    }

    update() {
        const sync = this.game.drivingSync;
        const car = sync?.driving ? sync.cars.get(sync.driving)?.car : null;
        if (car) {
            this.trackLaps(car);
        } else {
            this.track = null;
            // Out of the car: out of the race.
            if (this.inRace && !this.leaving) {
                this.leaving = true;
                this.game.network.send('raceLeave', {});
            }
        }
        if (!this.inRace) this.leaving = false;
        this.updateLights();
        this.updateHud(car);
    }

    trackLaps(car) {
        const track = this.track ??= { lastAngle: null, progress: 0, lapStart: null, lapStartProgress: 0 };
        const { x, z } = car.position;
        const distance = Math.hypot(x - PLAZA_CENTER.x, z - PLAZA_CENTER.z);
        if (distance < BAND.inner || distance > BAND.outer) {
            track.lastAngle = null;
            return;
        }
        const angle = angleAt(x, z);
        if (track.lastAngle !== null) {
            const delta = wrap(angle - track.lastAngle);
            track.progress += delta;
            const before = wrap(track.lastAngle - LINE_ANGLE);
            const after = wrap(angle - LINE_ANGLE);
            if (before < 0 && after >= 0 && Math.abs(delta) < 0.5) this.crossed(track);
        }
        track.lastAngle = angle;
    }

    // Our car crossed the line going the right way.
    crossed(track) {
        const now = performance.now();
        const run = track.progress - track.lapStartProgress;
        const fullLap = run >= FULL_LAP - LAP_SLACK;
        if (track.lapStart !== null && fullLap && now - track.lapStart <= MAX_LAP_MS) {
            this.game.network.send('raceLap', { ms: Math.round(now - track.lapStart) });
        }
        // A new lap starts here, unless this was just a wobble back and
        // forth over the line.
        if (track.lapStart === null || fullLap || run > 1) {
            track.lapStart = now;
            track.lapStartProgress = track.progress;
        }

        const entry = this.entry;
        if (!entry || entry.finished || this.race.phase !== 'running' || this.now < this.race.startAt) return;
        if (entry.mark === null) {
            entry.mark = track.progress; // the start: off the grid and over the line
        } else if (track.progress - entry.mark >= FULL_LAP - LAP_SLACK) {
            entry.lapsDone++;
            entry.mark = track.progress;
            if (entry.lapsDone >= this.race.laps) {
                entry.finished = true;
                this.game.network.send('raceFinish', {});
            }
        }
    }

    // How many red lights (1-3), green, or off, plus a beep on each change.
    lightState() {
        const { phase, startAt } = this.race;
        if (phase !== 'running' || !startAt) return { red: 0, green: false };
        const left = startAt - this.now;
        if (left > COUNTDOWN_MS) return { red: 0, green: false };
        if (left > 0) return { red: 3 - Math.floor(left / 1000), green: false };
        return { red: 0, green: true };
    }

    updateLights() {
        const { red, green } = this.lightState();
        this.lights.forEach((light, i) => light.material.color.setHex(green ? LIGHT_GREEN : (i < red ? LIGHT_RED : LIGHT_OFF)));
        const beep = green ? 'go' : red;
        if (beep !== this.lastBeep) {
            this.lastBeep = beep;
            const listener = this.game.environment.audioListener;
            const notes = beep === 'go' ? [[880, 0, 0.7]] : (red ? [[440, 0, 0.25]] : []);
            // Only for the start itself (not the green that stays on during the race).
            if (listener && notes.length && this.now - this.race.startAt < GO_SHOWN_MS) {
                playTones(listener, this.lights[1], new THREE.Vector3(), notes, 0.3, 25);
            }
        }
    }

    updateHud(car) {
        const text = this.hudText(car);
        this.hud.classList.toggle('hidden', !text);
        this.hud.classList.toggle('big', Boolean(text) && /^(\d|¡YA)/.test(text));
        if (text && this.hud.textContent !== text) this.hud.textContent = text;
    }

    hudText(car) {
        const { phase, startAt, laps, entrants, finishes } = this.race;
        const now = this.now;
        if (this.inRace && phase === 'lobby') {
            const seconds = Math.max(0, Math.ceil((this.race.lobbyEndsAt - now) / 1000));
            return `🏁 Salida en ${seconds} s · ${entrants.length} ${entrants.length === 1 ? 'coche' : 'coches'} · G: bajarte`;
        }
        if (this.inRace && phase === 'running') {
            const left = startAt - now;
            if (left > COUNTDOWN_MS) return 'Preparados…';
            if (left > 0) return `${Math.ceil(left / 1000)}`;
            if (-left < GO_SHOWN_MS) return '¡YA!';
            const finish = finishes.find(entry => entry.id === this.localId);
            if (finish) return `🏁 Llegas ${finishes.indexOf(finish) + 1}º · ${formatLap(finish.ms)}`;
            if (this.entry?.finished) return '🏁 ¡Meta!';
            const lap = Math.min((this.entry?.lapsDone ?? 0) + 1, laps);
            return `Vuelta ${lap}/${laps} · ${formatLap(-left)}`;
        }
        if (!car) return null;
        if (phase === 'lobby' && this.nearLine()) {
            const seconds = Math.max(0, Math.ceil((this.race.lobbyEndsAt - now) / 1000));
            return `🏁 Carrera en ${seconds} s · G: apuntarte`;
        }
        const track = this.track;
        if (track && track.lapStart !== null && track.lastAngle !== null) {
            const best = this.best ? ` · mejor ${formatLap(this.best)}` : '';
            return `⏱️ ${formatLap(performance.now() - track.lapStart)}${best}`;
        }
        if (phase === 'idle' && this.nearLine()) return '🏁 G: abrir una carrera';
        return null;
    }
}
