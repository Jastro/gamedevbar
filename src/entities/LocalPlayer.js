import { Player } from './Player';
import * as THREE from 'three';
import { Config } from '../core/Config';

export class LocalPlayer extends Player {
    constructor(id, initialPosition, game) {
        super(id, initialPosition, game);
        this.moveSpeed = Config.PLAYER_MOVE_SPEED;
        this.jumpSpeed = Config.PLAYER_JUMP_SPEED;
        this.gravity = Config.PLAYER_GRAVITY;
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
        super.update(deltaTime);
        this.handleMovement();
        this.handleJump();
        this.broadcastPosition();
    }
    sitDown(seat) {
        if (this.isSitting) return;

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
        if (seat.position.z < 0) {  // Asumiendo que los taburetes están en z < 0
            const barPosition = new THREE.Vector3(0, this.position.y, -3);
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
    handleMovement() {
        if (this.game.chatActive) return;

        if (this.game.environment.arcadePong.isPlayingGame(this.id)) {
            return;
        }
        
        if (this.isSitting && (
            this.keysPressed["w"] ||
            this.keysPressed["a"] ||
            this.keysPressed["s"] ||
            this.keysPressed["d"])) {
            this.standUp();
            return;
        }

        if (this.isSitting) return;

        // Obtener la dirección de la cámara
        const cameraDirection = new THREE.Vector3();
        this.game.camera.getCamera().getWorldDirection(cameraDirection);
        cameraDirection.y = 0;
        cameraDirection.normalize();

        // Calcular el vector derecho de la cámara
        const right = new THREE.Vector3();
        right.crossVectors(cameraDirection, new THREE.Vector3(0, 1, 0));

        const moveVector = new THREE.Vector3(0, 0, 0);

        if (this.keysPressed['w']) moveVector.add(cameraDirection);
        if (this.keysPressed['s']) moveVector.sub(cameraDirection);
        if (this.keysPressed['a']) moveVector.sub(right);
        if (this.keysPressed['d']) moveVector.add(right);

        if (moveVector.lengthSq() > 0) {
            moveVector.normalize();
            moveVector.multiplyScalar(this.moveSpeed);

            // Calcular la nueva posición
            const newPosition = this.position.clone().add(moveVector);

            // Comprobar colisiones
            if (!this.game.world.checkCollision(newPosition)) {
                this.position.copy(newPosition);
                // Rotar el personaje hacia la dirección del movimiento
                const angle = Math.atan2(moveVector.x, moveVector.z);
                this.rotation = angle;
                this.isMoving = true;
            }
        } else {
            this.isMoving = false;
        }
    }

    handleJump() {
        if (this.keysPressed[' '] && !this.isJumping) {
            this.isJumping = true;
            this.verticalSpeed = this.jumpSpeed;
        }

        if (this.isJumping) {
            this.position.y += this.verticalSpeed;
            this.verticalSpeed += this.gravity;

            if (this.position.y <= 1) {
                this.position.y = 1;
                this.isJumping = false;
                this.verticalSpeed = 0;
            }
        }
    }

    broadcastPosition() {
        if (!this.lastBroadcastPosition?.equals(this.position) ||
            this.lastBroadcastRotation !== this.rotation) {
                
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