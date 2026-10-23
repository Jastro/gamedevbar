import * as THREE from 'three';

const TABLE_RADIUS = 0.8;
// Chair seats are at 0.5 (stools at 0.9): the sitting avatar sits lower.
const CHAIR_SIT_HEIGHT = 1.0;

// Round tables you can jump onto (platform colliders) with four chairs each
// (seats facing the table, no colliders).
export class Furniture {
    constructor(scene, collisionManager) {
        this.scene = scene;
        this.collisionManager = collisionManager;
        this.seats = new Map();
        this.highlightMaterial = new THREE.MeshStandardMaterial({ color: 0x7fff7f, emissive: 0x2f2f2f });
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

    // y: the floor it stands on (the gallery, the terrace). Returns the chairs.
    createTableSet(x, z, y = 0, chairCount = 4) {
        // Crear mesa
        const tableGroup = new THREE.Group();
        tableGroup.position.set(x, y, z);
        const tableGeometry = new THREE.CylinderGeometry(TABLE_RADIUS, TABLE_RADIUS, 0.05, 16);
        const tableMaterial = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
        const table = new THREE.Mesh(tableGeometry, tableMaterial);
        table.position.y = 1;
        tableGroup.add(table);

        // Pata de la mesa
        const legGeometry = new THREE.CylinderGeometry(0.1, 0.1, 1, 8);
        const leg = new THREE.Mesh(legGeometry, tableMaterial);
        leg.position.y = 0.5;
        tableGroup.add(leg);
        this.scene.add(tableGroup);
        this.collisionManager?.addPlatform(tableGroup, TABLE_RADIUS);

        // Crear sillas alrededor
        const chairPositions = [
            // The seat faces local +z (backrest at -z): each angle points it at the table.
            { x: 1, z: 0, angle: -Math.PI / 2 },
            { x: -1, z: 0, angle: Math.PI / 2 },
            { x: 0, z: 1, angle: Math.PI },
            { x: 0, z: -1, angle: 0 }
        ];

        return chairPositions.slice(0, chairCount).map(pos => this.createChair(x + pos.x, z + pos.z, pos.angle, { x, z }, y));
    }

    createChair(x, z, angle, tableCenter, y = 0) {
        const chairGroup = new THREE.Group();

        // Asiento
        const seatGeometry = new THREE.BoxGeometry(0.5, 0.1, 0.5);
        const chairMaterial = new THREE.MeshStandardMaterial({ color: 0x4a4a4a });
        const seat = new THREE.Mesh(seatGeometry, chairMaterial);
        seat.position.y = 0.5;
        chairGroup.add(seat);

        // Respaldo
        const backGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.1);
        const back = new THREE.Mesh(backGeometry, chairMaterial);
        back.position.set(0, 0.75, -0.2);
        chairGroup.add(back);

        // Patas
        const legGeometry = new THREE.BoxGeometry(0.05, 0.5, 0.05);
        const legPositions = [
            { x: 0.2, z: 0.2 },
            { x: -0.2, z: 0.2 },
            { x: 0.2, z: -0.2 },
            { x: -0.2, z: -0.2 }
        ];

        legPositions.forEach(pos => {
            const leg = new THREE.Mesh(legGeometry, chairMaterial);
            leg.position.set(pos.x, 0.25, pos.z);
            chairGroup.add(leg);
        });

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

        this.scene.add(chairGroup);
        this.seats.set(chairGroup.id, chairGroup);
        return chairGroup;
    }
}