import * as THREE from 'three';

export class Renderer {
    constructor(scene, camera) {
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.scene = scene;
        this.camera = camera;
        this.init();
    }

    init() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        document.body.appendChild(this.renderer.domElement);
    }

    render() {
        this.renderer.render(this.scene.getScene(), this.camera.getCamera());
    }

    updateSize(width, height) {
        this.renderer.setSize(width, height);
    }
}