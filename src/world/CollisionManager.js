import * as THREE from 'three';

export class CollisionManager {
    constructor() {
        this.colliders = [];
    }

    addCollider(mesh, type = 'box') {
        const box = new THREE.Box3();
        // Every collider is static (doors toggle `enabled` instead of moving
        // their blocker), so the box is measured once, on the first check,
        // when the room groups are in place. Re-measuring every collider on
        // every check used to cost frames while walking.
        let measured = false;
        const collider = {
            mesh,
            box,
            type,
            // Doors toggle this instead of being added/removed.
            enabled: true,
            update: () => {
                mesh.updateWorldMatrix(true, false);
                box.setFromObject(mesh);
                measured = true;
            },
            ensureMeasured: () => {
                if (!measured) collider.update();
            }
        };
        this.colliders.push(collider);
        return collider;
    }

    checkCollision(position, radius = 0.5) {
        const playerBox = new THREE.Box3();
        const playerPosition = new THREE.Vector3(position.x, position.y, position.z);
        playerBox.setFromCenterAndSize(
            playerPosition,
            new THREE.Vector3(radius * 2, 2, radius * 2)
        );

        for (const collider of this.colliders) {
            if (!collider.enabled) continue;
            collider.ensureMeasured();
            if (playerBox.intersectsBox(collider.box)) {
                return true;
            }
        }
        return false;
    }

    update() {
        for (const collider of this.colliders) {
            collider.update();
        }
    }
} 