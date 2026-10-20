import * as THREE from 'three';
import { STREET, ROOM_HALF_WIDTH, ROOM_HALF_DEPTH } from './RoomLayout';

const FENCE_HEIGHT = 1.2;
const FENCE_THICKNESS = 0.3;
const SIDEWALK_WIDTH = 2;

// Outdoor area between the bars: ground, sidewalks and low fences that close
// the street wherever there is no facade, so players can't walk into the void.
export class Street {
    constructor(scene, collisionManager, rooms) {
        this.scene = scene;
        this.collisionManager = collisionManager;
        this.rooms = rooms;
        this.group = new THREE.Group();
        this.group.name = 'Street';
    }

    create() {
        this.createGround();
        this.createSidewalks();
        this.createCenterLine();
        this.createFences();
        this.scene.add(this.group);
        this.group.updateMatrixWorld(true);
        this.fences.forEach(fence => this.collisionManager.addCollider(fence));
    }

    createGround() {
        // Large enough to hide the void around the play area; sits under room floors.
        const ground = new THREE.Mesh(
            new THREE.PlaneGeometry(200, 200),
            new THREE.MeshStandardMaterial({ color: 0x2b2b30, roughness: 0.95 })
        );
        ground.rotation.x = -Math.PI / 2;
        ground.position.set((STREET.minX + STREET.maxX) / 2, -0.02, (STREET.minZ + STREET.maxZ) / 2);
        ground.receiveShadow = true;
        ground.name = 'StreetGround';
        this.group.add(ground);
    }

    createSidewalks() {
        const material = new THREE.MeshStandardMaterial({ color: 0x8a8580, roughness: 0.9 });
        const length = STREET.maxX - STREET.minX;
        const centerX = (STREET.minX + STREET.maxX) / 2;

        [STREET.minZ + SIDEWALK_WIDTH / 2, STREET.maxZ - SIDEWALK_WIDTH / 2].forEach(z => {
            const sidewalk = new THREE.Mesh(new THREE.PlaneGeometry(length, SIDEWALK_WIDTH), material);
            sidewalk.rotation.x = -Math.PI / 2;
            sidewalk.position.set(centerX, 0.01, z);
            sidewalk.receiveShadow = true;
            this.group.add(sidewalk);
        });
    }

    createCenterLine() {
        const material = new THREE.MeshBasicMaterial({ color: 0xd8c25a });
        const z = (STREET.minZ + STREET.maxZ) / 2;
        for (let x = STREET.minX + 1.5; x < STREET.maxX; x += 4) {
            const dash = new THREE.Mesh(new THREE.PlaneGeometry(2, 0.2), material);
            dash.rotation.x = -Math.PI / 2;
            dash.position.set(x, 0.005, z);
            this.group.add(dash);
        }
    }

    // Facade x-ranges per street edge. Assumes rooms are rotated by 0 or PI,
    // so every front wall runs along the x axis.
    getFacadeIntervals(edgeZ) {
        const intervals = [];
        this.rooms.forEach(room => {
            const frontLeft = room.toWorld(-ROOM_HALF_WIDTH, 0, ROOM_HALF_DEPTH);
            const frontRight = room.toWorld(ROOM_HALF_WIDTH, 0, ROOM_HALF_DEPTH);
            if (Math.abs(frontLeft.z - edgeZ) < 0.5) {
                intervals.push([Math.min(frontLeft.x, frontRight.x), Math.max(frontLeft.x, frontRight.x)]);
            }
        });
        return intervals.sort((a, b) => a[0] - b[0]);
    }

    // Parts of [STREET.minX, STREET.maxX] not covered by a facade.
    getOpenIntervals(edgeZ) {
        const open = [];
        let cursor = STREET.minX;
        this.getFacadeIntervals(edgeZ).forEach(([start, end]) => {
            if (start > cursor) open.push([cursor, Math.min(start, STREET.maxX)]);
            cursor = Math.max(cursor, end);
        });
        if (cursor < STREET.maxX) open.push([cursor, STREET.maxX]);
        return open;
    }

    createFences() {
        const material = new THREE.MeshStandardMaterial({ color: 0x7a4a3a, roughness: 0.8 });
        this.fences = [];

        const addFence = (width, depth, x, z) => {
            const fence = new THREE.Mesh(new THREE.BoxGeometry(width, FENCE_HEIGHT, depth), material);
            fence.position.set(x, FENCE_HEIGHT / 2, z);
            fence.castShadow = true;
            fence.receiveShadow = true;
            this.group.add(fence);
            this.fences.push(fence);
        };

        [STREET.minZ, STREET.maxZ].forEach(edgeZ => {
            this.getOpenIntervals(edgeZ).forEach(([start, end]) => {
                addFence(end - start, FENCE_THICKNESS, (start + end) / 2, edgeZ);
            });
        });

        // Street ends.
        const depth = STREET.maxZ - STREET.minZ;
        const centerZ = (STREET.minZ + STREET.maxZ) / 2;
        addFence(FENCE_THICKNESS, depth, STREET.minX, centerZ);
        addFence(FENCE_THICKNESS, depth, STREET.maxX, centerZ);
    }
}
