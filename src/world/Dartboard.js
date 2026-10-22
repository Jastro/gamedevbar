import * as THREE from 'three';
import { playSynth } from '../audio/synth';

// The dartboard on each bar's right wall, past the projector screen, with
// its throw line (oche) and a chalkboard of recent turns. Room-local.
// Board coordinates (what the server scores): 1 = outer edge of the double
// ring, x to the thrower's right, y up. DartsSync drives it.
const BOARD_CENTER = { x: 14.8, y: 2.1, z: 8 };
const SCORING_RADIUS = 0.42;                      // world units for board radius 1
const BOARD_RADIUS = SCORING_RADIUS * 225 / 170;  // with the number ring
const FACE_Z = 0.04;                              // board face, in front of the backing
const THROW_DISTANCE = 4.4;                       // board to the thrower's feet
const OCHE_X = BOARD_CENTER.x - THROW_DISTANCE;
const STAND = { x: OCHE_X - 0.3, z: BOARD_CENTER.z - 0.35 };
// Aiming view: well in front of the thrower, or the board is a dot. The
// darts come in from behind the camera.
const VIEW = { x: BOARD_CENTER.x - 2.4, y: BOARD_CENTER.y + 0.15, z: BOARD_CENTER.z - 0.3 };
const CHALKBOARD = { z: 6.2, y: 2.2, width: 1.4, height: 1.6 };
const FLIGHT_TIME = 0.35; // s
const DART_COLORS = [0xe53935, 0x43a047, 0x1e88e5];

// Clockwise from the top (same as server/features/darts.js).
const SECTORS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

function boardTexture() {
    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const c = size / 2;
    const mm = (size / 2 - 4) / 225; // px per real-board mm
    const ring = (outer, inner, start, end, color) => {
        ctx.beginPath();
        ctx.arc(c, c, outer * mm, start, end);
        ctx.arc(c, c, inner * mm, end, start, true);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
    };
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(c, c, 225 * mm, 0, Math.PI * 2);
    ctx.fill();
    const step = Math.PI * 2 / 20;
    SECTORS.forEach((number, i) => {
        // Canvas angles run clockwise from +x; the top is -90°.
        const start = -Math.PI / 2 + (i - 0.5) * step;
        const end = start + step;
        const dark = i % 2 === 0;
        const single = dark ? '#1b1b1b' : '#efe2c0';
        const scoring = dark ? '#c62828' : '#2e7d32';
        ring(170, 162, start, end, scoring);
        ring(162, 107, start, end, single);
        ring(107, 99, start, end, scoring);
        ring(99, 15.9, start, end, single);
        const mid = start + step / 2;
        ctx.save();
        ctx.translate(c + Math.cos(mid) * 197 * mm, c + Math.sin(mid) * 197 * mm);
        ctx.fillStyle = '#f5f5f5';
        ctx.font = `bold ${Math.round(30 * mm)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(number), 0, 0);
        ctx.restore();
    });
    ring(15.9, 6.35, 0, Math.PI * 2, '#2e7d32');
    ring(6.35, 0, 0, Math.PI * 2, '#c62828');
    // Wires.
    ctx.strokeStyle = 'rgba(200, 200, 200, 0.6)';
    ctx.lineWidth = 2;
    [170, 162, 107, 99, 15.9].forEach(r => {
        ctx.beginPath();
        ctx.arc(c, c, r * mm, 0, Math.PI * 2);
        ctx.stroke();
    });
    for (let i = 0; i < 20; i++) {
        const angle = -Math.PI / 2 + (i - 0.5) * step;
        ctx.beginPath();
        ctx.moveTo(c + Math.cos(angle) * 15.9 * mm, c + Math.sin(angle) * 15.9 * mm);
        ctx.lineTo(c + Math.cos(angle) * 170 * mm, c + Math.sin(angle) * 170 * mm);
        ctx.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
}

function createDart(color) {
    const dart = new THREE.Group();
    // Points along -z (into the board); the flights trail toward +z.
    const metal = new THREE.MeshStandardMaterial({ color: 0xcfd8dc, metalness: 0.8, roughness: 0.3 });
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.05, 8), metal);
    tip.rotation.x = -Math.PI / 2;
    tip.position.z = -0.025;
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.011, 0.09, 10), metal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = 0.045;
    const flightMaterial = new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.08, 6), flightMaterial);
    shaft.rotation.x = Math.PI / 2;
    shaft.position.z = 0.13;
    dart.add(tip, barrel, shaft);
    // Two crossed fins along the dart's axis.
    [0, Math.PI / 2].forEach(angle => {
        const geometry = new THREE.PlaneGeometry(0.06, 0.07);
        geometry.rotateX(Math.PI / 2);
        const flight = new THREE.Mesh(geometry, flightMaterial);
        flight.rotation.z = angle;
        flight.position.z = 0.16;
        dart.add(flight);
    });
    dart.traverse(child => { child.raycast = () => {}; });
    // Bigger than life, like the board, so they read from across the bar.
    dart.scale.setScalar(1.8);
    return dart;
}

export class Dartboard {
    constructor(room) {
        this.room = room;
        this.stuck = []; // index -> dart mesh on the board
        this.flights = []; // { dart, index, from, to, t, onLand }
    }

    get id() {
        return this.room.id;
    }

    create() {
        const highlight = new THREE.MeshStandardMaterial({ color: 0x7fff7f, emissive: 0x2f2f2f });
        const markHighlight = (group) => group.traverse(child => {
            if (!child.isMesh) return;
            child.userData.originalMaterial = child.material;
            child.userData.highlightMaterial = highlight;
        });

        // Board, facing the room (-x).
        const board = new THREE.Group();
        board.position.set(BOARD_CENTER.x, BOARD_CENTER.y, BOARD_CENTER.z);
        board.rotation.y = -Math.PI / 2;
        const backing = new THREE.Mesh(
            new THREE.BoxGeometry(BOARD_RADIUS * 2.6, BOARD_RADIUS * 2.6, 0.04),
            new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.8 })
        );
        // The rim is a short cylinder (its axis turned toward the thrower);
        // the face is a circle so the texture maps straight on.
        const rim = new THREE.Mesh(
            new THREE.CylinderGeometry(BOARD_RADIUS, BOARD_RADIUS, 0.05, 48),
            new THREE.MeshStandardMaterial({ color: 0x111111 })
        );
        rim.rotation.x = Math.PI / 2;
        rim.position.z = FACE_Z - 0.026;
        const faceTexture = boardTexture();
        const face = new THREE.Mesh(
            new THREE.CircleGeometry(BOARD_RADIUS, 64),
            new THREE.MeshStandardMaterial({ map: faceTexture, roughness: 0.9 })
        );
        face.position.z = FACE_Z;
        board.add(backing, rim, face);
        markHighlight(board);
        face.userData.highlightMaterial = new THREE.MeshStandardMaterial({ map: faceTexture, emissive: 0x333333 });
        board.userData = { type: 'dartboard', dartboard: this };
        this.board = board;
        this.room.add(board);

        // Throw line on the floor.
        const oche = new THREE.Group();
        oche.position.set(OCHE_X, 0, BOARD_CENTER.z);
        const line = new THREE.Mesh(
            new THREE.BoxGeometry(0.08, 0.02, 1.4),
            new THREE.MeshStandardMaterial({ color: 0xfdd835, emissive: 0x3a3000 })
        );
        line.position.y = 0.01;
        oche.add(line);
        markHighlight(oche);
        oche.userData = { type: 'dartboard', dartboard: this };
        this.oche = oche;
        this.room.add(oche);

        // Crosshair (only the thrower sees it).
        const crosshair = new THREE.Group();
        const crosshairMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true, opacity: 0.9 });
        const ringMesh = new THREE.Mesh(new THREE.RingGeometry(0.022, 0.03, 24), crosshairMaterial);
        const dot = new THREE.Mesh(new THREE.CircleGeometry(0.006, 12), crosshairMaterial);
        crosshair.add(ringMesh, dot);
        crosshair.traverse(child => {
            child.renderOrder = 999;
            child.raycast = () => {};
        });
        crosshair.position.z = FACE_Z + 0.01;
        crosshair.visible = false;
        this.crosshair = crosshair;
        board.add(crosshair);

        this.createChalkboard();
    }

    createChalkboard() {
        const canvas = document.createElement('canvas');
        canvas.width = 448;
        canvas.height = 512;
        this.chalkCanvas = canvas;
        this.chalkTexture = new THREE.CanvasTexture(canvas);
        this.chalkTexture.colorSpace = THREE.SRGBColorSpace;
        const group = new THREE.Group();
        group.position.set(BOARD_CENTER.x + 0.05, CHALKBOARD.y, CHALKBOARD.z);
        group.rotation.y = -Math.PI / 2;
        const frame = new THREE.Mesh(
            new THREE.BoxGeometry(CHALKBOARD.width + 0.1, CHALKBOARD.height + 0.1, 0.04),
            new THREE.MeshStandardMaterial({ color: 0x5d4037 })
        );
        const surface = new THREE.Mesh(
            new THREE.PlaneGeometry(CHALKBOARD.width, CHALKBOARD.height),
            new THREE.MeshStandardMaterial({ map: this.chalkTexture, roughness: 1 })
        );
        surface.position.z = 0.021;
        group.add(frame, surface);
        this.room.add(group);
        this.drawChalkboard(null);
    }

    drawChalkboard(state) {
        const ctx = this.chalkCanvas.getContext('2d');
        const { width, height } = this.chalkCanvas;
        ctx.fillStyle = '#263238';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#eceff1';
        ctx.textAlign = 'center';
        ctx.font = 'bold 40px "Segoe UI", sans-serif';
        ctx.fillText('🎯 Dardos', width / 2, 52);
        ctx.font = '24px "Segoe UI", sans-serif';
        ctx.fillStyle = '#ffe082';
        const best = state?.best;
        ctx.fillText(best ? `Mejor de hoy: ${best.name} · ${best.total}` : 'Mejor de hoy: —', width / 2, 92);

        ctx.textAlign = 'left';
        let y = 140;
        if (state?.thrower) {
            ctx.fillStyle = '#a5d6a7';
            ctx.font = 'bold 26px "Segoe UI", sans-serif';
            const labels = (state.darts ?? []).map(d => d.label).join('  ');
            ctx.fillText(`Tira: ${state.thrower.name}`, 24, y);
            y += 34;
            ctx.font = '24px "Segoe UI", sans-serif';
            ctx.fillText(labels || '…', 24, y);
            y += 44;
        } else {
            ctx.fillStyle = '#b0bec5';
            ctx.font = 'italic 22px "Segoe UI", sans-serif';
            ctx.fillText('Ponte en la línea amarilla (F)', 24, y);
            y += 48;
        }
        ctx.fillStyle = '#eceff1';
        ctx.font = 'bold 24px "Segoe UI", sans-serif';
        ctx.fillText('Últimas tiradas', 24, y);
        y += 34;
        ctx.font = '22px "Segoe UI", sans-serif';
        (state?.history ?? []).forEach(turn => {
            const name = turn.name.length > 14 ? `${turn.name.slice(0, 13)}…` : turn.name;
            ctx.fillText(`${name}: ${turn.total}`, 24, y);
            ctx.fillStyle = '#90a4ae';
            ctx.textAlign = 'right';
            ctx.fillText(turn.labels.join(' '), width - 20, y);
            ctx.textAlign = 'left';
            ctx.fillStyle = '#eceff1';
            y += 32;
        });
        this.chalkTexture.needsUpdate = true;
    }

    // --- Board space ---------------------------------------------------------

    // World point on the board's plane → board units.
    toBoardUnits(worldPoint) {
        const local = this.board.worldToLocal(worldPoint.clone());
        return { x: local.x / SCORING_RADIUS, y: local.y / SCORING_RADIUS };
    }

    // The board face as a world plane (for aiming).
    getPlane() {
        const normal = new THREE.Vector3(0, 0, 1).transformDirection(this.board.matrixWorld);
        const point = this.board.localToWorld(new THREE.Vector3(0, 0, FACE_Z));
        return new THREE.Plane().setFromNormalAndCoplanarPoint(normal, point);
    }

    // Where the thrower stands and faces, in world space.
    getStandSpot() {
        const position = this.room.toWorld(STAND.x, 1, STAND.z);
        const target = this.room.toWorld(BOARD_CENTER.x, 1, STAND.z);
        return { position, rotation: Math.atan2(target.x - position.x, target.z - position.z) };
    }

    getView() {
        return {
            position: this.room.toWorld(VIEW.x, VIEW.y, VIEW.z),
            lookAt: this.room.toWorld(BOARD_CENTER.x, BOARD_CENTER.y, BOARD_CENTER.z - 0.3)
        };
    }

    // Distance from a world position to the throw line (for the F range check).
    distanceToOche(worldPosition) {
        return this.oche.getWorldPosition(new THREE.Vector3()).setY(worldPosition.y).distanceTo(worldPosition);
    }

    setCrosshair(point) {
        this.crosshair.visible = Boolean(point);
        if (point) this.crosshair.position.set(point.x * SCORING_RADIUS, point.y * SCORING_RADIUS, FACE_Z + 0.01);
    }

    // --- Darts ---------------------------------------------------------------

    placeDart(index, x, y) {
        this.stuck[index]?.removeFromParent();
        const dart = createDart(DART_COLORS[index % DART_COLORS.length]);
        dart.position.set(x * SCORING_RADIUS, y * SCORING_RADIUS, FACE_Z + 0.02);
        // Slightly crooked, as real darts land; stable per position.
        dart.rotation.set(Math.sin(x * 37) * 0.15, Math.cos(y * 29) * 0.15, 0);
        this.board.add(dart);
        this.stuck[index] = dart;
    }

    // Matches the stuck darts to the server's list (no animation; join or
    // a new turn). Darts still in flight land by themselves.
    syncDarts(darts) {
        const list = Array.isArray(darts) ? darts : [];
        for (let i = list.length; i < this.stuck.length; i++) this.stuck[i]?.removeFromParent();
        this.stuck.length = Math.min(this.stuck.length, list.length);
        if (list.length === 0) {
            this.flights.forEach(flight => flight.dart.removeFromParent());
            this.flights = [];
        }
        list.forEach((dart, index) => {
            const flying = this.flights.some(flight => flight.index === index);
            if (!this.stuck[index] && !flying) this.placeDart(index, dart.x, dart.y);
        });
    }

    // A dart from `fromWorld` (the thrower's hand) to (x, y).
    throwDart(index, x, y, fromWorld, listener) {
        const from = this.board.worldToLocal(fromWorld.clone());
        const to = new THREE.Vector3(x * SCORING_RADIUS, y * SCORING_RADIUS, FACE_Z + 0.02);
        const dart = createDart(DART_COLORS[index % DART_COLORS.length]);
        dart.position.copy(from);
        this.board.add(dart);
        this.flights.push({ dart, index, x, y, from, to, t: 0, listener });
        if (listener) playSynth(listener, this.board, from, 'whoosh', 2);
    }

    update(deltaTime) {
        if (this.flights.length === 0) return;
        const landed = [];
        const previous = new THREE.Vector3();
        this.flights.forEach(flight => {
            flight.t = Math.min(1, flight.t + deltaTime / FLIGHT_TIME);
            previous.copy(flight.dart.position);
            const t = flight.t;
            flight.dart.position.lerpVectors(flight.from, flight.to, t);
            flight.dart.position.y += Math.sin(Math.PI * t) * 0.25; // arc
            // Point along the path: lookAt aims +z, the flights' end, so
            // aim it back where the dart came from and the tip leads.
            if (t < 1 && previous.distanceToSquared(flight.dart.position) > 1e-8) {
                flight.dart.lookAt(this.board.localToWorld(previous.clone()));
            }
            if (t >= 1) landed.push(flight);
        });
        landed.forEach(flight => {
            this.flights.splice(this.flights.indexOf(flight), 1);
            flight.dart.removeFromParent();
            this.placeDart(flight.index, flight.x, flight.y);
            if (flight.listener) playSynth(flight.listener, this.board, flight.to, 'dart', 3);
        });
    }
}
