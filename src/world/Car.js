import * as THREE from 'three';
import { PLAZA_RADIUS } from './RoomLayout';
import { roadAngle, hubPoint } from './Outdoors';

// The Uber Suicida: the black car parked on the plaza (world coordinates, by
// the road between Gamedev and Desarrollo). Clicking it or F (carInteraction)
// takes the first free of its five seats; occupancy is server state
// (CarSync). Whoever has the driver's seat (slot 0) drives it (DrivingSync,
// as car 'uber'). `playSmoke` fills the cabin with smoke and plays a hiss;
// everyone around sees and hears it, only the passengers get teleported.
// Frames: `group` is placed and turned like the other drivable cars (its
// local +z forward); everything else sits in `body`, built front at +x.

// Near the mouth of the road between slots 0 and 1 (Gamedev and Desarrollo),
// along the plaza's edge.
const CAR_ANGLE = roadAngle(0);
const CAR_POSITION = hubPoint(CAR_ANGLE, PLAZA_RADIUS - 5);
// Tangent to the plaza (the body's +x front, turned to the group's +z).
const CAR_YAW = CAR_ANGLE + Math.PI / 2;
const BODY = { length: 4.4, width: 1.9, height: 0.7, bottom: 0.35 };
const CABIN = { length: 2.4, height: 0.75, offsetX: -0.2 };
// Seat positions in car-local coordinates (front at +x).
const SEATS = [
    { x: 0.35, z: -0.45 }, { x: 0.35, z: 0.45 },
    { x: -0.75, z: -0.55 }, { x: -0.75, z: 0 }, { x: -0.75, z: 0.55 }
];
// position.y above the seat origin while sitting (low, inside the cabin).
const SEAT_SIT_HEIGHT = 0.75;
const SMOKE_PARTICLES = 160;
// The driver sits in slot 0 (front left).
const DRIVER_SLOT = 0;
const SMOKE_DURATION = 5; // s
const HISS_DURATION = 3.2; // s

export class Car {
    constructor(scene, collisionManager) {
        this.scene = scene;
        this.collisionManager = collisionManager;
        this.seats = [];
        this.smoke = null;
        this.smokeTime = 0;
    }

    get id() {
        return 'uber';
    }

    create() {
        this.group = new THREE.Group();
        this.group.name = 'UberSuicida';
        this.group.position.set(CAR_POSITION.x, 0, CAR_POSITION.z);
        this.group.rotation.y = CAR_YAW;
        // The car itself, front at +x, turned so the front is the group's +z.
        this.body = new THREE.Group();
        this.body.rotation.y = -Math.PI / 2;
        this.group.add(this.body);

        const paint = new THREE.MeshStandardMaterial({ color: 0x0b0b0e, roughness: 0.25, metalness: 0.7 });
        const glass = new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.35 });
        const rubber = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
        const chrome = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.2, metalness: 1 });
        const lightOn = new THREE.MeshBasicMaterial({ color: 0xfff3c0 });
        const tail = new THREE.MeshBasicMaterial({ color: 0xaa1111 });

        // Body: walls around an open cabin floor, so seated avatars show.
        const highlight = new THREE.MeshStandardMaterial({ color: 0x2f6f2f, emissive: 0x1f3f1f, roughness: 0.3 });
        const body = new THREE.Mesh(new THREE.BoxGeometry(BODY.length, BODY.height, BODY.width), paint);
        body.position.y = BODY.bottom + BODY.height / 2;
        body.userData = { originalMaterial: paint, highlightMaterial: highlight };
        this.body.add(body);

        // Cabin: glass sides and a black roof.
        const cabinY = BODY.bottom + BODY.height;
        const roof = new THREE.Mesh(new THREE.BoxGeometry(CABIN.length, 0.06, BODY.width - 0.1), paint);
        roof.position.set(CABIN.offsetX, cabinY + CABIN.height, 0);
        this.body.add(roof);
        const windows = new THREE.Mesh(new THREE.BoxGeometry(CABIN.length, CABIN.height, BODY.width - 0.12), glass);
        windows.position.set(CABIN.offsetX, cabinY + CABIN.height / 2, 0);
        this.body.add(windows);
        [-1, 1].forEach(side => {
            const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.08, CABIN.height, BODY.width - 0.1), paint);
            pillar.position.set(CABIN.offsetX + side * CABIN.length / 2, cabinY + CABIN.height / 2, 0);
            this.body.add(pillar);
        });

        // Wheels, lights, bumpers.
        const wheelGeometry = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 18);
        wheelGeometry.rotateX(Math.PI / 2);
        [[1.35, 1], [1.35, -1], [-1.35, 1], [-1.35, -1]].forEach(([x, side]) => {
            const wheel = new THREE.Mesh(wheelGeometry, rubber);
            wheel.position.set(x, 0.36, side * (BODY.width / 2 - 0.05));
            this.body.add(wheel);
        });
        [-0.6, 0.6].forEach(z => {
            const head = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.32), lightOn);
            head.position.set(BODY.length / 2 + 0.01, BODY.bottom + 0.45, z);
            this.body.add(head);
            const back = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.3), tail);
            back.position.set(-BODY.length / 2 - 0.01, BODY.bottom + 0.45, z);
            this.body.add(back);
        });
        [-1, 1].forEach(end => {
            const bumper = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, BODY.width), chrome);
            bumper.position.set(end * (BODY.length / 2 + 0.04), BODY.bottom + 0.1, 0);
            this.body.add(bumper);
        });

        this.createSeats();
        this.group.userData = { type: 'car', car: this };
        this.scene.add(this.group);
        this.group.updateMatrixWorld(true);
        // No collider: like the other drivable cars, people walk through it.
    }

    // Sitting spots only (the body hides the cushions); LocalPlayer.sitDown
    // reads sitHeight/faceYaw.
    createSeats() {
        SEATS.forEach((spot, slot) => {
            const seat = new THREE.Group();
            seat.position.set(spot.x, BODY.bottom, spot.z);
            seat.userData = {
                slot,
                sitHeight: SEAT_SIT_HEIGHT,
                faceYaw: CAR_YAW, // facing the front (DrivingSync keeps it up to date while it moves)
                seatId: `car:${slot}`
            };
            this.body.add(seat);
            this.seats.push(seat);
        });
    }

    getSeat(slot) {
        return this.seats[slot] ?? null;
    }

    // --- Driving (the same interface as DrivableCar) -------------------------

    get position() {
        return this.group.position;
    }

    get yaw() {
        return this.group.rotation.y;
    }

    get driverSlot() {
        return DRIVER_SLOT;
    }

    // Where someone in `slot` sits (world).
    seatPosition(slot) {
        const seat = this.seats[slot];
        return seat.localToWorld(new THREE.Vector3(0, SEAT_SIT_HEIGHT, 0));
    }

    driverSeat() {
        return this.seatPosition(DRIVER_SLOT);
    }

    // Points along its length (world xz) for collision checks.
    samplePoints(x, z, yaw) {
        const forward = { x: Math.sin(yaw), z: Math.cos(yaw) };
        const reach = BODY.length / 2 - BODY.width / 2;
        return [-reach, 0, reach].map(d => new THREE.Vector3(x + forward.x * d, 1, z + forward.z * d));
    }

    get halfWidth() {
        return BODY.width / 2;
    }

    // The back bumper, along the car (group frame: +z forward).
    get rearZ() {
        return -BODY.length / 2;
    }

    animate() {}

    distanceTo(worldPosition) {
        const center = this.group.getWorldPosition(new THREE.Vector3());
        return Math.hypot(worldPosition.x - center.x, worldPosition.z - center.z);
    }

    getCenter() {
        return this.body.localToWorld(new THREE.Vector3(CABIN.offsetX, BODY.bottom + BODY.height, 0));
    }

    // --- Smoke -----------------------------------------------------------

    playSmoke(listener) {
        this.stopSmoke();
        const positions = new Float32Array(SMOKE_PARTICLES * 3);
        this.smokeSeeds = [];
        for (let i = 0; i < SMOKE_PARTICLES; i++) {
            this.smokeSeeds.push({
                x: (Math.random() - 0.5) * CABIN.length,
                z: (Math.random() - 0.5) * (BODY.width - 0.3),
                delay: Math.random() * 1.5,
                rise: 0.2 + Math.random() * 0.5,
                drift: (Math.random() - 0.5) * 2.4
            });
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const material = new THREE.PointsMaterial({
            map: getSmokeTexture(),
            size: 0.9,
            transparent: true,
            depthWrite: false,
            opacity: 0,
            color: 0xd8d8d8
        });
        this.smoke = new THREE.Points(geometry, material);
        this.smoke.position.x = CABIN.offsetX;
        this.smoke.frustumCulled = false;
        this.body.add(this.smoke);
        this.smokeTime = 0;
        this.playHiss(listener);
    }

    update(deltaTime) {
        if (!this.smoke) return;
        this.smokeTime += Math.min(deltaTime, 0.1);
        const t = this.smokeTime;
        if (t > SMOKE_DURATION) {
            this.stopSmoke();
            return;
        }
        const positions = this.smoke.geometry.attributes.position;
        const cabinBottom = BODY.bottom + 0.4;
        this.smokeSeeds.forEach((seed, i) => {
            const age = Math.max(0, t - seed.delay);
            // Fills the cabin first, then leaks out of the windows and rises.
            const spill = Math.max(0, age - 1.5);
            positions.setXYZ(i,
                seed.x + spill * seed.drift * 0.3,
                cabinBottom + Math.min(age * seed.rise, CABIN.height + 0.2) + spill * 0.5,
                seed.z * (1 + spill * 0.8)
            );
        });
        positions.needsUpdate = true;
        // Fade in, hold, fade out.
        const fadeIn = Math.min(1, t / 0.8);
        const fadeOut = Math.min(1, (SMOKE_DURATION - t) / 1.2);
        this.smoke.material.opacity = 0.75 * fadeIn * fadeOut;
    }

    stopSmoke() {
        if (!this.smoke) return;
        this.smoke.removeFromParent();
        this.smoke.geometry.dispose();
        this.smoke.material.dispose();
        this.smoke = null;
    }

    // A long "fsss": filtered noise with a soft attack, positional at the car.
    playHiss(listener) {
        if (!listener) return;
        const context = listener.context;
        const length = Math.floor(context.sampleRate * HISS_DURATION);
        const buffer = context.createBuffer(1, length, context.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < length; i++) {
            const time = i / context.sampleRate;
            const envelope = Math.min(1, time / 0.4) * Math.min(1, (HISS_DURATION - time) / 0.8);
            // A little wobble, like breath through a gap.
            const wobble = 0.75 + 0.25 * Math.sin(time * 9);
            data[i] = (Math.random() * 2 - 1) * envelope * wobble;
        }
        if (!this.sound) {
            this.sound = new THREE.PositionalAudio(listener);
            this.sound.setRefDistance(3);
            const filter = context.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 3200;
            filter.Q.value = 0.7;
            this.sound.setFilter(filter);
            this.sound.position.set(CABIN.offsetX, BODY.bottom + BODY.height, 0);
            this.body.add(this.sound);
        }
        if (this.sound.isPlaying) this.sound.stop();
        this.sound.setBuffer(buffer);
        this.sound.setVolume(0.6);
        this.sound.play();
    }
}

let smokeTexture = null;
function getSmokeTexture() {
    if (smokeTexture) return smokeTexture;
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,255,255,0.9)');
    gradient.addColorStop(0.5, 'rgba(230,230,230,0.35)');
    gradient.addColorStop(1, 'rgba(220,220,220,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    smokeTexture = new THREE.CanvasTexture(canvas);
    return smokeTexture;
}
