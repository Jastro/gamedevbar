import * as THREE from 'three';
import {
    PLAZA_CENTER, PLAZA_RADIUS, RING_ROAD, WORLD_RADIUS, SLOT_COUNT, RADIAL_ROAD_WIDTH,
    slotAngle, bearing
} from './RoomLayout';

// Everything outside the bars (world coordinates, see RoomLayout's hub): the
// round paved plaza in the middle, a small road between each pair of bar
// slots out to the ring road, grass in between, and a low wall around the
// map. Nothing here blocks except that wall (CollisionManager.setBoundary).
const WALL_HEIGHT = 1.2;
const DASH = { length: 2, width: 0.2, gap: 2 };

// Where the small roads leave the plaza: between slot k and slot k + 1.
export function roadAngle(index) {
    return slotAngle(index) + Math.PI / SLOT_COUNT;
}

// A world point at `distance` from the plaza's center along bearing `angle`,
// shifted `side` units sideways (positive: to the right looking outward).
export function hubPoint(angle, distance, side = 0) {
    const out = bearing(angle);
    // Right of "outward" when seen from above: (-out.z, out.x).
    return new THREE.Vector3(
        PLAZA_CENTER.x + out.x * distance - out.z * side,
        0,
        PLAZA_CENTER.z + out.z * distance + out.x * side
    );
}

export class Outdoors {
    constructor(scene, collisionManager) {
        this.scene = scene;
        this.collisionManager = collisionManager;
        this.group = new THREE.Group();
        this.group.name = 'Outdoors';
    }

    create() {
        this.createGround();
        this.createPlaza();
        this.createRoads();
        this.createWall();
        this.scene.add(this.group);
        this.group.updateMatrixWorld(true);
        // Inside the wall's thickness, so nobody pokes through it.
        this.collisionManager.setBoundary(PLAZA_CENTER.x, PLAZA_CENTER.z, WORLD_RADIUS - 0.6);
    }

    // A flat disc or ring on the ground, just above the grass.
    flat(geometry, color, y, roughness = 0.9) {
        geometry.rotateX(-Math.PI / 2);
        const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness }));
        mesh.position.set(PLAZA_CENTER.x, y, PLAZA_CENTER.z);
        mesh.receiveShadow = true;
        this.group.add(mesh);
        return mesh;
    }

    createGround() {
        // Grass far past the wall, so the edge of the world never shows.
        this.flat(new THREE.CircleGeometry(WORLD_RADIUS + 120, 64), 0x3d5634, -0.03, 1);
    }

    createPlaza() {
        this.flat(new THREE.CircleGeometry(PLAZA_RADIUS, 96), 0x9a948a, -0.015);
        // A darker curb along its edge and a ring in the middle.
        this.flat(new THREE.RingGeometry(PLAZA_RADIUS - 0.7, PLAZA_RADIUS, 96), 0x6d675f, -0.012);
        this.flat(new THREE.RingGeometry(4, 4.8, 48), 0x7d776d, -0.012);
        this.flat(new THREE.CircleGeometry(1.2, 32), 0x7d776d, -0.012);
    }

    createRoads() {
        const asphalt = 0x2b2b30;
        // The ring road and its dashed middle line.
        this.flat(new THREE.RingGeometry(RING_ROAD.inner, RING_ROAD.outer, 160), asphalt, -0.02);
        const middle = (RING_ROAD.inner + RING_ROAD.outer) / 2;
        const count = Math.floor((2 * Math.PI * middle) / (DASH.length + DASH.gap));
        const dashGeometry = new THREE.PlaneGeometry(DASH.length, DASH.width).rotateX(-Math.PI / 2);
        const dashes = new THREE.InstancedMesh(dashGeometry, new THREE.MeshBasicMaterial({ color: 0xd8c25a }), count);
        const matrix = new THREE.Matrix4();
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const at = hubPoint(angle, middle);
            // Along the road: perpendicular to the bearing.
            matrix.makeRotationY(angle).setPosition(at.x, -0.005, at.z);
            dashes.setMatrixAt(i, matrix);
        }
        this.group.add(dashes);

        // A small road out from the plaza between each pair of slots.
        const start = PLAZA_RADIUS - 0.5;
        const length = RING_ROAD.inner + 0.5 - start;
        const material = new THREE.MeshStandardMaterial({ color: asphalt, roughness: 0.9 });
        for (let i = 0; i < SLOT_COUNT; i++) {
            const angle = roadAngle(i);
            const road = new THREE.Mesh(new THREE.PlaneGeometry(RADIAL_ROAD_WIDTH, length).rotateX(-Math.PI / 2), material);
            const at = hubPoint(angle, start + length / 2);
            road.position.set(at.x, -0.018, at.z);
            road.rotation.y = angle; // its length (local z) along the bearing
            road.receiveShadow = true;
            this.group.add(road);
        }
    }

    createWall() {
        const wall = new THREE.Mesh(
            new THREE.CylinderGeometry(WORLD_RADIUS, WORLD_RADIUS, WALL_HEIGHT, 160, 1, true),
            new THREE.MeshStandardMaterial({ color: 0x8a7f72, roughness: 0.9, side: THREE.DoubleSide })
        );
        wall.position.set(PLAZA_CENTER.x, WALL_HEIGHT / 2, PLAZA_CENTER.z);
        wall.raycast = () => {};
        this.group.add(wall);
        // A flat cap on top.
        this.flat(new THREE.RingGeometry(WORLD_RADIUS - 0.3, WORLD_RADIUS + 0.3, 160), 0x6f665b, WALL_HEIGHT);
    }

    // Lamp posts: one beside each small road, a bit out from the plaza.
    getLampSpots() {
        return Array.from({ length: SLOT_COUNT }, (_, i) => hubPoint(roadAngle(i), PLAZA_RADIUS + 8, RADIAL_ROAD_WIDTH / 2 + 1));
    }
}
