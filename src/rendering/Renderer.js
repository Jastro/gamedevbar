import * as THREE from 'three';
import { OutlineEffect } from 'three/examples/jsm/effects/OutlineEffect';

export class Renderer {
    constructor(scene, camera) {
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: true
        });
        this.scene = scene;
        this.camera = camera;
        this.init();
    }

    init() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        document.body.appendChild(this.renderer.domElement);

        // Configurar el efecto outline
        this.outlineEffect = new OutlineEffect(this.renderer, {
            defaultThickness: 0.003,
            defaultColor: [0, 0, 0],
            defaultAlpha: 0.8,
            defaultKeepAlive: true
        });
    }

    render() {
        // Asegurarse de que la escena y la cámara existen
        if (this.scene.getScene() && this.camera.getCamera()) {
            this.outlineEffect.render(this.scene.getScene(), this.camera.getCamera());
        }
    }

    updateSize(width, height) {
        this.renderer.setSize(width, height);
        if (this.outlineEffect) {
            this.outlineEffect.setSize(width, height);
        }
    }
}