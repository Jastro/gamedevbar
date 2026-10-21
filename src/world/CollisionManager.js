import * as THREE from 'three';

// What the player can't walk through. Two kinds:
// - blockers (walls, bar, fences, cabinets, doors): block at any height, so
//   jumping can't carry you over one and drop you inside it;
// - platforms (tables): round, with a top you can jump onto and stand on;
//   they block only while your feet are below that top.
// Everything is static (doors toggle `enabled` instead of moving their
// blocker), so each shape is measured once, on the first check, when the
// room groups are in place.

// Feet within this of a platform top count as standing on it.
const STEP_TOLERANCE = 0.05;
// Falling feet are caught by a platform top this far above them.
const LANDING_SNAP = 0.15;

export class CollisionManager {
    constructor() {
        this.colliders = [];
    }

    addCollider(mesh, type = 'box') {
        const box = new THREE.Box3();
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

    // A round table: `object` is measured for its center and top; `radius`
    // is the top's radius.
    addPlatform(object, radius) {
        const collider = this.addCollider(object, 'platform');
        collider.radius = radius;
        const measure = collider.update;
        collider.update = () => {
            measure();
            collider.center = collider.box.getCenter(new THREE.Vector3());
            collider.top = collider.box.max.y;
        };
        return collider;
    }

    // position: the player's center (feet at y - 1). radius: half its width.
    checkCollision(position, radius = 0.5) {
        const feet = position.y - 1;
        for (const collider of this.colliders) {
            if (!collider.enabled) continue;
            collider.ensureMeasured();
            if (collider.type === 'platform') {
                if (feet >= collider.top - STEP_TOLERANCE) continue;
                if (overlapsCircle(position, radius, collider)) return true;
            } else if (overlapsBoxXZ(position, radius, collider.box)) {
                return true;
            }
        }
        return false;
    }

    // Height of what the feet rest on (0 = floor): the highest platform top
    // under the player that the feet are at or above (within LANDING_SNAP).
    getGroundHeight(position, radius = 0.5) {
        const feet = position.y - 1;
        let ground = 0;
        for (const collider of this.colliders) {
            if (collider.type !== 'platform' || !collider.enabled) continue;
            collider.ensureMeasured();
            if (collider.top > feet + LANDING_SNAP || collider.top <= ground) continue;
            if (overlapsCircle(position, radius, collider)) ground = collider.top;
        }
        return ground;
    }

    update() {
        for (const collider of this.colliders) {
            collider.update();
        }
    }
}

// The player's square footprint against a box, ignoring height.
function overlapsBoxXZ(position, radius, box) {
    return position.x + radius > box.min.x && position.x - radius < box.max.x
        && position.z + radius > box.min.z && position.z - radius < box.max.z;
}

// The player's square footprint against a platform's circle.
function overlapsCircle(position, radius, platform) {
    const nearestX = Math.max(position.x - radius, Math.min(platform.center.x, position.x + radius));
    const nearestZ = Math.max(position.z - radius, Math.min(platform.center.z, position.z + radius));
    return Math.hypot(nearestX - platform.center.x, nearestZ - platform.center.z) < platform.radius;
}
