import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector';
import { playSynth, playFile } from '../audio/synth';

// A bar's bathroom: a cubicle in the front-left corner with a swinging door
// (latch inside, Libre/Ocupado sign outside), toilet with flush, sink with a
// mirror, air freshener, and its own lamp and switch. Room-local
// coordinates. Shared state comes from BathroomSync (`applyState`); one-off
// effects (sounds, particles) from `playEvent`.

// Inside of the cubicle (walls run along these lines).
export const BATHROOM_BOUNDS = { minX: -15, maxX: -10, minZ: 5, maxZ: 10 };
const WALL_HEIGHT = 3.2;
const WALL_THICKNESS = 0.15;
const DOOR = { minX: -11.9, maxX: -10.7, height: 2.4 };
const DOOR_SWING_SPEED = 5; // 1/s
// Centered on the left wall, away from the sink.
const TOILET = { x: -14.3, z: 7.5 };
const TOILET_SCALE = 1.25;
const SINK = { x: -12.2, z: 9.62 };
const FRESHENER = { x: -11.05, y: 1.3, z: 9.78 };
const SWITCH = { x: -10.4, y: 1.5, z: 5 + WALL_THICKNESS / 2 + 0.02 };
const LAMP = { x: -12.5, y: 3.0, z: 7.5 };
const LAMP_INTENSITY = 6;
const FLUSH_TIME = 1.4; // s for the bowl to empty
const SPRAY_TIME = 1.2; // s of spray particles
const FART_SOUNDS = [1, 2, 3, 4].map(n => `/assets/sound/cacota${n}.mp3`);

const white = new THREE.MeshStandardMaterial({ color: 0xf4f4f0, roughness: 0.35 });
const porcelain = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.15, metalness: 0.05 });
const chrome = new THREE.MeshStandardMaterial({ color: 0xd0d4d8, roughness: 0.2, metalness: 0.9 });
const tiles = new THREE.MeshStandardMaterial({ color: 0xbfd8d2, roughness: 0.5 });
const highlight = new THREE.MeshStandardMaterial({ color: 0x7fff7f, emissive: 0x2f2f2f });

function placed(object, x, y, z) {
    object.position.set(x, y, z);
    return object;
}

function box(w, h, d, material, x, y, z) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    return mesh;
}

// Hover highlight is per mesh (InteractionSystem.setHighlight).
function hoverable(group) {
    group.traverse(child => {
        if (!child.isMesh) return;
        child.userData.originalMaterial = child.material;
        child.userData.highlightMaterial = highlight;
    });
    return group;
}

function labelTexture(text, color, width = 256, height = 96) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const draw = (label, fill) => {
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#1b1b1b';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = fill;
        ctx.font = `bold ${Math.floor(height * 0.42)}px "Segoe UI", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, width / 2, height / 2 + 2);
        texture.needsUpdate = true;
    };
    draw(text, color);
    return { texture, draw };
}

export class Bathroom {
    // world: for the camera occluders (walls, ceiling, closed door).
    constructor(room, collisionManager, world) {
        this.room = room;
        this.collisionManager = collisionManager;
        this.world = world;
        this.listener = null; // set by BathroomSync (sounds need the AudioListener)
        this.state = { doorOpen: false, latchedBy: null, lightOn: true, mess: null, stinkUntil: 0, occupant: null };
        this.doorAngle = 0;
        this.flushTime = null;
        this.sprayTime = null;
        this.localInside = false;
    }

    create() {
        this.group = new THREE.Group();
        this.group.name = 'Bathroom';
        this.createWalls();
        this.createDoor();
        this.createToilet();
        this.createSink();
        this.createFreshener();
        this.createLight();
        this.createStink();
        this.room.add(this.group);
        this.group.updateMatrixWorld(true);
        this.colliders.forEach(mesh => this.collisionManager.addCollider(mesh));
        this.doorCollider = this.collisionManager.addCollider(this.doorBlocker);
        // The third-person camera stays out of the walls and under the ceiling.
        this.world?.cameraOccluders.push(...this.colliders, this.ceiling, this.doorPanel);
        this.applyState(this.state);
    }

    createWalls() {
        const { minX, maxX, minZ, maxZ } = BATHROOM_BOUNDS;
        const y = WALL_HEIGHT / 2;
        this.colliders = [];
        const wall = (w, d, x, z) => {
            const mesh = box(w, WALL_HEIGHT, d, white, x, y, z);
            this.group.add(mesh);
            this.colliders.push(mesh);
        };
        // Partition facing the bar, with the door gap.
        wall(DOOR.minX - minX, WALL_THICKNESS, (minX + DOOR.minX) / 2, minZ);
        wall(maxX - DOOR.maxX, WALL_THICKNESS, (DOOR.maxX + maxX) / 2, minZ);
        // Lintel above the door (above anyone's head, so it never blocks).
        const lintelHeight = WALL_HEIGHT - DOOR.height;
        this.group.add(box(DOOR.maxX - DOOR.minX, lintelHeight, WALL_THICKNESS, white,
            (DOOR.minX + DOOR.maxX) / 2, DOOR.height + lintelHeight / 2, minZ));
        // Partition along the room side.
        wall(WALL_THICKNESS, maxZ - minZ, maxX, (minZ + maxZ) / 2);
        // Ceiling (privacy, and the camera stays under it while inside).
        this.ceiling = box(maxX - minX, WALL_THICKNESS, maxZ - minZ, white,
            (minX + maxX) / 2, WALL_HEIGHT + WALL_THICKNESS / 2, (minZ + maxZ) / 2);
        this.group.add(this.ceiling);
        // Tiled floor inside.
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(maxX - minX, maxZ - minZ), tiles);
        floor.rotation.x = -Math.PI / 2;
        floor.position.set((minX + maxX) / 2, 0.01, (minZ + maxZ) / 2);
        this.group.add(floor);

        // Libre / Ocupado sign above the door, on the bar side.
        this.sign = labelTexture('🟢 LIBRE', '#7CFC9A');
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.34), new THREE.MeshBasicMaterial({ map: this.sign.texture }));
        sign.position.set((DOOR.minX + DOOR.maxX) / 2, DOOR.height + 0.32, minZ - WALL_THICKNESS / 2 - 0.01);
        sign.rotation.y = Math.PI;
        this.group.add(sign);
    }

    createDoor() {
        const width = DOOR.maxX - DOOR.minX;
        this.doorPivot = new THREE.Group();
        this.doorPivot.position.set(DOOR.minX, 0, BATHROOM_BOUNDS.minZ);
        const panelMaterial = new THREE.MeshStandardMaterial({ color: 0x6d8fa3, roughness: 0.5 });
        const panel = box(width - 0.04, DOOR.height - 0.04, 0.06, panelMaterial, width / 2, DOOR.height / 2, 0);
        this.doorPanel = panel;
        const handle = box(0.05, 0.05, 0.14, chrome, width - 0.15, 1.05, 0);
        const door = new THREE.Group();
        door.add(panel, handle);
        hoverable(door);
        door.userData = { type: 'bathroomDoor', bathroom: this };
        this.doorPivot.add(door);

        // Latch knob on the inner face (inside is +z). Its group sits at the
        // knob, so F can tell it from the door (whose group is at the hinge).
        const latch = new THREE.Group();
        latch.position.set(width - 0.15, 1.3, 0.06);
        this.latchKnob = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.05), new THREE.MeshStandardMaterial({ color: 0x2e7d32 }));
        latch.add(this.latchKnob);
        latch.userData = { type: 'bathroomLatch', bathroom: this };
        this.doorPivot.add(latch);
        this.group.add(this.doorPivot);

        // Invisible blocker while closed (doors toggle it, see Door.js).
        this.doorBlocker = box(width, DOOR.height, WALL_THICKNESS, new THREE.MeshBasicMaterial({ visible: false }),
            (DOOR.minX + DOOR.maxX) / 2, DOOR.height / 2, BATHROOM_BOUNDS.minZ);
        this.doorBlocker.raycast = () => {};
        this.group.add(this.doorBlocker);
    }

    createToilet() {
        const toilet = new THREE.Group();
        toilet.position.set(TOILET.x, 0, TOILET.z);
        toilet.scale.setScalar(TOILET_SCALE);
        // Facing +x (into the cubicle); the tank is against the wall (-x).
        toilet.add(
            box(0.36, 0.36, 0.3, porcelain, 0.02, 0.18, 0),
            placed(new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.2, 0.2, 20), porcelain), 0.08, 0.44, 0),
            box(0.22, 0.55, 0.5, porcelain, -0.3, 0.75, 0)
        );
        const seat = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.035, 8, 24), new THREE.MeshStandardMaterial({ color: 0xf9f9f9, roughness: 0.3 }));
        seat.rotation.x = Math.PI / 2;
        seat.position.set(0.08, 0.55, 0);
        toilet.add(seat);
        const water = new THREE.Mesh(new THREE.CircleGeometry(0.19, 20), new THREE.MeshStandardMaterial({ color: 0x9fd3e6, roughness: 0.05, transparent: true, opacity: 0.85 }));
        water.rotation.x = -Math.PI / 2;
        water.position.set(0.08, 0.5, 0);
        toilet.add(water);
        hoverable(toilet);
        toilet.userData = { type: 'toilet', bathroom: this };
        this.group.add(toilet);

        // What's in the bowl (in the toilet's own, scaled, space).
        this.peeMesh = new THREE.Mesh(new THREE.CircleGeometry(0.185, 20), new THREE.MeshStandardMaterial({ color: 0xf3d22b, transparent: true, opacity: 0.8, roughness: 0.1 }));
        this.peeMesh.rotation.x = -Math.PI / 2;
        this.peeMesh.position.set(0.08, 0.505, 0);
        this.pooMesh = createPoo();
        this.pooMesh.position.set(0.08, 0.5, 0);
        toilet.add(this.peeMesh, this.pooMesh);

        // Flush handle on the tank.
        const handle = new THREE.Group();
        handle.add(box(0.05, 0.05, 0.16, chrome, 0, 0, 0));
        handle.position.set(-0.18, 0.92, -0.2);
        hoverable(handle);
        handle.userData = { type: 'toiletFlush', bathroom: this };
        toilet.add(handle);

        // Toilet paper on the side wall.
        const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.12, 14), new THREE.MeshStandardMaterial({ color: 0xffffff }));
        roll.rotation.x = Math.PI / 2;
        roll.position.set(TOILET.x + 0.1, 0.8, TOILET.z + 0.7);
        this.group.add(roll);

        // Where you sit (number 2) and where you stand (number 1).
        // LocalPlayer.sitDown reads sitHeight / faceTarget (room-local).
        this.sitSpot = new THREE.Object3D();
        this.sitSpot.position.set(TOILET.x + 0.06, 0, TOILET.z);
        this.sitSpot.userData = { sitHeight: 1.1, faceTarget: { x: BATHROOM_BOUNDS.maxX, z: TOILET.z }, seatId: `${this.room.id}:toilet` };
        this.standSpot = new THREE.Object3D();
        this.standSpot.position.set(TOILET.x + 1.05, 0, TOILET.z);
        this.standSpot.userData = { sitHeight: 1, faceTarget: { x: BATHROOM_BOUNDS.minX, z: TOILET.z }, seatId: `${this.room.id}:toilet-front` };
        this.group.add(this.sitSpot, this.standSpot);
    }

    createSink() {
        const sink = new THREE.Group();
        sink.position.set(SINK.x, 0, SINK.z);
        sink.add(
            placed(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.8, 12), porcelain), 0, 0.4, 0),
            box(0.6, 0.14, 0.42, porcelain, 0, 0.86, -0.06),
            box(0.04, 0.14, 0.04, chrome, 0, 1.0, 0.08),
            box(0.04, 0.04, 0.12, chrome, 0, 1.06, 0.02)
        );
        hoverable(sink);
        sink.userData = { type: 'sink', bathroom: this };
        this.group.add(sink);

        // Mirror above the sink. Rendering it means drawing the scene again,
        // so it's only on while the local player is inside (setMirrorVisible).
        this.mirror = new Reflector(new THREE.PlaneGeometry(0.9, 1.1), {
            textureWidth: 512, textureHeight: 640, color: 0xb0b8bc
        });
        // In front of its frame (the frame is 0.03 thick, centered on the wall face).
        this.mirror.position.set(SINK.x, 1.85, BATHROOM_BOUNDS.maxZ - 0.1 - 0.03);
        this.mirror.rotation.y = Math.PI;
        this.mirror.visible = false;
        this.group.add(this.mirror);
        this.group.add(box(1.0, 1.2, 0.03, new THREE.MeshStandardMaterial({ color: 0x5d4037 }), SINK.x, 1.85, BATHROOM_BOUNDS.maxZ - 0.1));
    }

    createFreshener() {
        this.group.add(box(0.4, 0.04, 0.18, white, FRESHENER.x, FRESHENER.y - 0.02, FRESHENER.z));
        const can = new THREE.Group();
        can.add(
            placed(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.22, 12), new THREE.MeshStandardMaterial({ color: 0x8e44ad, metalness: 0.5, roughness: 0.3 })), 0, 0.11, 0),
            placed(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.04, 8), chrome), 0, 0.24, 0)
        );
        can.position.set(FRESHENER.x, FRESHENER.y, FRESHENER.z);
        hoverable(can);
        can.userData = { type: 'airFreshener', bathroom: this };
        this.group.add(can);
    }

    createLight() {
        const plate = new THREE.Group();
        plate.position.set(SWITCH.x, SWITCH.y, SWITCH.z);
        plate.add(box(0.2, 0.3, 0.03, new THREE.MeshStandardMaterial({ color: 0xeeeeee }), 0, 0, 0));
        this.switchRocker = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.13, 0.03), new THREE.MeshBasicMaterial({ color: 0x7fff7f }));
        this.switchRocker.position.z = 0.025;
        plate.add(this.switchRocker);
        hoverable(plate);
        plate.userData = { type: 'bathroomLight', bathroom: this };
        this.group.add(plate);

        this.lampMaterial = new THREE.MeshStandardMaterial({ color: 0xfff6e0, emissive: 0xfff2d0, emissiveIntensity: 1 });
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), this.lampMaterial);
        lamp.position.set(LAMP.x, LAMP.y, LAMP.z);
        this.group.add(lamp);
        this.light = new THREE.PointLight(0xfff2d8, LAMP_INTENSITY, 7, 1);
        this.light.position.set(LAMP.x, LAMP.y - 0.2, LAMP.z);
        this.group.add(this.light);
    }

    // Green haze plus a few flies around the toilet, while it stinks.
    createStink() {
        const count = 70;
        const positions = new Float32Array(count * 3);
        this.stinkSeeds = Array.from({ length: count }, () => ({
            x: TOILET.x + 0.4 + (Math.random() - 0.3) * 3,
            z: TOILET.z + (Math.random() - 0.5) * 3.5,
            y: Math.random() * 2.4,
            speed: 0.2 + Math.random() * 0.4,
            phase: Math.random() * Math.PI * 2
        }));
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.stink = new THREE.Points(geometry, new THREE.PointsMaterial({
            map: getPuffTexture(), size: 0.9, color: 0x8bc34a, transparent: true, opacity: 0.22, depthWrite: false
        }));
        this.stink.frustumCulled = false;
        this.stink.visible = false;
        this.flies = Array.from({ length: 4 }, (_, i) => {
            const fly = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), new THREE.MeshBasicMaterial({ color: 0x111111 }));
            fly.userData.phase = i * 1.7;
            return fly;
        });
        this.flyGroup = new THREE.Group();
        this.flyGroup.add(...this.flies);
        this.flyGroup.visible = false;
        this.group.add(this.stink, this.flyGroup);
        this.time = 0;
    }

    // --- State ---------------------------------------------------------

    // silent: a snapshot (joining), not a change anyone made.
    applyState(state, silent = false) {
        const previous = this.state;
        this.state = { ...this.state, ...state };
        if (!silent && Boolean(previous.latchedBy) !== Boolean(this.state.latchedBy)) {
            const knob = this.latchKnob.getWorldPosition(new THREE.Vector3());
            playSynth(this.listener, this.group, this.group.worldToLocal(knob), 'latch', 2);
        }
        this.doorCollider && (this.doorCollider.enabled = !this.state.doorOpen);
        // Like the front doors: only a closed door pushes the camera in.
        this.doorPanel.userData.blocksCamera = !this.state.doorOpen;
        const latched = Boolean(this.state.latchedBy);
        this.sign.draw(latched ? '🔴 OCUPADO' : '🟢 LIBRE', latched ? '#FF6B6B' : '#7CFC9A');
        this.latchKnob.material.color.setHex(latched ? 0xc62828 : 0x2e7d32);
        this.latchKnob.position.x = latched ? 0.1 : 0;
        this.switchRocker.material.color.setHex(this.state.lightOn ? 0x7fff7f : 0x553333);
        this.updateLamp();
        this.lampMaterial.emissiveIntensity = this.state.lightOn ? 1 : 0;
        // A flush animation empties the bowl itself.
        if (this.flushTime === null || this.state.mess) {
            this.peeMesh.visible = this.state.mess === 'pee';
            this.pooMesh.visible = this.state.mess === 'poo';
        }
        if (previous.mess && !this.state.mess && this.flushTime === null) this.resetBowl();
    }

    get stinking() {
        return this.stinkClock && this.stinkClock.now() < this.state.stinkUntil;
    }

    containsPoint(worldPosition) {
        const local = this.room.toLocal(worldPosition);
        const { minX, maxX, minZ, maxZ } = BATHROOM_BOUNDS;
        return local.x > minX && local.x < maxX && local.z > minZ && local.z < maxZ;
    }

    worldPoint(x, y, z) {
        return this.room.toWorld(x, y, z);
    }

    // Whether the local player is in here: the mirror (an extra render of the
    // scene) and the lamp (it would light the bar through the partition)
    // only matter then. The lamp's intensity changes, never its visibility,
    // so the scene's light count stays the same.
    setLocalInside(inside) {
        if (inside === this.localInside) return;
        this.localInside = inside;
        this.mirror.visible = inside;
        this.updateLamp();
    }

    updateLamp() {
        this.light.intensity = this.state.lightOn && this.localInside ? LAMP_INTENSITY : 0;
    }

    // In the door gap (where a closing door's blocker would be), with the
    // player's radius as margin.
    inDoorway(worldPosition, margin = 0.45) {
        const local = this.room.toLocal(worldPosition);
        return local.x > DOOR.minX - margin && local.x < DOOR.maxX + margin
            && Math.abs(local.z - BATHROOM_BOUNDS.minZ) < WALL_THICKNESS / 2 + margin;
    }

    // --- Effects -------------------------------------------------------

    playEvent(kind, listener) {
        const at = (x, y, z) => new THREE.Vector3(x, y, z);
        if (kind === 'pee') {
            playSynth(listener, this.group, at(TOILET.x, 0.6, TOILET.z), 'pee');
        } else if (kind === 'poo') {
            const fart = FART_SOUNDS[Math.floor(Math.random() * FART_SOUNDS.length)];
            playFile(listener, this.group, at(TOILET.x, 0.5, TOILET.z), fart);
        } else if (kind === 'flush') {
            playSynth(listener, this.group, at(TOILET.x - 0.2, 0.8, TOILET.z), 'flush', 4);
            this.flushTime = 0;
        } else if (kind === 'wash') {
            playSynth(listener, this.group, at(SINK.x, 1, SINK.z), 'wash');
        } else if (kind === 'spray') {
            playSynth(listener, this.group, at(FRESHENER.x, FRESHENER.y + 0.25, FRESHENER.z), 'spray');
            this.startSpray();
        }
    }

    startSpray() {
        this.stopSpray();
        const count = 50;
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
        this.sprayDirections = Array.from({ length: count }, () => new THREE.Vector3(
            (Math.random() - 0.5) * 1.2, (Math.random() - 0.2) * 0.8, -0.6 - Math.random() * 1.2
        ));
        this.spray = new THREE.Points(geometry, new THREE.PointsMaterial({
            map: getPuffTexture(), size: 0.35, color: 0xf3e5f5, transparent: true, opacity: 0.8, depthWrite: false
        }));
        this.spray.frustumCulled = false;
        this.spray.position.set(FRESHENER.x, FRESHENER.y + 0.26, FRESHENER.z);
        this.group.add(this.spray);
        this.sprayTime = 0;
    }

    stopSpray() {
        if (!this.spray) return;
        this.spray.removeFromParent();
        this.spray.geometry.dispose();
        this.spray.material.dispose();
        this.spray = null;
        this.sprayTime = null;
    }

    resetBowl() {
        this.pooMesh.scale.setScalar(1);
        this.pooMesh.rotation.y = 0;
        this.peeMesh.scale.setScalar(1);
    }

    update(deltaTime, serverClock) {
        const dt = Math.min(deltaTime, 0.1);
        this.time += dt;
        this.stinkClock = serverClock;

        // Door swing (inward).
        const target = this.state.doorOpen ? -Math.PI / 2 : 0;
        this.doorAngle += (target - this.doorAngle) * (1 - Math.exp(-DOOR_SWING_SPEED * dt));
        this.doorPivot.rotation.y = this.doorAngle;

        // Flush: the bowl's content swirls and sinks.
        if (this.flushTime !== null) {
            this.flushTime += dt;
            const left = Math.max(0, 1 - this.flushTime / FLUSH_TIME);
            this.pooMesh.rotation.y += dt * 8;
            this.pooMesh.scale.setScalar(left);
            this.peeMesh.scale.setScalar(left);
            if (this.flushTime >= FLUSH_TIME) {
                this.flushTime = null;
                this.resetBowl();
                this.peeMesh.visible = this.state.mess === 'pee';
                this.pooMesh.visible = this.state.mess === 'poo';
            }
        }

        // Stink haze and flies.
        const stinking = this.stinking;
        this.stink.visible = stinking;
        this.flyGroup.visible = stinking;
        if (stinking) {
            const positions = this.stink.geometry.attributes.position;
            this.stinkSeeds.forEach((seed, i) => {
                const y = (seed.y + this.time * seed.speed) % 2.6;
                positions.setXYZ(i, seed.x + Math.sin(this.time * 0.7 + seed.phase) * 0.25, y, seed.z + Math.cos(this.time * 0.5 + seed.phase) * 0.25);
            });
            positions.needsUpdate = true;
            this.flies.forEach(fly => {
                const t = this.time * 3 + fly.userData.phase;
                fly.position.set(TOILET.x + 0.3 + Math.cos(t) * 0.45, 0.9 + Math.sin(t * 2.3) * 0.25, TOILET.z + Math.sin(t * 1.3) * 0.45);
            });
        }

        // Air freshener spray.
        if (this.sprayTime !== null) {
            this.sprayTime += dt;
            const positions = this.spray.geometry.attributes.position;
            this.sprayDirections.forEach((direction, i) => {
                positions.setXYZ(i, direction.x * this.sprayTime, direction.y * this.sprayTime, direction.z * this.sprayTime);
            });
            positions.needsUpdate = true;
            this.spray.material.opacity = 0.8 * Math.max(0, 1 - this.sprayTime / SPRAY_TIME);
            if (this.sprayTime >= SPRAY_TIME) this.stopSpray();
        }
    }
}

// A soft-serve swirl: stacked tori and a tip.
function createPoo() {
    const brown = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.6 });
    const poo = new THREE.Group();
    [[0.11, 0.04, 0.03], [0.08, 0.035, 0.08], [0.05, 0.03, 0.125]].forEach(([radius, tube, y]) => {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 8, 16), brown);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = y;
        poo.add(ring);
    });
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.07, 10), brown);
    tip.position.y = 0.17;
    poo.add(tip);
    return poo;
}

let puffTexture = null;
function getPuffTexture() {
    if (puffTexture) return puffTexture;
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,255,255,0.8)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    puffTexture = new THREE.CanvasTexture(canvas);
    return puffTexture;
}
