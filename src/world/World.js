import * as THREE from 'three';
import { CollisionManager } from './CollisionManager';

export class World {
    constructor(scene) {
        this.scene = scene.getScene();
        this.collisionManager = new CollisionManager();
    }

    create() {
        this.createFloor();
        this.createWalls();
        this.createBarArea();
    }

    createFloor() {
        const floorGeometry = new THREE.PlaneGeometry(30, 20, 1, 1);
        const textureLoader = new THREE.TextureLoader();
        
        const floorMaterial = new THREE.MeshToonMaterial({
            roughness: 0.8,
            metalness: 0.1,
            side: THREE.DoubleSide,
            gradientMap: this.createToonGradient()
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
        
        this.scene.add(floor);
    }

    createWalls() {
        const wallMaterial = new THREE.MeshToonMaterial({
            color: 0xf0e6d2,
            roughness: 0.7,
            gradientMap: this.createToonGradient()
        });

        // Pared trasera
        const backWallGeometry = new THREE.BoxGeometry(30, 8, 0.2);
        const backWall = new THREE.Mesh(backWallGeometry, wallMaterial);
        backWall.position.set(0, 4, -10);
        backWall.castShadow = true;
        backWall.receiveShadow = true;
        this.scene.add(backWall);
        this.collisionManager.addCollider(backWall);

        // Paredes laterales
        const sideWallGeometry = new THREE.BoxGeometry(0.2, 8, 20);
        const leftWall = new THREE.Mesh(sideWallGeometry, wallMaterial);
        leftWall.position.set(-15, 4, 0);
        leftWall.castShadow = true;
        leftWall.receiveShadow = true;
        this.scene.add(leftWall);
        this.collisionManager.addCollider(leftWall);

        const rightWall = new THREE.Mesh(sideWallGeometry, wallMaterial);
        rightWall.position.set(15, 4, 0);
        rightWall.castShadow = true;
        rightWall.receiveShadow = true;
        this.scene.add(rightWall);
        this.collisionManager.addCollider(rightWall);

        // Pared frontal
        const frontWallGeometry = new THREE.BoxGeometry(30, 8, 0.2);
        const frontWall = new THREE.Mesh(frontWallGeometry, wallMaterial);
        frontWall.position.set(0, 4, 10);
        frontWall.castShadow = true;
        frontWall.receiveShadow = true;
        this.scene.add(frontWall);
        this.collisionManager.addCollider(frontWall);
    }

    createBarArea() {
        const barMaterial = new THREE.MeshToonMaterial({
            color: 0x8b4513,
            roughness: 0.6,
            metalness: 0.1,
            gradientMap: this.createToonGradient()
        });

        // Barra principal
        const barGeometry = new THREE.BoxGeometry(12, 1.2, 2);
        const bar = new THREE.Mesh(barGeometry, barMaterial);
        bar.position.set(0, 0.7, -3);
        bar.castShadow = true;
        bar.receiveShadow = true;
        this.scene.add(bar);
        this.collisionManager.addCollider(bar);

        // Estantería trasera
        const backBarGeometry = new THREE.BoxGeometry(12, 3, 0.5);
        const backBar = new THREE.Mesh(backBarGeometry, barMaterial);
        backBar.position.set(0, 1.5, -7);
        backBar.castShadow = true;
        backBar.receiveShadow = true;
        this.scene.add(backBar);
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

    update() {
        this.collisionManager.update();
    }

    checkCollision(position) {
        return this.collisionManager.checkCollision(position);
    }
}