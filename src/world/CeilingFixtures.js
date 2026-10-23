import * as THREE from 'three';
import { ceilingHeightAt } from './Roof';

// What hangs from each bar's ceiling (room-local):
// - two pendant lamps over the tables, on with the bar's normal light: the
//   bulbs glow and they light the bar below (RoomLighting hands them to
//   RegionLights, which lights only that bar's pixels with them);
// - a disco ball in the middle that, with disco on, spins, flashes in the
//   disco colors and throws colored specks round the walls, floor and
//   ceiling (dots placed where its "reflections" would land).
const LAMPS = [{ x: -6, z: 2 }, { x: 6, z: 2 }];
const SHADE_Y = 4.6;
export const LAMP_LIGHT = { color: new THREE.Color(0xffd9a0), intensity: 9, range: 10 };
const BALL = { x: 0, y: 6.2, z: 0, radius: 0.55 };
const SPIN = 0.7;             // rad/s
const SPECKS = 110;
// Where the specks land: the walls' inner faces and the floor (room-local),
// and the sloped ceiling above them (ceilingHeightAt).
const INSIDE = { halfX: 14.88, halfZ: 9.88 };

export class CeilingFixtures {
    constructor(room) {
        this.room = room;
        this.spin = 0;
        this.disco = 0;
        this.time = 0;
    }

    create() {
        this.group = new THREE.Group();
        this.group.name = 'CeilingFixtures';
        this.createLamps();
        this.createBall();
        this.createSpecks();
        this.room.add(this.group);
    }

    // A cord from the ceiling down to `bottom` (room-local y).
    cord(x, z, bottom, material) {
        const top = ceilingHeightAt(z);
        const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, top - bottom, 6), material);
        cord.position.set(x, (top + bottom) / 2, z);
        this.group.add(cord);
    }

    createLamps() {
        const metal = new THREE.MeshStandardMaterial({ color: 0x1f4d3a, metalness: 0.6, roughness: 0.4, side: THREE.DoubleSide });
        const brass = new THREE.MeshStandardMaterial({ color: 0xb08d57, metalness: 0.8, roughness: 0.3 });
        const black = new THREE.MeshStandardMaterial({ color: 0x111111 });
        this.bulbMaterial = new THREE.MeshStandardMaterial({ color: 0xfff1d0, emissive: 0xffd9a0, emissiveIntensity: 0 });
        this.lampPoints = LAMPS.map(({ x, z }) => {
            this.cord(x, z, SHADE_Y + 0.42, black);
            const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.14, 12), brass);
            cap.position.set(x, SHADE_Y + 0.36, z);
            const shade = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.42, 24, 1, true), metal);
            shade.position.set(x, SHADE_Y + 0.08, z);
            const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 10), this.bulbMaterial);
            bulb.position.set(x, SHADE_Y - 0.05, z);
            this.group.add(cap, shade, bulb);
            // The light comes from just under the bulb.
            return new THREE.Vector3(x, SHADE_Y - 0.2, z);
        });
    }

    createBall() {
        const ball = new THREE.Group();
        ball.position.set(BALL.x, BALL.y, BALL.z);
        const texture = getMirrorTexture();
        this.ballMaterial = new THREE.MeshStandardMaterial({
            map: texture, metalness: 0.9, roughness: 0.25,
            emissive: 0xffffff, emissiveMap: texture, emissiveIntensity: 0.08
        });
        const sphere = new THREE.Mesh(new THREE.SphereGeometry(BALL.radius, 28, 18), this.ballMaterial);
        ball.add(sphere);
        const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.16, 10), new THREE.MeshStandardMaterial({ color: 0x222222 }));
        motor.position.y = BALL.radius + 0.06;
        ball.add(motor);
        this.cord(BALL.x, BALL.z, BALL.y + BALL.radius + 0.14, new THREE.MeshStandardMaterial({ color: 0x111111 }));
        this.ball = ball;
        this.group.add(ball);
    }

    createSpecks() {
        // Fixed directions out of the ball (they turn with it), each its own hue.
        this.speckDirections = Array.from({ length: SPECKS }, () => {
            const y = Math.random() * 1.6 - 0.9; // more down than up
            const angle = Math.random() * Math.PI * 2;
            const r = Math.sqrt(Math.max(0, 1 - y * y));
            return new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r);
        });
        const positions = new Float32Array(SPECKS * 3);
        const colors = new Float32Array(SPECKS * 3);
        const color = new THREE.Color();
        this.speckDirections.forEach((_, i) => {
            color.setHSL(i / SPECKS, 1, 0.6);
            color.toArray(colors, i * 3);
        });
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        this.speckMaterial = new THREE.PointsMaterial({
            size: 0.35, map: getDotTexture(), vertexColors: true, transparent: true, opacity: 0,
            blending: THREE.AdditiveBlending, depthWrite: false
        });
        this.specks = new THREE.Points(geometry, this.speckMaterial);
        this.specks.frustumCulled = false;
        this.specks.visible = false;
        this.specks.raycast = () => {};
        this.group.add(this.specks);
    }

    // The lit lamps' world positions (none with the normal light off).
    get litLamps() {
        if (!this.lampsOn) return [];
        return this.lampPoints.map(point => this.room.root.localToWorld(point.clone()));
    }

    // lights: the bar's switches ({ normal, low, disco }).
    update(deltaTime, lights) {
        const dt = Math.min(deltaTime, 0.1);
        this.time += dt;
        this.lampsOn = Boolean(lights.normal);
        this.bulbMaterial.emissiveIntensity = this.lampsOn ? 1.6 : 0;

        this.disco += ((lights.disco ? 1 : 0) - this.disco) * Math.min(1, dt * 4);
        const on = this.disco > 0.01;
        if (on) {
            this.spin += SPIN * dt * this.disco;
            this.ball.rotation.y = this.spin;
        }
        // Tiles flash in the cycling disco color.
        this.ballMaterial.emissive.setHSL((this.time * 0.15) % 1, 1, 0.6);
        this.ballMaterial.emissiveIntensity = 0.08 + this.disco * (0.5 + 0.3 * Math.sin(this.time * 9));
        this.specks.visible = on;
        if (on) this.placeSpecks();
        this.speckMaterial.opacity = this.disco * 0.9;
    }

    // Each speck where its direction, turned with the ball, meets the room.
    placeSpecks() {
        const positions = this.specks.geometry.attributes.position;
        const cos = Math.cos(this.spin);
        const sin = Math.sin(this.spin);
        this.speckDirections.forEach((d, i) => {
            const dx = d.x * cos + d.z * sin;
            const dz = -d.x * sin + d.z * cos;
            const dy = d.y;
            let t = Infinity;
            if (Math.abs(dx) > 1e-4) t = Math.min(t, (Math.sign(dx) * INSIDE.halfX - BALL.x) / dx);
            if (Math.abs(dz) > 1e-4) t = Math.min(t, (Math.sign(dz) * INSIDE.halfZ - BALL.z) / dz);
            if (dy < -1e-4) t = Math.min(t, (0.02 - BALL.y) / dy);
            if (dy > 1e-4) {
                // The ceiling slopes down both ways from the ridge (z 0).
                const ridge = ceilingHeightAt(0);
                const slope = (ridge - ceilingHeightAt(INSIDE.halfZ)) / INSIDE.halfZ;
                t = Math.min(t, (ridge - 0.05 - BALL.y) / (dy + slope * Math.abs(dz)));
            }
            const back = 0.04; // just in front of the surface
            positions.setXYZ(i, BALL.x + dx * (t - back), BALL.y + dy * (t - back), BALL.z + dz * (t - back));
        });
        positions.needsUpdate = true;
    }
}

// Little mirror tiles in slightly different grays.
let mirrorTexture = null;
function getMirrorTexture() {
    if (mirrorTexture) return mirrorTexture;
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const size = 8;
    for (let y = 0; y < canvas.height; y += size) {
        for (let x = 0; x < canvas.width; x += size) {
            const shade = 150 + Math.floor(Math.random() * 105);
            ctx.fillStyle = `rgb(${shade}, ${shade}, ${Math.min(255, shade + 10)})`;
            ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
        }
    }
    mirrorTexture = new THREE.CanvasTexture(canvas);
    mirrorTexture.colorSpace = THREE.SRGBColorSpace;
    return mirrorTexture;
}

// A soft round dot (the specks).
let dotTexture = null;
function getDotTexture() {
    if (dotTexture) return dotTexture;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.4, 'rgba(255,255,255,0.7)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    dotTexture = new THREE.CanvasTexture(canvas);
    return dotTexture;
}
