import * as THREE from 'three';
import {
    PLAZA_CENTER, PLAZA_RADIUS, RING_ROAD, WORLD_RADIUS, SLOT_COUNT, RADIAL_ROAD_WIDTH,
    slotAngle, bearing
} from './RoomLayout';

// Everything outside the bars (world coordinates, see RoomLayout's hub): the
// round paved plaza in the middle, a small road between each pair of bar
// slot out to the ring road, grass in between, a fountain in the middle and
// a low wall around the map. Only the fountain and that wall block
// (CollisionManager.setBoundary).
const WALL_HEIGHT = 1.2;
const DASH = { length: 2, width: 0.2, gap: 2 };
// Tall and slim: a basin, a column with two bowls, water falling from each.
const FOUNTAIN = { basinRadius: 2.4, basinHeight: 0.7, waterY: 0.55, columnTop: 3.6 };
const BOWLS = [{ y: 1.9, radius: 1.3 }, { y: 3.0, radius: 0.75 }]; // rim height, rim radius
const DROPS = 360;
// Quiet and close: you hear it at the basin, barely across the plaza.
const WATER_VOLUME = 0.15; // about 20 dB under the old hiss
const WATER_LOOP_SECONDS = 4;
const RING_LAMPS = 18;

// Where the small roads leave the plaza: between slot k and slot k + 1.
export function roadAngle(index) {
    return slotAngle(index) + Math.PI / SLOT_COUNT;
}

// A world point at `distance` from the plaza's center along bearing `angle`,
// shifted `side` units sideways (positive: to the right looking outward).
export function hubPoint(angle, distance, side = 0) {
    const out = bearing(angle);
    // Right of "outward" when seen from above: (-out.z, out.x).
    return new THREE.Vector3(
        PLAZA_CENTER.x + out.x * distance - out.z * side,
        0,
        PLAZA_CENTER.z + out.z * distance + out.x * side
    );
}

export class Outdoors {
    constructor(scene, collisionManager) {
        this.scene = scene;
        this.collisionManager = collisionManager;
        this.group = new THREE.Group();
        this.group.name = 'Outdoors';
    }

    create() {
        this.createGround();
        this.createPlaza();
        this.createRoads();
        this.createWall();
        this.createFountain();
        this.scene.add(this.group);
        this.group.updateMatrixWorld(true);
        // Inside the wall's thickness, so nobody pokes through it.
        this.collisionManager.setBoundary(PLAZA_CENTER.x, PLAZA_CENTER.z, WORLD_RADIUS - 0.6);
        // The basin is a round platform (you can hop onto its rim); the column
        // is one too tall to get onto.
        this.collisionManager.addPlatform(this.basinBlocker, FOUNTAIN.basinRadius);
        this.collisionManager.addPlatform(this.columnBlocker, 0.5);
    }

    // A flat disc or ring on the ground, just above the grass.
    flat(geometry, color, y, roughness = 0.9) {
        geometry.rotateX(-Math.PI / 2);
        const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness }));
        mesh.position.set(PLAZA_CENTER.x, y, PLAZA_CENTER.z);
        mesh.receiveShadow = true;
        this.group.add(mesh);
        return mesh;
    }

    createGround() {
        // Grass far past the wall, so the edge of the world never shows.
        this.flat(new THREE.CircleGeometry(WORLD_RADIUS + 120, 64), 0x3d5634, -0.03, 1);
    }

    createPlaza() {
        this.flat(new THREE.CircleGeometry(PLAZA_RADIUS, 96), 0x9a948a, -0.015);
        // A darker curb along its edge and a ring in the middle.
        this.flat(new THREE.RingGeometry(PLAZA_RADIUS - 0.7, PLAZA_RADIUS, 96), 0x6d675f, -0.012);
        this.flat(new THREE.RingGeometry(4, 4.8, 48), 0x7d776d, -0.012);
        this.flat(new THREE.CircleGeometry(1.2, 32), 0x7d776d, -0.012);
    }

    createRoads() {
        const asphalt = 0x2b2b30;
        // The ring road and its dashed middle line.
        this.flat(new THREE.RingGeometry(RING_ROAD.inner, RING_ROAD.outer, 160), asphalt, -0.02);
        const middle = (RING_ROAD.inner + RING_ROAD.outer) / 2;
        const count = Math.floor((2 * Math.PI * middle) / (DASH.length + DASH.gap));
        const dashGeometry = new THREE.PlaneGeometry(DASH.length, DASH.width).rotateX(-Math.PI / 2);
        const dashes = new THREE.InstancedMesh(dashGeometry, new THREE.MeshBasicMaterial({ color: 0xd8c25a }), count);
        const matrix = new THREE.Matrix4();
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const at = hubPoint(angle, middle);
            // Along the road: perpendicular to the bearing.
            matrix.makeRotationY(angle).setPosition(at.x, -0.005, at.z);
            dashes.setMatrixAt(i, matrix);
        }
        this.group.add(dashes);

        // A small road out from the plaza between each pair of slots.
        const start = PLAZA_RADIUS - 0.5;
        const length = RING_ROAD.inner + 0.5 - start;
        const material = new THREE.MeshStandardMaterial({ color: asphalt, roughness: 0.9 });
        for (let i = 0; i < SLOT_COUNT; i++) {
            const angle = roadAngle(i);
            const road = new THREE.Mesh(new THREE.PlaneGeometry(RADIAL_ROAD_WIDTH, length).rotateX(-Math.PI / 2), material);
            const at = hubPoint(angle, start + length / 2);
            road.position.set(at.x, -0.018, at.z);
            road.rotation.y = angle; // its length (local z) along the bearing
            road.receiveShadow = true;
            this.group.add(road);
        }
    }

    createWall() {
        const wall = new THREE.Mesh(
            new THREE.CylinderGeometry(WORLD_RADIUS, WORLD_RADIUS, WALL_HEIGHT, 160, 1, true),
            new THREE.MeshStandardMaterial({ color: 0x8a7f72, roughness: 0.9, side: THREE.DoubleSide })
        );
        wall.position.set(PLAZA_CENTER.x, WALL_HEIGHT / 2, PLAZA_CENTER.z);
        wall.raycast = () => {};
        this.group.add(wall);
        // A flat cap on top.
        this.flat(new THREE.RingGeometry(WORLD_RADIUS - 0.3, WORLD_RADIUS + 0.3, 160), 0x6f665b, WALL_HEIGHT);
    }

    createFountain() {
        const stone = new THREE.MeshStandardMaterial({ color: 0xb8b0a2, roughness: 0.8 });
        const water = new THREE.MeshStandardMaterial({ color: 0x4fa3d1, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.8 });
        const fountain = new THREE.Group();
        fountain.position.set(PLAZA_CENTER.x, 0, PLAZA_CENTER.z);
        const add = (mesh, y) => {
            mesh.position.y = y;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            fountain.add(mesh);
            return mesh;
        };
        const { basinRadius, basinHeight } = FOUNTAIN;
        // Basin: an open stone ring with a floor, and its water.
        const stoneBothSides = new THREE.MeshStandardMaterial({ color: 0xb8b0a2, roughness: 0.8, side: THREE.DoubleSide });
        add(new THREE.Mesh(new THREE.CylinderGeometry(basinRadius, basinRadius + 0.1, basinHeight, 48, 1, true), stoneBothSides), basinHeight / 2);
        add(new THREE.Mesh(new THREE.TorusGeometry(basinRadius - 0.06, 0.13, 8, 48).rotateX(Math.PI / 2), stone), basinHeight);
        add(new THREE.Mesh(new THREE.CircleGeometry(basinRadius, 48).rotateX(-Math.PI / 2), stone), 0.05);
        this.waterMeshes = [add(new THREE.Mesh(new THREE.CircleGeometry(basinRadius - 0.1, 48).rotateX(-Math.PI / 2), water), FOUNTAIN.waterY)];
        // Column with two bowls (each with water in it) and a top.
        add(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, FOUNTAIN.columnTop, 16), stone), FOUNTAIN.columnTop / 2);
        BOWLS.forEach(({ y, radius }) => {
            add(new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.35, 0.35, 32), stone), y - 0.17);
            this.waterMeshes.push(add(new THREE.Mesh(new THREE.CircleGeometry(radius - 0.08, 32).rotateX(-Math.PI / 2), water), y + 0.005));
        });
        add(new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), stone), FOUNTAIN.columnTop + 0.15);
        add(new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.35, 12), stone), FOUNTAIN.columnTop + 0.45);
        fountain.traverse(child => { child.raycast = () => {}; });
        this.group.add(fountain);
        this.fountain = fountain;

        // Falling water: drops leave each bowl's rim and fall into the one below.
        const positions = new Float32Array(DROPS * 3);
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.drops = Array.from({ length: DROPS }, (_, i) => this.newDrop(i % BOWLS.length, Math.random()));
        this.dropPoints = new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xbfe6ff, size: 0.07, transparent: true, opacity: 0.85 }));
        this.dropPoints.frustumCulled = false;
        this.dropPoints.raycast = () => {};
        fountain.add(this.dropPoints);

        // Invisible blockers for the collision manager.
        const invisible = new THREE.MeshBasicMaterial({ visible: false });
        this.basinBlocker = new THREE.Mesh(new THREE.CylinderGeometry(basinRadius + 0.1, basinRadius + 0.1, basinHeight + 0.1, 16), invisible);
        this.basinBlocker.position.set(PLAZA_CENTER.x, (basinHeight + 0.1) / 2, PLAZA_CENTER.z);
        this.columnBlocker = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, FOUNTAIN.columnTop + 0.8, 8), invisible);
        this.columnBlocker.position.set(PLAZA_CENTER.x, (FOUNTAIN.columnTop + 0.8) / 2, PLAZA_CENTER.z);
        [this.basinBlocker, this.columnBlocker].forEach(blocker => {
            blocker.raycast = () => {};
            this.group.add(blocker);
        });
    }

    // A drop leaving bowl `level`'s rim (fountain space), `progress` 0..1 of its fall.
    newDrop(level, progress = 0) {
        const bowl = BOWLS[level];
        const below = level > 0 ? BOWLS[level - 1].y : FOUNTAIN.waterY;
        const angle = Math.random() * Math.PI * 2;
        return { level, angle, outward: 0.25 + Math.random() * 0.2, time: progress * Math.sqrt((2 * (bowl.y - below)) / 9.8) };
    }

    // Per frame (World.update): the water falls and ripples, and you hear it near.
    update(deltaTime) {
        if (!this.drops) return;
        const dt = Math.min(deltaTime, 0.1);
        const positions = this.dropPoints.geometry.attributes.position.array;
        this.drops.forEach((drop, i) => {
            drop.time += dt;
            const bowl = BOWLS[drop.level];
            const below = drop.level > 0 ? BOWLS[drop.level - 1].y : FOUNTAIN.waterY;
            const y = bowl.y - 4.9 * drop.time * drop.time;
            if (y <= below) {
                this.drops[i] = this.newDrop(drop.level);
                return;
            }
            const radius = bowl.radius + drop.outward * drop.time;
            positions[i * 3] = Math.sin(drop.angle) * radius;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = Math.cos(drop.angle) * radius;
        });
        this.dropPoints.geometry.attributes.position.needsUpdate = true;
        const time = performance.now() / 1000;
        this.waterMeshes.forEach((mesh, i) => { mesh.position.y += Math.sin(time * 3 + i) * 0.0006; });
        this.updateWaterSound();
    }

    // A soothing loop from the fountain (once audio exists): a faint fizz,
    // with soft splats and plips of the drops landing in the water.
    updateWaterSound() {
        const listener = window.game?.environment.audioListener;
        if (this.waterSound || !listener) return;
        const context = listener.context;
        this.waterSound = new THREE.PositionalAudio(listener);
        this.waterSound.setBuffer(createWaterBuffer(context));
        this.waterSound.setLoop(true);
        this.waterSound.setRefDistance(2);
        this.waterSound.setRolloffFactor(2);
        this.waterSound.setVolume(WATER_VOLUME);
        // Rounds off the top, so the fizz never gets sharp.
        const filter = context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 4200;
        filter.Q.value = 0.5;
        this.waterSound.setFilter(filter);
        this.waterSound.position.y = 1.5;
        this.fountain.add(this.waterSound);
        if (context.state === 'running') this.waterSound.play();
        else context.addEventListener('statechange', () => {
            if (context.state === 'running' && !this.waterSound.isPlaying) this.waterSound.play();
        });
    }

    // Lamp posts: one beside each small road, a bit out from the plaza.
    getLampSpots() {
        const byRoads = Array.from({ length: SLOT_COUNT }, (_, i) => hubPoint(roadAngle(i), PLAZA_RADIUS + 8, RADIAL_ROAD_WIDTH / 2 + 1));
        // Along the ring road's outer edge, evenly spaced.
        const ring = Array.from({ length: RING_LAMPS }, (_, i) => hubPoint(((i + 0.5) * 2 * Math.PI) / RING_LAMPS, RING_ROAD.outer + 1.2));
        return [...byRoads, ...ring];
    }
}

// The fountain's loop (WATER_LOOP_SECONDS, seamless): a faint fizz of tiny
// crackles over a soft hiss, soft splats, and now and then a "plip".
function createWaterBuffer(context) {
    const rate = context.sampleRate;
    const length = Math.floor(rate * WATER_LOOP_SECONDS);
    const buffer = context.createBuffer(1, length, rate);
    const data = buffer.getChannelData(0);
    // Events wrap around the end, so the loop has no seam.
    const addAt = (start, samples, sample) => {
        for (let j = 0; j < samples; j++) data[(start + j) % length] += sample(j / rate);
    };
    // Hiss, breathing slowly (a whole number of swells per loop).
    for (let i = 0; i < length; i++) {
        const swell = 0.6 + 0.4 * Math.sin((2 * Math.PI * 3 * i) / length);
        data[i] = (Math.random() * 2 - 1) * 0.05 * swell;
    }
    // Fizz: many tiny, quick-fading crackles.
    for (let n = 0; n < 140 * WATER_LOOP_SECONDS; n++) {
        const amplitude = 0.05 + Math.random() * 0.12;
        addAt(Math.floor(Math.random() * length), Math.floor(rate * 0.004), (time) => (Math.random() * 2 - 1) * amplitude * Math.exp(-time / 0.0012));
    }
    // Splats: short, muffled noise bursts (smoothed noise).
    for (let n = 0; n < 3 * WATER_LOOP_SECONDS; n++) {
        const amplitude = 0.15 + Math.random() * 0.2;
        const decay = 0.02 + Math.random() * 0.03;
        let smooth = 0;
        addAt(Math.floor(Math.random() * length), Math.floor(rate * decay * 5), (time) => {
            smooth += ((Math.random() * 2 - 1) - smooth) * 0.25;
            return smooth * amplitude * Math.exp(-time / decay);
        });
    }
    // Plips: a drop's bubble, a quick sine sweeping up.
    for (let n = 0; n < 1.5 * WATER_LOOP_SECONDS; n++) {
        const amplitude = 0.08 + Math.random() * 0.1;
        const pitch = 500 + Math.random() * 700;
        let phase = 0;
        addAt(Math.floor(Math.random() * length), Math.floor(rate * 0.08), (time) => {
            phase += (2 * Math.PI * pitch * (1 + time * 12)) / rate;
            return Math.sin(phase) * amplitude * Math.exp(-time / 0.018);
        });
    }
    return buffer;
}
