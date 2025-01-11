import * as THREE from 'three';

export class Furniture {
    constructor(scene) {
        this.scene = scene;
        this.seats = new Map();
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

    createTableSet(x, z) {
        // Crear mesa
        const tableGeometry = new THREE.CylinderGeometry(0.8, 0.8, 0.05, 16);
        const tableMaterial = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
        const table = new THREE.Mesh(tableGeometry, tableMaterial);
        table.position.set(x, 1, z);
        this.scene.add(table);

        // Pata de la mesa
        const legGeometry = new THREE.CylinderGeometry(0.1, 0.1, 1, 8);
        const leg = new THREE.Mesh(legGeometry, tableMaterial);
        leg.position.set(x, 0.5, z);
        this.scene.add(leg);

        // Crear sillas alrededor
        const chairPositions = [
            { x: 1, z: 0, angle: 0 },
            { x: -1, z: 0, angle: Math.PI },
            { x: 0, z: 1, angle: -Math.PI/2 },
            { x: 0, z: -1, angle: Math.PI/2 }
        ];

        chairPositions.forEach(pos => {
            this.createChair(x + pos.x, z + pos.z, pos.angle);
        });
    }

    createChair(x, z, angle) {
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

        chairGroup.position.set(x, 0, z);
        chairGroup.rotation.y = angle;

        chairGroup.userData = {
            type: "seat",
            originalMaterial: chairMaterial,
            highlightMaterial: new THREE.MeshStandardMaterial({
                color: 0x7fff7f,
                emissive: 0x2f2f2f,
            }),
            forwardDirection: new THREE.Vector3(0, 0, -1),
        };

        this.scene.add(chairGroup);
        this.seats.set(chairGroup.id, chairGroup);
    }
}