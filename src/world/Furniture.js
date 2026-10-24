import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils';

const TABLE_RADIUS = 0.8;
// Chair seats are at 0.5 (stools at 0.9): the sitting avatar sits lower.
const CHAIR_SIT_HEIGHT = 1.0;

// Round tables you can jump onto (platform colliders) with four chairs each
// (seats facing the table, no colliders). Each table and each chair is one
// mesh (merged parts, shared geometry and material): a bar has ~40 of them,
// drawn twice (the outline pass).
let tableGeometry = null;
let chairGeometry = null;

function getTableGeometry() {
    tableGeometry ??= mergeGeometries([
        new THREE.CylinderGeometry(TABLE_RADIUS, TABLE_RADIUS, 0.05, 16).translate(0, 1, 0),
        new THREE.CylinderGeometry(0.1, 0.1, 1, 8).translate(0, 0.5, 0)
    ]);
    return tableGeometry;
}

function getChairGeometry() {
    chairGeometry ??= mergeGeometries([
        new THREE.BoxGeometry(0.5, 0.1, 0.5).translate(0, 0.5, 0),   // seat
        new THREE.BoxGeometry(0.5, 0.5, 0.1).translate(0, 0.75, -0.2), // backrest
        ...[[0.2, 0.2], [-0.2, 0.2], [0.2, -0.2], [-0.2, -0.2]]
            .map(([x, z]) => new THREE.BoxGeometry(0.05, 0.5, 0.05).translate(x, 0.25, z))
    ]);
    return chairGeometry;
}

export class Furniture {
    constructor(scene, collisionManager) {
        this.scene = scene;
        this.collisionManager = collisionManager;
        this.seats = new Map();
        this.highlightMaterial = new THREE.MeshStandardMaterial({ color: 0x7fff7f, emissive: 0x2f2f2f });
        this.tableMaterial = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
        this.chairMaterial = new THREE.MeshStandardMaterial({ color: 0x4a4a4a });
    }

    create() {
        const tablePositions = [
            { x: -5, z: 2 },
            { x: 0, z: 2 },
            { x: 5, z: 2 },
        ];

        tablePositions.forEach(pos => {
            this.createTableSet(pos.x, pos.z);
        });
    }

    // y: the floor it stands on (the gallery, the terrace); parent: what it
    // hangs from (the room, or the terrace's group, room-local all the same).
    // Returns the chairs.
    createTableSet(x, z, y = 0, chairCount = 4, parent = this.scene) {
        const tableGroup = new THREE.Group();
        tableGroup.position.set(x, y, z);
        tableGroup.add(new THREE.Mesh(getTableGeometry(), this.tableMaterial));
        parent.add(tableGroup);
        this.collisionManager?.addPlatform(tableGroup, TABLE_RADIUS);

        // Crear sillas alrededor
        const chairPositions = [
            // The seat faces local +z (backrest at -z): each angle points it at the table.
            { x: 1, z: 0, angle: -Math.PI / 2 },
            { x: -1, z: 0, angle: Math.PI / 2 },
            { x: 0, z: 1, angle: Math.PI },
            { x: 0, z: -1, angle: 0 }
        ];

        return chairPositions.slice(0, chairCount).map(pos => this.createChair(x + pos.x, z + pos.z, pos.angle, { x, z }, y, parent));
    }

    createChair(x, z, angle, tableCenter, y = 0, parent = this.scene) {
        const chairGroup = new THREE.Group();
        const chairMaterial = this.chairMaterial;
        chairGroup.add(new THREE.Mesh(getChairGeometry(), chairMaterial));

        chairGroup.position.set(x, y, z);
        chairGroup.rotation.y = angle;

        // Hover highlight is per mesh (InteractionSystem.setHighlight).
        chairGroup.traverse(child => {
            if (!child.isMesh) return;
            child.userData.originalMaterial = chairMaterial;
            child.userData.highlightMaterial = this.highlightMaterial;
        });
        chairGroup.userData = {
            type: "seat",
            sitHeight: CHAIR_SIT_HEIGHT,
            faceTarget: tableCenter, // room-local
        };

        parent.add(chairGroup);
        this.seats.set(chairGroup.id, chairGroup);
        return chairGroup;
    }
}