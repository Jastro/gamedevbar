// src/rendering/Camera.js
import * as THREE from 'three';

export class Camera {
    constructor(scene) {
        this.scene = scene;
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        
        this.rotation = {
            horizontal: 0,
            vertical: Math.PI / 6
        };
        
        this.distance = 5;
        this.minDistance = 2;
        this.maxDistance = 8;
        this.isRightMouseDown = false;
        this.previousMouseX = 0;
        this.previousMouseY = 0;

        this.init();
        this.setupEventListeners();
    }

    init() {
        this.camera.position.set(0, 5, 10);
    }

    setupEventListeners() {
        // Control de la cámara con el botón derecho
        window.addEventListener("mousedown", (e) => {
            if (e.button === 2) {
                this.isRightMouseDown = true;
                this.previousMouseX = e.clientX;
                this.previousMouseY = e.clientY;
            }
        });

        window.addEventListener("mouseup", (e) => {
            if (e.button === 2) {
                this.isRightMouseDown = false;
            }
        });

        window.addEventListener("mousemove", (e) => {
            if (this.isRightMouseDown) {
                const deltaX = e.clientX - this.previousMouseX;
                const deltaY = e.clientY - this.previousMouseY;

                this.rotation.horizontal -= deltaX * 0.005;
                this.rotation.vertical += deltaY * 0.005;

                this.rotation.vertical = Math.max(0.1, Math.min(Math.PI / 2, this.rotation.vertical));

                this.previousMouseX = e.clientX;
                this.previousMouseY = e.clientY;
            }
        });

        window.addEventListener("wheel", (e) => {
            const zoomSpeed = 0.001;
            this.distance += e.deltaY * zoomSpeed * this.distance;
            this.distance = Math.max(this.minDistance, Math.min(this.maxDistance, this.distance));
        });

        window.addEventListener("contextmenu", (e) => {
            e.preventDefault();
        });
    }

    updatePosition(targetPosition) {
        const distance = this.distance;
        const height = distance * Math.sin(this.rotation.vertical);
        const radius = distance * Math.cos(this.rotation.vertical);

        const cameraOffset = new THREE.Vector3(
            radius * Math.sin(this.rotation.horizontal),
            height,
            radius * Math.cos(this.rotation.horizontal)
        );

        // Posición deseada de la cámara
        const targetCameraPos = new THREE.Vector3().copy(targetPosition).add(cameraOffset);

        // Crear un raycaster desde el personaje hacia la posición deseada de la cámara
        const raycaster = new THREE.Raycaster();
        raycaster.set(
            targetPosition,
            cameraOffset.clone().normalize()
        );

        // Lista de objetos a comprobar para colisiones (paredes)
        const walls = this.scene.children.filter(obj =>
            obj.isMesh &&
            (obj.geometry instanceof THREE.BoxGeometry) &&
            obj.position.y >= 2 // Asumiendo que las paredes están en y >= 2
        );

        const intersects = raycaster.intersectObjects(walls);

        if (intersects.length > 0) {
            // Si hay una colisión, colocar la cámara justo antes del punto de colisión
            const collision = intersects[0];
            if (collision.distance < cameraOffset.length()) {
                const adjustedDistance = collision.distance * 0.9; // 90% de la distancia a la pared
                const adjustedOffset = cameraOffset.normalize().multiplyScalar(adjustedDistance);
                this.camera.position.copy(targetPosition).add(adjustedOffset);
            } else {
                this.camera.position.copy(targetCameraPos);
            }
        } else {
            this.camera.position.copy(targetCameraPos);
        }

        this.camera.lookAt(targetPosition);
    }

    getCamera() {
        return this.camera;
    }

    updateAspect(aspect) {
        this.camera.aspect = aspect;
        this.camera.updateProjectionMatrix();
    }
}