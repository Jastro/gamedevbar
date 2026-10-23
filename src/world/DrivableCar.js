import * as THREE from 'three';

// A small open-top car anyone can drive (DrivingSync moves it), so the driver
// shows. Its own frame: +z forward, and facing forward, +x is the left side;
// the driver sits on the left, as in Spain, so DRIVER_SEAT.x is positive.
export const CAR_SIZE = { length: 4, width: 1.9 };
const BODY_BOTTOM = 0.35;
const BODY_HEIGHT = 0.6;
const WHEEL_RADIUS = 0.36;
const WHEELBASE = 2.5;
// Hips on the seat, avatar space at size 1 (see Player's seated pose).
export const DRIVER_SEAT = { x: 0.45, y: 1.5, z: -0.25 };

export class DrivableCar {
    constructor(scene, id, color) {
        this.scene = scene;
        this.id = id;
        this.color = color;
        this.wheelSpin = 0;
        this.steer = 0;
    }

    create(position, yaw) {
        const group = new THREE.Group();
        const paint = new THREE.MeshStandardMaterial({ color: this.color, roughness: 0.35, metalness: 0.5 });
        const dark = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 });
        const chrome = new THREE.MeshStandardMaterial({ color: 0xd0d4d8, metalness: 0.9, roughness: 0.2 });
        const seatMaterial = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.7 });
        const { length, width } = CAR_SIZE;
        const parts = [];
        const box = (w, h, d, material, x, y, z) => {
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
            mesh.position.set(x, y, z);
            mesh.castShadow = true;
            group.add(mesh);
            parts.push(mesh);
            return mesh;
        };

        // Body: a tub with the cabin cut out (sides, nose, tail), open on top.
        const top = BODY_BOTTOM + BODY_HEIGHT;
        box(width, 0.15, length, paint, 0, BODY_BOTTOM + 0.075, 0);                // floor
        box(0.12, BODY_HEIGHT, length, paint, width / 2 - 0.06, BODY_BOTTOM + BODY_HEIGHT / 2, 0);
        box(0.12, BODY_HEIGHT, length, paint, -width / 2 + 0.06, BODY_BOTTOM + BODY_HEIGHT / 2, 0);
        box(width, BODY_HEIGHT, 1.2, paint, 0, BODY_BOTTOM + BODY_HEIGHT / 2, length / 2 - 0.6);  // bonnet
        box(width, BODY_HEIGHT * 0.8, 0.8, paint, 0, BODY_BOTTOM + BODY_HEIGHT * 0.4, -length / 2 + 0.4); // boot
        // Windscreen frame, seats, wheel.
        const glass = new THREE.MeshStandardMaterial({ color: 0x99bbdd, transparent: true, opacity: 0.35, roughness: 0.1 });
        const screen = box(width - 0.1, 0.45, 0.04, glass, 0, top + 0.2, length / 2 - 1.25);
        screen.rotation.x = -0.35;
        box(0.7, 0.25, 0.6, seatMaterial, DRIVER_SEAT.x, top - 0.2, DRIVER_SEAT.z);
        box(0.7, 0.25, 0.6, seatMaterial, -DRIVER_SEAT.x, top - 0.2, DRIVER_SEAT.z);
        box(0.7, 0.55, 0.12, seatMaterial, DRIVER_SEAT.x, top + 0.05, DRIVER_SEAT.z - 0.3);
        box(0.7, 0.55, 0.12, seatMaterial, -DRIVER_SEAT.x, top + 0.05, DRIVER_SEAT.z - 0.3);
        const wheelRim = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.03, 8, 20), dark);
        wheelRim.position.set(DRIVER_SEAT.x, top + 0.1, DRIVER_SEAT.z + 0.55);
        wheelRim.rotation.x = -0.6;
        group.add(wheelRim);
        // Lights and bumpers.
        const headlight = new THREE.MeshBasicMaterial({ color: 0xfff3c0 });
        const taillight = new THREE.MeshBasicMaterial({ color: 0xaa1111 });
        [-1, 1].forEach(side => {
            box(0.3, 0.14, 0.05, headlight, side * (width / 2 - 0.3), BODY_BOTTOM + 0.42, length / 2 + 0.01);
            box(0.3, 0.12, 0.05, taillight, side * (width / 2 - 0.3), BODY_BOTTOM + 0.35, -length / 2 - 0.01);
        });
        box(width + 0.05, 0.12, 0.1, chrome, 0, BODY_BOTTOM + 0.1, length / 2 + 0.05);
        box(width + 0.05, 0.12, 0.1, chrome, 0, BODY_BOTTOM + 0.1, -length / 2 - 0.05);

        // Wheels: the front pair steers (a pivot each), all spin.
        this.wheels = [];
        this.frontPivots = [];
        const tyre = new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.28, 16);
        tyre.rotateZ(Math.PI / 2); // axle along x
        [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([side, end]) => {
            const pivot = new THREE.Group();
            pivot.position.set(side * (width / 2 - 0.05), WHEEL_RADIUS, end * (WHEELBASE / 2));
            const wheel = new THREE.Mesh(tyre, dark);
            const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.3, 10).rotateZ(Math.PI / 2), chrome);
            wheel.add(hub);
            pivot.add(wheel);
            group.add(pivot);
            this.wheels.push(wheel);
            if (end > 0) this.frontPivots.push(pivot);
        });

        const highlight = new THREE.MeshStandardMaterial({ color: 0x7fff7f, emissive: 0x2f2f2f });
        parts.forEach(mesh => {
            mesh.userData.originalMaterial = mesh.material;
            mesh.userData.highlightMaterial = highlight;
        });
        group.userData = { type: 'drivableCar', car: this };
        group.position.copy(position);
        group.rotation.y = yaw;
        this.group = group;
        this.scene.add(group);
    }

    get position() {
        return this.group.position;
    }

    get yaw() {
        return this.group.rotation.y;
    }

    // Where the driver's avatar goes (world), and which way it faces.
    driverSeat() {
        return this.group.localToWorld(new THREE.Vector3(DRIVER_SEAT.x, DRIVER_SEAT.y, DRIVER_SEAT.z));
    }

    // The seat beside the driver.
    passengerSeat() {
        return this.group.localToWorld(new THREE.Vector3(-DRIVER_SEAT.x, DRIVER_SEAT.y, DRIVER_SEAT.z));
    }

    get halfWidth() {
        return CAR_SIZE.width / 2;
    }

    // Points along its length (world xz) for collision checks.
    samplePoints(x, z, yaw) {
        const forward = { x: Math.sin(yaw), z: Math.cos(yaw) };
        const reach = CAR_SIZE.length / 2 - CAR_SIZE.width / 2;
        return [-reach, 0, reach].map(d => new THREE.Vector3(x + forward.x * d, 1, z + forward.z * d));
    }

    // Visuals for a speed and steer (-1..1).
    animate(deltaTime, speed, steer) {
        this.wheelSpin += (speed * deltaTime) / WHEEL_RADIUS;
        this.wheels.forEach(wheel => { wheel.rotation.x = this.wheelSpin; });
        this.steer += (steer - this.steer) * Math.min(1, deltaTime * 10);
        this.frontPivots.forEach(pivot => { pivot.rotation.y = this.steer * 0.45; });
    }
}

export { WHEELBASE };
