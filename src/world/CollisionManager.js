import * as THREE from 'three';

// What the player can't walk through. Two kinds:
// - blockers (walls, bar, fences, cabinets, doors): block from their bottom
//   up, with no top, so jumping can't carry you over one and drop you inside
//   it; one entirely above your head (a door's lintel) doesn't block;
// - platforms (tables, the bar counter): a top you can jump onto and stand
//   on; they block only while your feet are below that top. Tables are
//   round (addPlatform), the counter is a box (addBoxPlatform).
// Everything is static (doors toggle `enabled` instead of moving their
// blocker), so each shape is measured once, on the first check, when the
// room groups are in place.

// Feet within this of a platform top count as standing on it.
const STEP_TOLERANCE = 0.05;
const PLAYER_HEIGHT = 2;
// Standing on a table: your center within its radius plus this.
const PLATFORM_EDGE = 0.15;
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

    // A box-shaped platform: the mesh's bounding box, top included.
    addBoxPlatform(mesh) {
        const collider = this.addCollider(mesh, 'platform');
        collider.shape = 'box';
        const measure = collider.update;
        collider.update = () => {
            measure();
            collider.top = collider.box.max.y;
        };
        return collider;
    }

    // position: the player's center (feet at y - 1). radius: half its width.
    checkCollision(position, radius = 0.5) {
        const feet = position.y - 1;
        const head = feet + PLAYER_HEIGHT;
        for (const collider of this.colliders) {
            if (!collider.enabled) continue;
            collider.ensureMeasured();
            if (collider.type === 'platform') {
                if (feet >= collider.top - STEP_TOLERANCE) continue;
                if (collider.shape === 'box') {
                    if (overlapsBoxXZ(position, radius, collider.box)) return true;
                } else if (centerDistance(position, collider) < collider.radius + radius) {
                    return true;
                }
            } else if (collider.box.min.y < head && overlapsBoxXZ(position, radius, collider.box)) {
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
            const under = collider.shape === 'box'
                ? overlapsBoxXZ(position, PLATFORM_EDGE, collider.box)
                : centerDistance(position, collider) < collider.radius + PLATFORM_EDGE;
            if (under) ground = collider.top;
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

// Horizontal distance from the player's center to a platform's center
// (tables are round: the player is treated as a circle against them).
function centerDistance(position, platform) {
    return Math.hypot(position.x - platform.center.x, position.z - platform.center.z);
}
