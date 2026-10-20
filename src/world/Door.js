import * as THREE from 'three';
import { FRONT_DOOR, ROOM_HALF_DEPTH, WALL_THICKNESS } from './RoomLayout';

const OPEN_ANGLE = Math.PI / 2;      // swings inward (towards local -z)
const SWING_SPEED = Math.PI;         // radians per second
export const DOOR_INTERACT_DISTANCE = 3;

// Front door of a room. Clicking it (or pressing E nearby) asks the server to
// toggle it; the server broadcasts the new state so everyone sees the same door.
export class Door {
    constructor(room, collisionManager) {
        this.room = room;
        this.collisionManager = collisionManager;
        this.id = `${room.id}:front`;
        this.isOpen = false;
        this.angle = 0;
        this.targetAngle = 0;
    }

    create() {
        const { width, height } = FRONT_DOOR;

        this.group = new THREE.Group();
        this.group.name = `Door_${this.id}`;
        this.group.position.set(FRONT_DOOR.x, 0, ROOM_HALF_DEPTH);
        this.group.userData = { type: 'door', door: this };

        this.createFrame(width, height);
        this.createPanel(width, height);
        this.createBlocker(width, height);
        this.createSign(height);

        this.room.add(this.group);
        this.group.updateMatrixWorld(true);
        this.collider = this.collisionManager.addCollider(this.blocker);
        this.applyState();
    }

    createFrame(width, height) {
        const material = new THREE.MeshStandardMaterial({ color: 0x3b2614, roughness: 0.7 });
        const postGeometry = new THREE.BoxGeometry(0.15, height, WALL_THICKNESS + 0.1);
        [-width / 2, width / 2].forEach(x => {
            const post = new THREE.Mesh(postGeometry, material);
            post.position.set(x, height / 2, 0);
            this.group.add(post);
        });
        const top = new THREE.Mesh(new THREE.BoxGeometry(width + 0.15, 0.15, WALL_THICKNESS + 0.1), material);
        top.position.set(0, height, 0);
        this.group.add(top);
    }

    createPanel(width, height) {
        // Pivot on the left jamb so the panel rotates around its hinge.
        this.pivot = new THREE.Group();
        this.pivot.position.set(-width / 2, 0, 0);
        this.group.add(this.pivot);

        const material = new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.6 });
        this.panel = new THREE.Mesh(new THREE.BoxGeometry(width - 0.05, height - 0.05, 0.08), material);
        this.panel.position.set(width / 2, height / 2, 0);
        this.panel.castShadow = true;
        this.panel.userData = {
            originalMaterial: material,
            highlightMaterial: new THREE.MeshStandardMaterial({
                color: 0x7fff7f,
                emissive: 0x2f2f2f,
            }),
            blocksCamera: true
        };
        this.pivot.add(this.panel);

        const knobMaterial = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.8, roughness: 0.3 });
        [0.07, -0.07].forEach(z => {
            const knob = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 12), knobMaterial);
            knob.position.set(width - 0.25, height * 0.4, z);
            this.pivot.add(knob);
        });
    }

    // Static, invisible box filling the doorway. Collides only while closed,
    // so the swinging panel never traps a player.
    createBlocker(width, height) {
        this.blocker = new THREE.Mesh(
            new THREE.BoxGeometry(width, height, WALL_THICKNESS + 0.1),
            new THREE.MeshBasicMaterial()
        );
        this.blocker.position.set(0, height / 2, 0);
        this.blocker.visible = false;
        this.blocker.layers.set(1); // keep it out of mouse raycasts
        this.group.add(this.blocker);
    }

    // Name sign above the entrance, on the outer face of the wall.
    createSign(height) {
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#1a1009';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#dc5a0b';
        ctx.lineWidth = 12;
        ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);
        ctx.font = 'bold 140px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = '#ff7b2c';
        ctx.shadowBlur = 30;
        ctx.fillStyle = '#ffb347';
        ctx.fillText(this.room.name.toUpperCase(), canvas.width / 2, canvas.height / 2 + 6);

        const sign = new THREE.Mesh(
            new THREE.PlaneGeometry(4, 1),
            new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas) })
        );
        sign.position.set(0, height + 0.9, WALL_THICKNESS / 2 + 0.02);
        this.group.add(sign);
    }

    setOpen(isOpen, instant = false) {
        this.isOpen = isOpen;
        this.targetAngle = isOpen ? OPEN_ANGLE : 0;
        if (instant) this.angle = this.targetAngle;
        this.applyState();
    }

    applyState() {
        if (this.collider) this.collider.enabled = !this.isOpen;
        this.panel.userData.blocksCamera = !this.isOpen;
        this.pivot.rotation.y = this.angle;
    }

    getWorldPosition() {
        return this.group.localToWorld(new THREE.Vector3(0, 0, 0));
    }

    distanceTo(worldPosition) {
        const doorPosition = this.getWorldPosition();
        return Math.hypot(worldPosition.x - doorPosition.x, worldPosition.z - doorPosition.z);
    }

    update(deltaTime) {
        if (this.angle === this.targetAngle) return;
        const step = SWING_SPEED * deltaTime;
        const delta = this.targetAngle - this.angle;
        this.angle = Math.abs(delta) <= step ? this.targetAngle : this.angle + Math.sign(delta) * step;
        this.pivot.rotation.y = this.angle;
    }
}
