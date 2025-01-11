// src/rendering/Camera.js
import * as THREE from 'three';

export class Camera {
    constructor() {
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

        this.camera.position.copy(targetPosition).add(cameraOffset);
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