import * as THREE from 'three';
import { CollisionManager } from './CollisionManager';
import { Room } from './Room';
import { Outdoors } from './Outdoors';
import {
    ROOMS,
    ROOM_HALF_WIDTH,
    ROOM_HALF_DEPTH,
    WALL_HEIGHT,
    WALL_THICKNESS,
    FRONT_DOOR,
    BAR_COUNTER_Z,
    BACK_BAR_Z
} from './RoomLayout';

export class World {
    constructor(scene) {
        this.sceneWrapper = scene;
        this.scene = scene.getScene();
        this.collisionManager = new CollisionManager();
        this.rooms = new Map();
        // Meshes the third-person camera must not pass through.
        this.cameraOccluders = [];
        this.toonGradient = this.createToonGradient();
    }

    create() {
        ROOMS.forEach(definition => {
            const room = new Room(definition, this.scene);
            this.rooms.set(room.id, room);

            const level = this.sceneWrapper.createLevelInstance();
            if (level) room.add(level);

            this.createFloor(room);
            this.createWalls(room);
            this.createBarArea(room);
        });

        // The plaza, roads and the wall around the map (RoomLayout's hub).
        this.outdoors = new Outdoors(this.scene, this.collisionManager);
        this.outdoors.create();
    }

    getRoom(roomId) {
        return this.rooms.get(roomId);
    }

    // Room whose interior contains the given world position, or null when outside.
    getRoomAt(worldPosition) {
        for (const room of this.rooms.values()) {
            if (room.containsPoint(worldPosition)) return room;
        }
        return null;
    }

    // Walks up the hierarchy to find the room an object belongs to.
    getRoomForObject(object) {
        let current = object;
        while (current) {
            if (current.userData?.roomId) return this.rooms.get(current.userData.roomId) ?? null;
            current = current.parent;
        }
        return null;
    }

    getCameraOccluders() {
        return this.cameraOccluders.filter(mesh => mesh.userData.blocksCamera !== false);
    }

    createFloor(room) {
        const floorGeometry = new THREE.PlaneGeometry(ROOM_HALF_WIDTH * 2, ROOM_HALF_DEPTH * 2, 1, 1);
        const textureLoader = new THREE.TextureLoader();
        
        const floorMaterial = new THREE.MeshToonMaterial({
            roughness: 0.8,
            metalness: 0.1,
            side: THREE.DoubleSide,
            gradientMap: this.toonGradient
        });
        
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = 0.001;
        floor.receiveShadow = true;
        floor.name = "Floor";
        
        textureLoader.load(
            "https://threejs.org/examples/textures/hardwood2_diffuse.jpg",
            (texture) => {
                texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
                texture.repeat.set(8, 6);
                texture.generateMipmaps = true;
                texture.minFilter = THREE.LinearMipmapLinearFilter;
                texture.magFilter = THREE.LinearFilter;
                texture.needsUpdate = true;
                floorMaterial.map = texture;
                floorMaterial.needsUpdate = true;
            }
        );
        
        room.add(floor);
    }

    createWalls(room) {
        const wallMaterial = new THREE.MeshToonMaterial({
            color: 0xf0e6d2,
            roughness: 0.7,
            gradientMap: this.toonGradient
        });

        const addWall = (width, height, depth, x, y, z) => {
            const wall = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), wallMaterial);
            wall.position.set(x, y, z);
            wall.castShadow = true;
            wall.receiveShadow = true;
            room.add(wall);
            this.collisionManager.addCollider(wall);
            this.cameraOccluders.push(wall);
            return wall;
        };

        const fullWidth = ROOM_HALF_WIDTH * 2;
        const halfHeight = WALL_HEIGHT / 2;

        // Pared trasera
        addWall(fullWidth, WALL_HEIGHT, WALL_THICKNESS, 0, halfHeight, -ROOM_HALF_DEPTH);

        // Paredes laterales
        addWall(WALL_THICKNESS, WALL_HEIGHT, ROOM_HALF_DEPTH * 2, -ROOM_HALF_WIDTH, halfHeight, 0);
        addWall(WALL_THICKNESS, WALL_HEIGHT, ROOM_HALF_DEPTH * 2, ROOM_HALF_WIDTH, halfHeight, 0);

        // Front wall, split around the entrance: left piece, right piece, lintel.
        const doorLeft = FRONT_DOOR.x - FRONT_DOOR.width / 2;
        const doorRight = FRONT_DOOR.x + FRONT_DOOR.width / 2;
        const leftWidth = doorLeft + ROOM_HALF_WIDTH;
        const rightWidth = ROOM_HALF_WIDTH - doorRight;
        const lintelHeight = WALL_HEIGHT - FRONT_DOOR.height;

        addWall(leftWidth, WALL_HEIGHT, WALL_THICKNESS, -ROOM_HALF_WIDTH + leftWidth / 2, halfHeight, ROOM_HALF_DEPTH);
        addWall(rightWidth, WALL_HEIGHT, WALL_THICKNESS, ROOM_HALF_WIDTH - rightWidth / 2, halfHeight, ROOM_HALF_DEPTH);
        addWall(FRONT_DOOR.width, lintelHeight, WALL_THICKNESS, FRONT_DOOR.x, FRONT_DOOR.height + lintelHeight / 2, ROOM_HALF_DEPTH);
    }

    createBarArea(room) {
        const barMaterial = new THREE.MeshToonMaterial({
            color: 0x8b4513,
            roughness: 0.6,
            metalness: 0.1,
            gradientMap: this.toonGradient
        });

        // Barra principal
        const barGeometry = new THREE.BoxGeometry(12, 1.2, 2);
        const bar = new THREE.Mesh(barGeometry, barMaterial);
        bar.position.set(0, 0.7, BAR_COUNTER_Z);
        bar.castShadow = true;
        bar.receiveShadow = true;
        room.add(bar);
        // You can jump onto the counter and walk on it, like the tables.
        this.collisionManager.addBoxPlatform(bar);

        // Estantería trasera
        const backBarGeometry = new THREE.BoxGeometry(12, 3, 0.5);
        // Darker wood than the counter.
        const backBarMaterial = new THREE.MeshToonMaterial({ color: 0x4a3219, gradientMap: this.toonGradient });
        const backBar = new THREE.Mesh(backBarGeometry, backBarMaterial);
        backBar.position.set(0, 1.5, BACK_BAR_Z);
        backBar.castShadow = true;
        backBar.receiveShadow = true;
        room.add(backBar);
        this.collisionManager.addCollider(backBar);
    }

    createToonGradient() {
        const gradientMap = new THREE.DataTexture(
            new Uint8Array([0, 97, 162, 236, 255]),
            5, 1,
            THREE.LuminanceFormat,
            THREE.UnsignedByteType,
            THREE.UVMapping,
            THREE.ClampToEdgeWrapping,
            THREE.ClampToEdgeWrapping,
            THREE.NearestFilter,
            THREE.NearestFilter
        );
        gradientMap.needsUpdate = true;
        return gradientMap;
    }

    // Colliders are static and measured once (CollisionManager), so there's
    // nothing to refresh per frame.
    update(deltaTime) {
        this.outdoors?.update(deltaTime);
    }

    checkCollision(position, radius) {
        return this.collisionManager.checkCollision(position, radius);
    }

    getGroundHeight(position, radius) {
        return this.collisionManager.getGroundHeight(position, radius);
    }
}
