// src/rendering/Camera.js
import * as THREE from 'three';

// A page loaded hidden or zero-sized (background tab, collapsed iframe)
// reports 0x0, and 0/0 would leave the camera with a NaN aspect: a black
// scene, and NaN positions anywhere the aspect is used.
function safeAspect(aspect) {
    return Number.isFinite(aspect) && aspect > 0 ? aspect : 16 / 9;
}

const DEFAULT_DISTANCE = 5;
const DEFAULT_VERTICAL = Math.PI / 6;
const MAX_PAN = 3; // world units the view can be shifted with middle-drag
const KEY_ROTATE_SPEED = 2.2; // rad/s while Q or E is held
// A right press that moves less than this (px) is a click (emoji menu), not
// a rotation drag.
const RIGHT_CLICK_TOLERANCE = 5;
const WORLD_UP = new THREE.Vector3(0, 1, 0);

export class Camera {
    constructor(scene) {
        this.scene = scene;
        this.camera = new THREE.PerspectiveCamera(
            75,
            safeAspect(window.innerWidth / window.innerHeight),
            0.1,
            1000
        );
        
        this.rotation = {
            horizontal: 0,
            vertical: DEFAULT_VERTICAL
        };
        // Yaw R resets to (set per room on entry, see Game.start).
        this.defaultHorizontal = 0;
        // Middle-drag shift of the view, in camera right/up units.
        this.pan = new THREE.Vector2();
        this.isPanning = false;

        this.distance = DEFAULT_DISTANCE;
        this.minDistance = 2;
        this.maxDistance = 8;
        this.isRightMouseDown = false;
        this.previousMouseX = 0;
        this.previousMouseY = 0;
        // Q / E held (rotate the view left / right).
        this.rotateKeys = { q: false, e: false };
        // Set by Game: right click (no drag) on the 3D view.
        this.onRightClick = null;

        this.init();
        this.setupEventListeners();
    }

    init() {
        this.camera.position.set(0, 5, 10);
    }

    setupEventListeners() {
        // Right button rotates, middle button (wheel click) pans.
        window.addEventListener("mousedown", (e) => {
            if (e.button === 2) {
                this.isRightMouseDown = true;
                this.previousMouseX = e.clientX;
                this.previousMouseY = e.clientY;
                this.rightPress = { x: e.clientX, y: e.clientY, onScene: this.isOverScene(e), dragged: false };
            }
            if (e.button === 1 && this.isOverScene(e)) {
                e.preventDefault(); // no browser autoscroll
                this.isPanning = true;
                this.previousMouseX = e.clientX;
                this.previousMouseY = e.clientY;
            }
        });

        window.addEventListener("mouseup", (e) => {
            if (e.button === 2) {
                this.isRightMouseDown = false;
                const press = this.rightPress;
                this.rightPress = null;
                if (press?.onScene && !press.dragged) this.onRightClick?.(e);
            }
            if (e.button === 1) {
                this.isPanning = false;
            }
        });

        window.addEventListener("mousemove", (e) => {
            if (this.isPanning) {
                // Drag the scene with the cursor; scaled so it feels the same at any zoom.
                const scale = (this.view ? 1.5 : this.distance) * 0.002;
                this.pan.x -= (e.clientX - this.previousMouseX) * scale;
                this.pan.y += (e.clientY - this.previousMouseY) * scale;
                this.pan.clampLength(0, MAX_PAN);
                this.previousMouseX = e.clientX;
                this.previousMouseY = e.clientY;
                return;
            }
            if (this.rightPress && !this.rightPress.dragged) {
                const moved = Math.hypot(e.clientX - this.rightPress.x, e.clientY - this.rightPress.y);
                if (moved < RIGHT_CLICK_TOLERANCE) return;
                this.rightPress.dragged = true;
            }
            if (this.isRightMouseDown && !this.view) {
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
            // Only over the 3D view (not panels, chat or the ROM list), and
            // never while the camera is locked on an arcade screen.
            if (this.view || !this.isOverScene(e)) return;
            const zoomSpeed = 0.001;
            this.distance += e.deltaY * zoomSpeed * this.distance;
            this.distance = Math.max(this.minDistance, Math.min(this.maxDistance, this.distance));
        });

        window.addEventListener("contextmenu", (e) => {
            e.preventDefault();
        });

        window.addEventListener('keydown', (e) => this.setRotateKey(e, true));
        window.addEventListener('keyup', (e) => this.setRotateKey(e, false));
        // A key released in another window never reaches us.
        window.addEventListener('blur', () => {
            this.rotateKeys.q = false;
            this.rotateKeys.e = false;
        });
    }

    setRotateKey(event, isDown) {
        const key = event.key.toLowerCase();
        if (key !== 'q' && key !== 'e') return;
        // Typing in the chat or a panel field isn't camera control.
        if (isDown && ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target?.tagName)) return;
        this.rotateKeys[key] = isDown;
    }

    // Q/E rotation, per second. Off while typing or locked on a screen.
    update(deltaTime, inputBlocked) {
        if (this.view || inputBlocked) return;
        const direction = (this.rotateKeys.q ? 1 : 0) - (this.rotateKeys.e ? 1 : 0);
        this.rotation.horizontal += direction * KEY_ROTATE_SPEED * Math.min(deltaTime, 0.1);
    }

    // The WebGL canvas is the 3D view; anything else (UI) is not.
    isOverScene(event) {
        return event.target?.id === 'webgl-layer';
    }

    // Locked view (e.g. framing an arcade screen) that replaces the follow
    // camera until clearView(). Pan still applies; zoom and rotation don't.
    setView(position, lookAt) {
        const isNew = !this.view;
        this.view = { position: position.clone(), lookAt: lookAt.clone() };
        if (isNew) this.pan.set(0, 0);
    }

    clearView() {
        this.view = null;
        this.pan.set(0, 0);
    }

    // R: back to the default framing (and, outside a locked view, default
    // zoom and angle behind the player).
    reset() {
        this.pan.set(0, 0);
        if (this.view) return;
        this.distance = DEFAULT_DISTANCE;
        this.rotation.vertical = DEFAULT_VERTICAL;
        this.rotation.horizontal = this.defaultHorizontal;
    }

    // Places the camera at `position` looking at `target`, both shifted by
    // the pan along the camera's right/up axes.
    placeCamera(position, target) {
        if (this.pan.lengthSq() > 0) {
            const forward = new THREE.Vector3().subVectors(target, position).normalize();
            const right = new THREE.Vector3().crossVectors(forward, WORLD_UP).normalize();
            const up = new THREE.Vector3().crossVectors(right, forward);
            const offset = right.multiplyScalar(this.pan.x).add(up.multiplyScalar(this.pan.y));
            position = position.clone().add(offset);
            target = target.clone().add(offset);
        }
        this.camera.position.copy(position);
        this.camera.lookAt(target);
    }

    updatePosition(targetPosition) {
        if (this.view) {
            this.placeCamera(this.view.position, this.view.lookAt);
            return;
        }

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

        // Walls (and closed doors) live inside room groups, so they come from
        // the world instead of scanning direct scene children.
        const walls = this.getOccluders ? this.getOccluders() : [];

        const intersects = raycaster.intersectObjects(walls, false);

        let cameraPosition = targetCameraPos;
        if (intersects.length > 0) {
            // Si hay una colisión, colocar la cámara justo antes del punto de colisión
            const collision = intersects[0];
            if (collision.distance < cameraOffset.length()) {
                const adjustedDistance = collision.distance * 0.9; // 90% de la distancia a la pared
                const adjustedOffset = cameraOffset.normalize().multiplyScalar(adjustedDistance);
                cameraPosition = new THREE.Vector3().copy(targetPosition).add(adjustedOffset);
            }
        }

        this.placeCamera(cameraPosition, targetPosition);
    }

    setOccluderProvider(getOccluders) {
        this.getOccluders = getOccluders;
    }

    getCamera() {
        return this.camera;
    }

    updateAspect(aspect) {
        this.camera.aspect = safeAspect(aspect);
        this.camera.updateProjectionMatrix();
    }
}