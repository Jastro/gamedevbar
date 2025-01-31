import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

export class SoccerGame {
    constructor(scene, world) {
        this.scene = scene;
        this.world = world;
        this.stadium = null;
        this.ball = null;
        this.players = new Map();
        this.isActive = false;
        this.originalPlayerPositions = new Map();
        this.lastUpdateTime = 0;
        this.updateInterval = 50;

        // Física de la pelota ajustada para ser más divertida
        this.ballPhysics = {
            velocity: new THREE.Vector3(),
            gravity: -15, // Gravedad más rápida para mejor respuesta
            friction: 0.98, // Más fricción para mejor control
            bounceForce: 0.65, // Rebote más divertido
            maxSpeed: 20, // Velocidad máxima aumentada para más dinamismo
            kickForce: 8, // Más fuerza de patada base
            minVelocity: 0.05, // Se detiene más rápido cuando va lento
            airResistance: 0.995 // Menos resistencia del aire para movimientos más fluidos
        };

        // Colisiones
        this.playerColliders = new Map();
        this.ballRadius = 0.2;
        this.playerRadius = 1.2; // Radio aumentado para colisiones más fáciles
    }

    async init() {
        const loader = new GLTFLoader();
        try {
            const gltf = await loader.loadAsync('/assets/models/estadio_furbo.glb');
            this.stadium = gltf.scene;
            
            // Configurar el estadio
            this.stadium.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    // Optimizar geometrías
                    if (child.geometry) {
                        child.geometry.computeBoundingBox();
                        child.geometry.computeBoundingSphere();
                    }
                }
            });

            // Posicionar el estadio
            this.stadium.position.set(0, 0, -50);
            this.stadium.visible = false;
            this.scene.add(this.stadium);

            // Crear pelota con física
            const ballGeometry = new THREE.SphereGeometry(0.2, 32, 32);
            const ballMaterial = new THREE.MeshPhongMaterial({ 
                color: 0xffffff,
                roughness: 0.4,
                metalness: 0.5
            });
            this.ball = new THREE.Mesh(ballGeometry, ballMaterial);
            this.ball.castShadow = true;
            this.ball.visible = false;
            this.scene.add(this.ball);

            // Añadir colisionador esférico para la pelota
            this.ballRadius = 0.2;

            // Escuchar actualizaciones de red
            if (window.game?.network) {
                window.game.network.on('soccerBallUpdate', (data) => {
                    if (!this.isActive) return;
                    // Solo actualizar si no somos el último que envió la actualización
                    if (Date.now() - this.lastUpdateTime > this.updateInterval) {
                        this.ball.position.copy(new THREE.Vector3().fromArray(data.position));
                        this.ballPhysics.velocity.copy(new THREE.Vector3().fromArray(data.velocity));
                    }
                });
            }

        } catch (error) {
            console.error('Error loading soccer stadium:', error);
        }
    }

    startGame(players) {
        if (!this.stadium) return;
        
        this.isActive = true;
        this.stadium.visible = true;
        this.ball.visible = true;

        // Reiniciar física de la pelota con un pequeño impulso inicial
        const initialVelocity = new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            3,
            (Math.random() - 0.5) * 2
        );
        
        this.ballPhysics.velocity.copy(initialVelocity);

        // Guardar posiciones originales y teleportar jugadores
        players.forEach((player, id) => {
            this.originalPlayerPositions.set(id, {
                position: player.position.clone(),
                rotation: player.rotation
            });

            // Posicionar jugadores en el campo
            const randomX = (Math.random() - 0.5) * 10;
            const randomZ = (Math.random() - 0.5) * 10;
            player.position.set(randomX, 0, -50 + randomZ);
            this.players.set(id, player);

            // Crear colisionador para el jugador
            const collider = new THREE.Sphere(player.mesh.position, this.playerRadius);
            this.playerColliders.set(id, collider);
        });

        // Posicionar pelota en el centro
        this.ball.position.set(0, 0.2, -50);
    }

    endGame() {
        if (!this.isActive) return;

        this.isActive = false;
        this.stadium.visible = false;
        this.ball.visible = false;

        // Restaurar posiciones originales
        this.players.forEach((player, id) => {
            const originalPos = this.originalPlayerPositions.get(id);
            if (originalPos) {
                player.position.copy(originalPos.position);
                player.rotation = originalPos.rotation;
            }
        });

        this.players.clear();
        this.playerColliders.clear();
        this.originalPlayerPositions.clear();
    }

    checkPlayerCollisions() {
        this.players.forEach((player, id) => {
            const collider = this.playerColliders.get(id);
            if (!collider) return;
            
            collider.center.copy(player.mesh.position);
            const ballPos = this.ball.position;
            const distance = collider.center.distanceTo(ballPos);
            const collisionThreshold = collider.radius + this.ballRadius;
            
            if (distance < collisionThreshold) {
                const normal = new THREE.Vector3()
                    .subVectors(ballPos, collider.center)
                    .normalize();

                // Fuerza base más consistente
                const relativeVelocity = this.ballPhysics.velocity.length();
                const baseForce = 5; // Aumentado para mejor respuesta
                this.ballPhysics.velocity.copy(normal)
                    .multiplyScalar(Math.max(relativeVelocity, baseForce) * this.ballPhysics.bounceForce);

                // Más fuerza al golpear cuando el jugador se mueve
                if (player.isMoving) {
                    const playerDirection = new THREE.Vector3(
                        Math.sin(player.rotation),
                        0,
                        Math.cos(player.rotation)
                    );
                    
                    const kickForce = this.ballPhysics.kickForce * 1.5;
                    this.ballPhysics.velocity.add(
                        playerDirection.multiplyScalar(kickForce)
                    );
                    // Elevación más consistente
                    this.ballPhysics.velocity.y += Math.min(5, kickForce * 0.4);
                } else {
                    // Añadir un poco de elevación incluso cuando no se mueve
                    this.ballPhysics.velocity.y += 2;
                }

                // Mover la pelota fuera de la colisión
                this.ball.position.copy(collider.center)
                    .add(normal.multiplyScalar(collisionThreshold * 1.1)); // Un poco más de separación

                this.syncBallState();
            }
        });
    }

    syncBallState() {
        if (!window.game?.network || Date.now() - this.lastUpdateTime < this.updateInterval) return;
        
        window.game.network.send('soccerBallUpdate', {
            position: [this.ball.position.x, this.ball.position.y, this.ball.position.z],
            velocity: [this.ballPhysics.velocity.x, this.ballPhysics.velocity.y, this.ballPhysics.velocity.z]
        });
        
        this.lastUpdateTime = Date.now();
    }

    update(deltaTime) {
        if (!this.isActive || !this.ball) return;

        // Aplicar gravedad con resistencia del aire
        this.ballPhysics.velocity.y += this.ballPhysics.gravity * deltaTime;
        
        // Aplicar resistencia del aire (afecta más cuando la pelota está en el aire)
        if (this.ball.position.y > this.ballRadius) {
            this.ballPhysics.velocity.multiplyScalar(Math.pow(this.ballPhysics.airResistance, deltaTime * 60));
        }

        // Aplicar fricción solo cuando está cerca del suelo
        if (this.ball.position.y <= this.ballRadius + 0.1) {
            this.ballPhysics.velocity.x *= Math.pow(this.ballPhysics.friction, deltaTime * 60);
            this.ballPhysics.velocity.z *= Math.pow(this.ballPhysics.friction, deltaTime * 60);
        }

        // Detener la pelota si la velocidad es muy baja
        if (this.ballPhysics.velocity.length() < this.ballPhysics.minVelocity) {
            this.ballPhysics.velocity.set(0, 0, 0);
        }

        // Limitar velocidad máxima con un poco de margen para movimientos explosivos
        const speed = this.ballPhysics.velocity.length();
        if (speed > this.ballPhysics.maxSpeed * 1.2) {
            this.ballPhysics.velocity.multiplyScalar(this.ballPhysics.maxSpeed * 1.2 / speed);
        }

        // Actualizar posición
        const movement = this.ballPhysics.velocity.clone().multiplyScalar(deltaTime);
        this.ball.position.add(movement);

        // Hacer rodar la pelota
        if (speed > 0.1 && this.ball.position.y <= this.ballRadius + 0.1) {
            const axis = new THREE.Vector3(-movement.z, 0, movement.x).normalize();
            const angle = speed * deltaTime * 3;
            this.ball.rotateOnAxis(axis, angle);
        }

        // Rebote con el suelo
        if (this.ball.position.y < this.ballRadius) {
            this.ball.position.y = this.ballRadius;
            if (Math.abs(this.ballPhysics.velocity.y) > 0.1) {
                this.ballPhysics.velocity.y = -this.ballPhysics.velocity.y * this.ballPhysics.bounceForce;
                // Reducir velocidad horizontal en el impacto basado en la fuerza del impacto
                const impactForce = Math.abs(this.ballPhysics.velocity.y) / 10;
                this.ballPhysics.velocity.x *= (1 - impactForce);
                this.ballPhysics.velocity.z *= (1 - impactForce);
                this.syncBallState();
            } else {
                this.ballPhysics.velocity.y = 0;
            }
        }

        // Límites del campo
        const fieldLimits = {
            x: 15,
            z: 25
        };

        // Rebote con los límites del campo
        if (Math.abs(this.ball.position.x) > fieldLimits.x) {
            this.ball.position.x = Math.sign(this.ball.position.x) * fieldLimits.x;
            this.ballPhysics.velocity.x = -this.ballPhysics.velocity.x * this.ballPhysics.bounceForce;
            this.syncBallState();
        }

        if (Math.abs(this.ball.position.z + 50) > fieldLimits.z) {
            this.ball.position.z = -50 + Math.sign(this.ball.position.z + 50) * fieldLimits.z;
            this.ballPhysics.velocity.z = -this.ballPhysics.velocity.z * this.ballPhysics.bounceForce;
            this.syncBallState();
        }

        // Comprobar colisiones con jugadores
        this.checkPlayerCollisions();
    }
} 