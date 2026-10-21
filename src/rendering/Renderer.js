import * as THREE from 'three';
import { OutlineEffect } from 'three/examples/jsm/effects/OutlineEffect';
import { CSS3DRenderer } from 'three/examples/jsm/renderers/CSS3DRenderer';

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

        // HTML in 3D (the projectors' YouTube iframes) is drawn by a CSS3D layer
        // *under* the transparent WebGL canvas; meshes that write alpha 0 let it
        // show through (see Projector).
        if (!this.cssRenderer) {
            this.cssRenderer = new CSS3DRenderer();
            const cssElement = this.cssRenderer.domElement;
            cssElement.id = 'css3d-layer';
            document.body.insertBefore(cssElement, this.renderer.domElement);
            this.renderer.domElement.id = 'webgl-layer';
        }
        this.cssRenderer.setSize(window.innerWidth, window.innerHeight);

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
            this.cssRenderer?.render(this.scene.getScene(), this.camera.getCamera());
        }
    }

    updateSize(width, height) {
        this.renderer.setSize(width, height);
        if (this.outlineEffect) {
            this.outlineEffect.setSize(width, height);
        }
        this.cssRenderer?.setSize(width, height);
    }
}