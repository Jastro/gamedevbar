import * as THREE from 'three';

export class Lighting {
    constructor(scene) {
        this.scene = scene;
        this.setupLighting();
    }

    setupLighting() {
        // Luz ambiental
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        // Luz direccional
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 10, 10);
        directionalLight.castShadow = true;
        this.scene.add(directionalLight);
    }
}