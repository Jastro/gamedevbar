import { Player } from './Player';
import { Vector3 } from 'three';

export class RemotePlayer extends Player {
    constructor(id, initialPosition, game) {
        super(id, initialPosition, game);
        this.targetPosition = initialPosition.clone();
        this.lastUpdateTime = Date.now();
    }

    updatePosition(position) {
        if (!Array.isArray(position)) return;
        // console.log('Updating remote player position:', position);
        this.targetPosition.set(position[0], position[1], position[2]);
        this.lastUpdateTime = Date.now();
        
        // Calcular si está en movimiento basado en la distancia
        const distance = this.position.distanceTo(this.targetPosition);
        this.isMoving = distance > 0.01;
    }

    updateRotation(rotation) {
        this.rotation = rotation;
        this.mesh.rotation.y = rotation;
    }

    update(deltaTime) {
        if (this.animations.mixer) {
            this.animations.mixer.update(deltaTime);
        }

        // Interpolación suave
        const lerpFactor = 0.1;
        if (this.position.distanceTo(this.targetPosition) > 0.01) {
            this.position.lerp(this.targetPosition, lerpFactor);
            this.isMoving = true;
        } else {
            this.isMoving = false;
        }

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