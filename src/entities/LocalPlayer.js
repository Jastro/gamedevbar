import { Player, lerpAngle } from './Player';
import * as THREE from 'three';

// Movement tuning, per second (the old per-frame values at 60 fps).
const WALK_SPEED = 3.2;           // units/s
const ACCELERATION = 12;          // 1/s: how fast the velocity reaches the input
const DECELERATION = 16;          // 1/s: how fast it stops when keys are released
const STOP_SPEED = 0.05;          // units/s below which a released player stops
const TURN_RATE = 14;             // 1/s: how fast the avatar turns to face the way it walks
const WALK_ANIMATION_SPEED = 0.4; // units/s above which the walk animation plays
const JUMP_SPEED = 10.8;          // units/s
const GRAVITY = -18;              // units/s²
const PLAYER_RADIUS = 0.4;        // half the collision box (0.5 caught on door frames)
const MAX_STEP = 0.15;            // longest collision-checked step, so nothing is skipped
// Walking straight into a door frame's edge: if a sideways shift this small
// would clear it, the player is eased toward the opening instead of stopping.
const CORNER_PROBES = [0.15, 0.3, 0.45];
const MAX_FRAME_TIME = 0.1;       // s: a stalled tab doesn't teleport the player
const BROADCAST_INTERVAL = 50;    // ms between position updates (20 per second)
const UP = new THREE.Vector3(0, 1, 0);

export class LocalPlayer extends Player {
    constructor(id, initialPosition, game) {
        super(id, initialPosition, game);
        this.velocity = new THREE.Vector3();
        this.isJumping = false;
        this.verticalSpeed = 0;
        this.keysPressed = {};

        this.setupInputHandlers();
    }

    setupInputHandlers() {
        window.addEventListener('keydown', (e) => {
            this.keysPressed[e.key.toLowerCase()] = true;
        });

        window.addEventListener('keyup', (e) => {
            this.keysPressed[e.key.toLowerCase()] = false;
        });
    }

    update(deltaTime) {
        const dt = Math.min(deltaTime, MAX_FRAME_TIME);
        this.handleMovement(dt);
        this.handleJump(dt);
        super.update(deltaTime);
        this.broadcastPosition();
    }
    sitDown(seat) {
        if (this.isSitting) return;
        // Sat down mid-stride: no walking in place on the seat.
        this.stopMoving();

        // Guardar estado anterior
        this.previousPosition = this.position.clone();
        this.previousRotation = this.rotation;

        this.isSitting = true;
        const seatPosition = new THREE.Vector3();
        seat.getWorldPosition(seatPosition);

        // Ajustar posición al sentarse
        this.position.copy(seatPosition);
        this.position.y += 1.4;

        // Calcular rotación hacia la barra si es un taburete
        // (stools sit at room-local z < 0; the counter is at room-local z = -3)
        const room = this.game.world.getRoomForObject(seat);
        if (room && seat.position.z < 0) {
            const barPosition = room.toWorld(0, this.position.y, -3);
            const direction = barPosition.sub(this.position).normalize();
            this.rotation = Math.atan2(direction.x, direction.z);
        }

        // Notificar al servidor
        this.game.network.send('userSat', {
            seatId: seat.id
        });
    }

    standUp() {
        if (!this.isSitting) return;

        // Restaurar posición anterior
        if (this.previousPosition) {
            this.position.copy(this.previousPosition);
            this.rotation = this.previousRotation;
        }

        this.game.network.send('userStood', {});
        this.isSitting = false;
    }
    // Frame-rate independent: speeds are per second. The velocity eases
    // toward the input (no instant start/stop), the avatar turns smoothly,
    // and a blocked step slides along the wall instead of stopping dead.
    handleMovement(dt) {
        const blocked = this.game.chatActive || this.game.playMode
            || this.game.environment.isPlayingArcade(this.id);
        if (blocked) {
            this.stopMoving();
            return;
        }

        const input = this.getInputDirection();
        if (this.isSitting) {
            if (input) this.standUp();
            return;
        }

        const target = input ? input.clone().multiplyScalar(WALK_SPEED) : new THREE.Vector3();
        const rate = input ? ACCELERATION : DECELERATION;
        this.velocity.lerp(target, 1 - Math.exp(-rate * dt));
        if (!input && this.velocity.lengthSq() < STOP_SPEED * STOP_SPEED) this.velocity.set(0, 0, 0);

        const step = this.velocity.clone().multiplyScalar(dt);
        const substeps = Math.max(1, Math.ceil(step.length() / MAX_STEP));
        step.divideScalar(substeps);
        for (let i = 0; i < substeps; i++) this.moveWithSlide(step);

        if (input) this.rotation = lerpAngle(this.rotation, Math.atan2(input.x, input.z), 1 - Math.exp(-TURN_RATE * dt));
        this.isMoving = this.velocity.length() > WALK_ANIMATION_SPEED;
    }

    // Unit vector on the ground from WASD relative to the camera, or null.
    getInputDirection() {
        const keys = this.keysPressed;
        if (!keys.w && !keys.a && !keys.s && !keys.d) return null;

        const forward = new THREE.Vector3();
        this.game.camera.getCamera().getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();
        const right = new THREE.Vector3().crossVectors(forward, UP);

        const direction = new THREE.Vector3();
        if (keys.w) direction.add(forward);
        if (keys.s) direction.sub(forward);
        if (keys.a) direction.sub(right);
        if (keys.d) direction.add(right);
        return direction.lengthSq() > 0 ? direction.normalize() : null;
    }

    // Tries the whole step, then each axis on its own (sliding along walls),
    // then a sideways nudge around a corner (door frames). A blocked axis
    // loses its velocity.
    moveWithSlide(step) {
        if (this.tryMove(step.x, step.z)) return;
        const movedX = step.x !== 0 && this.tryMove(step.x, 0);
        const movedZ = step.z !== 0 && this.tryMove(0, step.z);
        if (movedX || movedZ) {
            if (!movedX) this.velocity.x = 0;
            if (!movedZ) this.velocity.z = 0;
            return;
        }
        if (this.nudgeAroundCorner(step)) return;
        this.velocity.x = 0;
        this.velocity.z = 0;
    }

    tryMove(dx, dz) {
        const candidate = new THREE.Vector3(this.position.x + dx, this.position.y, this.position.z + dz);
        if (!this.canStandAt(candidate)) return false;
        this.position.copy(candidate);
        return true;
    }

    // Fully blocked: look a little to each side (nearest first); if the step
    // would be free from there, slide that way by one step's length.
    nudgeAroundCorner(step) {
        const length = Math.hypot(step.x, step.z);
        if (length === 0) return false;
        const sideX = -step.z / length;
        const sideZ = step.x / length;
        for (const probe of CORNER_PROBES) {
            for (const sign of [1, -1]) {
                const ahead = new THREE.Vector3(
                    this.position.x + sideX * sign * probe + step.x,
                    this.position.y,
                    this.position.z + sideZ * sign * probe + step.z
                );
                if (this.canStandAt(ahead) && this.tryMove(sideX * sign * length, sideZ * sign * length)) return true;
            }
        }
        return false;
    }

    // Free, or already overlapping something (e.g. a door closed on us):
    // then any move is allowed so the player can walk out of it.
    canStandAt(position) {
        const world = this.game.world;
        return !world.checkCollision(position, PLAYER_RADIUS) || world.checkCollision(this.position, PLAYER_RADIUS);
    }

    stopMoving() {
        this.velocity.set(0, 0, 0);
        this.isMoving = false;
    }

    handleJump(dt) {
        if (this.keysPressed[' '] && !this.isJumping && !this.game.chatActive && !this.game.playMode) {
            this.isJumping = true;
            this.verticalSpeed = JUMP_SPEED;
        }

        if (this.isJumping) {
            this.position.y += this.verticalSpeed * dt;
            this.verticalSpeed += GRAVITY * dt;

            if (this.position.y <= 1) {
                this.position.y = 1;
                this.isJumping = false;
                this.verticalSpeed = 0;
            }
        }
    }

    // At most BROADCAST_INTERVAL apart; others interpolate in between.
    broadcastPosition() {
        const now = performance.now();
        if (now - (this.lastBroadcastTime ?? 0) < BROADCAST_INTERVAL) return;
        if (!this.lastBroadcastPosition?.equals(this.position) ||
            this.lastBroadcastRotation !== this.rotation) {
            this.lastBroadcastTime = now;

            this.game.network.send('userMoved', {
                type: 'userMoved',
                position: [this.position.x, this.position.y, this.position.z],
                rotation: this.rotation
            });
    
            this.lastBroadcastPosition = this.position.clone();
            this.lastBroadcastRotation = this.rotation;
        }
    }
}