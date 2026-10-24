import { Player, lerpAngle } from './Player';
import * as THREE from 'three';
import { BAR_COUNTER_Z } from '../world/RoomLayout';

// Movement tuning, per second (the old per-frame values at 60 fps).
const WALK_SPEED = 3.7;           // units/s
const RUN_SPEED = 6.5;            // units/s with Shift held
const ACCELERATION = 12;          // 1/s: how fast the velocity reaches the input
const DECELERATION = 16;          // 1/s: how fast it stops when keys are released
const STOP_SPEED = 0.05;          // units/s below which a released player stops
const TURN_RATE = 14;             // 1/s: how fast the avatar turns to face the way it walks
const WALK_ANIMATION_SPEED = 0.4; // units/s above which the walk animation plays
// About 1.5 high and 0.6 s in the air (tables, 1.0 high, stay reachable).
const JUMP_SPEED = 10;            // units/s
const GRAVITY = -33;              // units/s²
const STANDING_HEIGHT = 1;        // position.y above the ground (the collision box is 2 tall)
const SEAT_HEIGHT = 1.55;         // position.y above a seat's origin (bar stools)
const PLAYER_RADIUS = 0.4;        // half the collision box (0.5 caught on door frames)
const MAX_STEP = 0.15;            // longest collision-checked step, so nothing is skipped
const STEP_DOWN = 0.35;           // walking down stairs keeps you on them (no tiny falls)
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

        // Ajustar posición al sentarse (chairs are lower than stools)
        this.position.copy(seatPosition);
        this.position.y += seat.userData.sitHeight ?? SEAT_HEIGHT;
        this.isJumping = false;
        this.verticalSpeed = 0;

        // Face the table (chairs), a fixed way (car seats), or the bar for
        // stools (stools sit at room-local z < 0, in front of the counter)
        const room = this.game.world.getRoomForObject(seat);
        const faceTarget = seat.userData.faceTarget;
        if (seat.userData.faceYaw !== undefined) {
            this.rotation = seat.userData.faceYaw;
        } else if (room && faceTarget) {
            const target = room.toWorld(faceTarget.x, this.position.y, faceTarget.z);
            this.rotation = Math.atan2(target.x - this.position.x, target.z - this.position.z);
        } else if (room && room.toLocal(seatPosition).z < 0) {
            // Stools: straight at the counter (BAR_COUNTER_Z), not at its middle,
            // which turned the outer stools sideways.
            const local = room.toLocal(seatPosition);
            const barPosition = room.toWorld(local.x, this.position.y, BAR_COUNTER_Z);
            const direction = barPosition.sub(this.position).normalize();
            this.rotation = Math.atan2(direction.x, direction.z);
        }

        this.seat = seat;
        // Notificar al servidor
        // Everyone else shows us seated (or standing, at the toilet's front).
        this.game.network.send('userSat', {
            seatId: seat.userData.seatId ?? seat.id,
            pose: seat.userData.pose === 'stand' ? 'stand' : 'sit'
        });
    }

    // landAt: stand up somewhere else (the car's teleport) instead of where
    // we sat down from.
    standUp(landAt = null) {
        if (!this.isSitting) return;

        // Restaurar posición anterior
        if (landAt) {
            this.position.copy(landAt);
        } else if (this.previousPosition) {
            this.position.copy(this.previousPosition);
            this.rotation = this.previousRotation;
        }

        const seat = this.seat;
        this.seat = null;
        this.game.network.send('userStood', {});
        this.isSitting = false;
        seat?.userData.onStand?.(this);
    }
    // Frame-rate independent: speeds are per second. The velocity eases
    // toward the input (no instant start/stop), the avatar turns smoothly,
    // and a blocked step slides along the wall instead of stopping dead.
    handleMovement(dt) {
        // Arrested (GuillotineSync moves us): no input, walking only while
        // the policeman takes us along.
        const guillotine = this.game.guillotine;
        if (guillotine?.arrested) {
            this.velocity.set(0, 0, 0);
            this.isMoving = guillotine.escortMoving;
            return;
        }
        const blocked = this.game.chatActive || this.game.playMode
            || this.game.environment.isPlayingArcade(this.id);
        if (blocked) {
            this.stopMoving();
            return;
        }

        const input = this.getInputDirection();
        // Walking off cuts a gesture short (for everyone).
        if (input && this.gesture) this.game.gestureSync?.stop();
        if (this.isSitting) {
            if (input) this.standUp();
            return;
        }

        const speed = this.keysPressed.shift ? RUN_SPEED : WALK_SPEED;
        const target = input ? input.clone().multiplyScalar(speed) : new THREE.Vector3();
        const rate = input ? ACCELERATION : DECELERATION;
        this.velocity.lerp(target, 1 - Math.exp(-rate * dt));
        if (!input && this.velocity.lengthSq() < STOP_SPEED * STOP_SPEED) this.velocity.set(0, 0, 0);

        const step = this.velocity.clone().multiplyScalar(dt);
        const substeps = Math.max(1, Math.ceil(step.length() / MAX_STEP));
        step.divideScalar(substeps);
        for (let i = 0; i < substeps; i++) {
            this.moveWithSlide(step);
            this.climb();
        }

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
        if (direction.lengthSq() === 0) return null;
        // Drunk: the walk weaves from side to side.
        const drunk = this.game.drinkSync?.effect ?? 0;
        if (drunk > 0) {
            const t = performance.now() / 1000;
            direction.applyAxisAngle(UP, (Math.sin(t * 1.3) + 0.5 * Math.sin(t * 3.1)) * 0.45 * drunk);
        }
        return direction.normalize();
    }

    // Up the stairs as we go: each substep lifts us onto the ground ahead,
    // so a long frame doesn't sink us into the ramp (handleJump does the rest).
    climb() {
        if (this.isJumping) return;
        const ground = this.game.world.getGroundHeight(this.position, PLAYER_RADIUS);
        if (ground > this.position.y - STANDING_HEIGHT) this.position.y = ground + STANDING_HEIGHT;
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

    // Jumping, falling off a table and landing on one. The ground is the
    // floor or the top of a platform (CollisionManager.getGroundHeight).
    handleJump(dt) {
        if (this.isSitting || this.game.playMode || this.game.guillotine?.arrested) return;
        const world = this.game.world;
        const ground = world.getGroundHeight(this.position, PLAYER_RADIUS);
        const feet = this.position.y - STANDING_HEIGHT;
        const onGround = !this.isJumping && feet <= ground + 0.001;

        if (onGround && this.keysPressed[' '] && !this.game.chatActive) {
            this.isJumping = true;
            this.verticalSpeed = JUMP_SPEED;
        } else if (onGround || (!this.isJumping && feet - ground < STEP_DOWN)) {
            this.position.y = ground + STANDING_HEIGHT;
            return;
        }

        // In the air: jumped, or walked off a table.
        this.isJumping = true;
        this.verticalSpeed += GRAVITY * dt;
        const nextFeet = feet + this.verticalSpeed * dt;
        // Landing: the ground under us now, caught even if a fast fall would
        // pass the table top within one frame.
        if (this.verticalSpeed <= 0 && nextFeet <= ground) {
            this.position.y = ground + STANDING_HEIGHT;
            this.isJumping = false;
            this.verticalSpeed = 0;
        } else {
            this.position.y = nextFeet + STANDING_HEIGHT;
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