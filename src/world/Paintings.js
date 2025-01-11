import * as THREE from 'three';

export class Paintings {
    constructor(scene) {
        this.scene = scene;
        this.paintings = new Map();
    }

    create() {
        const paintingPositions = [
            { x: -12, y: 4, z: -9.8, rotation: 0 },
            { x: -8, y: 4, z: -9.8, rotation: 0 },
            { x: -4, y: 4, z: -9.8, rotation: 0 },
            { x: 0, y: 4, z: -9.8, rotation: 0 },
            { x: 4, y: 4, z: -9.8, rotation: 0 },
            { x: 8, y: 4, z: -9.8, rotation: 0 },
            { x: 12, y: 4, z: -9.8, rotation: 0 },
            { x: 14.8, y: 4, z: -6, rotation: 4.7 },
            { x: 14.8, y: 4, z: -2, rotation: 4.7 },
            { x: 14.8, y: 4, z: 2, rotation: 4.7 },
            { x: 14.8, y: 4, z: 6, rotation: 4.7 },
            { x: -14.8, y: 4, z: -6, rotation: -4.7 },
            { x: -14.8, y: 4, z: -2, rotation: -4.7 },
            { x: -14.8, y: 4, z: 2, rotation: -4.7 },
            { x: -14.8, y: 4, z: 6, rotation: -4.7 },
        ];

        paintingPositions.forEach((pos, index) => {
            this.createPainting(pos.x, pos.y, pos.z, pos.rotation, index);
        });
    }

    createPainting(x, y, z, rotation, index) {
        const frameGeometry = new THREE.BoxGeometry(2, 2, 0.1);
        const frameMaterial = new THREE.MeshStandardMaterial({
            color: 0x8b4513,
            roughness: 0.5,
        });
        const frame = new THREE.Mesh(frameGeometry, frameMaterial);

        const canvasGeometry = new THREE.PlaneGeometry(1.8, 1.8);
        const canvas = document.createElement("canvas");
        canvas.width = 512;
        canvas.height = 512;
        const context = canvas.getContext("2d");

        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = "#000000";
        context.font = "20px Arial";
        context.textAlign = "center";
        context.fillText(
            `Cuadro ${index + 1}`,
            canvas.width / 2,
            canvas.height / 2
        );

        const texture = new THREE.CanvasTexture(canvas);
        const canvasMaterial = new THREE.MeshBasicMaterial({
            map: texture,
        });
        const canvasMesh = new THREE.Mesh(canvasGeometry, canvasMaterial);
        canvasMesh.position.z = 0.06;

        const paintingGroup = new THREE.Group();
        paintingGroup.add(frame);
        paintingGroup.add(canvasMesh);
        paintingGroup.position.set(x, y, z);
        paintingGroup.rotation.y = rotation;

        this.scene.add(paintingGroup);

        this.paintings.set(paintingGroup.id, {
            group: paintingGroup,
            canvas: canvas,
            context: context,
            texture: texture,
        });
    }

    loadImage(paintingId, imageUrl) {
        const painting = this.paintings.get(paintingId);
        if (!painting) return;

        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => {
            const { canvas, context, texture } = painting;
            context.clearRect(0, 0, canvas.width, canvas.height);
            context.drawImage(img, 0, 0, canvas.width, canvas.height);
            texture.needsUpdate = true;
        };
        img.src = imageUrl;
    }

    getPaintingsInfo() {
        const info = [];
        this.paintings.forEach((painting, id) => {
            const worldPos = new THREE.Vector3();
            painting.group.getWorldPosition(worldPos);
            info.push({
                id: id,
                position: worldPos,
                rotation: painting.group.rotation.y,
            });
        });
        return info;
    }
}