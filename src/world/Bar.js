import * as THREE from 'three';
import { BAR_COUNTER_Z, BACK_BAR_Z } from './RoomLayout';

// What sits on and behind the bar: shelves with bottles, glasses on the
// counter, the sign. The counter and the back shelf themselves are World's.

export class Bar {
    constructor(scene, signText = 'Gamedev MV') {
        this.scene = scene;
        this.signText = signText;
    }

    create() {
        this.createMainBar();
        this.createBackBar();
        this.createGlassesAndBottles();
    }

    createMainBar() {
        this.createBarSign();
    }

    createBarSign() {
        // On the back wall, above the paintings (they span y 4..6), and bigger
        // since it's seen from across the room.
        const signGeometry = new THREE.BoxGeometry(4.2, 1.05, 0.1);
        const signMaterial = new THREE.MeshStandardMaterial({
            color: 0xff8c00,
        });
        const sign = new THREE.Mesh(signGeometry, signMaterial);
        sign.position.set(0, 7, -9.8);
        this.scene.add(sign);

        // Texto del cartel
        const canvas = document.createElement("canvas");
        canvas.width = 256;
        canvas.height = 64;
        const context = canvas.getContext("2d");
        context.fillStyle = "#FFFFFF";
        context.font = "bold 32px Arial";
        // Shrink longer names (e.g. "Desarrollo MV") so they fit the sign.
        const textWidth = context.measureText(this.signText).width;
        if (textWidth > 240) {
            context.font = `bold ${Math.floor(32 * 240 / textWidth)}px Arial`;
        }
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(this.signText, 128, 32);

        const texture = new THREE.CanvasTexture(canvas);
        const textMaterial = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
        });
        const textGeometry = new THREE.PlaneGeometry(3.8, 0.84);
        const textMesh = new THREE.Mesh(textGeometry, textMaterial);
        textMesh.position.set(0, 7, -9.74);
        this.scene.add(textMesh);
    }

    createBackBar() {
        // Estantes, in front of the back shelf
        const estantesAlturas = [1.5, 2.0, 2.5];
        estantesAlturas.forEach((altura) => {
            const shelfGeometry = new THREE.BoxGeometry(11.5, 0.1, 0.8);
            const shelfMaterial = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
            const shelf = new THREE.Mesh(shelfGeometry, shelfMaterial);
            shelf.position.set(0, altura, BACK_BAR_Z + 0.2);
            shelf.castShadow = true;
            this.scene.add(shelf);
        });
    }

    createGlassesAndBottles() {
        const bottleGroup = new THREE.Group();
        bottleGroup.name = 'BottlesAndGlasses';

        const colors = [0x4caf50, 0x2196f3, 0xf44336, 0xffeb3b];

        // Crear botellas
        for (let i = -5; i <= 5; i += 1) {
            // Primera fila de botellas
            const bottle1 = this.createBottle(colors[Math.floor(Math.random() * colors.length)]);
            bottle1.position.set(i, 1.8, BACK_BAR_Z + 0.3);
            bottleGroup.add(bottle1);

            // Segunda fila de botellas
            const bottle2 = this.createBottle(colors[Math.floor(Math.random() * colors.length)]);
            bottle2.position.set(i * 0.8, 2.3, BACK_BAR_Z + 0.3);
            bottleGroup.add(bottle2);
        }

        // Crear vasos
        for (let i = -5; i <= 5; i += 1) {
            const glass = this.createGlass();
            glass.position.set(i * 0.8, 1.4, BAR_COUNTER_Z + 0.5);
            bottleGroup.add(glass);
        }

        this.scene.add(bottleGroup);
    }

    createBottle(color) {
        const bottleGroup = new THREE.Group();

        const bodyGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.6, 8);
        // One material per color, shared: the shelf merges into a few meshes
        // (mergeStatic in Environment).
        this.bottleMaterials ??= new Map();
        if (!this.bottleMaterials.has(color)) {
            this.bottleMaterials.set(color, new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.8 }));
        }
        const bodyMaterial = this.bottleMaterials.get(color);
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        bottleGroup.add(body);

        const neckGeometry = new THREE.CylinderGeometry(0.05, 0.1, 0.2, 8);
        const neck = new THREE.Mesh(neckGeometry, bodyMaterial);
        neck.position.y = 0.4;
        bottleGroup.add(neck);

        return bottleGroup;
    }

    createGlass() {
        const glassGeometry = new THREE.CylinderGeometry(0.1, 0.07, 0.2, 8);
        this.glassMaterial ??= new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 });
        return new THREE.Mesh(glassGeometry, this.glassMaterial);
    }
}
