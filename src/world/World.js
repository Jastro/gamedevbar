import * as THREE from 'three';
import { CollisionManager } from './CollisionManager';
import { Room } from './Room';
import { Outdoors } from './Outdoors';
import { createRoof } from './Roof';
import { wallFinish } from './WallTextures';
import { createClosedBuilding } from './ClosedBuilding';
import { addWindows } from './Windows';
import {
    ROOMS,
    ROOM_HALF_WIDTH,
    ROOM_HALF_DEPTH,
    WALL_HEIGHT,
    WALL_THICKNESS,
    FRONT_DOOR,
    FREE_SLOTS,
    GALLERY,
    TERRACE_DOOR,
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

        // The empty slots: closed buildings, coming soon.
        FREE_SLOTS.forEach(slot => createClosedBuilding(this.scene, slot, {
            collisionManager: this.collisionManager,
            cameraOccluders: this.cameraOccluders,
            wallMaterial: this.plainWallMaterial()
        }));

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

    // The walls' plain cream: their ends and tops, and the closed buildings.
    plainWallMaterial() {
        this.plainWall ??= new THREE.MeshToonMaterial({
            color: 0xf0e6d2,
            roughness: 0.7,
            gradientMap: this.toonGradient
        });
        return this.plainWall;
    }

    // A wall finish (WallTextures) as a material, or null.
    finishMaterial(style) {
        const finish = wallFinish(style);
        if (!finish) return null;
        this.finishMaterials ??= new Map();
        if (!this.finishMaterials.has(style)) {
            this.finishMaterials.set(style, new THREE.MeshToonMaterial({ map: finish.texture, gradientMap: this.toonGradient }));
        }
        return { finish, material: this.finishMaterials.get(style) };
    }

    createWalls(room) {
        const wallMaterial = this.plainWallMaterial();
        const inside = this.finishMaterial(room.definition.interior);
        const outside = this.finishMaterial(room.definition.exterior);

        // inward: the room-local direction the wall's inner face looks.
        const addWall = (width, height, depth, x, y, z, inward) => {
            const geometry = new THREE.BoxGeometry(width, height, depth);
            const materials = mapWallFaces(geometry, { x, y, z }, inward, inside, outside, wallMaterial);
            const wall = new THREE.Mesh(geometry, materials);
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

        // Back wall, side walls.
        addWall(fullWidth, WALL_HEIGHT, WALL_THICKNESS, 0, halfHeight, -ROOM_HALF_DEPTH, { x: 0, z: 1 });
        addWall(WALL_THICKNESS, WALL_HEIGHT, ROOM_HALF_DEPTH * 2, -ROOM_HALF_WIDTH, halfHeight, 0, { x: 1, z: 0 });
        addWall(WALL_THICKNESS, WALL_HEIGHT, ROOM_HALF_DEPTH * 2, ROOM_HALF_WIDTH, halfHeight, 0, { x: -1, z: 0 });

        // Front wall, split around the entrance: left piece, right piece, lintel.
        const doorLeft = FRONT_DOOR.x - FRONT_DOOR.width / 2;
        const doorRight = FRONT_DOOR.x + FRONT_DOOR.width / 2;
        const leftWidth = doorLeft + ROOM_HALF_WIDTH;
        const rightWidth = ROOM_HALF_WIDTH - doorRight;

        const front = { x: 0, z: -1 };
        addWall(leftWidth, WALL_HEIGHT, WALL_THICKNESS, -ROOM_HALF_WIDTH + leftWidth / 2, halfHeight, ROOM_HALF_DEPTH, front);
        addWall(rightWidth, WALL_HEIGHT, WALL_THICKNESS, ROOM_HALF_WIDTH - rightWidth / 2, halfHeight, ROOM_HALF_DEPTH, front);
        // Above the entrance: the wall up to the gallery's underside (its slab
        // fills the doorway's threshold; a wall top level with the floor
        // z-fought it), the terrace doorway, and over it.
        const doorwayTop = GALLERY.top + TERRACE_DOOR.height;
        const sill = GALLERY.top - GALLERY.thickness;
        addWall(FRONT_DOOR.width, sill - FRONT_DOOR.height, WALL_THICKNESS, FRONT_DOOR.x, (FRONT_DOOR.height + sill) / 2, ROOM_HALF_DEPTH, front);
        addWall(FRONT_DOOR.width, WALL_HEIGHT - doorwayTop, WALL_THICKNESS, FRONT_DOOR.x, (doorwayTop + WALL_HEIGHT) / 2, ROOM_HALF_DEPTH, front);

        room.roof = createRoof(room, wallMaterial, outside, this.finishMaterial('plaster'));
        // Two rows of windows round the outside; on the front, either side of the door.
        addWindows(room, { lowerFront: [-10, -5, 5, 10], upperFront: [-10, -5, 5, 10] });
        this.cameraOccluders.push(...room.roof.userData.slopes);
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

// A box wall's materials per face (+x, -x, +y, -y, +z, -z): the inside finish
// on the face looking `inward`, the outside one on the opposite face, plain
// on the ends and top. The finished faces get UVs in meters (along the wall
// to the right of whoever faces it, and up from the floor), so a pattern
// keeps its size and lines up from wall to wall.
function mapWallFaces(geometry, offset, inward, inside, outside, plain) {
    const position = geometry.attributes.position;
    const normal = geometry.attributes.normal;
    const uv = geometry.attributes.uv;
    for (let i = 0; i < position.count; i++) {
        const nx = normal.getX(i);
        const nz = normal.getZ(i);
        const facing = nx * inward.x + nz * inward.z;
        const side = facing > 0.5 ? inside : facing < -0.5 ? outside : null;
        if (!side) continue;
        const x = position.getX(i) + offset.x;
        const y = position.getY(i) + offset.y;
        const z = position.getZ(i) + offset.z;
        const along = Math.abs(nz) > 0.5 ? x * Math.sign(nz) : -z * Math.sign(nx);
        uv.setXY(i, along / side.finish.width, y / side.finish.height);
    }
    return [[1, 0], [-1, 0], null, null, [0, 1], [0, -1]].map(direction => {
        if (!direction) return plain;
        const facing = direction[0] * inward.x + direction[1] * inward.z;
        if (facing > 0.5) return inside?.material ?? plain;
        if (facing < -0.5) return outside?.material ?? plain;
        return plain;
    });
}
