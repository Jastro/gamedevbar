import * as THREE from 'three';

export class World {
    constructor(scene) {
        this.scene = scene;
    }

    create() {
        this.createFloor();
        this.createWalls();
    }

    createFloor() {
        const floorGeometry = new THREE.PlaneGeometry(30, 20);
        const floorTexture = new THREE.TextureLoader().load(
            "https://threejs.org/examples/textures/hardwood2_diffuse.jpg"
        );
        floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping;
        floorTexture.repeat.set(8, 6);
        const floorMaterial = new THREE.MeshStandardMaterial({
            map: floorTexture,
            roughness: 0.8,
        });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);
    }

    createWalls() {
        const wallMaterial = new THREE.MeshStandardMaterial({
            color: 0xf0e6d2,
            roughness: 0.7,
        });

        // Pared trasera
        const backWallGeometry = new THREE.BoxGeometry(30, 8, 0.2);
        const backWall = new THREE.Mesh(backWallGeometry, wallMaterial);
        backWall.position.set(0, 4, -10);
        this.scene.add(backWall);

        // Paredes laterales
        const sideWallGeometry = new THREE.BoxGeometry(0.2, 8, 20);
        const leftWall = new THREE.Mesh(sideWallGeometry, wallMaterial);
        leftWall.position.set(-15, 4, 0);
        this.scene.add(leftWall);

        const rightWall = new THREE.Mesh(sideWallGeometry, wallMaterial);
        rightWall.position.set(15, 4, 0);
        this.scene.add(rightWall);

        // Pared frontal
        const frontWallGeometry = new THREE.BoxGeometry(30, 8, 0.2);
        const frontWall = new THREE.Mesh(frontWallGeometry, wallMaterial);
        frontWall.position.set(0, 4, 10);
        this.scene.add(frontWall);
    }
}