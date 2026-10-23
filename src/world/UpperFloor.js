import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils';
import { GALLERY, ROOM_HALF_WIDTH, ROOM_HALF_DEPTH, WALL_THICKNESS } from './RoomLayout';

// Each bar's upper floor (room-local): a gallery along the front wall at
// GALLERY.top, reached by stairs along the room's width, with tables, and
// through a doorway in the front wall (above the entrance) a terrace outside
// that looks over the plaza and the fountain (the doorway is a gap World
// leaves in the front wall, TERRACE_DOOR).
// - Gallery, landing and terrace are `floor` colliders (stand on them, walk
//   under them) and camera occluders; the stairs are a `ramp`.
// - Railings block only people up there (they start at the gallery's top);
//   the stairs' handrail blocks from the floor up (no stepping off the side).
// - Everything under the gallery fits below its slab (the bathroom, the
//   clock, the who's-here board, the darts).
const INNER = { x: ROOM_HALF_WIDTH - WALL_THICKNESS / 2, z: ROOM_HALF_DEPTH - WALL_THICKNESS / 2 };
// Left of the entrance, where the floor is free: the foot by the door, rising
// toward the bathroom (-x), the landing beside the bathroom's front corner.
const STAIRS = { footX: -2.2, topX: -8.2, minZ: 4.55, maxZ: 6.45, steps: 20 };
const LANDING = { minX: -9.9, maxX: STAIRS.topX, minZ: STAIRS.minZ, maxZ: GALLERY.edgeZ };
// The terrace starts inside the wall's thickness (under the doorway).
const TERRACE = { halfWidth: 6.5, minZ: ROOM_HALF_DEPTH - 0.15, maxZ: ROOM_HALF_DEPTH + 4 };
const RAIL_HEIGHT = 1;
const POST_SPACING = 1.2;
// Clear of the landing and of the terrace doorway.
const GALLERY_TABLES = [{ x: -5.2, z: 8.2 }, { x: 4.5, z: 8.2 }, { x: 11, z: 8.2 }];
// Either side of the way out of the doorway.
const TERRACE_TABLES = [{ x: -3.6, z: 12.3 }, { x: 3.6, z: 12.3 }];

export class UpperFloor {
    constructor(room, world, furniture) {
        this.room = room;
        this.world = world;
        this.furniture = furniture;
    }

    create() {
        const group = new THREE.Group();
        group.name = 'UpperFloor';
        this.group = group;
        this.room.add(group);
        this.floorMaterial = new THREE.MeshStandardMaterial({ map: getPlankTexture(), roughness: 0.8 });
        this.woodMaterial = new THREE.MeshStandardMaterial({ color: 0x4a2f1d, roughness: 0.7 });

        this.addSlab(-INNER.x, INNER.x, GALLERY.edgeZ, INNER.z);
        this.addSlab(LANDING.minX, LANDING.maxX, LANDING.minZ, LANDING.maxZ);
        this.addStairs();
        this.addRailings();
        this.addTerrace();
        GALLERY_TABLES.forEach(({ x, z }) => this.furniture.createTableSet(x, z, GALLERY.top));
    }

    // A slab with its top at the gallery's height: standable, walk-under.
    addSlab(minX, maxX, minZ, maxZ, material = this.floorMaterial) {
        const slab = new THREE.Mesh(new THREE.BoxGeometry(maxX - minX, GALLERY.thickness, maxZ - minZ), material);
        slab.position.set((minX + maxX) / 2, GALLERY.top - GALLERY.thickness / 2, (minZ + maxZ) / 2);
        slab.castShadow = true;
        slab.receiveShadow = true;
        this.group.add(slab);
        slab.updateMatrixWorld(true);
        this.world.collisionManager.addFloor(slab);
        this.world.cameraOccluders.push(slab);
        return slab;
    }

    addStairs() {
        const { footX, topX, minZ, maxZ, steps } = STAIRS;
        const run = (topX - footX) / steps;
        const rise = GALLERY.top / steps;
        const depth = maxZ - minZ;
        // Solid treads down to the floor, merged into one mesh.
        const treads = Array.from({ length: steps }, (_, i) => {
            const height = rise * (i + 1);
            return new THREE.BoxGeometry(Math.abs(run), height, depth).translate(footX + run * (i + 0.5), height / 2, (minZ + maxZ) / 2);
        });
        const stairs = new THREE.Mesh(mergeGeometries(treads), this.floorMaterial);
        stairs.castShadow = true;
        stairs.receiveShadow = true;
        this.group.add(stairs);
        // The walkable slope (invisible). A ramp rises along its local +x,
        // so it's turned round to rise toward -x.
        const ramp = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(topX - footX), GALLERY.top, depth), new THREE.MeshBasicMaterial({ visible: false }));
        ramp.position.set((footX + topX) / 2, GALLERY.top / 2, (minZ + maxZ) / 2);
        if (topX < footX) ramp.rotation.y = Math.PI;
        ramp.raycast = () => {};
        this.group.add(ramp);
        ramp.updateMatrixWorld(true);
        this.world.collisionManager.addRamp(ramp);
    }

    // A railing from (x0, z0) to (x1, z1) at height `base` (rising to
    // `baseEnd` for the stairs): posts, a top rail and, if `blocks`, a
    // collider that stops people walking off the edge (for a sloping one,
    // from the floor up: the stairs are solid underneath anyway).
    addRail(x0, z0, x1, z1, { base = GALLERY.top, baseEnd = base, blocks = true } = {}) {
        const length = Math.hypot(x1 - x0, z1 - z0);
        const posts = Math.max(1, Math.round(length / POST_SPACING));
        const parts = [];
        for (let i = 0; i <= posts; i++) {
            const t = i / posts;
            const y = base + (baseEnd - base) * t;
            parts.push(new THREE.BoxGeometry(0.06, RAIL_HEIGHT, 0.06).translate(x0 + (x1 - x0) * t, y + RAIL_HEIGHT / 2, z0 + (z1 - z0) * t));
        }
        const rail = new THREE.BoxGeometry(length, 0.08, 0.1);
        rail.rotateZ(Math.atan2(baseEnd - base, length));
        rail.rotateY(-Math.atan2(z1 - z0, x1 - x0));
        rail.translate((x0 + x1) / 2, (base + baseEnd) / 2 + RAIL_HEIGHT, (z0 + z1) / 2);
        parts.push(rail);
        const mesh = new THREE.Mesh(mergeGeometries(parts), this.woodMaterial);
        mesh.castShadow = true;
        this.group.add(mesh);
        if (!blocks) return;
        const bottom = base === baseEnd ? base : 0;
        const height = Math.max(base, baseEnd) + RAIL_HEIGHT - bottom;
        const blocker = new THREE.Mesh(new THREE.BoxGeometry(length, height, 0.12), new THREE.MeshBasicMaterial({ visible: false }));
        blocker.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
        blocker.position.set((x0 + x1) / 2, bottom + height / 2, (z0 + z1) / 2);
        blocker.raycast = () => {};
        this.group.add(blocker);
        blocker.updateMatrixWorld(true);
        this.world.collisionManager.addCollider(blocker);
    }

    addRailings() {
        const edge = GALLERY.edgeZ;
        // The gallery's edge, open where the landing meets it.
        this.addRail(-INNER.x, edge, LANDING.minX, edge);
        this.addRail(LANDING.maxX, edge, INNER.x, edge);
        // Round the landing (its +x side is the top of the stairs).
        this.addRail(LANDING.minX, LANDING.minZ, LANDING.maxX, LANDING.minZ);
        this.addRail(LANDING.minX, LANDING.minZ, LANDING.minX, LANDING.maxZ);
        // The stairs' open side, sloping.
        this.addRail(STAIRS.footX, STAIRS.minZ, STAIRS.topX, STAIRS.minZ, { base: 0, baseEnd: GALLERY.top });
    }

    addTerrace() {
        const { halfWidth, minZ, maxZ } = TERRACE;
        const deck = this.addSlab(-halfWidth, halfWidth, minZ, maxZ);
        deck.name = 'Terrace';
        // Railings on its three open sides.
        const outer = ROOM_HALF_DEPTH + WALL_THICKNESS / 2;
        this.addRail(-halfWidth, maxZ, halfWidth, maxZ);
        this.addRail(-halfWidth, outer, -halfWidth, maxZ);
        this.addRail(halfWidth, outer, halfWidth, maxZ);
        // Tables with chairs (outside: F works from the terrace, see
        // InteractionSystem) and two potted plants.
        TERRACE_TABLES.forEach(({ x, z }) => {
            const chairs = this.furniture.createTableSet(x, z, GALLERY.top);
            chairs.forEach(chair => { chair.userData.outside = true; });
        });
        const pot = new THREE.MeshStandardMaterial({ color: 0xa0522d, roughness: 0.9 });
        const leaves = new THREE.MeshStandardMaterial({ color: 0x3f7d3a, roughness: 0.8 });
        [-1, 1].forEach(side => {
            const plant = new THREE.Group();
            const base = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.25, 0.6, 12), pot);
            base.position.y = 0.3;
            const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), leaves);
            bush.position.y = 1.0;
            plant.add(base, bush);
            plant.position.set(side * (halfWidth - 0.6), GALLERY.top, maxZ - 0.6);
            this.group.add(plant);
        });
    }
}

// Floor boards for the gallery and stairs.
let plankTexture = null;
function getPlankTexture() {
    if (plankTexture) return plankTexture;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const boards = 8;
    const width = canvas.width / boards;
    for (let i = 0; i < boards; i++) {
        const shade = 0.85 + Math.random() * 0.25;
        ctx.fillStyle = `rgb(${Math.round(120 * shade)}, ${Math.round(80 * shade)}, ${Math.round(50 * shade)})`;
        ctx.fillRect(i * width, 0, width - 2, canvas.height);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(i * width + width - 2, 0, 2, canvas.height);
    }
    plankTexture = new THREE.CanvasTexture(canvas);
    plankTexture.colorSpace = THREE.SRGBColorSpace;
    plankTexture.wrapS = plankTexture.wrapT = THREE.RepeatWrapping;
    plankTexture.repeat.set(6, 2);
    plankTexture.anisotropy = 4;
    return plankTexture;
}
