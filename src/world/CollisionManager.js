import * as THREE from 'three';

export class CollisionManager {
    constructor() {
        this.colliders = [];
    }

    addCollider(mesh, type = 'box') {
        const box = new THREE.Box3();
        box.setFromObject(mesh);
        this.colliders.push({
            mesh,
            box,
            type,
            update: () => {
                box.setFromObject(mesh);
            }
        });
    }

    checkCollision(position, radius = 0.5) {
        const playerBox = new THREE.Box3();
        const playerPosition = new THREE.Vector3(position.x, position.y, position.z);
        playerBox.setFromCenterAndSize(
            playerPosition,
            new THREE.Vector3(radius * 2, 2, radius * 2)
        );

        for (const collider of this.colliders) {
            collider.update();
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