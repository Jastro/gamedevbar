import * as THREE from 'three';

export class Bar {
    constructor(scene) {
        this.scene = scene;
    }

    create() {
        this.createMainBar();
        this.createBackBar();
        this.createGlassesAndBottles();
    }

    createMainBar() {
        const barGeometry = new THREE.BoxGeometry(12, 1.2, 2);
        const barMaterial = new THREE.MeshStandardMaterial({
            color: 0x8b4513,
            roughness: 0.6,
        });
        const bar = new THREE.Mesh(barGeometry, barMaterial);
        bar.position.set(0, 0.7, -3);
        bar.castShadow = true;
        bar.receiveShadow = true;
        this.scene.add(bar);

        this.createBarSign();
    }

    createBarSign() {
        const signGeometry = new THREE.BoxGeometry(2, 0.5, 0.1);
        const signMaterial = new THREE.MeshStandardMaterial({
            color: 0xff8c00,
        });
        const sign = new THREE.Mesh(signGeometry, signMaterial);
        sign.position.set(0, 1.5, -2.2);
        this.scene.add(sign);

        // Texto del cartel
        const canvas = document.createElement("canvas");
        canvas.width = 256;
        canvas.height = 64;
        const context = canvas.getContext("2d");
        context.fillStyle = "#FFFFFF";
        context.font = "bold 32px Arial";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText("Gamedev MV", 128, 32);

        const texture = new THREE.CanvasTexture(canvas);
        const textMaterial = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
        });
        const textGeometry = new THREE.PlaneGeometry(1.8, 0.4);
        const textMesh = new THREE.Mesh(textGeometry, textMaterial);
        textMesh.position.set(0, 1.5, -2.14);
        this.scene.add(textMesh);
    }

    createBackBar() {
        const backBarGeometry = new THREE.BoxGeometry(12, 3, 0.5);
        const backBarMaterial = new THREE.MeshStandardMaterial({
            color: 0x4a3219,
            roughness: 0.7,
        });
        const backBar = new THREE.Mesh(backBarGeometry, backBarMaterial);
        backBar.position.set(0, 1.5, -7);
        backBar.castShadow = true;
        this.scene.add(backBar);

        // Estantes
        const estantesAlturas = [1.5, 2.0, 2.5];
        estantesAlturas.forEach((altura) => {
            const shelfGeometry = new THREE.BoxGeometry(11.5, 0.1, 0.8);
            const shelfMaterial = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
            const shelf = new THREE.Mesh(shelfGeometry, shelfMaterial);
            shelf.position.set(0, altura, -6.8);
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
            bottle1.position.set(i, 1.8, -6.7);
            bottleGroup.add(bottle1);

            // Segunda fila de botellas
            const bottle2 = this.createBottle(colors[Math.floor(Math.random() * colors.length)]);
            bottle2.position.set(i * 0.8, 2.3, -6.7);
            bottleGroup.add(bottle2);
        }

        // Crear vasos
        for (let i = -5; i <= 5; i += 1) {
            const glass = this.createGlass();
            glass.position.set(i * 0.8, 1.4, -2.5);
            bottleGroup.add(glass);
        }

        this.scene.add(bottleGroup);
    }

    createBottle(color) {
        const bottleGroup = new THREE.Group();

        const bodyGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.6, 8);
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: color,
            transparent: true,
            opacity: 0.8,
        });
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
        const glassMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.4,
        });
        return new THREE.Mesh(glassGeometry, glassMaterial);
    }
}