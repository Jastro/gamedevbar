import * as THREE from 'three';
import LAYOUT from '../../server/shared/foosball.json';

// The futbolín on the left side of each bar (room-local). Just the table
// and what it shows; FoosballSync drives it from the server's game
// (server/features/foosball.js). Table space: x along the table (red defends
// -x), z across (red players stand at +z, blue at -z), y up from the floor.
export { LAYOUT };
const POSITION = { x: -11, z: -1.5 };
export const FIELD_Y = 1.05;
const ROD_Y = FIELD_Y + 0.2;
const WALL_HEIGHT = 0.22;
const ROD_OVERHANG = 0.45;   // rod length past each side of the field
// Players' feet from the table's center line: clear of the blocker (handles
// included), or they'd be stuck in it when they walk off.
export const STAND_DISTANCE = 1.5;
const TEAM_COLORS = [0xd32f2f, 0x1e63d6];
export const TEAM_NAMES = ['🔴 Rojo', '🔵 Azul'];

// How far a rod slides from the center (keep in sync with the server).
export function maxOffset(rod) {
    if (rod.role === 'goalie') return LAYOUT.goalWidth / 2 + 0.08;
    return LAYOUT.field.width / 2 - LAYOUT.manRadius - ((rod.men - 1) / 2) * rod.spacing;
}

// Rods a slot moves (keep in sync with rodsFor in server/features/foosball.js).
export function rodsFor(slots, slot) {
    const team = slot < 2 ? 0 : 1;
    const partner = team * 2 + (slot % 2 === 0 ? 1 : 0);
    const roles = slots[partner]
        ? (slot % 2 === 0 ? ['goalie', 'defense'] : ['midfield', 'attack'])
        : ['goalie', 'defense', 'midfield', 'attack'];
    return LAYOUT.rods
        .map((rod, index) => ({ rod, index }))
        .filter(({ rod }) => rod.team === team && roles.includes(rod.role))
        .map(({ index }) => index);
}

export class Foosball {
    constructor(room, collisionManager) {
        this.room = room;
        this.collisionManager = collisionManager;
        this.rodGroups = [];
        this.swing = LAYOUT.rods.map(() => 0);
        this.scoreText = '';
    }

    get id() {
        return this.room.id;
    }

    create() {
        const { length, width } = LAYOUT.field;
        const group = new THREE.Group();
        group.position.set(POSITION.x, 0, POSITION.z);
        const wood = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.7 });
        const black = new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.6 });
        const metal = new THREE.MeshStandardMaterial({ color: 0xd0d4d8, metalness: 0.9, roughness: 0.25 });
        const highlight = new THREE.MeshStandardMaterial({ color: 0x7fff7f, emissive: 0x2f2f2f });
        const parts = [];
        const box = (w, h, d, material, x, y, z) => {
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
            mesh.position.set(x, y, z);
            group.add(mesh);
            parts.push(mesh);
            return mesh;
        };

        // Legs and body under the field.
        [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([sx, sz]) => {
            box(0.12, FIELD_Y - 0.15, 0.12, black, sx * (length / 2 - 0.05), (FIELD_Y - 0.15) / 2, sz * (width / 2 - 0.05));
        });
        box(length + 0.2, 0.3, width + 0.2, wood, 0, FIELD_Y - 0.15, 0);

        // The pitch: green with white lines.
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 278;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#2e7d32';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 4;
        ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);
        ctx.beginPath();
        ctx.moveTo(canvas.width / 2, 6);
        ctx.lineTo(canvas.width / 2, canvas.height - 6);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(canvas.width / 2, canvas.height / 2, 40, 0, Math.PI * 2);
        ctx.stroke();
        const boxDepth = (LAYOUT.goalWidth / width) * canvas.height * 1.6;
        ctx.strokeRect(6, (canvas.height - boxDepth) / 2, 50, boxDepth);
        ctx.strokeRect(canvas.width - 56, (canvas.height - boxDepth) / 2, 50, boxDepth);
        const pitchTexture = new THREE.CanvasTexture(canvas);
        pitchTexture.colorSpace = THREE.SRGBColorSpace;
        const pitch = new THREE.Mesh(new THREE.PlaneGeometry(length, width), new THREE.MeshStandardMaterial({ map: pitchTexture, roughness: 0.9 }));
        pitch.rotation.x = -Math.PI / 2;
        pitch.position.y = FIELD_Y + 0.002;
        group.add(pitch);

        // Side walls, and end walls with the goal mouths.
        const wallY = FIELD_Y + WALL_HEIGHT / 2;
        box(length + 0.2, WALL_HEIGHT, 0.06, wood, 0, wallY, width / 2 + 0.03);
        box(length + 0.2, WALL_HEIGHT, 0.06, wood, 0, wallY, -width / 2 - 0.03);
        const post = (width - LAYOUT.goalWidth) / 2;
        [-1, 1].forEach(end => {
            const x = end * (length / 2 + 0.03);
            box(0.06, WALL_HEIGHT, post, wood, x, wallY, (LAYOUT.goalWidth + post) / 2);
            box(0.06, WALL_HEIGHT, post, wood, x, wallY, -(LAYOUT.goalWidth + post) / 2);
            // A dark box behind the mouth, so goals look like holes.
            box(0.14, WALL_HEIGHT, LAYOUT.goalWidth, black, x + end * 0.07, wallY - 0.02, 0);
        });

        // Rods with their men; each rod group slides along z and spins on its axis.
        const rodLength = width + ROD_OVERHANG * 2;
        LAYOUT.rods.forEach((layout) => {
            const rod = new THREE.Group();
            rod.position.set(layout.x, ROD_Y, 0);
            const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, rodLength, 8), metal);
            bar.rotation.x = Math.PI / 2;
            rod.add(bar);
            // Handle on the owning team's side.
            const side = layout.team === 0 ? 1 : -1;
            const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.16, 10), black);
            handle.rotation.x = Math.PI / 2;
            handle.position.z = side * (rodLength / 2 - 0.08);
            rod.add(handle);
            const shirt = new THREE.MeshStandardMaterial({ color: TEAM_COLORS[layout.team], roughness: 0.5 });
            const skin = new THREE.MeshStandardMaterial({ color: 0xf1c27d });
            for (let i = 0; i < layout.men; i++) {
                const z = (i - (layout.men - 1) / 2) * layout.spacing;
                const man = new THREE.Group();
                man.position.z = z;
                const torso = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.07), shirt);
                torso.position.y = 0.0;
                const legs = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.05), black);
                legs.position.y = -0.11;
                const foot = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.03, 0.05), black);
                foot.position.set(0, -0.175, 0);
                const head = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), skin);
                head.position.y = 0.09;
                man.add(torso, legs, foot, head);
                rod.add(man);
            }
            rod.traverse(child => { child.raycast = () => {}; });
            group.add(rod);
            this.rodGroups.push(rod);
        });

        // Ball.
        this.ball = new THREE.Mesh(new THREE.SphereGeometry(LAYOUT.ballRadius, 16, 12), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }));
        this.ball.position.set(0, FIELD_Y + LAYOUT.ballRadius, 0);
        this.ball.raycast = () => {};
        group.add(this.ball);

        // The score, printed on the outside of both long side walls (nothing
        // floats over the table).
        this.scoreCanvas = document.createElement('canvas');
        this.scoreCanvas.width = 512;
        this.scoreCanvas.height = 96;
        this.scoreTexture = new THREE.CanvasTexture(this.scoreCanvas);
        this.scoreTexture.colorSpace = THREE.SRGBColorSpace;
        const scoreMaterial = new THREE.MeshBasicMaterial({ map: this.scoreTexture });
        [1, -1].forEach(side => {
            const board = new THREE.Mesh(new THREE.PlaneGeometry(0.9, WALL_HEIGHT * 0.8), scoreMaterial);
            board.position.set(0, FIELD_Y + WALL_HEIGHT / 2, side * (width / 2 + 0.061));
            board.rotation.y = side > 0 ? 0 : Math.PI;
            board.raycast = () => {};
            group.add(board);
        });
        this.setScoreText('🔴 0 - 0 🔵');

        parts.forEach(mesh => {
            mesh.userData.originalMaterial = mesh.material;
            mesh.userData.highlightMaterial = highlight;
        });
        group.userData = { type: 'foosball', table: this };
        this.group = group;
        this.room.add(group);
        group.updateMatrixWorld(true);
        // Blocks walking (handles included), and you can't jump onto it.
        const blocker = new THREE.Mesh(
            new THREE.BoxGeometry(length + 0.3, FIELD_Y + WALL_HEIGHT, width + ROD_OVERHANG * 2 - 0.1),
            new THREE.MeshBasicMaterial({ visible: false })
        );
        blocker.position.y = (FIELD_Y + WALL_HEIGHT) / 2;
        blocker.raycast = () => {};
        group.add(blocker);
        blocker.updateMatrixWorld(true);
        this.collisionManager.addCollider(blocker);
    }

    // --- Places -----------------------------------------------------------

    // Which team's side a world position is on (red at +z).
    sideOf(worldPosition) {
        return this.group.worldToLocal(worldPosition.clone()).z >= 0 ? 0 : 1;
    }

    distanceTo(worldPosition) {
        const local = this.group.worldToLocal(worldPosition.clone());
        const dx = Math.max(0, Math.abs(local.x) - LAYOUT.field.length / 2);
        const dz = Math.max(0, Math.abs(local.z) - LAYOUT.field.width / 2);
        return Math.hypot(dx, dz);
    }

    // Where a player of `team` stands (left/right along the table by slot).
    getStandSpot(team, along) {
        const side = team === 0 ? 1 : -1;
        const position = this.group.localToWorld(new THREE.Vector3(along, 1, side * STAND_DISTANCE));
        const facing = this.group.localToWorld(new THREE.Vector3(along, 1, 0));
        return { position, rotation: Math.atan2(facing.x - position.x, facing.z - position.z) };
    }

    // The locked camera for a team: high on its side, looking down at the pitch.
    getView(team) {
        const side = team === 0 ? 1 : -1;
        return {
            position: this.group.localToWorld(new THREE.Vector3(0, FIELD_Y + 1.5, side * 1.4)),
            lookAt: this.group.localToWorld(new THREE.Vector3(0, FIELD_Y, side * -0.1))
        };
    }

    // --- Drawing ----------------------------------------------------------

    setRod(index, offset) {
        this.rodGroups[index].position.z = offset;
    }

    getRod(index) {
        return this.rodGroups[index].position.z;
    }

    // A kick: the men swing forward (toward the other goal) and come back.
    kick(index) {
        this.swing[index] = 1;
    }

    setBall(x, z) {
        this.ball.position.set(x, FIELD_Y + LAYOUT.ballRadius, z);
    }

    update(deltaTime) {
        this.swing.forEach((value, index) => {
            const next = Math.max(0, value - deltaTime * 5);
            this.swing[index] = next;
            const forward = LAYOUT.rods[index].team === 0 ? 1 : -1;
            // The feet (below the rod) swing up to ~70° toward the other goal and back.
            this.rodGroups[index].rotation.z = forward * Math.sin(next * Math.PI) * 1.2;
        });
    }

    setScoreText(text) {
        if (text === this.scoreText) return;
        this.scoreText = text;
        const ctx = this.scoreCanvas.getContext('2d');
        const { width, height } = this.scoreCanvas;
        ctx.fillStyle = '#1b1b1b';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 56px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, width / 2, height / 2 + 4, width - 16);
        this.scoreTexture.needsUpdate = true;
    }
}
