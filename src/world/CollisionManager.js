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
// Boxes are tested in their own frame (rooms around the plaza are rotated
// by any angle, and a rotated wall's world-aligned box would cover half
// the bar): the player's position goes into the collider's local space and
// is checked against its local bounds. Heights use the world box (things
// only ever rotate about the vertical).
// The whole map is a disc: `setBoundary` keeps everyone inside its wall.

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
        this.boundary = null; // { x, z, radius }
    }

    // Nobody walks past this circle (world xz).
    setBoundary(x, z, radius) {
        this.boundary = { x, z, radius };
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
                mesh.updateWorldMatrix(true, true);
                box.setFromObject(mesh);
                measureLocal(collider);
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
        const edge = this.boundary;
        if (edge && Math.hypot(position.x - edge.x, position.z - edge.z) + radius > edge.radius) return true;
        for (const collider of this.colliders) {
            if (!collider.enabled) continue;
            collider.ensureMeasured();
            if (collider.type === 'platform') {
                if (feet >= collider.top - STEP_TOLERANCE) continue;
                if (collider.shape === 'box') {
                    if (overlapsXZ(position, radius, collider)) return true;
                } else if (centerDistance(position, collider) < collider.radius + radius) {
                    return true;
                }
            } else if (collider.box.min.y < head && overlapsXZ(position, radius, collider)) {
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
                ? overlapsXZ(position, PLATFORM_EDGE, collider)
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

const scratchPoint = new THREE.Vector3();
const scratchMatrix = new THREE.Matrix4();
const scratchBox = new THREE.Box3();

// The collider's bounds in its own frame (all its meshes), the way back
// into that frame, and its scale along x and z (to scale the footprint).
function measureLocal(collider) {
    const { mesh } = collider;
    const inverse = mesh.matrixWorld.clone().invert();
    const local = new THREE.Box3();
    mesh.traverse(child => {
        if (!child.isMesh || !child.geometry) return;
        if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
        scratchMatrix.multiplyMatrices(inverse, child.matrixWorld);
        local.union(scratchBox.copy(child.geometry.boundingBox).applyMatrix4(scratchMatrix));
    });
    const elements = mesh.matrixWorld.elements;
    collider.local = local;
    collider.inverse = inverse;
    collider.scaleX = Math.hypot(elements[0], elements[1], elements[2]) || 1;
    collider.scaleZ = Math.hypot(elements[8], elements[9], elements[10]) || 1;
}

// The player's square footprint (turned with the collider) against its
// bounds, in the collider's frame, ignoring height.
function overlapsXZ(position, radius, collider) {
    const { local } = collider;
    if (!local || local.isEmpty()) return false;
    const point = scratchPoint.copy(position).applyMatrix4(collider.inverse);
    const rx = radius / collider.scaleX;
    const rz = radius / collider.scaleZ;
    return point.x + rx > local.min.x && point.x - rx < local.max.x
        && point.z + rz > local.min.z && point.z - rz < local.max.z;
}

// Horizontal distance from the player's center to a platform's center
// (tables are round: the player is treated as a circle against them).
function centerDistance(position, platform) {
    return Math.hypot(position.x - platform.center.x, position.z - platform.center.z);
}
