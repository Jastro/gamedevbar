import * as THREE from 'three';
import { DrivableCar, WHEELBASE } from './DrivableCar';
import { RING_ROAD } from './RoomLayout';
import { roadAngle, hubPoint } from './Outdoors';
import { playSynth } from '../audio/synth';
import { lerpAngle } from '../entities/Player';

// Drivable cars (server: server/features/driving.js). F next to one to drive:
// W/S speed up and brake (then reverse), A/D steer, F or Esc to get out.
// The driver's client runs the car (simple bicycle model) and sends its pose;
// everyone else eases toward it. Cars crash into walls, lamp posts, the
// fountain and the map's edge, can't go into a bar, and pass through people.
// The Uber Suicida (Car.js, id 'uber') is driven from its driver's seat:
// sitting there (CarSync) takes the wheel, and its passengers ride along.
const CARS = [
    { id: 'car1', color: 0xd32f2f, road: 0 },
    { id: 'car2', color: 0x1e63d6, road: 2 },
    { id: 'car3', color: 0xf9c80e, road: 3 },
    { id: 'car4', color: 0x2e9e3a, road: 5 }
];
const MAX_FORWARD = 14;   // units/s
const MAX_REVERSE = 5;
const ACCELERATION = 7;   // units/s²
const BRAKING = 16;
const COASTING = 3;
const MAX_STEER = 0.55;   // rad at the front wheels
const STEER_RATE = 4;     // 1/s: how fast the wheel turns
const CRASH_BOUNCE = 0.25;
const SEND_INTERVAL = 50; // ms
const FOLLOW_RATE = 12;   // 1/s for other people's cars
const CAMERA_FOLLOW = 2;  // 1/s: the camera swings behind a moving car
const UNSTICK_REACH = 3;  // how far a stuck car may hop to get free
const HINT = 'W/S: acelerar / frenar · A/D: girar · F o Esc: bajar';

// Parked along the ring road, just past road k's junction, pointing along it.
function parkingSpot(road) {
    const angle = roadAngle(road) + 0.12;
    const position = hubPoint(angle, (RING_ROAD.inner + RING_ROAD.outer) / 2 + 1.8);
    // Tangent to the ring (counterclockwise from above).
    return { position, yaw: Math.atan2(-Math.cos(angle), Math.sin(angle)) };
}

export class DrivingSync {
    constructor(game) {
        this.game = game;
        this.cars = new Map(); // id -> { car, driver, name, speed, steer, target }
        this.driving = null;   // our car's id
        this.keys = {};
        this.lastSent = 0;
        window.addEventListener('keydown', (event) => {
            if (!this.driving || this.game.chatActive) return;
            this.keys[event.code] = true;
            if ((event.key.toLowerCase() === 'f' || event.key === 'Escape') && !event.repeat) this.leave();
        });
        window.addEventListener('keyup', (event) => { this.keys[event.code] = false; });
        window.addEventListener('blur', () => { this.keys = {}; });
    }

    get localId() {
        return this.game.players.localPlayer?.id;
    }

    // After the world exists.
    create() {
        const scene = this.game.scene.getScene();
        CARS.forEach(({ id, color, road }) => {
            const car = new DrivableCar(scene, id, color);
            const spot = parkingSpot(road);
            car.create(spot.position, spot.yaw);
            this.cars.set(id, { car, driver: null, name: null, speed: 0, steer: 0, target: null });
        });
        this.uber = this.game.environment.car;
        this.cars.set(this.uber.id, { car: this.uber, driver: null, name: null, speed: 0, steer: 0, target: null });
    }

    // The Uber's driver's seat, where sitting takes the wheel.
    get uberDriverSeat() {
        return this.uber.getSeat(this.uber.driverSlot);
    }

    bind() {
        const { network } = this.game;
        network.on('driveStates', (data) => (Array.isArray(data.cars) ? data.cars : []).forEach(state => this.applyState(state, true)));
        network.on('driveState', (data) => this.applyState(data, false));
        network.on('driveUpdate', (data) => {
            const entry = this.cars.get(data.carId);
            if (!entry || entry.driver === this.localId) return;
            entry.target = { x: data.x, z: data.z, yaw: data.yaw };
            entry.speed = Number(data.speed) || 0;
            entry.steer = Number(data.steer) || 0;
        });
        network.on('driveBusy', (data) => this.say(`🚗 Ya lo conduce ${data.name ?? 'alguien'}.`));
    }

    say(message) {
        this.game.ui.chat?.addMessage({ type: 'system', message });
    }

    applyState({ carId, driver, name, x, z, yaw }, snap) {
        const entry = this.cars.get(carId);
        if (!entry) return;
        const previousDriver = entry.driver;
        entry.driver = driver ?? null;
        entry.name = name ?? null;
        if (typeof x === 'number' && entry.driver !== this.localId) {
            entry.target = { x, z, yaw };
            if (snap) {
                entry.car.group.position.set(x, 0, z);
                entry.car.group.rotation.y = yaw;
            }
        }
        if (!entry.driver) entry.speed = 0;
        // Whoever stopped driving it gets their own pose back.
        if (previousDriver && previousDriver !== entry.driver && previousDriver !== this.localId) {
            const player = this.game.players.players.get(previousDriver);
            if (player?.drivingCar === carId) {
                player.drivingCar = null;
                player.seatPose = null;
            }
        }
        if (entry.driver === this.localId && this.driving !== carId) this.enter(carId);
        else if (this.driving === carId && entry.driver !== this.localId) this.exit();
    }

    // From the interaction.
    request(car) {
        const entry = this.cars.get(car.id);
        if (!entry || this.game.playMode) return;
        if (entry.driver && this.game.players.players.has(entry.driver)) {
            this.say(`🚗 Ya lo conduce ${entry.name ?? 'alguien'}.`);
            return;
        }
        this.game.network.send('driveStart', { carId: car.id, x: car.position.x, z: car.position.z, yaw: car.yaw });
    }

    enter(carId) {
        const player = this.game.players.localPlayer;
        if (!player || this.game.playMode) {
            this.game.network.send('driveStop', {});
            return;
        }
        // In the Uber you stay in its driver's seat.
        if (player.isSitting && player.seat !== this.uberDriverSeat) player.standUp();
        this.game.gestureSync?.stop();
        player.stopMoving?.();
        player.keysPressed = {};
        player.driving = true;
        this.driving = carId;
        this.keys = {};
        this.playMode = { hint: HINT };
        this.game.playMode = this.playMode;
        this.say('🚗 W/S para acelerar y frenar, A/D para girar. F para bajar.');
    }

    exit() {
        const entry = this.cars.get(this.driving);
        const player = this.game.players.localPlayer;
        this.driving = null;
        if (entry) entry.speed = 0;
        if (player) {
            player.driving = false;
            if (entry?.car === this.uber) {
                // Out of the driver's seat (which frees it); not if the
                // ride already stood us up somewhere else.
                if (player.seat === this.uberDriverSeat) player.standUp(this.exitSpot(entry.car));
            } else if (entry) {
                player.position.copy(this.exitSpot(entry.car));
            }
        }
        if (this.game.playMode === this.playMode) this.game.playMode = null;
        this.playMode = null;
    }

    leave() {
        if (!this.driving) return;
        this.game.network.send('driveStop', {});
        this.exit();
    }

    // Out the driver's side, else the other side, else behind.
    exitSpot(car) {
        const candidates = [[2, 0], [-2, 0], [0, -3.2], [0, 3.2]];
        const collisions = this.game.world.collisionManager;
        for (const [x, z] of candidates) {
            const spot = car.group.localToWorld(new THREE.Vector3(x, 0, z)).setY(1);
            if (!collisions.checkCollision(spot, 0.4) && !this.game.world.getRoomAt(spot)) return spot;
        }
        return car.group.localToWorld(new THREE.Vector3(2, 0, 0)).setY(1);
    }

    // Would the car hit something at this pose?
    blocked(car, x, z, yaw) {
        const collisions = this.game.world.collisionManager;
        return car.samplePoints(x, z, yaw).some(point =>
            collisions.checkCollision(point, car.halfWidth) || this.game.world.getRoomAt(point));
    }

    // A car already touching something (a door shut on it) could never move
    // again: it hops to the nearest free spot around it.
    unstick(car) {
        const { x, z } = car.position;
        const yaw = car.yaw;
        if (!this.blocked(car, x, z, yaw)) return;
        for (let distance = 0.25; distance <= UNSTICK_REACH; distance += 0.25) {
            for (let k = 0; k < 16; k++) {
                const angle = (k / 16) * Math.PI * 2;
                const nextX = x + Math.sin(angle) * distance;
                const nextZ = z + Math.cos(angle) * distance;
                if (!this.blocked(car, nextX, nextZ, yaw)) {
                    car.group.position.set(nextX, 0, nextZ);
                    return;
                }
            }
        }
    }

    drive(entry, dt) {
        const { car } = entry;
        const chatting = this.game.chatActive;
        const forward = !chatting && (this.keys.KeyW || this.keys.ArrowUp);
        const back = !chatting && (this.keys.KeyS || this.keys.ArrowDown);
        const left = !chatting && (this.keys.KeyA || this.keys.ArrowLeft);
        const right = !chatting && (this.keys.KeyD || this.keys.ArrowRight);

        let speed = entry.speed;
        if (forward) speed += (speed < 0 ? BRAKING : ACCELERATION) * dt;
        else if (back) speed -= (speed > 0.1 ? BRAKING : ACCELERATION * 0.6) * dt;
        else speed -= Math.sign(speed) * Math.min(Math.abs(speed), COASTING * dt);
        speed = THREE.MathUtils.clamp(speed, -MAX_REVERSE, MAX_FORWARD);
        const steerTarget = left === right ? 0 : (left ? 1 : -1);
        entry.steer += (steerTarget - entry.steer) * Math.min(1, STEER_RATE * dt);

        this.unstick(car);
        // Small steps, so nothing is skipped at speed.
        const steps = Math.max(1, Math.ceil(Math.abs(speed * dt) / 0.25));
        const step = dt / steps;
        let { x, z } = car.position;
        let yaw = car.yaw;
        for (let i = 0; i < steps; i++) {
            const nextYaw = yaw + (speed / WHEELBASE) * Math.tan(entry.steer * MAX_STEER) * step;
            const nextX = x + Math.sin(nextYaw) * speed * step;
            const nextZ = z + Math.cos(nextYaw) * speed * step;
            if (this.blocked(car, nextX, nextZ, nextYaw)) {
                if (Math.abs(speed) > 3) {
                    const listener = this.game.environment.audioListener;
                    if (listener) playSynth(listener, car.group, new THREE.Vector3(0, 0.6, Math.sign(speed) * 2), 'dart', 6);
                }
                speed = -speed * CRASH_BOUNCE;
                break;
            }
            x = nextX;
            z = nextZ;
            yaw = nextYaw;
        }
        entry.speed = speed;
        car.group.position.set(x, 0, z);
        car.group.rotation.y = yaw;

        // The camera swings in behind a moving car.
        if (Math.abs(speed) > 1) {
            const camera = this.game.camera;
            camera.rotation.horizontal = lerpAngle(camera.rotation.horizontal, yaw + Math.PI, 1 - Math.exp(-CAMERA_FOLLOW * dt));
        }

        const now = performance.now();
        if (now - this.lastSent >= SEND_INTERVAL) {
            this.lastSent = now;
            const round = (value) => Math.round(value * 1000) / 1000;
            this.game.network.send('driveUpdate', { carId: car.id, x: round(x), z: round(z), yaw: round(yaw), speed: round(speed), steer: round(entry.steer) });
        }
    }

    follow(entry, dt) {
        const { car, target } = entry;
        if (!target) return;
        // Carry on along the last heading between updates, then ease there.
        target.x += Math.sin(target.yaw) * entry.speed * dt;
        target.z += Math.cos(target.yaw) * entry.speed * dt;
        const t = 1 - Math.exp(-FOLLOW_RATE * dt);
        car.group.position.x += (target.x - car.group.position.x) * t;
        car.group.position.z += (target.z - car.group.position.z) * t;
        car.group.rotation.y = lerpAngle(car.group.rotation.y, target.yaw, t);
    }

    // A low hum while someone drives it, higher with speed.
    updateEngine(entry) {
        const listener = this.game.environment.audioListener;
        if (!listener) return;
        if (entry.driver && !entry.engine) {
            const context = listener.context;
            const oscillator = context.createOscillator();
            oscillator.type = 'sawtooth';
            const filter = context.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 380;
            oscillator.connect(filter);
            const sound = new THREE.PositionalAudio(listener);
            sound.setNodeSource(filter);
            sound.setRefDistance(3);
            sound.setVolume(0.12);
            sound.position.set(0, 0.6, 1.4);
            entry.car.group.add(sound);
            oscillator.start();
            entry.engine = { oscillator, filter, sound };
        } else if (!entry.driver && entry.engine) {
            const { oscillator, filter, sound } = entry.engine;
            oscillator.stop();
            oscillator.disconnect();
            filter.disconnect();
            sound.panner.disconnect();
            sound.gain.disconnect();
            sound.removeFromParent();
            entry.engine = null;
        }
        if (entry.engine) {
            const speed = Math.abs(entry.speed);
            const now = listener.context.currentTime;
            entry.engine.oscillator.frequency.setTargetAtTime(42 + speed * 5 + Math.sin(now * 23) * 1.5, now, 0.1);
            entry.engine.sound.setVolume(0.08 + Math.min(0.1, speed * 0.008));
        }
    }

    // Sitting in the Uber's driver's seat takes the wheel; losing that seat
    // (the smoke ride stood us up) hands it back.
    updateUberDriver() {
        const player = this.game.players.localPlayer;
        if (!player) return;
        const atWheel = player.seat === this.uberDriverSeat;
        if (atWheel && !this.driving && !this.uberAsked) {
            this.uberAsked = true;
            this.request(this.uber);
        } else if (!atWheel) {
            this.uberAsked = false;
            if (this.driving === this.uber.id) this.leave();
        }
    }

    // Everyone in the Uber stays in their seat as it moves.
    updateUberSeats() {
        const players = this.game.players.players;
        const yaw = this.uber.yaw;
        this.game.carSync.seatedSlots.forEach((id, slot) => {
            const player = id ? players.get(id) : null;
            if (!player) return;
            const local = player === this.game.players.localPlayer;
            // Ours only while seated (not mid-teleport).
            if (local && player.seat !== this.uber.getSeat(slot)) return;
            const seat = this.uber.seatPosition(slot);
            player.position.copy(seat);
            player.rotation = yaw;
            player.mesh.position.copy(seat);
            player.mesh.rotation.y = yaw;
            if (!local) {
                player.targetPosition?.copy(seat);
                player.targetRotation = yaw;
            }
        });
    }

    update(deltaTime) {
        const dt = Math.min(deltaTime, 0.1);
        const players = this.game.players.players;
        this.updateUberDriver();
        this.cars.forEach((entry, id) => {
            if (id === this.driving) this.drive(entry, dt);
            else if (entry.driver) this.follow(entry, dt);
            entry.car.animate(dt, entry.speed, entry.steer);
            this.updateEngine(entry);
            if (entry.car === this.uber) {
                this.updateUberSeats();
                return;
            }

            // The driver sits in the seat, seated, facing the road.
            const player = entry.driver ? players.get(entry.driver) : null;
            if (!player) return;
            const seat = entry.car.driverSeat();
            player.position.copy(seat);
            player.rotation = entry.car.yaw;
            player.mesh.position.copy(seat);
            player.mesh.rotation.y = entry.car.yaw;
            if (player !== this.game.players.localPlayer) {
                player.targetPosition?.copy(seat);
                player.targetRotation = entry.car.yaw;
                player.seatPose = 'sit';
                player.drivingCar = id;
            }
        });
    }
}
