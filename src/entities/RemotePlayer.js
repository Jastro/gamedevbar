import { Player, lerpAngle } from './Player';

// Others' positions arrive ~20 times a second; ease toward the latest one
// (frame-rate independent), and jump straight there after a teleport.
const FOLLOW_RATE = 12;      // 1/s
const TELEPORT_DISTANCE = 5; // units
const MOVING_DISTANCE = 0.05;

export class RemotePlayer extends Player {
    constructor(id, initialPosition, game) {
        super(id, initialPosition, game);
        this.targetPosition = initialPosition.clone();
        this.targetRotation = 0;
        this.lastUpdateTime = Date.now();
    }

    updatePosition(position) {
        if (!Array.isArray(position)) return;
        this.targetPosition.set(position[0], position[1], position[2]);
        this.lastUpdateTime = Date.now();
        
    }

    updateRotation(rotation) {
        if (typeof rotation === 'number') this.targetRotation = rotation;
    }

    update(deltaTime) {
        if (this.animations.mixer) {
            this.animations.mixer.update(deltaTime);
        }

        const distance = this.position.distanceTo(this.targetPosition);
        const t = 1 - Math.exp(-FOLLOW_RATE * Math.min(deltaTime, 0.1));
        if (distance > TELEPORT_DISTANCE) {
            this.position.copy(this.targetPosition);
        } else {
            this.position.lerp(this.targetPosition, t);
        }
        this.rotation = lerpAngle(this.rotation, this.targetRotation, t);
        this.isMoving = distance > MOVING_DISTANCE;

        // Actualizar mesh y animaciones
        this.mesh.position.copy(this.position);
        this.mesh.rotation.y = this.rotation;

        // Actualizar animación basada en movimiento
        if (this.isMoving && this.animations.actions.get('walk')) {
            this.fadeToAction('walk');
        } else if (this.animations.actions.get('idle')) {
            this.fadeToAction('idle');
        }
    }
}